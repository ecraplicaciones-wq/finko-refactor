// ─────────────────────────────────────────────────────────────────────────────
// Finko Pro — Módulo de Persistencia v4
//
// Responsabilidades:
//   1. VERSIONING   — S._version + función migrar() para actualizaciones de schema
//   2. GUARDADO     — save() con monitor de espacio antes de cada write
//   3. CARGA        — loadData() → migrar() → inicializar campos faltantes
//   4. ARCHIVADO    — archivarHistorialAntiguo() para controlar crecimiento
//   5. DIAGNÓSTICO  — medirUso() + verificarEspacio() para métricas en UI
// ─────────────────────────────────────────────────────────────────────────────
import { S, resetAppState } from './state.js';

export const STORAGE_KEY    = 'fco_v4';
export const CURRENT_VERSION = 7;

// Límite práctico: 5 MB - 50 KB de margen de seguridad
const LIMITE_BYTES     = 5 * 1024 * 1024;
const UMBRAL_AVISO     = 0.75;  // 75% → banner amarillo
const UMBRAL_CRITICO   = 0.90;  // 90% → archivar historial viejo automáticamente
const MAX_HISTORIAL    = 24;    // máx quincenas guardadas ≈ 2 años

// ─── SNAPSHOTS ROTATIVOS (defensa contra corrupción) ──────────────────────────
// Cada save() escribe el JSON también en uno de estos slots, rotando. Si
// `fco_v4` se corrompe (escritura interrumpida, bug, quota a media escritura),
// loadData() se cae al snapshot más reciente que parsee bien. Defensa de capas
// junto con el banner de respaldo cada 30 días — el respaldo es del usuario,
// el snapshot es interno y automático.
export const SNAPSHOT_KEYS       = ['fco_v4_snap_a', 'fco_v4_snap_b', 'fco_v4_snap_c'];
export const SNAPSHOT_CURSOR_KEY = 'fco_v4_snap_cursor';

// ─── CONTROL DE ESCRITURA ─────────────────────────────────────────────────────
let _saveTimer = null;  // id del setTimeout pendiente
let _savePendiente = false; // hay datos sin persistir en disco

// ─── 1. VERSIONING: MIGRACIONES ──────────────────────────────────────────────
/**
 * Transforma el objeto `data` desde `fromVersion` hasta CURRENT_VERSION.
 * Cada bloque es idempotente — puede aplicarse más de una vez sin daño.
 * Al agregar features nuevas, se agrega un bloque `if (v < N)` aquí.
 */
function _migrar(data, fromVersion) {
  let v = fromVersion || 0;
  const d = data;

  // ── v0 / v1 → v2: agregar gastosFijos y pagosAgendados ───────────────────
  if (v < 2) {
    if (!Array.isArray(d.gastosFijos))    d.gastosFijos    = [];
    if (!Array.isArray(d.pagosAgendados)) d.pagosAgendados = [];
    v = 2;
  }

  // ── v2 → v3: agregar inversiones y fondoEmergencia ────────────────────────
  if (v < 3) {
    if (!Array.isArray(d.inversiones))  d.inversiones = [];
    if (!d.fondoEmergencia || typeof d.fondoEmergencia !== 'object') {
      d.fondoEmergencia = { objetivoMeses: 6, actual: 0 };
    }
    // Normalizar deudas viejas: asegurar campo pagado numérico
    if (Array.isArray(d.deudas)) {
      d.deudas.forEach(deu => {
        if (typeof deu.pagado !== 'number') deu.pagado = 0;
        if (typeof deu.cuota  !== 'number') deu.cuota  = 0;
        if (typeof deu.total  !== 'number') deu.total  = 0;
      });
    }
    v = 3;
  }

  // ── v3 → v4: agregar bolsillos y logros ───────────────────────────────────
  if (v < 4) {
    if (!Array.isArray(d.bolsillos)) d.bolsillos = [];
    if (!d.logros || typeof d.logros !== 'object') {
      d.logros = { desbloqueados: [], vistos: [], rachas: {} };
    }
    // Normalizar gastos viejos: asegurar campos booleanos y deudaId
    if (Array.isArray(d.gastos)) {
      d.gastos.forEach(g => {
        if (typeof g.hormiga    !== 'boolean') g.hormiga    = g.tipo === 'hormiga';
        if (typeof g.cuatroXMil !== 'boolean') g.cuatroXMil = false;
        if (g.deudaId === undefined)           g.deudaId    = null;
      });
    }
    v = 4;
  }

  if (v < 5) {
    if (Array.isArray(d.cuentas) && d.cuentas.length > 0 && d.saldos) {
      const totalCtas = d.cuentas.reduce((s, c) => s + (c.saldo || 0), 0);
      if (Math.abs((d.saldos.banco || 0) - totalCtas) < 1) {
        d.saldos.banco = 0;
      }
    }
    v = 5;
  }

  // ── v5 → v6: agregar meDeben (R3 — préstamos a terceros) ──────────────────
  if (v < 6) {
    if (!Array.isArray(d.meDeben)) d.meDeben = [];
    v = 6;
  }

  // ── v6 → v7: agregar lastBackupAt (banner de respaldo cada 30 días) ──────
  if (v < 7) {
    if (typeof d.lastBackupAt === 'undefined') d.lastBackupAt = null;
    v = 7;
  }

  d._version = CURRENT_VERSION;
  return d;
}

