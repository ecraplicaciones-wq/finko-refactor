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
export const CURRENT_VERSION = 5;

// Límite práctico: 5 MB - 50 KB de margen de seguridad
const LIMITE_BYTES     = 5 * 1024 * 1024;
const UMBRAL_AVISO     = 0.75;  // 75% → banner amarillo
const UMBRAL_CRITICO   = 0.90;  // 90% → archivar historial viejo automáticamente
const MAX_HISTORIAL    = 24;    // máx quincenas guardadas ≈ 2 años

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
 * Si el almacenamiento está en zona crítica, archiva los períodos del historial
 * más antiguos — conserva MAX_HISTORIAL (24) entradas.
 * No muestra diálogos: opera silenciosamente para no interrumpir el flujo.
 */
export function archivarHistorialAntiguo() {
  if (!Array.isArray(S.historial) || S.historial.length <= MAX_HISTORIAL) return 0;
  // El historial está ordenado del más reciente al más antiguo (unshift en cerrarQ)
  const podados = S.historial.length - MAX_HISTORIAL;
  S.historial = S.historial.slice(0, MAX_HISTORIAL);
  console.info(`[Finko] Historial podado: ${podados} período(s) archivado(s). Exportá un backup si los necesitás.`);
  return podados;
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
    ? `🚨 <strong>Almacenamiento casi lleno (${pct}%  —  ${uso.label})</strong>. Exportá un backup ahora para no perder datos. <button onclick="window.exportarDatos?.()" style="background:#fff;color:#c00;border:none;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px;">📥 Exportar ya</button>`
    : `⚠️ Tu almacenamiento va al <strong>${pct}%</strong> (${uso.label} de ~5 MB). Exportá un backup pronto. <button onclick="document.getElementById('finko-storage-banner').remove()" style="background:none;border:none;font-size:15px;cursor:pointer;padding:0 4px;" aria-label="Cerrar aviso">×</button>`;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch (e) {
    // QuotaExceededError — el único error esperado aquí
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.error('[Finko] localStorage lleno. Intentando liberar espacio...');
      archivarHistorialAntiguo();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
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

// ─── 3. CARGA ─────────────────────────────────────────────────────────────────
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { resetAppState(); return; }

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      resetAppState(); return;
    }

    // Migrar al schema actual antes de asignar al estado
    const migrado = _migrar(parsed, parsed._version ?? 0);

    resetAppState();
    Object.assign(S, migrado);

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

  } catch (e) {
    console.error('[Finko] Error al cargar datos:', e);
    resetAppState();
  }
}

// ─── FLUSH FORZADO AL SALIR ───────────────────────────────────────────────────
// Si el usuario cierra el tab dentro del debounce de 200ms, el timer
// nunca dispara y se pierden los últimos datos. Estos dos eventos garantizan
// que siempre se escribe antes de salir.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') _flushSave();
});
window.addEventListener('beforeunload', () => _flushSave());