// ─── 2. GUARDADO ─────────────────────────────────────────────────────────────

/**
 * Mide el uso actual del localStorage de Finko.
 * Devuelve { bytes, pct, label, estado } para usar en UI.
 */
export function medirUso() {
  try {
    const raw   = localStorage.getItem(STORAGE_KEY) || '';
    // UTF-16 en JS → 2 bytes por carácter
    const bytes = raw.length * 2;
    const pct   = bytes / LIMITE_BYTES;
    const kb    = (bytes / 1024).toFixed(1);
    const mb    = (bytes / (1024 * 1024)).toFixed(2);
    const label = bytes > 1024 * 100 ? `${mb} MB` : `${kb} KB`;
    const estado = pct >= UMBRAL_CRITICO ? 'critico'
                 : pct >= UMBRAL_AVISO   ? 'aviso'
                 :                         'ok';
    return { bytes, pct: Math.min(pct, 1), label, estado };
  } catch {
    return { bytes: 0, pct: 0, label: '?', estado: 'ok' };
  }
}

/**
 * Si el almacenamiento está en zona crítica, reduce el historial usando una
 * estrategia en dos pasos:
 *
 *   1. **Compactación inteligente** (no destructiva). Fusiona los quincenales
 *      antiguos del mismo mes en un solo entry mensual. Conserva los totales —
 *      el usuario sigue pudiendo ver "Abr/2024 = ingreso X, gastado Y".
 *   2. **Slice destructivo** solo si tras compactar todavía hay >MAX_HISTORIAL.
 *      A esa altura los entries ya son agregados mensuales/anuales, así que la
 *      pérdida es de información antigua y de granularidad menor.
 *
 * No muestra diálogos: opera silenciosamente para no interrumpir el flujo.
 *
 * @returns {number} cantidad total de entries reducidos (compactados + podados).
 */
export function archivarHistorialAntiguo() {
  if (!Array.isArray(S.historial) || S.historial.length <= MAX_HISTORIAL) return 0;

  const antes = S.historial.length;

  // ── Paso 1: compactación inteligente (sin pérdida de totales) ──────────────
  const r = compactarHistorial(S.historial, { quincenalesProtegidos: 6 });
  if (r && r.compactado) {
    S.historial = r.compactado;
    if (r.mesesAgregados > 0) {
      console.info(`[Finko] Historial compactado: ${r.mesesAgregados} mes(es) agregados de quincenal a mensual. Reducción: ${r.reduccion} entry(s).`);
    }
  }

  // ── Paso 2: si aún excede el límite, podar lo más antiguo (destructivo) ────
  if (S.historial.length > MAX_HISTORIAL) {
    const podados = S.historial.length - MAX_HISTORIAL;
    S.historial = S.historial.slice(0, MAX_HISTORIAL);
    console.info(`[Finko] Historial podado: ${podados} período(s) archivado(s). Exportá un backup si los necesitás.`);
  }

  return antes - S.historial.length;
}

/**
 * Verifica el espacio antes de guardar. Si está en zona crítica, archiva
 * historial viejo. Si está en zona de aviso, notifica al usuario via banner.
 * @returns {'ok' | 'aviso' | 'critico'}
 */
export function verificarEspacio() {
  const uso = medirUso();
  if (uso.estado === 'critico') {
    const podados = archivarHistorialAntiguo();
    if (podados > 0) {
      // Avisar por sr() si está disponible (no bloquear con un modal)
      window.sr?.(`Se archivaron ${podados} períodos viejos para liberar espacio. Exportá un backup para no perder esa información.`);
    }
    _mostrarBannerEspacio(uso);
  } else if (uso.estado === 'aviso') {
    _mostrarBannerEspacio(uso);
  } else {
    _ocultarBannerEspacio();
  }
  return uso.estado;
}

/** Inyecta o actualiza el banner de espacio en la UI. */
function _mostrarBannerEspacio(uso) {
  let b = document.getElementById('finko-storage-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'finko-storage-banner';
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    Object.assign(b.style, {
      position:     'fixed',
      top:          '0',
      left:         '0',
      right:        '0',
      padding:      '8px 16px',
      fontSize:     '12px',
      fontWeight:   '600',
      fontFamily:   'var(--ff, sans-serif)',
      zIndex:       '9997',
      textAlign:    'center',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      gap:          '10px',
    });
    document.body.appendChild(b);
  }

  const esCritico = uso.estado === 'critico';
  const pct = Math.round(uso.pct * 100);

  Object.assign(b.style, {
    background: esCritico ? 'rgba(255,68,68,.95)' : 'rgba(255,214,10,.95)',
    color:      esCritico ? '#fff' : '#000',
  });

  b.innerHTML = esCritico
    ? `🚨 <strong>Almacenamiento casi lleno (${pct}%  —  ${uso.label})</strong>. Exportá un backup ahora para no perder datos. <button data-action="exportarDatos" style="background:#fff;color:#c00;border:none;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px;">📥 Exportar ya</button>`
    : `⚠️ Tu almacenamiento va al <strong>${pct}%</strong> (${uso.label} de ~5 MB). Exportá un backup pronto. <button data-action="dismissStorageBanner" style="background:none;border:none;font-size:15px;cursor:pointer;padding:0 4px;" aria-label="Cerrar aviso">×</button>`;
}

function _ocultarBannerEspacio() {
  document.getElementById('finko-storage-banner')?.remove();
}

/**
 * Agenda una escritura en localStorage con debounce de 200ms.
 * Si se llama 10 veces seguidas, solo escribe 1 vez al final.
 * Flush inmediato garantizado al cerrar o minimizar el tab.
 */
export function save() {
  _savePendiente = true;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSave, 200);
}

/**
 * Escribe S en localStorage. Llamada por el timer o por el flush forzado.
 */
function _flushSave() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (!_savePendiente) return;
  _savePendiente = false;
  try {
    verificarEspacio();
    S._version = CURRENT_VERSION;
    const json = JSON.stringify(S);
    localStorage.setItem(STORAGE_KEY, json);
    _writeSnapshot(json);   // ← solo si el principal funcionó
  } catch (e) {
    // QuotaExceededError — el único error esperado aquí
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.error('[Finko] localStorage lleno. Intentando liberar espacio...');
      archivarHistorialAntiguo();
      try {
        const json = JSON.stringify(S);
        localStorage.setItem(STORAGE_KEY, json);
        _writeSnapshot(json);
        window.sr?.('Espacio liberado. Se archivaron períodos viejos para poder guardar.');
      } catch (e2) {
        console.error('[Finko] No fue posible guardar ni tras liberar espacio:', e2);
        window.showAlert?.(
          '🚨 Tu almacenamiento está lleno y no se pudo guardar.\n\nExportá un backup inmediatamente para no perder tus datos.',
          'Error crítico de almacenamiento'
        );
      }
    } else {
      console.error('[Finko] Error inesperado al guardar:', e);
    }
  }
}

// ─── SNAPSHOTS: ESCRITURA Y SELECCIÓN ─────────────────────────────────────────

/**
 * Lee el cursor persistido (0..N-1). Si no existe o es inválido, devuelve 0.
 * El cursor sobrevive reloads — sin esto, cada sesión sobreescribiría el slot 0.
 */
function _readSnapCursor() {
  try {
    const v = +localStorage.getItem(SNAPSHOT_CURSOR_KEY);
    return Number.isInteger(v) && v >= 0 && v < SNAPSHOT_KEYS.length ? v : 0;
  } catch { return 0; }
}

/**
 * Escribe `json` (ya serializado, idéntico al principal) en el slot rotativo
 * actual y marca su timestamp en la clave lateral `<key>_at`. Avanza el cursor.
 * Falla silenciosamente — el snapshot es un best-effort, no debe romper save().
 */
function _writeSnapshot(json) {
  if (typeof localStorage === 'undefined') return;
  try {
    const cursor = _readSnapCursor();
    const key    = SNAPSHOT_KEYS[cursor];
    localStorage.setItem(key, json);
    localStorage.setItem(key + '_at', String(Date.now()));
    const next = (cursor + 1) % SNAPSHOT_KEYS.length;
    localStorage.setItem(SNAPSHOT_CURSOR_KEY, String(next));
  } catch {
    // QuotaExceededError u otra falla — el principal ya está guardado, no es fatal
  }
}

/**
 * Pure: dado un array de candidatos `{ json, ts }` (cualquiera puede ser null/
 * inválido), devuelve `{ json, parsed, ts }` del más reciente que parsee a un
 * objeto con shape mínima conocida — al menos uno de los arrays de dominio
 * presentes (gastos / cuentas / deudas / bolsillos). Si ninguno sirve, null.
 *
 * Sin acceso a localStorage ni window — totalmente testeable.
 */
export function seleccionarMejorSnapshot(candidatos) {
  if (!Array.isArray(candidatos)) return null;
  let mejor = null;
  for (const c of candidatos) {
    if (!c || typeof c.json !== 'string' || c.json.length === 0) continue;
    let parsed;
    try { parsed = JSON.parse(c.json); } catch { continue; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const tieneShape =
      Array.isArray(parsed.gastos)    ||
      Array.isArray(parsed.cuentas)   ||
      Array.isArray(parsed.deudas)    ||
      Array.isArray(parsed.bolsillos);
    if (!tieneShape) continue;
    const ts = Number.isFinite(+c.ts) ? +c.ts : 0;
    if (!mejor || ts > mejor.ts) mejor = { json: c.json, parsed, ts };
  }
  return mejor;
}

// ─── COMPACTACIÓN INTELIGENTE DEL HISTORIAL ──────────────────────────────────
// archivarHistorialAntiguo() truncaba con slice() — pérdida pura. La compactación
// preserva los totales mensuales fusionando los quincenales viejos en un solo
// entry por mes. El último año aproximado se mantiene quincenal para que la
// comparativa Q-vs-Q anterior siga funcionando bien; los meses más viejos
// quedan como un agregado "Abr/2026 (mes)" con `compactado:'mes'` y `n:2`.

const _MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/** "2026-04" → "Abr/2026". Sin locale dependencies — es determinístico para tests. */
function _labelMesCompacto(mes) {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  const idx = parseInt(m[2], 10) - 1;
  if (idx < 0 || idx > 11) return mes;
  return `${_MESES_CORTOS[idx]}/${m[1]}`;
}

/** Funde N quincenales del mismo mes en un solo entry con totales sumados. */
function _agregarEntriesPorMes(entries, mes) {
  let ingreso = 0, gastado = 0, ahorro = 0, hormiga = 0;
  const catMap = {};
  let idMax = 0;

  for (const h of entries) {
    if (typeof h.id === 'number' && h.id > idMax) idMax = h.id;
    ingreso += Number(h.ingreso) || 0;
    gastado += Number(h.gastado) || 0;
    ahorro  += Number(h.ahorro)  || 0;
    hormiga += Number(h.hormiga) || 0;
    if (h.catMap && typeof h.catMap === 'object') {
      for (const [k, v] of Object.entries(h.catMap)) {
        catMap[k] = (catMap[k] || 0) + (Number(v) || 0);
      }
    }
  }

  return {
    id: idMax,
    periodo: _labelMesCompacto(mes),
    mes,
    ingreso,
    gastado,
    ahorro,
    hormiga,
    catMap,
    compactado: 'mes',
    n: entries.length,
  };
}

/**
 * Pure: compacta entries antiguos del historial fusionando quincenas del mismo
 * mes. Los últimos N quincenales se preservan tal cual (default 6 = ~3 meses
 * recientes con detalle quincenal). Los más viejos se agrupan por `mes`; cuando
 * un mes aporta ≥2 quincenales a la zona vieja se funden en un único entry con
 * `compactado:'mes'` y `n:cantidad`. Meses con un solo quincenal se preservan
 * intactos (no hay nada que ganar fusionando uno solo).
 *
 * Sin acceso a `S`, localStorage ni `Date.now()` — totalmente testeable.
 *
 * @param {Array} historial — ordenado del más reciente al más antiguo.
 * @param {{quincenalesProtegidos?:number}} [config]
 * @returns {null | {compactado:Array, antes:number, despues:number, reduccion:number, mesesAgregados:number}}
 */
export function compactarHistorial(historial, config = {}) {
  if (!Array.isArray(historial)) return null;

  const cfg = (config && typeof config === 'object') ? config : {};
  const protegidos = Number.isFinite(cfg.quincenalesProtegidos)
    ? cfg.quincenalesProtegidos
    : 6;
  if (protegidos < 0) return null;

  const recientes = historial.slice(0, protegidos);
  const viejos    = historial.slice(protegidos);

  if (viejos.length === 0) {
    return {
      compactado: historial.slice(),
      antes: historial.length,
      despues: historial.length,
      reduccion: 0,
      mesesAgregados: 0,
    };
  }

  // Agrupar viejos por mes válido. Los corruptos (sin `mes` válido) se separan
  // y se preservan al final — no podemos agregarlos sin riesgo de mezclar años.
  const grupos = new Map();
  const sinMes = [];

  for (const h of viejos) {
    if (!h || typeof h !== 'object') continue;
    if (typeof h.mes !== 'string' || !/^\d{4}-\d{2}$/.test(h.mes)) {
      sinMes.push(h);
      continue;
    }
    if (!grupos.has(h.mes)) grupos.set(h.mes, []);
    grupos.get(h.mes).push(h);
  }

  const compactos = [];
  let mesesAgregados = 0;
  for (const [mes, entries] of grupos.entries()) {
    if (entries.length === 1) {
      compactos.push(entries[0]);  // un solo quincenal: nada que fusionar
      continue;
    }
    compactos.push(_agregarEntriesPorMes(entries, mes));
    mesesAgregados += 1;
  }

  // Más reciente primero — coincide con el orden del historial pre-compact.
  compactos.sort((a, b) => (b.mes || '').localeCompare(a.mes || ''));

  const compactado = [...recientes, ...compactos, ...sinMes];

  return {
    compactado,
    antes: historial.length,
    despues: compactado.length,
    reduccion: historial.length - compactado.length,
    mesesAgregados,
  };
}

/**
 * Lee los 3 slots de localStorage y delega a `seleccionarMejorSnapshot`.
 * Wrapper con efectos. Devuelve `{ parsed, ts }` o null.
 */
function _restaurarDesdeSnapshots() {
  if (typeof localStorage === 'undefined') return null;
  const candidatos = SNAPSHOT_KEYS.map(k => {
    let json = null, ts = 0;
    try { json = localStorage.getItem(k); }            catch {}
    try { ts   = +localStorage.getItem(k + '_at') || 0; } catch {}
    return { json, ts };
  });
  return seleccionarMejorSnapshot(candidatos);
}

// ─── NORMALIZACIÓN DE OBJETIVOS (DATA INTEGRITY) ────────────────────────────────
/**
 * Pure: normaliza un array de objetivos, corrigiendo inconsistencias silenciosamente.
 *
 * El usuario puede importar backups viejos o editar JSON manualmente, causando:
 * - ahorrado > objetivoAhorro (sobre-ahorrado)
 * - gastado < 0 (gasto negativo)
 * - NaN, undefined en campos numéricos
 * - tipo invalido
 *
 * Normalizaciones aplicadas a cada objetivo:
 *   - id: Math.floor(id) || Date.now()
 *   - nombre: (nombre || '').trim() || 'Sin nombre'
 *   - tipo: ('evento' o 'ahorro', default 'ahorro')
 *   - icono: icono || '🎯'
 *   - fecha: fecha || ''
 *   - objetivoAhorro: Math.max(0, Number(...))
 *   - ahorrado: capeado a [0, objetivoAhorro]
 *   - presupuesto: solo para eventos; 0 para ahorros
 *   - gastado: Math.max(0, Number(...)), solo para eventos
 *   - gastos: array validado
 *   - fechaUltimoAporte: ISO date valida o undefined
 *
 * @param {*} objetivos — candidato a array de objetivos
 * @returns {Array} array normalizado (vacío si input inválido)
 */
export function normalizarObjetivos(objetivos) {
  if (!Array.isArray(objetivos)) return [];
  if (objetivos.length === 0) return [];

  const resultado = [];
  for (const obj of objetivos) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;

    // Determinar tipo primero (afecta el resto de normalizaciones)
    const tipo = obj.tipo === 'evento' ? 'evento' : 'ahorro';

    // Normalizar id: Math.floor(id) || Date.now() — fallback si id no es número válido o es 0
    const id = Math.floor(obj.id) || Date.now();

    // Normalizar campos string
    const nombre = (typeof obj.nombre === 'string' && obj.nombre.trim())
      ? obj.nombre.trim()
      : 'Sin nombre';
    const icono = obj.icono || '🎯';
    const fecha = obj.fecha || '';

    // Normalizar montos numéricos
    const objetivoAhorro = Math.max(0, Number(obj.objetivoAhorro) || 0);
    const ahorrado = tipo === 'evento'
      ? 0  // eventos no tienen "ahorrado", solo presupuesto/gastado
      : Math.max(0, Math.min(Number(obj.ahorrado) || 0, objetivoAhorro));

    const presupuesto = tipo === 'evento'
      ? Math.max(0, Number(obj.presupuesto) || 0)
      : 0;

    const gastado = tipo === 'evento'
      ? Math.max(0, Number(obj.gastado) || 0)
      : 0;

    // Normalizar arrays
    const gastos = Array.isArray(obj.gastos) ? obj.gastos : [];

    // Normalizar fechaUltimoAporte
    const fechaUltimoAporte =
      (typeof obj.fechaUltimoAporte === 'string' && /^\d{4}-\d{2}-\d{2}/.test(obj.fechaUltimoAporte))
        ? obj.fechaUltimoAporte
        : undefined;

    resultado.push({
      id,
      nombre,
      tipo,
      icono,
      fecha,
      objetivoAhorro,
      ahorrado,
      presupuesto,
      gastado,
      gastos,
      fechaUltimoAporte,
    });
  }

  return resultado;
}

// ─── 3. CARGA ─────────────────────────────────────────────────────────────────
export function loadData() {
  // ── 1) Intentar el JSON principal ───────────────────────────────────────────
  let parsed         = null;
  let restauradoDeSnap = false;
  let snapTs           = 0;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        parsed = p;
      }
    }
  } catch (e) {
    console.warn('[Finko] JSON principal corrupto, intentando snapshot…', e);
  }

  // ── 2) Si el principal falló o no existe, probar snapshots rotativos ────────
  if (!parsed) {
    const snap = _restaurarDesdeSnapshots();
    if (snap) {
      parsed             = snap.parsed;
      restauradoDeSnap   = true;
      snapTs             = snap.ts;
      const fechaLegible = snap.ts > 0
        ? new Date(snap.ts).toLocaleString('es-CO')
        : 'sin fecha';
      console.warn(`[Finko] Datos recuperados desde snapshot interno (${fechaLegible}). El JSON principal estaba corrupto o ausente.`);
    }
  }

  // ── 3) Si nada sirvió, estado en blanco ─────────────────────────────────────
  if (!parsed) { resetAppState(); return; }

  try {
    // Migrar al schema actual antes de asignar al estado
    const migrado = _migrar(parsed, parsed._version ?? 0);

    resetAppState();
    Object.assign(S, migrado);

    // Normalizar objetivos: corregir inconsistencias silenciosamente
    if (Array.isArray(S.objetivos)) {
      S.objetivos = normalizarObjetivos(S.objetivos);
    }

    // Guardia final: arrays y objetos críticos
    // (redundante con _migrar pero protege contra JSON externo malformado)
    if (!Array.isArray(S.cuentas))        S.cuentas        = [];
    if (!Array.isArray(S.gastos))         S.gastos         = [];
    if (!Array.isArray(S.objetivos))      S.objetivos      = [];
    if (!Array.isArray(S.deudas))         S.deudas         = [];
    if (!Array.isArray(S.historial))      S.historial      = [];
    if (!Array.isArray(S.gastosFijos))    S.gastosFijos    = [];
    if (!Array.isArray(S.pagosAgendados)) S.pagosAgendados = [];
    if (!Array.isArray(S.inversiones))    S.inversiones    = [];
    if (!Array.isArray(S.bolsillos))      S.bolsillos      = [];
    if (!Array.isArray(S.meDeben))        S.meDeben        = [];
    if (!S.saldos || typeof S.saldos !== 'object') {
      S.saldos = { efectivo: 0, banco: 0 };
    }
    if (!S.fondoEmergencia || typeof S.fondoEmergencia !== 'object') {
      S.fondoEmergencia = { objetivoMeses: 6, actual: 0 };
    }
    if (!S.logros || typeof S.logros !== 'object') {
      S.logros = { desbloqueados: [], vistos: [], rachas: {} };
    }

    // Verificar espacio al cargar — avisa si ya está en zona de riesgo
    const uso = medirUso();
    if (uso.estado !== 'ok') _mostrarBannerEspacio(uso);

    // Aviso al usuario si recuperamos desde snapshot — para que sepa que algo
    // pasó y exporte un backup cuanto antes.
    if (restauradoDeSnap && typeof window !== 'undefined') {
      const fecha = snapTs > 0 ? new Date(snapTs).toLocaleString('es-CO') : 'reciente';
      // sr() es no-bloqueante; no usamos showAlert para no interrumpir el arranque
      window.sr?.(`Tus datos se recuperaron de un respaldo automático interno (${fecha}). Te recomendamos exportar un backup ahora.`);
      // Forzamos un re-save inmediato para reconstituir el JSON principal limpio
      _savePendiente = true;
      _flushSave();
    }

  } catch (e) {
    console.error('[Finko] Error al cargar datos:', e);
    resetAppState();
  }
}

// ─── UNDO DE 1 PASO PARA OPERACIONES DESTRUCTIVAS ────────────────────────────
// Distinto de los snapshots rotativos:
//   - Slot único, dedicado, key separada.
//   - Lo dispara el usuario (resetQuincena, resetTodo, importarDatos), no el
//     debounce de save().
//   - TTL corto (10 min). El undo viejo se considera caducado: si pasaron 10
//     min sin interactuar, ya nadie quiere deshacer ese reset.
//   - Best-effort: si localStorage está lleno, la op destructiva igual procede,
//     simplemente no habrá undo. Nunca bloquea al usuario.
//
// La sobre-escritura es OK: cada destructiva toma su propio undo. Si el usuario
// hace dos resets seguidos, solo puede deshacer el último — esperable para "1 paso".

export const UNDO_KEY    = 'fco_v4_undo';
export const UNDO_TTL_MS = 10 * 60 * 1000;   // 10 minutos

/**
 * Pure: empaqueta un snapshot de undo a partir del estado, una etiqueta legible
 * y un timestamp. No toca localStorage ni Date.now() — totalmente testeable.
 *
 * @param {object} state — snapshot del estado a respaldar (típicamente S).
 * @param {string} label — descripción corta de la op deshacible ("Reset de quincena").
 * @param {number} ts    — timestamp de creación (ms desde epoch).
 * @returns {null | {json:string, label:string, ts:number}}
 */
export function crearSnapshotUndo(state, label, ts) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  if (typeof label !== 'string' || label.length === 0)             return null;
  if (!Number.isFinite(+ts) || +ts <= 0)                           return null;
  let json;
  try { json = JSON.stringify(state); } catch { return null; }
  if (typeof json !== 'string' || json.length === 0)               return null;
  // Estado vacío `{}` o `null` ya serializado → rechazar para no crear un
  // undo inútil que sobreescriba un undo previo todavía válido.
  if (json === '{}' || json === 'null')                            return null;
  return { json, label, ts: +ts };
}

/**
 * Pure: valida un snapshot de undo. Verifica shape, parseabilidad del JSON y
 * frescura (no más viejo que ttlMs respecto a nowMs). Sin acceso a clocks ni
 * a localStorage.
 *
 * @param {*}       snap   — candidato a snapshot.
 * @param {number}  nowMs  — referencia temporal para el cómputo de TTL.
 * @param {number=} ttlMs  — TTL en ms (default UNDO_TTL_MS).
 * @returns {boolean}
 */
export function validarSnapshotUndo(snap, nowMs, ttlMs = UNDO_TTL_MS) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap))         return false;
  if (typeof snap.json  !== 'string' || snap.json.length === 0)         return false;
  if (typeof snap.label !== 'string' || snap.label.length === 0)        return false;
  if (!Number.isFinite(+snap.ts) || +snap.ts <= 0)                      return false;
  if (!Number.isFinite(+nowMs))                                         return false;
  const ttl = (Number.isFinite(+ttlMs) && +ttlMs > 0) ? +ttlMs : UNDO_TTL_MS;
  // Si el snapshot es más viejo que TTL → caducado.
  // Snapshots con ts en el futuro respecto a now (clock skew) se aceptan: no
  // queremos invalidar undo legítimo por un reloj mal sincronizado.
  if (+nowMs - +snap.ts > ttl)                                          return false;
  let parsed;
  try { parsed = JSON.parse(snap.json); } catch { return false; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))   return false;
  return true;
}

/**
 * Captura S y lo escribe en el slot UNDO. Best-effort: si falla la escritura
 * (quota llena, JSON circular, etc.) la op destructiva igual debe proceder.
 * @param {string} label — descripción de la operación, p. ej. "Reset de quincena".
 * @returns {boolean} true si se guardó, false si no se pudo.
 */
export function guardarUndoSnapshot(label) {
  if (typeof localStorage === 'undefined') return false;
  const snap = crearSnapshotUndo(S, label, Date.now());
  if (!snap) return false;
  try {
    localStorage.setItem(UNDO_KEY, JSON.stringify(snap));
    return true;
  } catch {
    // QuotaExceededError u otra falla — no fatal. Sin undo, pero la op procede.
    return false;
  }
}

/** Devuelve el snapshot de undo si existe y es válido; null en caso contrario. */
export function leerUndoSnapshot() {
  if (typeof localStorage === 'undefined') return null;
  let raw = null;
  try { raw = localStorage.getItem(UNDO_KEY); } catch { return null; }
  if (!raw) return null;
  let snap;
  try { snap = JSON.parse(raw); } catch {
    // Slot corrupto — limpiar para no quedar pegado en estado raro.
    try { localStorage.removeItem(UNDO_KEY); } catch {}
    return null;
  }
  if (!validarSnapshotUndo(snap, Date.now())) {
    try { localStorage.removeItem(UNDO_KEY); } catch {}
    return null;
  }
  return snap;
}

/** Atajo booleano por si la UI quiere preguntar si hay algo para deshacer. */
export function tieneUndoDisponible() {
  return leerUndoSnapshot() !== null;
}

/** Borra el slot de undo. Idempotente. */
export function descartarUndo() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(UNDO_KEY); } catch {}
}

/**
 * Restaura S desde el snapshot de undo y borra el slot. Idéntica al flujo de
 * `loadData` pero más liviana: sin migraciones (el snapshot ya es de la versión
 * actual) y sin tocar los snapshots rotativos.
 * @returns {null | {label:string, ts:number}} info del snapshot restaurado.
 */
export function restaurarUndo() {
  const snap = leerUndoSnapshot();
  if (!snap) return null;
  let parsed;
  try { parsed = JSON.parse(snap.json); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  resetAppState();
  Object.assign(S, parsed);

  // Mismas guardias que loadData — defensa contra snapshots ligeramente
  // inconsistentes (importados de versión vieja, edición externa, etc.).
  if (!Array.isArray(S.cuentas))        S.cuentas        = [];
  if (!Array.isArray(S.gastos))         S.gastos         = [];
  if (!Array.isArray(S.objetivos))      S.objetivos      = [];
  if (!Array.isArray(S.deudas))         S.deudas         = [];
  if (!Array.isArray(S.historial))      S.historial      = [];
  if (!Array.isArray(S.gastosFijos))    S.gastosFijos    = [];
  if (!Array.isArray(S.pagosAgendados)) S.pagosAgendados = [];
  if (!Array.isArray(S.inversiones))    S.inversiones    = [];
  if (!Array.isArray(S.bolsillos))      S.bolsillos      = [];
  if (!Array.isArray(S.meDeben))        S.meDeben        = [];
  if (!S.saldos || typeof S.saldos !== 'object') {
    S.saldos = { efectivo: 0, banco: 0 };
  }
  if (!S.fondoEmergencia || typeof S.fondoEmergencia !== 'object') {
    S.fondoEmergencia = { objetivoMeses: 6, actual: 0 };
  }
  if (!S.logros || typeof S.logros !== 'object') {
    S.logros = { desbloqueados: [], vistos: [], rachas: {} };
  }

  // Persistir el rollback inmediatamente y consumir el slot.
  descartarUndo();
  _savePendiente = true;
  _flushSave();

  return { label: snap.label, ts: snap.ts };
}

/**
 * Inyecta un banner no-bloqueante con botón "Deshacer". Si el usuario lo
 * presiona, restaura el snapshot y re-renderiza. Si no, el banner se auto-cierra
 * a los 8s; el undo sigue disponible en localStorage hasta que expire el TTL
 * (10 min) o ocurra otra operación destructiva que lo sobreescriba.
 * @param {string} mensaje — texto opcional; default usa el label del snapshot.
 */
export function mostrarBannerUndo(mensaje) {
  if (typeof document === 'undefined' || !document.body || !document.body.appendChild) return;
  const snap = leerUndoSnapshot();
  if (!snap) return;

  // Limpiar banner previo (evitar duplicados si se dispara dos veces seguidas).
  document.getElementById('finko-undo-banner')?.remove();

  const b = document.createElement('div');
  b.id = 'finko-undo-banner';
  b.setAttribute('role', 'status');
  b.setAttribute('aria-live', 'polite');
  Object.assign(b.style, {
    position:       'fixed',
    bottom:         '16px',
    left:           '50%',
    transform:      'translateX(-50%)',
    padding:        '10px 14px',
    borderRadius:   '10px',
    background:     'rgba(33,150,243,.96)',
    color:          '#fff',
    fontSize:       '13px',
    fontWeight:     '600',
    fontFamily:     'var(--ff, sans-serif)',
    boxShadow:      '0 4px 16px rgba(0,0,0,.25)',
    display:        'flex',
    alignItems:     'center',
    gap:            '12px',
    zIndex:         '9998',
    maxWidth:       '92vw',
  });

  const txt = document.createElement('span');
  txt.textContent = mensaje || `↺ ${snap.label}`;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Deshacer';
  Object.assign(btn.style, {
    background: '#fff', color: '#1565c0', border: 'none',
    borderRadius: '6px', padding: '4px 12px',
    fontSize: '12px', fontWeight: '700', cursor: 'pointer',
  });
  btn.addEventListener('click', () => {
    const r = restaurarUndo();
    if (r) {
      try { window.renderAll?.(); } catch {}
      try { window.go?.('dash'); } catch {}
      window.sr?.(`Operación deshecha: ${r.label}`);
    } else {
      window.sr?.('El undo ya no está disponible.');
    }
    b.remove();
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Cerrar aviso');
  Object.assign(close.style, {
    background: 'transparent', color: '#fff', border: 'none',
    fontSize: '18px', lineHeight: '1', cursor: 'pointer', padding: '0 4px',
  });
  close.addEventListener('click', () => b.remove());

  b.appendChild(txt);
  b.appendChild(btn);
  b.appendChild(close);
  document.body.appendChild(b);

  // Auto-dismiss del banner a los 8s. El undo en localStorage sobrevive más
  // tiempo; el usuario podría hipotéticamente disparar restaurarUndo() desde
  // otro punto futuro mientras siga válido.
  setTimeout(() => { b.remove(); }, 8000);
}

// ─── ATAJO DE TECLADO Ctrl+Z PARA DESHACER ───────────────────────────────────
// Cierra el ciclo del feature de undo: el banner enseña que hay undo, pero el
// usuario eventualmente lo cierra con × y pierde la pista. Ctrl+Z global lo
// trae de vuelta — siempre que la op sea reversible Y el contexto lo permita.

/**
 * Pure: decide si Ctrl+Z (o Cmd+Z) debe disparar el undo dado el contexto
 * del evento. Sin acceso a document, window ni localStorage — testeable.
 *
 * Reglas:
 *   - Tecla 'z' (case insensitive)
 *   - Ctrl o Meta presionado (Cmd en Mac)
 *   - Shift NO presionado (Shift+Ctrl+Z = redo, distinto)
 *   - Target NO es un campo editable (input, textarea, select, contenteditable)
 *     — el usuario podría estar tipeando "z" en un campo
 *   - No hay un modal abierto — preserva el contexto del usuario
 *
 * @param {{
 *   key?:string, ctrlKey?:boolean, metaKey?:boolean, shiftKey?:boolean,
 *   targetTag?:string, targetIsContentEditable?:boolean, modalOpen?:boolean
 * }} ctx
 * @returns {boolean}
 */
export function shouldFireUndoShortcut(ctx) {
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx))                    return false;
  const key = (typeof ctx.key === 'string') ? ctx.key.toLowerCase() : '';
  if (key !== 'z')                                                              return false;
  if (!ctx.ctrlKey && !ctx.metaKey)                                             return false;
  if (ctx.shiftKey === true)                                                    return false;
  const tag = (typeof ctx.targetTag === 'string') ? ctx.targetTag.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')                return false;
  if (ctx.targetIsContentEditable === true)                                     return false;
  if (ctx.modalOpen === true)                                                   return false;
  return true;
}

let _undoShortcutInstalled = false;

/**
 * Instala el listener global de Ctrl+Z. Idempotente: llamarlo dos veces no
 * agrega listeners duplicados. Llamarse desde el bootstrap (events.js _initUI).
 */
export function initUndoShortcut() {
  if (_undoShortcutInstalled) return;
  if (typeof document === 'undefined' || !document.addEventListener) return;
  _undoShortcutInstalled = true;

  document.addEventListener('keydown', (e) => {
    const target = e.target;
    const ctx = {
      key:                     e.key,
      ctrlKey:                 e.ctrlKey,
      metaKey:                 e.metaKey,
      shiftKey:                e.shiftKey,
      targetTag:               target && target.tagName,
      targetIsContentEditable: !!(target && target.isContentEditable),
      // Detectar modal abierto. Los modales de Finko usan `.modal.open`.
      modalOpen:               !!document.querySelector('.modal.open'),
    };
    if (!shouldFireUndoShortcut(ctx)) return;

    // Si el undo expiró o nunca existió, no consumimos el evento — dejamos
    // que el browser haga lo suyo (probablemente undo nativo en algún input
    // que pasamos por alto). Solo notificamos discretamente.
    if (!tieneUndoDisponible()) {
      window.sr?.('No hay operaciones recientes para deshacer.');
      return;
    }

    e.preventDefault();
    const r = restaurarUndo();
    if (r) {
      try { window.renderAll?.(); } catch {}
      try { window.go?.('dash'); } catch {}
      window.sr?.(`Operación deshecha: ${r.label}`);
      // Limpiar el banner de undo si está visible — ya se consumió.
      try { document.getElementById('finko-undo-banner')?.remove(); } catch {}
    }
  });
}

// ─── FLUSH FORZADO AL SALIR ───────────────────────────────────────────────────
// Si el usuario cierra el tab dentro del debounce de 200ms, el timer
// nunca dispara y se pierden los últimos datos. Estos dos eventos garantizan
// que siempre se escribe antes de salir.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _flushSave();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => _flushSave());
}