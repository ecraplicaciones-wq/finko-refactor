import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import { f, he, hoy, setEl, setHtml } from '../infra/utils.js';
import { CATS, CCOLORS } from '../core/constants.js';
import { registerAction } from '../ui/actions.js';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PURAS DEL DOMINIO (R1 auditoría v5)
// ═══════════════════════════════════════════════════════════════════════════════
// Sin S, sin DOM. Las usan los renders y los cálculos de rachas más abajo.

/**
 * Días consecutivos sin gastos hormiga, contados desde el día más reciente
 * con registro hacia atrás. Los días sin ningún registro NO cuentan ni
 * rompen la racha (gaps son neutrales).
 *
 * @param {Array<{fecha:string, hormiga?:boolean, tipo?:string}>} gastos
 * @returns {number} días con registro y sin hormiga (≥ 0).
 */
export function calcularRachaHormiga(gastos) {
  if (!gastos || !gastos.length) return 0;

  // Mapa fecha → "tuvo hormiga ese día?"
  const porFecha = {};
  gastos.forEach(g => {
    if (porFecha[g.fecha] === undefined) porFecha[g.fecha] = false;
    if (g.hormiga || g.tipo === 'hormiga') porFecha[g.fecha] = true;
  });

  // Fechas de más reciente a más antigua
  const fechas = Object.keys(porFecha).sort().reverse();
  let racha = 0;
  for (const f of fechas) {
    if (porFecha[f]) break;
    racha++;
  }
  return racha;
}

/**
 * Quincenas consecutivas con ahorro positivo, contadas desde la más reciente
 * hacia atrás. La quincena en curso suma 1 si `ahorroActual > 0`.
 *
 * @param {Array<{id:number, ahorro?:number}>} historial — quincenas cerradas.
 * @param {number} ahorroActual — total del período en curso (S.gastos tipo
 *                                ahorro). Sumar 1 si > 0.
 * @returns {number} quincenas (≥ 0).
 */
export function calcularRachaAhorro(historial, ahorroActual) {
  // historial ordenado de más reciente a más antiguo (id es timestamp)
  const hist = [...(historial || [])].sort((a, b) => b.id - a.id);

  let racha = ahorroActual > 0 ? 1 : 0;
  for (const h of hist) {
    if ((h.ahorro || 0) > 0) racha++;
    else break;
  }
  return racha;
}

// ─── DETECTOR DE MESES SIN CERRAR ────────────────────────────────────────────
// Caso de uso: el usuario abandona la app por meses, vuelve, y se encuentra
// con un S.gastos gigante donde los gastos abarcan múltiples meses. La quincena
// en curso parece tener "ingresos imposibles vs gastos imposibles" porque la
// app suma todo bajo el mismo período.
//
// Este detector identifica meses en los que hay gastos en S.gastos pero que
// NUNCA fueron cerrados (no hay entry en S.historial con esa `mes`). Excluye
// el mes actual (en curso) y los meses futuros (fechas adelantadas/typos).
//
// La función es pura: no muta nada, no exporta, no auto-archiva. Solo informa.
// La acción la decide el usuario (revisar, exportar backup, eliminar gastos
// huérfanos, o cerrar las quincenas viejas manualmente).

const _MES_RX_HUERFANO = /^(\d{4})-(\d{2})/;

/**
 * Pure: detecta meses con gastos en S.gastos pero sin entry en S.historial.
 *
 * @param {Array<{fecha?:string, monto?:number, montoTotal?:number, tipo?:string}>} gastos
 * @param {Array<{mes?:string}>} historial
 * @param {string} hoyISO 'YYYY-MM-DD' actual.
 * @param {{umbralMinGastos?:number}} [config]
 *   - umbralMinGastos (default 1): ignora meses con menos de N gastos. Subir a
 *     2-3 si querés filtrar gastos sueltos creados por error.
 * @returns {Array<{
 *   mes:string, nGastos:number, total:number,
 *   primerGasto:string, ultimoGasto:string
 * }>} ordenado por `mes` ASC (más viejo primero).
 */
export function detectarMesesSinCerrar(gastos, historial, hoyISO, config = {}) {
  if (!Array.isArray(gastos) || gastos.length === 0) return [];
  if (typeof hoyISO !== 'string')                    return [];
  const mHoy = _MES_RX_HUERFANO.exec(hoyISO);
  if (!mHoy)                                         return [];
  const mesHoy = `${mHoy[1]}-${mHoy[2]}`;

  const cfg = (config && typeof config === 'object') ? config : {};
  const umbral = (Number.isFinite(+cfg.umbralMinGastos) && +cfg.umbralMinGastos > 0)
    ? Math.floor(+cfg.umbralMinGastos)
    : 1;

  // Set de meses ya cerrados (con entry en historial). Robusto contra entries
  // sin `mes` (versiones viejas, manuales): los ignora silenciosamente.
  const cerrados = new Set();
  if (Array.isArray(historial)) {
    for (const h of historial) {
      if (!h || typeof h !== 'object' || typeof h.mes !== 'string') continue;
      const m = _MES_RX_HUERFANO.exec(h.mes);
      if (m) cerrados.add(`${m[1]}-${m[2]}`);
    }
  }

  // Acumular gastos por mes huérfano. Map preserva orden de inserción, pero
  // ordenamos al final igual para no depender del orden del input.
  const acum = new Map();
  for (const g of gastos) {
    if (!g || typeof g !== 'object' || typeof g.fecha !== 'string') continue;
    const mg = _MES_RX_HUERFANO.exec(g.fecha);
    if (!mg) continue;
    const mes = `${mg[1]}-${mg[2]}`;

    // Excluir mes actual y meses futuros. Comparar como string YYYY-MM funciona
    // por orden lexicográfico (mismo orden que cronológico).
    if (mes >= mesHoy)         continue;
    if (cerrados.has(mes))     continue;

    const monto = Number(g.montoTotal) || Number(g.monto) || 0;

    let entry = acum.get(mes);
    if (!entry) {
      entry = {
        mes,
        nGastos: 0,
        total: 0,
        primerGasto: g.fecha,
        ultimoGasto: g.fecha,
      };
      acum.set(mes, entry);
    }
    entry.nGastos += 1;
    entry.total   += monto;
    if (g.fecha < entry.primerGasto) entry.primerGasto = g.fecha;
    if (g.fecha > entry.ultimoGasto) entry.ultimoGasto = g.fecha;
  }

  const out = [];
  for (const entry of acum.values()) {
    if (entry.nGastos >= umbral) out.push(entry);
  }

  // Más viejo primero — refuerza la sensación de "iceberg" cronológico.
  out.sort((a, b) => a.mes.localeCompare(b.mes));
  return out;
}

const _MESES_NOMBRE_HUERFANO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** "2026-03" → "Marzo 2026". Sin locale dependency. */
function _labelMesHuerfano(mes) {
  const m = _MES_RX_HUERFANO.exec(mes);
  if (!m) return mes;
  const idx = parseInt(m[2], 10) - 1;
  if (idx < 0 || idx > 11) return mes;
  return `${_MESES_NOMBRE_HUERFANO[idx]} ${m[1]}`;
}

/**
 * Renderiza la tarjeta "tienes meses sin cerrar" en el dashboard. Si no hay
 * huérfanos, oculta el contenedor. Muestra los 3 meses más viejos (que son los
 * más urgentes — los más nuevos casi-actuales pueden ser parte de la quincena
 * en curso aún sin cerrar).
 */
export function renderMesesSinCerrar() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-meses-sin-cerrar');
  if (!el) return;

  const huerfanos = detectarMesesSinCerrar(S.gastos || [], S.historial || [], hoy());
  if (huerfanos.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = huerfanos.slice(0, 3);
  const filas = top.map(h => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--b1);">
      <div style="min-width:0;">
        <div style="font-weight:700;font-size:13px;color:var(--t1);">${he(_labelMesHuerfano(h.mes))}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:2px;">
          ${h.nGastos} gasto${h.nGastos !== 1 ? 's' : ''} sin archivar · Total: <strong>${f(h.total)}</strong>
        </div>
      </div>
    </div>
  `).join('');

  const titulo = huerfanos.length === 1
    ? 'Tienes 1 mes con gastos sin archivar'
    : `Tienes ${huerfanos.length} meses con gastos sin archivar`;

  const restantes = huerfanos.length > 3
    ? `<div style="font-size:10px;color:var(--t3);padding-top:6px;border-top:1px solid var(--b1);">Y ${huerfanos.length - 3} mes${huerfanos.length - 3 !== 1 ? 'es' : ''} más…</div>`
    : '';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,140,0,.4);background:rgba(255,140,0,.06);">
      <div style="font-size:11px;font-weight:800;color:#ff8c00;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        🗓️ ${he(titulo)}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Hay gastos viejos en tu período actual. Antes de cerrar la quincena, exportá un backup y revisá si querés mantenerlos o limpiarlos.
      </div>
      ${filas}
      ${restantes}
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn bbl bsm" data-action="exportarDatos" aria-label="Exportar respaldo antes de tocar nada">📥 Exportar backup</button>
      </div>
    </div>
  `;
}

// ─── ANÁLISIS DE GASTOS HORMIGA ACUMULADOS (MES CORRIENTE) ───────────────────
// Distinto de:
//   - calcularRachaHormiga: días seguidos sin hormiga (positivo, motivacional).
//   - calcularImpactoHormiga (preview en el formulario): "si hacés esto cada
//     día, $X al año".
// Este es el RETROSPECTIVO: en lo que va del mes actual, ¿cuánto se ha ido en
// hormigas? Top categorías, proyección lineal al fin del mes, severidad por
// % del ingreso. La fuga acumulada — café diario + propina + app store — que
// el usuario no dimensiona porque cada uno es chico.

const _RX_FECHA_HORMIGA = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Pure: analiza el acumulado de gastos hormiga del mes corriente.
 *
 * @param {Array<{fecha?:string, monto?:number, montoTotal?:number, cat?:string,
 *                desc?:string, hormiga?:boolean, tipo?:string}>} gastos
 * @param {number} ingreso — ingreso del período (para % del presupuesto).
 *                           Si <=0 o falsy, se usan thresholds por count.
 * @param {string} hoyISO 'YYYY-MM-DD'.
 * @param {{topN?:number}} [config]
 *   - topN (default 3): cuántas categorías top devolver.
 * @returns {null | {
 *   total:number, nGastos:number,
 *   pctIngreso:number|null,
 *   diasTranscurridos:number,
 *   proyeccionMensual:number,
 *   topCategorias:Array<{cat:string, total:number, n:number}>,
 *   mayorGasto: {desc:string, monto:number, fecha:string, cat:string} | null,
 *   severidad: 'info'|'warn'|'urgent'
 * }} null si no hay hormigas en el mes o inputs inválidos.
 */
export function analizarHormigaAcumulada(gastos, ingreso, hoyISO, config = {}) {
  if (!Array.isArray(gastos) || gastos.length === 0) return null;
  if (typeof hoyISO !== 'string')                    return null;
  const mh = _RX_FECHA_HORMIGA.exec(hoyISO);
  if (!mh)                                           return null;
  const day   = +mh[3];
  const month = +mh[2];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const cfg = (config && typeof config === 'object') ? config : {};
  const topN = (Number.isFinite(+cfg.topN) && +cfg.topN > 0)
    ? Math.floor(+cfg.topN) : 3;

  const mesActual = `${mh[1]}-${mh[2]}`;
  const ing = Number(ingreso) || 0;

  // Filtrar hormigas del mes corriente. Compatible con dos representaciones:
  // - g.hormiga === true (canon nuevo, post-migración v4)
  // - g.tipo === 'hormiga' (canon viejo de pre-migración — defensivo)
  let total = 0;
  let n = 0;
  const porCat = new Map();
  let mayor = null;

  for (const g of gastos) {
    if (!g || typeof g !== 'object')                             continue;
    if (typeof g.fecha !== 'string')                             continue;
    if (!_RX_FECHA_HORMIGA.test(g.fecha))                        continue;
    if (!g.fecha.startsWith(mesActual))                          continue;
    const esHormiga = g.hormiga === true || g.tipo === 'hormiga';
    if (!esHormiga)                                              continue;

    const monto = Number(g.montoTotal) || Number(g.monto) || 0;
    if (monto <= 0)                                              continue;

    total += monto;
    n     += 1;

    const cat = (typeof g.cat === 'string' && g.cat.length > 0) ? g.cat : 'otros';
    const entry = porCat.get(cat);
    if (entry) { entry.total += monto; entry.n += 1; }
    else       { porCat.set(cat, { cat, total: monto, n: 1 }); }

    if (!mayor || monto > mayor.monto) {
      mayor = {
        desc:  (typeof g.desc === 'string' && g.desc.length > 0) ? g.desc : '(sin descripción)',
        monto,
        fecha: g.fecha.slice(0, 10),
        cat,
      };
    }
  }

  if (n === 0) return null;

  // Proyección lineal: total * (30 / diasTranscurridos). Si el mes está justo
  // empezando, da estimación pesimista (bien) en lugar de optimista — el
  // usuario ve el riesgo proyectado y puede corregir.
  const diasTranscurridos = Math.max(1, day);
  const proyeccionMensual = Math.round(total * (30 / diasTranscurridos));

  const pctIngreso = (ing > 0) ? +(total / ing * 100).toFixed(1) : null;

  // Severidad: con ingreso, por %. Sin ingreso, por count.
  let severidad;
  if (ing > 0) {
    if      (pctIngreso >= 15) severidad = 'urgent';
    else if (pctIngreso >= 5)  severidad = 'warn';
    else                       severidad = 'info';
  } else {
    if      (n >= 25) severidad = 'urgent';
    else if (n >= 10) severidad = 'warn';
    else              severidad = 'info';
  }

  // Top N categorías por total desc. Empate → mayor n primero, luego cat asc
  // (alfabético) para orden determinístico en tests.
  const cats = [...porCat.values()];
  cats.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.n !== a.n)         return b.n - a.n;
    return a.cat.localeCompare(b.cat);
  });
  const topCategorias = cats.slice(0, topN);

  return {
    total,
    nGastos: n,
    pctIngreso,
    diasTranscurridos,
    proyeccionMensual,
    topCategorias,
    mayorGasto: mayor,
    severidad,
  };
}

/**
 * Renderiza la tarjeta "hormigas acumuladas este mes" en el dashboard. Solo
 * aparece cuando hay datos suficientes Y la severidad es 'warn' o 'urgent' —
 * en 'info' el dashboard ya está limpio y no vale la pena distraer al usuario.
 */
export function renderHormigaAcumulada() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-hormiga-acum');
  if (!el) return;

  const r = analizarHormigaAcumulada(S.gastos || [], S.ingreso || 0, hoy());
  if (!r || r.severidad === 'info') {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const colorBorde = r.severidad === 'urgent' ? 'rgba(255,68,68,.35)' : 'rgba(255,180,0,.35)';
  const colorFondo = r.severidad === 'urgent' ? 'rgba(255,68,68,.05)' : 'rgba(255,180,0,.05)';
  const colorTitulo = r.severidad === 'urgent' ? '#ff4444' : '#ffb400';

  const ctxIngreso = (r.pctIngreso != null)
    ? ` (<strong>${r.pctIngreso}%</strong> de tu ingreso)`
    : '';

  const filas = r.topCategorias.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--b1);">
      <div style="font-size:12px;color:var(--t1);">
        ${he(c.cat)} <span style="font-size:10px;color:var(--t3);margin-left:6px;">${c.n} gasto${c.n !== 1 ? 's' : ''}</span>
      </div>
      <div class="mono" style="font-size:12px;font-weight:700;color:var(--t1);">${f(c.total)}</div>
    </div>
  `).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:${colorBorde};background:${colorFondo};">
      <div style="font-size:11px;font-weight:800;color:${colorTitulo};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        🐜 Hormigas este mes — ${f(r.total)}${ctxIngreso}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Llevás <strong>${r.nGastos}</strong> gasto${r.nGastos !== 1 ? 's' : ''} chico${r.nGastos !== 1 ? 's' : ''} en ${r.diasTranscurridos} día${r.diasTranscurridos !== 1 ? 's' : ''}. Si seguís el ritmo, terminás el mes en <strong>${f(r.proyeccionMensual)}</strong>.
      </div>
      ${filas}
    </div>
  `;
}

// ─── COMPARACIÓN DE CATEGORÍAS (PERÍODO ACTUAL VS ANTERIOR) ──────────────────
// Complemento a calcularComparacionQuincenas (que compara 4 totales: gastado,
// ahorro, hormiga, ingreso). Esta función compara EL DESGLOSE POR CATEGORÍA —
// donde realmente se ve el cambio de comportamiento.
//
// "Este mes te se fueron $200k MÁS en comida que el anterior" es feedback
// mucho más accionable que "este mes gastaste 12% más". El número agregado
// no dice nada sobre qué hacer; el desglose sí.
//
// Direcciones:
//   - 'subio'       : delta > 0 (gastó más en esa cat este mes)
//   - 'bajo'        : delta < 0
//   - 'igual'       : abs(deltaPct) < 5% (variación irrelevante)
//   - 'nueva'       : cat aparece en actual pero no en anterior
//   - 'desaparecio' : cat aparecía en anterior pero no en actual

/**
 * Pure: compara dos `catMap` y devuelve un análisis estructurado. Cualquier
 * cat ausente en uno de los dos lados se reporta como 'nueva' o 'desaparecio'.
 *
 * @param {{[cat:string]:number}} catMapActual
 * @param {{[cat:string]:number}} catMapAnterior
 * @param {{topN?:number}} [config]
 *   - topN (default 5): cuántas categorías devolver en `categorias`. Las
 *     ordenadas por |delta| desc. Highlights siempre devuelve top 3.
 * @returns {null | {
 *   categorias: Array<{
 *     cat:string, actual:number, anterior:number,
 *     delta:number, deltaPct:number,
 *     direccion: 'subio'|'bajo'|'igual'|'nueva'|'desaparecio'
 *   }>,
 *   highlights: Array<{tipo:'mejora'|'alerta', cat:string, mensaje:string}>,
 *   totalActual:number, totalAnterior:number
 * }} null si los inputs no son objetos válidos.
 */
export function calcularComparacionCategorias(catMapActual, catMapAnterior, config = {}) {
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(catMapActual) && !isObj(catMapAnterior))                return null;

  const cmA = isObj(catMapActual)   ? catMapActual   : {};
  const cmP = isObj(catMapAnterior) ? catMapAnterior : {};

  const cfg = (config && typeof config === 'object') ? config : {};
  const topN = (Number.isFinite(+cfg.topN) && +cfg.topN > 0)
    ? Math.floor(+cfg.topN) : 5;

  // Conjunto unión de todas las categorías presentes en cualquiera de los dos.
  const cats = new Set();
  for (const k of Object.keys(cmA)) cats.add(k);
  for (const k of Object.keys(cmP)) cats.add(k);

  const out = [];
  let totalActual = 0;
  let totalAnterior = 0;

  for (const cat of cats) {
    const actual    = Number(cmA[cat]) || 0;
    const anterior  = Number(cmP[cat]) || 0;
    if (actual <= 0 && anterior <= 0)                                continue;

    totalActual   += actual;
    totalAnterior += anterior;

    const delta    = actual - anterior;
    // pct: si anterior es 0, usamos 100% (cat nueva). Si bajó a 0 desde algo,
    // -100% (cat desapareció). Si ambos > 0, cómputo normal.
    let deltaPct;
    if (anterior <= 0) deltaPct = (actual > 0) ? 100 : 0;
    else               deltaPct = +(delta / anterior * 100).toFixed(1);

    let direccion;
    if      (anterior <= 0 && actual > 0)        direccion = 'nueva';
    else if (anterior > 0  && actual <= 0)       direccion = 'desaparecio';
    else if (Math.abs(deltaPct) < 5)             direccion = 'igual';
    else if (delta > 0)                           direccion = 'subio';
    else                                           direccion = 'bajo';

    out.push({ cat, actual, anterior, delta, deltaPct, direccion });
  }

  // Orden: |delta| desc para que los cambios más grandes en pesos vayan primero.
  // Empate → cat alfabético para determinismo.
  out.sort((a, b) => {
    const da = Math.abs(b.delta) - Math.abs(a.delta);
    if (da !== 0) return da;
    return a.cat.localeCompare(b.cat);
  });

  // Highlights: top 3 con cambios significativos (no 'igual'). Los etiquetamos
  // 'mejora' si gastó menos (bajó o desapareció), 'alerta' si gastó más
  // (subió o cat nueva). El usuario quiere ver dónde mejoró y dónde empeoró.
  const cambios = out.filter(c => c.direccion !== 'igual');
  const highlights = cambios.slice(0, 3).map(c => {
    const esMejora = c.direccion === 'bajo' || c.direccion === 'desaparecio';
    const tipo = esMejora ? 'mejora' : 'alerta';
    let mensaje;
    if (c.direccion === 'nueva') {
      mensaje = `Empezaste a gastar en ${c.cat}`;
    } else if (c.direccion === 'desaparecio') {
      mensaje = `Dejaste de gastar en ${c.cat}`;
    } else if (c.direccion === 'subio') {
      mensaje = `Subió ${c.deltaPct}% en ${c.cat}`;
    } else {
      mensaje = `Bajó ${Math.abs(c.deltaPct)}% en ${c.cat}`;
    }
    return { tipo, cat: c.cat, mensaje };
  });

  return {
    categorias:    out.slice(0, topN),
    highlights,
    totalActual,
    totalAnterior,
  };
}

/**
 * Renderiza la card "vs período anterior — por categoría" en el dashboard.
 * Usa el último entry del historial como referencia. Si no hay historial o
 * gastos del mes actual, oculta el contenedor.
 */
export function renderComparacionCategorias() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-comparacion-categorias');
  if (!el) return;

  // Necesitamos catMap actual (del mes corriente) y el catMap del último
  // entry del historial.
  const prev = (Array.isArray(S.historial) && S.historial.length > 0)
    ? S.historial[0] : null;
  if (!prev || !prev.catMap || typeof prev.catMap !== 'object') {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  // Construir catMap del mes actual desde S.gastos (excluir tipo='ahorro' —
  // el catMap del historial agrupa solo gastos, no ahorros).
  const mesAct = (typeof hoy === 'function' ? hoy() : '').slice(0, 7);
  const catMapActual = {};
  for (const g of (S.gastos || [])) {
    if (!g || typeof g !== 'object')                  continue;
    if (g.tipo === 'ahorro')                          continue;
    if (typeof g.fecha !== 'string')                  continue;
    if (!g.fecha.startsWith(mesAct))                  continue;
    const cat   = (typeof g.cat === 'string' && g.cat.length > 0) ? g.cat : 'otros';
    const monto = Number(g.montoTotal) || Number(g.monto) || 0;
    if (monto <= 0)                                   continue;
    catMapActual[cat] = (catMapActual[cat] || 0) + monto;
  }

  if (Object.keys(catMapActual).length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const r = calcularComparacionCategorias(catMapActual, prev.catMap, { topN: 5 });
  if (!r || r.categorias.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  // Highlights compactos arriba.
  const filasHL = r.highlights.map(h => {
    const color = h.tipo === 'mejora' ? '#00b464' : '#ff8c00';
    const icono = h.tipo === 'mejora' ? '↓' : '↑';
    return `<div style="font-size:11px;color:var(--t2);margin-bottom:2px;">
      <span style="color:${color};font-weight:800;">${icono}</span> ${he(h.mensaje)}
    </div>`;
  }).join('');

  // Barras side-by-side por categoría.
  const maxValor = Math.max(
    ...r.categorias.map(c => Math.max(c.actual, c.anterior)),
    1
  );

  const filas = r.categorias.map(c => {
    const wA = Math.round((c.actual / maxValor) * 100);
    const wP = Math.round((c.anterior / maxValor) * 100);
    let label;
    if (c.direccion === 'nueva')          label = '<span style="color:#ff8c00;font-weight:700;">nuevo</span>';
    else if (c.direccion === 'desaparecio') label = '<span style="color:#00b464;font-weight:700;">−</span>';
    else if (c.direccion === 'igual')      label = '<span style="color:var(--t3);">~</span>';
    else {
      const colorPct = c.direccion === 'subio' ? '#ff4444' : '#00b464';
      const signo    = c.delta > 0 ? '+' : '';
      label = `<span style="color:${colorPct};font-weight:700;">${signo}${c.deltaPct}%</span>`;
    }
    return `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11px;margin-bottom:3px;">
        <span style="color:var(--t1);font-weight:600;">${he(c.cat)}</span>
        ${label}
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:9px;color:var(--t3);width:32px;flex-shrink:0;">ant.</span>
          <div style="flex:1;height:5px;background:var(--s2);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${wP}%;background:rgba(150,150,150,.5);"></div>
          </div>
          <span class="mono" style="font-size:10px;color:var(--t3);min-width:60px;text-align:right;">${f(c.anterior)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:9px;color:var(--t3);width:32px;flex-shrink:0;">act.</span>
          <div style="flex:1;height:5px;background:var(--s2);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${wA}%;background:var(--a4);"></div>
          </div>
          <span class="mono" style="font-size:10px;color:var(--t1);min-width:60px;text-align:right;font-weight:700;">${f(c.actual)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <div style="font-size:11px;font-weight:800;color:var(--a4);text-transform:uppercase;letter-spacing:.5px;">
          📊 vs ${he(prev.periodo || prev.mes || 'período anterior')}
        </div>
        <div style="font-size:10px;color:var(--t3);">
          Total: <strong style="color:var(--t1);">${f(r.totalActual)}</strong> (era ${f(r.totalAnterior)})
        </div>
      </div>
      ${filasHL ? `<div style="margin-bottom:10px;padding:8px 10px;background:var(--s2);border-radius:6px;">${filasHL}</div>` : ''}
      ${filas}
    </div>
  `;
}

// ─── TENDENCIAS MULTI-PERÍODO (TRAYECTORIA EN HISTORIAL) ─────────────────────
// Complemento a calcularComparacionCategorias (Q vs Q anterior, comparación
// pareada). Esta función mira la TRAYECTORIA de las últimas N entradas del
// historial — no compara dos puntos, evalúa la dirección sostenida.
//
// Caso de uso: el usuario nota cambio gradual que las comparaciones pareadas
// no detectan. "Bajaste 8% en ahorro este mes" = nada urgente. "Llevás 4
// meses seguidos bajando ahorro" = patrón que merece atención.

const _UMBRAL_TENDENCIA_DEFAULT = 0.05;   // 5% — cambio mínimo para contar.

/**
 * Helper: dada una serie de números (más reciente primero), cuenta la racha
 * inicial de cambios consecutivos en la dirección dada. Cambios bajo el
 * umbral no rompen pero tampoco extienden — los tratamos como "neutro".
 *
 * @param {number[]} valores  Más reciente primero.
 * @param {number} umbral     Fracción mínima del valor anterior (ej. 0.05 = 5%).
 * @param {1|-1} signo        +1 cuenta subidas, -1 cuenta bajadas.
 * @returns {number} Cantidad de variaciones consecutivas en esa dirección
 *   desde el valor más reciente. Si la primera variación va en sentido
 *   contrario, retorna 0.
 */
function _contarRacha(valores, umbral, signo) {
  if (!Array.isArray(valores) || valores.length < 2) return 0;
  let racha = 0;
  for (let i = 0; i < valores.length - 1; i++) {
    const actual    = Number(valores[i]);
    const anterior  = Number(valores[i + 1]);
    if (!Number.isFinite(actual) || !Number.isFinite(anterior)) break;
    const delta = actual - anterior;
    if (anterior === 0) {
      // Salimos de "0 anterior": cuenta solo si el delta es notable y va en signo.
      if (delta * signo > 0) racha += 1;
      else                    break;
      continue;
    }
    const fracc = delta / Math.abs(anterior);
    if (Math.abs(fracc) < umbral)            break;   // cambio menor → corta racha
    if (fracc * signo > 0)                    racha += 1;
    else                                      break;
  }
  return racha;
}

/**
 * Pure: analiza tendencias direccionales en las últimas N entradas del
 * historial. Para cada métrica devuelve dirección, racha actual, cambio
 * promedio por período y mensaje listo para UI.
 *
 * @param {Array<{
 *   gastado?:number, ahorro?:number, hormiga?:number, ingreso?:number,
 *   periodo?:string, mes?:string
 * }>} historial Más reciente primero (S.historial nativo).
 * @param {{ventana?:number, umbralCambio?:number, rachaMin?:number}} [config]
 *   - ventana (default 4): cuántos períodos mirar.
 *   - umbralCambio (default 0.05): fracción mínima para no contar como estable.
 *   - rachaMin (default 3): racha mínima para que aparezca en highlights.
 * @returns {null | {
 *   ventana:number, nDatos:number,
 *   metricas: {
 *     [k:string]: {
 *       direccion: 'subiendo'|'bajando'|'estable'|'volatil'|'sin-datos',
 *       racha:number, signo:1|-1|0,
 *       pendientePromedio:number,
 *       polaridad:'mas-es-mejor'|'menos-es-mejor',
 *       mensaje:string,
 *     }
 *   },
 *   highlights: Array<{tipo:'mejora'|'alerta', metrica:string, mensaje:string}>
 * }} null si historial tiene < 3 entradas (no hay con qué juzgar trayectoria).
 */
export function calcularTendencias(historial, config = {}) {
  if (!Array.isArray(historial))                                 return null;
  if (historial.length < 3)                                       return null;

  const cfg = (config && typeof config === 'object') ? config : {};
  const ventana = (Number.isFinite(+cfg.ventana) && +cfg.ventana >= 3)
    ? Math.floor(+cfg.ventana) : 4;
  const umbral = (Number.isFinite(+cfg.umbralCambio) && +cfg.umbralCambio > 0)
    ? +cfg.umbralCambio : _UMBRAL_TENDENCIA_DEFAULT;
  const rachaMin = (Number.isFinite(+cfg.rachaMin) && +cfg.rachaMin > 0)
    ? Math.floor(+cfg.rachaMin) : 3;

  // Filtramos PRIMERO, luego tomamos las N más recientes. Sin esto, items
  // null/malformados dispersos en el historial podían reducir la muestra
  // bajo el mínimo aún teniendo suficientes válidos disponibles.
  const datos = historial
    .filter(h => h && typeof h === 'object')
    .slice(0, ventana);
  if (datos.length < 3)                                           return null;
  const nDatos = datos.length;

  const METRICAS = [
    { key: 'gastado', polaridad: 'menos-es-mejor', label: 'Gastos'   },
    { key: 'ahorro',  polaridad: 'mas-es-mejor',   label: 'Ahorro'   },
    { key: 'hormiga', polaridad: 'menos-es-mejor', label: 'Hormiga'  },
    { key: 'ingreso', polaridad: 'mas-es-mejor',   label: 'Ingreso'  },
  ];

  const metricas = {};
  const highlights = [];

  for (const meta of METRICAS) {
    const serie = datos.map(d => Number(d[meta.key]) || 0);

    // Pendiente promedio: cambio promedio por período entre el primer y último.
    // Más reciente está al inicio (índice 0), más viejo al final.
    const reciente = serie[0];
    const masViejo = serie[serie.length - 1];
    const pendientePromedio = serie.length > 1
      ? +((reciente - masViejo) / (serie.length - 1)).toFixed(2)
      : 0;

    const rachaSubida = _contarRacha(serie, umbral, +1);
    const rachaBajada = _contarRacha(serie, umbral, -1);

    let direccion, racha, signo;
    if (rachaSubida >= 2)        { direccion = 'subiendo'; racha = rachaSubida; signo = 1; }
    else if (rachaBajada >= 2)   { direccion = 'bajando';  racha = rachaBajada; signo = -1; }
    else if (rachaSubida === 1 || rachaBajada === 1) {
      direccion = 'volatil'; racha = 0; signo = 0;
    } else {
      direccion = 'estable'; racha = 0; signo = 0;
    }

    // Mensaje contextual.
    let mensaje;
    if (direccion === 'estable') {
      mensaje = 'Estable en los últimos períodos.';
    } else if (direccion === 'volatil') {
      mensaje = 'Variando sin patrón claro.';
    } else {
      const verbo = direccion === 'subiendo' ? 'subiendo' : 'bajando';
      mensaje = `${verbo} ${racha} período${racha === 1 ? '' : 's'} seguido${racha === 1 ? '' : 's'}.`;
    }

    metricas[meta.key] = {
      direccion, racha, signo,
      pendientePromedio,
      polaridad: meta.polaridad,
      mensaje,
    };

    // Highlight: una racha ≥ rachaMin con polaridad clara.
    if (racha >= rachaMin) {
      const esMejora =
        (meta.polaridad === 'mas-es-mejor'   && direccion === 'subiendo') ||
        (meta.polaridad === 'menos-es-mejor' && direccion === 'bajando');
      const tipo = esMejora ? 'mejora' : 'alerta';
      const verbo = direccion === 'subiendo' ? 'Subiendo' : 'Bajando';
      const nota = `${meta.label}: ${verbo.toLowerCase()} ${racha} períodos seguidos.`;
      highlights.push({ tipo, metrica: meta.key, mensaje: nota });
    }
  }

  // Ordenar highlights: alertas primero, luego mejoras. Determinístico por key.
  const tipoRank = { alerta: 0, mejora: 1 };
  const keyRank = { gastado: 0, hormiga: 1, ahorro: 2, ingreso: 3 };
  highlights.sort((a, b) => {
    const t = tipoRank[a.tipo] - tipoRank[b.tipo];
    if (t !== 0) return t;
    return keyRank[a.metrica] - keyRank[b.metrica];
  });

  return { ventana: nDatos, nDatos, metricas, highlights };
}

/**
 * Renderiza la card "tendencias" en el dashboard. Solo aparece si hay al
 * menos 1 highlight (racha ≥ 3) — sin patrón notable, no distrae.
 */
export function renderTendencias() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-tendencias');
  if (!el) return;

  const r = calcularTendencias(S.historial || []);
  if (!r || r.highlights.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const filasHL = r.highlights.map(h => {
    const color = h.tipo === 'mejora' ? '#00b464' : '#ff4444';
    const icono = h.tipo === 'mejora' ? '✓' : '⚠';
    return `<div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;">
      <span style="color:${color};font-weight:800;font-size:14px;flex-shrink:0;">${icono}</span>
      <span style="font-size:11px;color:var(--t1);line-height:1.5;">${he(h.mensaje)}</span>
    </div>`;
  }).join('');

  // Resumen visual de las 4 métricas.
  const flecha = (m) => {
    if (m.direccion === 'subiendo') return '↑';
    if (m.direccion === 'bajando')  return '↓';
    if (m.direccion === 'volatil')  return '↔';
    return '→';
  };
  const colorMetrica = (m) => {
    if (m.direccion === 'estable' || m.direccion === 'volatil') return 'var(--t3)';
    const esMejora =
      (m.polaridad === 'mas-es-mejor'   && m.direccion === 'subiendo') ||
      (m.polaridad === 'menos-es-mejor' && m.direccion === 'bajando');
    return esMejora ? '#00b464' : '#ff4444';
  };

  const labels = { gastado: '💸', ahorro: '💰', hormiga: '🐜', ingreso: '💵' };
  const filasMetricas = ['gastado', 'ahorro', 'hormiga', 'ingreso'].map(k => {
    const m = r.metricas[k];
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:60px;">
      <div style="font-size:14px;line-height:1;margin-bottom:2px;">${labels[k]}</div>
      <div style="font-size:18px;line-height:1;font-weight:800;color:${colorMetrica(m)};">${flecha(m)}</div>
      <div style="font-size:9px;color:var(--t3);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;">${k}</div>
    </div>`;
  }).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb">
      <div style="font-size:11px;font-weight:800;color:var(--a4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
        📈 Tendencias (últimos ${r.nDatos} períodos)
      </div>
      <div style="display:flex;gap:8px;justify-content:space-around;padding:10px;background:var(--s2);border-radius:6px;margin-bottom:10px;">
        ${filasMetricas}
      </div>
      ${filasHL}
    </div>
  `;
}

// ─── INDICADOR DE SALUD FINANCIERA GLOBAL ────────────────────────────────────
// Cierra el loop emocional del dashboard: hasta ahora 9 nudges defensivos
// regañan al usuario. Falta el "lo estás haciendo bien" para el usuario
// disciplinado. El banner aparece SOLO cuando score >= 70 — debajo de eso,
// los detectores defensivos hablan y este se calla para no saturar.
//
// 6 componentes con peso fijo, total 100 pts:
//   1. Sin atrasos             (25) — fijos al día + deudas activas + objetivos avanzando
//   2. Ahorrando                (25) — % de ingreso que va a ahorro este mes
//   3. Fondo de emergencia      (20) — % completado vs objetivo (default 6 meses)
//   4. Deudas bajo control      (15) — cuotas mensuales / ingreso ≤ 40%
//   5. Backup reciente          (10) — días desde último export
//   6. Hormigas controladas     ( 5) — % del ingreso en gastos hormiga
//
// Etiqueta: 'critica' <40, 'mejorable' <70, 'buena' <90, 'excelente' ≥90.

const _RX_FECHA_SALUD = /^(\d{4})-(\d{2})-(\d{2})/;

/** Diferencia en días UTC entre dos fechas YYYY-MM-DD. null si malformadas. */
function _diffDiasSalud(desdeISO, hastaISO) {
  const a = _RX_FECHA_SALUD.exec(desdeISO);
  const b = _RX_FECHA_SALUD.exec(hastaISO);
  if (!a || !b) return null;
  const dA = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const dB = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  return Math.floor((dB - dA) / 86_400_000);
}

function _calcCompAtrasos({ gastosFijos, deudas, objetivos, mesActual, anio, mes, dia, hoyISO }) {
  let fijosAtrasados = 0;
  for (const fx of gastosFijos) {
    if (!fx || typeof fx !== 'object')        continue;
    const diaRaw = Number(fx.dia) || 1;
    if (diaRaw < 1 || diaRaw > 31)            continue;
    const lastDay = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const dia1 = Math.min(diaRaw, lastDay);
    if (dia < dia1)                            continue;
    const pagados = Array.isArray(fx.pagadoEn)
      ? fx.pagadoEn.filter(x => x === mesActual).length
      : 0;
    if (pagados >= 1)                          continue;
    fijosAtrasados += 1;
  }
  let deudasDurmiendo = 0;
  for (const d of deudas) {
    if (!d || typeof d !== 'object')           continue;
    const total  = Number(d.total)  || 0;
    const pagado = Number(d.pagado) || 0;
    if (total - pagado <= 0)                   continue;
    const fup = (typeof d.fechaUltimoPago === 'string') ? d.fechaUltimoPago : null;
    if (!fup)                                  continue;
    const dias = _diffDiasSalud(fup, hoyISO);
    if (dias !== null && dias > 60) deudasDurmiendo += 1;
  }
  let objSinProgreso = 0;
  for (const o of objetivos) {
    if (!o || typeof o !== 'object')           continue;
    const meta = Number(o.objetivoAhorro) || 0;
    const ah   = Number(o.ahorrado)       || 0;
    if (meta <= 0 || ah >= meta)               continue;
    const fua = (typeof o.fechaUltimoAporte === 'string') ? o.fechaUltimoAporte : null;
    if (!fua)                                  continue;
    const dias = _diffDiasSalud(fua, hoyISO);
    if (dias !== null && dias > 60) objSinProgreso += 1;
  }
  const totalAtrasos = fijosAtrasados + deudasDurmiendo + objSinProgreso;
  const score = totalAtrasos === 0 ? 25 : totalAtrasos === 1 ? 15 : totalAtrasos === 2 ? 5 : 0;
  return {
    key:    'atrasos',
    label:  'Sin atrasos',
    peso:   25,
    score,
    mensaje: totalAtrasos === 0
      ? 'Todo al día. Cero fijos atrasados, deudas durmiendo u objetivos abandonados.'
      : `${totalAtrasos} ${totalAtrasos === 1 ? 'cosa' : 'cosas'} pidiendo atención.`,
  };
}

function _calcCompAhorro({ gastos, ingreso, mesActual }) {
  let ahorrado = 0;
  for (const g of gastos) {
    if (!g || typeof g !== 'object')           continue;
    if (g.tipo !== 'ahorro')                   continue;
    if (typeof g.fecha !== 'string')           continue;
    if (!g.fecha.startsWith(mesActual))        continue;
    ahorrado += Number(g.montoTotal) || Number(g.monto) || 0;
  }
  const tasaAhorro = ingreso > 0 ? (ahorrado / ingreso) : 0;
  const score = tasaAhorro >= 0.20 ? 25 : tasaAhorro >= 0.10 ? 15 : tasaAhorro >= 0.05 ? 8 : 0;
  return {
    key:    'ahorro',
    label:  'Ahorrando',
    peso:   25,
    score,
    mensaje: ingreso <= 0
      ? 'Configurá tu ingreso para ver tu tasa de ahorro.'
      : tasaAhorro >= 0.20
        ? `Ahorrás el ${(tasaAhorro*100).toFixed(0)}% — disciplinado de verdad.`
        : tasaAhorro >= 0.10
          ? `Ahorrás el ${(tasaAhorro*100).toFixed(0)}%. Subí al 20% para excelencia.`
          : tasaAhorro > 0
            ? `Ahorrás el ${(tasaAhorro*100).toFixed(0)}%. Apuntá al 10% mínimo.`
            : 'Sin ahorros este mes — empezá con cualquier monto.',
  };
}

function _calcCompFondo({ fondo, ingreso }) {
  if (!fondo || ingreso <= 0) {
    return {
      key:    'fondo',
      label:  'Fondo de emergencia',
      peso:   20,
      score:  0,
      mensaje: 'Sin fondo de emergencia configurado.',
    };
  }
  const objMeses = Number(fondo.objetivoMeses) || 6;
  const actual   = Number(fondo.actual)        || 0;
  const objetivo = ingreso * objMeses;
  const pctFondo = objetivo > 0 ? (actual / objetivo) * 100 : 0;
  const score = pctFondo >= 100 ? 20 : pctFondo >= 50 ? 12 : pctFondo >= 20 ? 6 : 0;
  return {
    key:    'fondo',
    label:  'Fondo de emergencia',
    peso:   20,
    score,
    mensaje: pctFondo >= 100
      ? `Fondo completo (${objMeses} meses). Dormís tranquilo.`
      : `Fondo al ${pctFondo.toFixed(0)}% de ${objMeses} meses.`,
  };
}

function _calcCompDeudas({ deudas, ingreso }) {
  let cuotaMensual = 0;
  let deudasVivas  = 0;
  for (const d of deudas) {
    if (!d || typeof d !== 'object')           continue;
    const total  = Number(d.total)  || 0;
    const pagado = Number(d.pagado) || 0;
    if (total - pagado <= 0)                   continue;
    deudasVivas += 1;
    const cuota = Number(d.cuota) || 0;
    cuotaMensual += d.periodicidad === 'quincenal' ? cuota * 2 : cuota;
  }
  if (deudasVivas === 0) {
    return {
      key:    'deudas',
      label:  'Deudas bajo control',
      peso:   15,
      score:  15,
      mensaje: 'Sin deudas vivas. Libertad financiera.',
    };
  }
  if (ingreso <= 0) {
    return {
      key:    'deudas',
      label:  'Deudas bajo control',
      peso:   15,
      score:  0,
      mensaje: 'Configurá tu ingreso para evaluar carga de deudas.',
    };
  }
  const pct = (cuotaMensual / ingreso) * 100;
  const score = pct <= 20 ? 15 : pct <= 40 ? 10 : pct <= 60 ? 5 : 0;
  return {
    key:    'deudas',
    label:  'Deudas bajo control',
    peso:   15,
    score,
    mensaje: `Cuotas mensuales: ${pct.toFixed(0)}% de tu ingreso.`,
  };
}

function _calcCompBackup({ lastBackupAt, hoyISO }) {
  if (!lastBackupAt) {
    return {
      key:    'backup',
      label:  'Backup reciente',
      peso:   10,
      score:  0,
      mensaje: 'Nunca exportaste un backup. Hacelo ahora.',
    };
  }
  const dias = _diffDiasSalud(lastBackupAt, hoyISO);
  let score, mensaje;
  if (dias === null || dias < 0) {
    score   = 0;
    mensaje = 'Fecha de backup inválida — exportá uno nuevo.';
  } else if (dias <= 7) {
    score   = 10;
    mensaje = `Backup hace ${dias} día${dias === 1 ? '' : 's'}. Impecable.`;
  } else if (dias <= 30) {
    score   = 6;
    mensaje = `Backup hace ${dias} días. Bien.`;
  } else if (dias <= 60) {
    score   = 3;
    mensaje = `Backup hace ${dias} días. Convendría refrescar.`;
  } else {
    score   = 0;
    mensaje = `Backup hace ${dias} días — exportá uno nuevo ya.`;
  }
  return { key: 'backup', label: 'Backup reciente', peso: 10, score, mensaje };
}

function _calcCompHormigas({ gastos, ingreso, mesActual }) {
  let hormigasMes = 0;
  for (const g of gastos) {
    if (!g || typeof g !== 'object')           continue;
    if (typeof g.fecha !== 'string')           continue;
    if (!g.fecha.startsWith(mesActual))        continue;
    if (!(g.hormiga === true || g.tipo === 'hormiga')) continue;
    hormigasMes += Number(g.montoTotal) || Number(g.monto) || 0;
  }
  if (hormigasMes === 0) {
    return {
      key:    'hormiga',
      label:  'Hormigas controladas',
      peso:   5,
      score:  5,
      mensaje: 'Cero hormigas este mes. Disciplina pura.',
    };
  }
  if (ingreso <= 0) {
    // Sin ingreso: usar monto como proxy (no podemos calcular pct)
    return {
      key:    'hormiga',
      label:  'Hormigas controladas',
      peso:   5,
      score:  3,
      mensaje: `${f(hormigasMes)} en hormigas este mes.`,
    };
  }
  const pct = (hormigasMes / ingreso) * 100;
  const score = pct < 2 ? 5 : pct < 5 ? 3 : pct < 10 ? 1 : 0;
  return {
    key:    'hormiga',
    label:  'Hormigas controladas',
    peso:   5,
    score,
    mensaje: `Hormigas: ${pct.toFixed(1)}% del ingreso.`,
  };
}

/**
 * Pure: calcula el indicador de salud financiera global a partir de slices
 * del estado. Sin S, sin DOM. Determinística para tests.
 *
 * @param {{
 *   gastos?: Array, gastosFijos?: Array, deudas?: Array, objetivos?: Array,
 *   ingreso?: number,
 *   fondoEmergencia?: {objetivoMeses?:number, actual?:number},
 *   lastBackupAt?: string|null,
 * }} input
 * @param {string} hoyISO 'YYYY-MM-DD'.
 * @param {{}} [config] reservado para futuras configuraciones.
 * @returns {null | {
 *   score: number,
 *   etiqueta: 'critica'|'mejorable'|'buena'|'excelente',
 *   componentes: Array<{
 *     key:string, label:string, peso:number, score:number, mensaje:string
 *   }>
 * }}
 */
export function calcularSaludFinanciera(input, hoyISO, _config = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (typeof hoyISO !== 'string' || !_RX_FECHA_SALUD.test(hoyISO)) return null;

  const m = _RX_FECHA_SALUD.exec(hoyISO);
  const anio = +m[1], mes = +m[2], dia = +m[3];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31)              return null;

  const mesActual = `${m[1]}-${m[2]}`;
  const ingreso   = Number(input.ingreso) || 0;

  const gastos       = Array.isArray(input.gastos)       ? input.gastos       : [];
  const gastosFijos  = Array.isArray(input.gastosFijos)  ? input.gastosFijos  : [];
  const deudas       = Array.isArray(input.deudas)       ? input.deudas       : [];
  const objetivos    = Array.isArray(input.objetivos)    ? input.objetivos    : [];
  const fondo        = (input.fondoEmergencia && typeof input.fondoEmergencia === 'object')
    ? input.fondoEmergencia : null;
  const lastBackupAt = (typeof input.lastBackupAt === 'string') ? input.lastBackupAt : null;

  const componentes = [
    _calcCompAtrasos({ gastosFijos, deudas, objetivos, mesActual, anio, mes, dia, hoyISO }),
    _calcCompAhorro({ gastos, ingreso, mesActual }),
    _calcCompFondo({ fondo, ingreso }),
    _calcCompDeudas({ deudas, ingreso }),
    _calcCompBackup({ lastBackupAt, hoyISO }),
    _calcCompHormigas({ gastos, ingreso, mesActual }),
  ];

  const score = componentes.reduce((s, c) => s + c.score, 0);
  let etiqueta;
  if      (score >= 90) etiqueta = 'excelente';
  else if (score >= 70) etiqueta = 'buena';
  else if (score >= 40) etiqueta = 'mejorable';
  else                   etiqueta = 'critica';

  return { score, etiqueta, componentes };
}

/**
 * Renderiza el banner de salud financiera en el dashboard. Solo aparece cuando
 * score >= 70 — debajo de eso, los nudges defensivos toman el espacio. Muestra
 * score, etiqueta, barra de progreso, y top 3 wins (componentes con score
 * pleno o cercano).
 */
export function renderSaludFinanciera() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-salud-financiera');
  if (!el) return;

  const r = calcularSaludFinanciera({
    gastos:           S.gastos,
    gastosFijos:      S.gastosFijos,
    deudas:           S.deudas,
    objetivos:        S.objetivos,
    ingreso:          S.ingreso,
    fondoEmergencia:  S.fondoEmergencia,
    lastBackupAt:     S.lastBackupAt,
  }, hoy());

  if (!r || r.score < 70) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const isExcelente = r.etiqueta === 'excelente';
  const titulo = isExcelente
    ? '🏆 Salud financiera excelente'
    : '✅ Salud financiera buena';
  const colorBorde = isExcelente ? 'rgba(0,220,130,.5)' : 'rgba(0,180,100,.35)';
  const colorFondo = isExcelente ? 'rgba(0,220,130,.08)' : 'rgba(0,180,100,.05)';
  const colorAcento = isExcelente ? '#00dc82' : '#00b464';

  // Top 3 wins: componentes con score >= 80% de su peso.
  const wins = r.componentes
    .filter(c => c.peso > 0 && c.score >= c.peso * 0.8)
    .sort((a, b) => (b.score / b.peso) - (a.score / a.peso))
    .slice(0, 3);

  const filasWins = wins.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
      <span style="font-size:14px;flex-shrink:0;color:${colorAcento};" aria-hidden="true">✓</span>
      <span style="font-size:11px;color:var(--t2);">${he(c.label)}: <strong style="color:var(--t1);">${he(c.mensaje)}</strong></span>
    </div>
  `).join('');

  const pctBarra = Math.min(r.score, 100);

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:${colorBorde};background:${colorFondo};">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="font-size:11px;font-weight:800;color:${colorAcento};text-transform:uppercase;letter-spacing:.5px;">
          ${he(titulo)}
        </div>
        <div class="mono" style="font-size:14px;font-weight:800;color:${colorAcento};">${r.score}<span style="font-size:10px;color:var(--t3);font-weight:600;">/100</span></div>
      </div>
      <div style="height:6px;background:var(--s2);border-radius:3px;overflow:hidden;margin-bottom:10px;">
        <div style="height:100%;width:${pctBarra}%;background:${colorAcento};transition:width .6s cubic-bezier(.4,0,.2,1);"></div>
      </div>
      ${filasWins}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ ESTADÍSTICAS ═══
// ═══════════════════════════════════════════════════════════════════════════════

// ─── RENDER COMPLETO ─────────────────────────────────────────────────────────
export function renderStats() {
  window.calcScore?.();

  const tN = S.gastos.filter(g => g.tipo === 'necesidad' && !g.hormiga).reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tD = S.gastos.filter(g => g.tipo === 'deseo'     && !g.hormiga).reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tH = S.gastos.filter(g => g.tipo === 'hormiga'   || g.hormiga) .reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tA = S.gastos.filter(g => g.tipo === 'ahorro')                  .reduce((s, g) => s + g.monto, 0);
  const tG = tN + tD + tH;
  const totalPie = tN + tD + tH + tA;

  _renderTopCategorias(tG);
  _renderPie(totalPie, tN, tD, tH, tA, tG);
  _renderInsights(tG, tA);

  // Gamificación: inyecta la sección de logros al final de la pestaña Balance.
  // Usa optional chaining — si logros.js aún no cargó, no falla.
  window.renderLogros?.();
}

// ─── TOP CATEGORÍAS ──────────────────────────────────────────────────────────
function _renderTopCategorias(tG) {
  const cats = {};
  S.gastos.filter(g => g.tipo !== 'ahorro').forEach(g => {
    cats[g.cat] = (cats[g.cat] || 0) + (g.montoTotal || g.monto);
  });
  const sorted   = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const htmlBars = sorted.length === 0
    ? '<div class="emp">Registra gastos para ver la distribución.</div>'
    : sorted.map(([cat, monto]) => {
        const pct = tG > 0 ? (monto / tG) * 100 : 0;
        return `
          <div class="stat-bar-row" style="margin-bottom:14px;">
            <div class="stat-bar-label" style="font-size:12px; color:var(--t2); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
              <span>${CATS[cat] || cat}</span>
              <span style="font-family:var(--fm); font-weight:700; color:var(--t1);">${f(monto)}</span>
            </div>
            <div class="stat-bar-wrap" style="height:8px; background:var(--s3); border-radius:999px; overflow:hidden;">
              <div class="stat-bar-fill" style="height:100%; width:${pct}%; background:${CCOLORS[cat] || 'var(--a4)'}; border-radius:999px; transition:width .5s ease;"></div>
            </div>
            <div style="font-size:10px; color:var(--t3); margin-top:3px; text-align:right;">${pct.toFixed(1)}% del total</div>
          </div>`;
      }).join('');
  setHtml('stat-bars', htmlBars);
}

// ─── GRÁFICO DE TORTA (CSS conic-gradient) ────────────────────────────────────
function _renderPie(totalPie, tN, tD, tH, tA, tG) {
  const pieCard = document.getElementById('stat-pie-card');
  if (totalPie <= 0) { if (pieCard) pieCard.style.display = 'none'; return; }
  if (pieCard) pieCard.style.display = 'block';

  const colorNeeds   = '#00bcd4';
  const colorDesires = '#ff9800';
  const colorHormiga = '#795548';
  const colorSavings = '#4caf50';

  const pctN = (tN / totalPie) * 100;
  const pctD = (tD / totalPie) * 100;
  const pctH = (tH / totalPie) * 100;
  const pctA = (tA / totalPie) * 100;

  const stop1 = Math.round(pctN);
  const stop2 = Math.round(pctN + pctD);
  const stop3 = Math.round(pctN + pctD + pctH);
  const gradient = `conic-gradient(${colorNeeds} 0% ${stop1}%, ${colorDesires} ${stop1}% ${stop2}%, ${colorHormiga} ${stop2}% ${stop3}%, ${colorSavings} ${stop3}% 100%)`;

  const tasa50N  = S.ingreso > 0 ? ((tN / S.ingreso) * 100).toFixed(1) : 0;
  const tasa50D  = S.ingreso > 0 ? ((tD / S.ingreso) * 100).toFixed(1) : 0;
  const tasa50A  = S.ingreso > 0 ? ((tA / S.ingreso) * 100).toFixed(1) : 0;

  setHtml('stat-pie-container', `
    <div class="pie-wrapper">
      <div class="pie-chart" style="background:${gradient};"></div>
      <div class="pie-center-text">
        <span style="font-size:10px; font-weight:800; color:var(--t3); letter-spacing:1px; margin-bottom:2px;">GASTADO</span>
        <span style="font-family:var(--fm); font-size:18px; font-weight:800; color:var(--t1);">${f(tG)}</span>
      </div>
    </div>
    <div class="pie-legend">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:${colorNeeds}; font-weight:700; font-size:12px;">■ Necesidades</span>
        <div style="text-align:right;"><span class="mono" style="font-size:12px;">${Math.round(pctN)}%</span>${S.ingreso > 0 ? `<div style="font-size:10px; color:var(--t3);">${tasa50N}% del ingreso</div>` : ''}</div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:${colorDesires}; font-weight:700; font-size:12px;">■ Deseos</span>
        <div style="text-align:right;"><span class="mono" style="font-size:12px;">${Math.round(pctD)}%</span>${S.ingreso > 0 ? `<div style="font-size:10px; color:var(--t3);">${tasa50D}% del ingreso</div>` : ''}</div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:${colorHormiga}; font-weight:700; font-size:12px;">■ Fuga Hormiga 🐜</span>
        <span class="mono" style="font-size:12px;">${Math.round(pctH)}%</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:${colorSavings}; font-weight:700; font-size:12px;">■ Ahorros</span>
        <div style="text-align:right;"><span class="mono" style="font-size:12px;">${Math.round(pctA)}%</span>${S.ingreso > 0 ? `<div style="font-size:10px; color:var(--t3);">${tasa50A}% del ingreso</div>` : ''}</div>
      </div>
    </div>`);
}

// ─── INSIGHTS Y PRONÓSTICOS ──────────────────────────────────────────────────
function _renderInsights(tG, tA) {
  const insights = [];

  if (S.ingreso > 0 || tG > 0) {
    // Proyección de ahorro anual
    if (tA > 0) {
      insights.push(`<div class="insight-card" style="border-left-color:var(--a1)">📈 <strong>Proyección:</strong> En 1 año tendrás <strong>${f(tA * 24)}</strong> extra si mantienes este ritmo de ahorro (2 quincenas × 12 meses).</div>`);
    } else {
      insights.push(`<div class="insight-card" style="border-left-color:var(--a2)">⚠️ <strong>Estancamiento:</strong> Guardar al menos el 10% (${f(S.ingreso * 0.1)}) cambiaría tu futuro financiero.</div>`);
    }

    // Proyección libertad de deuda
    const totalDeuda = S.deudas.reduce((s, d) => s + Math.max(0, d.total - d.pagado), 0);
    const sq         = S.deudas.filter(d => d.periodicidad === 'quincenal').reduce((s, d) => s + d.cuota, 0);
    const sm         = S.deudas.filter(d => d.periodicidad === 'mensual').reduce((s, d) => s + d.cuota, 0);
    const ccm        = (sq * 2) + sm;
    if (totalDeuda > 0 && ccm > 0) {
      const meses = Math.ceil(totalDeuda / ccm);
      insights.push(`<div class="insight-card" style="border-left-color:var(--a5)">⏳ <strong>Libertad:</strong> Al ritmo actual, serás 100% libre de deudas en aprox. <strong>${meses} mes${meses !== 1 ? 'es' : ''}</strong>.</div>`);
    }

    // Comparativa vs período anterior
    if (S.historial && S.historial.length > 0) {
      const gMP = S.historial[0].gastado;
      if (gMP > 0) {
        const dif = Math.round(((tG - gMP) / gMP) * 100);
        if (dif > 0) insights.push(`<div class="insight-card" style="border-left-color:var(--dan)">📉 <strong>Tendencia:</strong> Gastas un <strong>${dif}% más</strong> que el período anterior (${f(gMP)} vs ${f(tG)}).</div>`);
        else if (dif < 0) insights.push(`<div class="insight-card" style="border-left-color:var(--a1)">📈 <strong>Tendencia:</strong> Gastas un <strong>${Math.abs(dif)}% menos</strong> que el período anterior. ¡Buen trabajo!</div>`);
        else insights.push(`<div class="insight-card" style="border-left-color:var(--t3)">📊 <strong>Tendencia:</strong> Tus gastos se mantienen estables respecto al período anterior.</div>`);
      }
    }

    // Supervivencia con fondo de emergencia
    if (typeof window.calcularFondoEmergencia === 'function') {
      const sF = window.calcularFondoEmergencia();
      if (sF.gastoMensualFijo > 0) {
        const dias = Math.floor((sF.actual / sF.gastoMensualFijo) * 30);
        insights.push(`<div class="insight-card" style="border-left-color:var(--a4)">🛡️ <strong>Supervivencia:</strong> Podrías cubrir tus gastos fijos durante <strong>${dias} días</strong> sin ingresos con tu fondo actual.</div>`);
      }
    }

    // Alerta gasto hormiga
    const tH = S.gastos.filter(g => g.tipo === 'hormiga' || g.hormiga).reduce((s, g) => s + (g.montoTotal || g.monto), 0);
    if (S.ingreso > 0 && tH > S.ingreso * 0.10) {
      const anualH = tH * 24;
      insights.push(`<div class="insight-card" style="border-left-color:#795548">🐜 <strong>Fuga hormiga:</strong> Llevas ${f(tH)} en gastos hormiga esta quincena. Proyectado al año: <strong>${f(anualH)}</strong>.</div>`);
    }
  }

  setHtml('stat-insights', insights.length
    ? insights.join('')
    : '<div class="emp" style="padding:10px;">Faltan datos para generar pronósticos.</div>');
}

// ─── DISTRIBUCIÓN 50/30/20 ACUMULADA ────────────────────────────────────────
export function calcDistribucionReal() {
  const tN  = S.gastos.filter(g => g.tipo === 'necesidad').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tD  = S.gastos.filter(g => g.tipo === 'deseo').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tH  = S.gastos.filter(g => g.tipo === 'hormiga' || g.hormiga).reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tA  = S.gastos.filter(g => g.tipo === 'ahorro').reduce((s, g) => s + g.monto, 0);
  const tG  = tN + tD + tH;
  const ing = S.ingreso || 1;
  return {
    necesidades: { monto: tN, pct: Math.round((tN / ing) * 100) },
    deseos:      { monto: tD + tH, pct: Math.round(((tD + tH) / ing) * 100) },
    ahorro:      { monto: tA, pct: Math.round((tA / ing) * 100) },
    total:       tG
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ LOGROS ═══
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Finko Pro — Módulo de Gamificación: Rachas y Logros
// Estrategia de diseño:
//   • Cero cambios en index.html — toda la UI se inyecta dinámicamente.
//   • evaluarLogros() se llama desde renderSmart en cada ciclo de render.
//   • Los toasts son una cola FIFO — nunca se pisan entre sí.
//   • Los logros no desaparecen ni se reinician — son permanentes.
// ─────────────────────────────────────────────────────────────────────────────

// ─── CATÁLOGO DE LOGROS ───────────────────────────────────────────────────────
// Cada logro tiene un id único, icono, nombre corto colombiano, descripción
// motivadora y categoría. Los de tipo hormiga tienen rachaMin para el umbral.
export const LOGROS = [
  // ── Primeros pasos ─────────────────────────────────────────────────────────
  {
    id: 'primer_gasto', icon: '✍️', cat: 'inicio',
    nombre: 'Primero la honestidad',
    desc:   'Registraste tu primer gasto. Reconocer lo que gastás es el primer paso para controlarlo.',
  },
  {
    id: 'primer_bolsillo', icon: '🪙', cat: 'inicio',
    nombre: 'El de los bolsillos',
    desc:   'Creaste tu primer bolsillo. Plata con propósito es plata que no se pierde.',
  },
  {
    id: 'primer_plan', icon: '📋', cat: 'inicio',
    nombre: 'El que planea no truena',
    desc:   'Configuraste tu primera quincena. Quien planea, gana.',
  },
  {
    id: 'primera_meta', icon: '🎯', cat: 'inicio',
    nombre: 'Soñador con plan',
    desc:   'Creaste tu primera meta de ahorro. Los sueños con fecha se vuelven planes.',
  },
  {
    id: 'primera_deuda', icon: '🤝', cat: 'inicio',
    nombre: 'Cara a cara con la deuda',
    desc:   'Registraste tu primera deuda. Verla de frente es el primer paso para salir de ella.',
  },

  // ── Hormiga domada ─────────────────────────────────────────────────────────
  {
    id: 'sin_hormiga_3', icon: '🐜', cat: 'hormiga', rachaMin: 3,
    nombre: '3 días sin hormiga',
    desc:   'Tres días sin gastos hormiga. Esos pesos se están quedando en tu bolsillo.',
  },
  {
    id: 'sin_hormiga_7', icon: '🦋', cat: 'hormiga', rachaMin: 7,
    nombre: 'Una semana pura',
    desc:   '¡7 días sin gastos hormiga! La disciplina ya se está convirtiendo en hábito.',
  },
  {
    id: 'sin_hormiga_15', icon: '🔥', cat: 'hormiga', rachaMin: 15,
    nombre: 'Quincena sin hormiga',
    desc:   'Una quincena entera sin gastos hormiga. Eso es control de verdad.',
  },
  {
    id: 'sin_hormiga_30', icon: '🏆', cat: 'hormiga', rachaMin: 30,
    nombre: 'Un mes perfecto',
    desc:   '30 días sin caer en gastos hormiga. Nivel maestro — ¡felicitaciones!',
  },

  // ── Ahorrador ──────────────────────────────────────────────────────────────
  {
    id: 'primer_ahorro', icon: '💰', cat: 'ahorro',
    nombre: 'El primero se celebra',
    desc:   'Registraste tu primer ahorro. Págate a ti primero, siempre.',
  },
  {
    id: 'ahorro_3q', icon: '📈', cat: 'ahorro',
    nombre: 'Ahorrador consistente',
    desc:   'Tres quincenas seguidas con ahorro positivo. La constancia hace la riqueza.',
  },
  {
    id: 'meta_cumplida', icon: '🎉', cat: 'ahorro',
    nombre: '¡Sueño hecho realidad!',
    desc:   'Completaste tu primera meta de ahorro. Dijiste que ibas a lograrlo, ¡y lo lograste!',
  },

  // ── Deudas ─────────────────────────────────────────────────────────────────
  {
    id: 'cuota_pagada', icon: '💳', cat: 'deudas',
    nombre: 'Primero cumplí',
    desc:   'Registraste el pago de tu primera cuota. La disciplina con las deudas es respeto propio.',
  },
  {
    id: 'deuda_liquidada', icon: '🗓️', cat: 'deudas',
    nombre: '¡Libre de esa!',
    desc:   'Liquidaste una deuda completa. Cada peso que pagaste fue un paso hacia la libertad.',
  },

  // ── Colchoneta ─────────────────────────────────────────────────────────────
  {
    id: 'fondo_inicio', icon: '🛡️', cat: 'fondo',
    nombre: 'La colchoneta empieza',
    desc:   'Tu fondo de emergencia ya tiene algo. Los imprevistos no te van a agarrar desprevenido.',
  },
  {
    id: 'fondo_completo', icon: '🏰', cat: 'fondo',
    nombre: 'Castillo financiero',
    desc:   'Tu fondo de emergencia está completo. Podés dormir tranquilo sin importar lo que pase.',
  },

  // ── Inversionista ──────────────────────────────────────────────────────────
  {
    id: 'primera_inversion', icon: '📊', cat: 'inversion',
    nombre: 'La plata trabaja',
    desc:   'Registraste tu primera inversión. Ya dejaste de solo guardar y empezaste a hacer crecer.',
  },
];

// ─── GARANTÍA DE ESTADO ───────────────────────────────────────────────────────
// Llamar antes de cualquier lectura de S.logros.
// Retrocompatible con usuarios sin el campo (versiones anteriores).
export function _initLogros() {
  if (!S.logros || typeof S.logros !== 'object') {
    S.logros = { desbloqueados: [], vistos: [], rachas: {} };
  }
  if (!Array.isArray(S.logros.desbloqueados)) S.logros.desbloqueados = [];
  if (!Array.isArray(S.logros.vistos))        S.logros.vistos        = [];
  if (!S.logros.rachas || typeof S.logros.rachas !== 'object') S.logros.rachas = {};
  if (!S.logros.rachas.sinHormiga) S.logros.rachas.sinHormiga = { actual: 0, max: 0 };
  if (!S.logros.rachas.ahorro)     S.logros.rachas.ahorro     = { actual: 0, max: 0 };
}

// ─── CACHE DE RACHAS ─────────────────────────────────────────────────────────
// Las rachas se recalculan en cada renderSmart (hasta 8 veces por ciclo).
// Este cache evita el trabajo repetido: si el número de gastos y la fecha
// del último no cambiaron, devuelve el resultado anterior en O(1).
let _rachaCache = { key: null, hormiga: 0, ahorro: 0 };

function _rachaCacheKey() {
  const gastos = S.gastos || [];
  const n      = gastos.length;
  const last   = n ? (gastos[n - 1].fecha || 0) : 0;
  const histN  = (S.historial || []).length;
  return `${n}:${last}:${histN}`;
}

// ─── CÁLCULO DE RACHAS ────────────────────────────────────────────────────────
/**
 * Racha sin hormiga: días consecutivos con gastos registrados donde
 * ninguno es de tipo hormiga (contado desde el día más reciente hacia atrás).
 * Los días sin ningún registro no cuentan ni rompen la racha.
 */
function _rachaHormiga() {
  const key = _rachaCacheKey();
  if (_rachaCache.key === key) return _rachaCache.hormiga;

  const racha = calcularRachaHormiga(S.gastos);
  _rachaCache = { key, hormiga: racha, ahorro: _rachaCache.ahorro };
  return racha;
}

/**
 * Racha de ahorro: quincenas consecutivas (del historial) con ahorro > 0,
 * contadas de más reciente a más antigua. El período actual se suma si tiene
 * gastos de tipo ahorro registrados.
 */
function _rachaAhorro() {
  const key = _rachaCacheKey();
  if (_rachaCache.key === key) return _rachaCache.ahorro;

  const ahorroActual = (S.gastos || [])
    .filter(g => g.tipo === 'ahorro')
    .reduce((s, g) => s + g.monto, 0);

  const racha = calcularRachaAhorro(S.historial, ahorroActual);
  _rachaCache = { key, hormiga: _rachaCache.hormiga, ahorro: racha };
  return racha;
}

/** Actualiza ambas rachas en S.logros y devuelve el objeto de rachas. */
export function calcularRachas() {
  _initLogros();
  const rH = _rachaHormiga();
  const rA = _rachaAhorro();

  S.logros.rachas.sinHormiga.actual = rH;
  S.logros.rachas.sinHormiga.max    = Math.max(rH, S.logros.rachas.sinHormiga.max);
  S.logros.rachas.ahorro.actual     = rA;
  S.logros.rachas.ahorro.max        = Math.max(rA, S.logros.rachas.ahorro.max);

  return S.logros.rachas;
}

// ─── EVALUACIÓN Y DESBLOQUEO ─────────────────────────────────────────────────
export function evaluarLogros() {
  _initLogros();
  calcularRachas();

  const nuevos   = [];
  const ya       = id => S.logros.desbloqueados.includes(id);
  const unlock   = id => { if (!ya(id)) { S.logros.desbloqueados.push(id); nuevos.push(id); } };
  const rachas   = S.logros.rachas;

  // ── Primeros pasos ──────────────────────────────────────────────────────────
  if ((S.gastos  || []).length > 0)    unlock('primer_gasto');
  if ((S.bolsillos || []).length > 0)  unlock('primer_bolsillo');
  if ((S.ingreso  || 0) > 0)           unlock('primer_plan');
  if ((S.objetivos || []).length > 0)  unlock('primera_meta');
  if ((S.deudas   || []).length > 0 ||
      (S.historial || []).some(h => (h.deudas || 0) > 0)) {
    unlock('primera_deuda');
  }

  // ── Hormiga ─────────────────────────────────────────────────────────────────
  const ra = rachas.sinHormiga.actual;
  if (ra >= 3)  unlock('sin_hormiga_3');
  if (ra >= 7)  unlock('sin_hormiga_7');
  if (ra >= 15) unlock('sin_hormiga_15');
  if (ra >= 30) unlock('sin_hormiga_30');

  // ── Ahorro ───────────────────────────────────────────────────────────────────
  const hayAhorro = (S.gastos || []).some(g => g.tipo === 'ahorro') ||
                    (S.historial || []).some(h => (h.ahorro || 0) > 0);
  if (hayAhorro) unlock('primer_ahorro');
  if (rachas.ahorro.actual >= 3) unlock('ahorro_3q');

  const metaCumplida = (S.objetivos || []).some(o => {
    const meta    = o.objetivoAhorro || 0;
    const actual  = o.ahorroActual ?? o.ahorro ?? 0;
    return meta > 0 && actual >= meta;
  });
  if (metaCumplida) unlock('meta_cumplida');

  // ── Deudas ───────────────────────────────────────────────────────────────────
  const cuotaRegistrada = (S.gastos || []).some(g => g.cat === 'deudas') ||
                          (S.historial || []).some(h => (h.deudas || 0) > 0);
  if (cuotaRegistrada) unlock('cuota_pagada');

  const liquidada = (S.deudas || []).some(d => d.total > 0 && d.pagado >= d.total);
  if (liquidada) unlock('deuda_liquidada');

  // ── Fondo de emergencia ──────────────────────────────────────────────────────
  const fondoActual = S.fondoEmergencia?.actual || 0;
  if (fondoActual > 0) unlock('fondo_inicio');

  // Meta del fondo: campo propio o calculado desde ingreso × meses objetivo
  const fondoMeta = S.fondoEmergencia?.objetivo ||
    ((S.ingreso || 0) * (S.fondoEmergencia?.objetivoMeses || 6));
  if (fondoMeta > 0 && fondoActual >= fondoMeta) unlock('fondo_completo');

  // ── Inversiones ──────────────────────────────────────────────────────────────
  if ((S.inversiones || []).length > 0) unlock('primera_inversion');

  // ── Notificar y guardar si hay novedades ─────────────────────────────────────
  if (nuevos.length) {
    save();
    nuevos.forEach(id => {
      const logro = LOGROS.find(l => l.id === id);
      if (logro) _encolarToast(logro);
    });
    renderRachaWidget();
  }
}

// ─── TOAST NOTIFICATION ──────────────────────────────────────────────────────
// Cola FIFO: los toasts nunca se pisan entre sí. Máx 4.5 seg cada uno.
let _toastQueue  = [];
let _toastActivo = false;

function _encolarToast(logro) {
  _toastQueue.push(logro);
  if (!_toastActivo) _siguienteToast();
}

function _siguienteToast() {
  if (!_toastQueue.length) { _toastActivo = false; return; }
  _toastActivo = true;
  const logro = _toastQueue.shift();

  const t = document.createElement('div');
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.setAttribute('aria-label', `Nuevo logro desbloqueado: ${logro.nombre}`);

  t.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="font-size:36px;flex-shrink:0;line-height:1;">${logro.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:10px;font-weight:700;color:var(--a2);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">🏆 ¡Logro desbloqueado!</div>
        <div style="font-size:14px;font-weight:800;color:var(--t1);margin-bottom:3px;">${logro.nombre}</div>
        <div style="font-size:11px;color:var(--t3);line-height:1.45;">${logro.desc}</div>
      </div>
    </div>`;

  Object.assign(t.style, {
    position:     'fixed',
    bottom:       'calc(env(safe-area-inset-bottom, 0px) + 80px)',
    left:         '50%',
    transform:    'translateX(-50%) translateY(16px)',
    background:   'var(--s1, #0d1410)',
    border:       '1px solid rgba(255,214,10,.4)',
    borderRadius: '16px',
    padding:      '14px 18px',
    width:        'min(370px, 94vw)',
    zIndex:       '9998',
    boxShadow:    '0 8px 32px rgba(0,0,0,.6)',
    opacity:      '0',
    transition:   'opacity .35s ease, transform .35s ease',
    cursor:       'pointer',
    userSelect:   'none',
  });

  document.body.appendChild(t);

  // Entrada
  requestAnimationFrame(() => {
    t.style.opacity   = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });

  let _cerrado = false;
  const cerrar = () => {
    if (_cerrado) return;           // evita doble ejecución si click y timer coinciden
    _cerrado = true;
    clearTimeout(_autoTimer);      // cancela el timer automático si el usuario hizo click
    if (!document.body.contains(t)) { _siguienteToast(); return; } // ya fue removido
    t.style.opacity   = '0';
    t.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => { t.remove(); setTimeout(_siguienteToast, 250); }, 350);
  };

  t.addEventListener('click', cerrar);
  const _autoTimer = setTimeout(cerrar, 4500);
}

// ─── WIDGET RACHA EN DASHBOARD ────────────────────────────────────────────────
// Se inyecta dinámicamente después del div#d-alr (zona de alertas del dashboard).
// Si no hay datos, el widget desaparece solo — no ocupa espacio vacío.
export function renderRachaWidget() {
  _initLogros();
  const rachas   = S.logros.rachas;
  const rH       = rachas.sinHormiga.actual;
  const rA       = rachas.ahorro.actual;
  const total    = S.logros.desbloqueados.length;

  let cont = document.getElementById('dash-rachas-widget');
  if (!cont) {
    const anchor = document.getElementById('d-alr');
    if (!anchor) return;
    cont = document.createElement('div');
    cont.id = 'dash-rachas-widget';
    anchor.parentNode.insertBefore(cont, anchor.nextSibling);
  }

  // Si no hay nada que mostrar, limpiar y salir
  if (rH === 0 && rA === 0 && total === 0) {
    cont.innerHTML = '';
    return;
  }

  const emojiHormiga = rH >= 30 ? '🏆' : rH >= 15 ? '🔥' : rH >= 7 ? '🦋' : '🐜';

  const chip = (emoji, valor, etiqueta, color) => `
    <div style="text-align:center;flex-shrink:0;">
      <div style="font-size:22px;line-height:1;">${emoji}</div>
      <div style="font-family:var(--fm);font-size:20px;font-weight:800;color:${color};line-height:1;margin-top:2px;">${valor}</div>
      <div style="font-size:9px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-top:1px;">${etiqueta}</div>
    </div>`;

  const chips = [
    rH > 0 ? chip(emojiHormiga, rH, 'días sin<br>hormiga', 'var(--a2)') : '',
    rA > 0 ? chip('💰', rA, 'quincenas<br>ahorrando', 'var(--a1)')      : '',
  ].filter(Boolean).join('');

  cont.innerHTML = `
    <button class="card mb"
         style="padding:14px 16px;cursor:pointer;width:100%;text-align:left;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r3);"
         data-action="irALogros"
         aria-label="Ver mis logros y rachas — ${total} logro${total!==1?'s':''} desbloqueado${total!==1?'s':''}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0;">
          ${chips}
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:3px;">Mis rachas activas 🔥</div>
            <div style="font-size:11px;color:var(--t3);">${total} logro${total!==1?'s':''} desbloqueado${total!==1?'s':''} · Toca para ver todos</div>
          </div>
        </div>
        <span style="color:var(--t3);font-size:18px;flex-shrink:0;" aria-hidden="true">›</span>
      </div>
    </button>`;
}

// ─── SECCIÓN COMPLETA DE LOGROS (pestaña Balance) ─────────────────────────────
// Se inyecta al final de #sec-stat. Si el contenedor ya existe, solo actualiza.
export function renderLogros() {
  _initLogros();
  calcularRachas();

  const secStat = document.getElementById('sec-stat');
  if (!secStat) return;

  let cont = document.getElementById('logros-section');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'logros-section';
    secStat.appendChild(cont);
  }

  const desbloqueados = S.logros.desbloqueados;
  const obtenidos     = desbloqueados.length;
  const total         = LOGROS.length;
  const pct           = total > 0 ? Math.round((obtenidos / total) * 100) : 0;
  const rachas        = S.logros.rachas;

  // Catálogo por categoría
  const CATS_LOGROS = {
    inicio:    '🌱 Primeros pasos',
    hormiga:   '🐜 Hormiga domada',
    ahorro:    '💰 Ahorrador',
    deudas:    '💳 Sin deudas',
    fondo:     '🛡️ Colchoneta',
    inversion: '📊 Inversionista',
  };

  const logrosPorCat = {};
  LOGROS.forEach(l => {
    if (!logrosPorCat[l.cat]) logrosPorCat[l.cat] = [];
    logrosPorCat[l.cat].push(l);
  });

  const renderLogro = l => {
    const obtenido = desbloqueados.includes(l.id);
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;
                  background:${obtenido ? 'rgba(0,220,130,.05)' : 'var(--s1)'};
                  border:1px solid ${obtenido ? 'rgba(0,220,130,.2)' : 'var(--b1)'};
                  border-radius:10px;opacity:${obtenido ? '1' : '.45'};"
           aria-label="${l.nombre}${obtenido ? ', obtenido' : ', pendiente'}">
        <div style="font-size:26px;flex-shrink:0;filter:${obtenido ? 'none' : 'grayscale(1) opacity(.5)'};">${l.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:${obtenido ? 'var(--t1)' : 'var(--t3)'};">
            ${l.nombre}
          </div>
          <div style="font-size:10px;color:var(--t3);line-height:1.45;margin-top:2px;">
            ${obtenido ? l.desc : '???'}
          </div>
        </div>
        ${obtenido ? '<span style="color:var(--a1);font-size:18px;flex-shrink:0;" aria-hidden="true">✓</span>' : ''}
      </div>`;
  };

  const renderCat = catKey => {
    const logros = logrosPorCat[catKey];
    if (!logros?.length) return '';
    return `
      <div style="padding:16px 20px;border-bottom:1px solid var(--b1);">
        <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:10px;">${CATS_LOGROS[catKey]}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${logros.map(renderLogro).join('')}
        </div>
      </div>`;
  };

  cont.innerHTML = `
    <div class="card mb" style="padding:0;overflow:hidden;">

      <!-- Encabezado: progreso general -->
      <div style="padding:16px 20px 14px;border-bottom:1px solid var(--b1);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div class="ct" style="margin:0;">🏆 Mis Logros</div>
          <span style="font-size:11px;font-weight:700;color:var(--t3);">${obtenidos}/${total}</span>
        </div>
        <div style="height:6px;background:var(--s3);border-radius:999px;overflow:hidden;margin-bottom:5px;">
          <div style="height:100%;width:${pct}%;
                      background:linear-gradient(90deg,var(--a1),var(--a2));
                      border-radius:999px;transition:width .6s ease;"></div>
        </div>
        <div style="font-size:10px;color:var(--t3);">${pct}% completado</div>
      </div>

      <!-- Logros por categoría -->
      ${Object.keys(CATS_LOGROS).map(renderCat).join('')}

      <!-- Rachas en números -->
      <div style="padding:16px 20px 20px;">
        <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:12px;">🔥 Rachas actuales</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">

          <div style="text-align:center;padding:16px 8px;
                      background:rgba(255,214,10,.06);border:1px solid rgba(255,214,10,.2);
                      border-radius:12px;"
               aria-label="Racha sin hormiga: ${rachas.sinHormiga.actual} días">
            <div style="font-size:30px;margin-bottom:4px;">
              ${rachas.sinHormiga.actual >= 30 ? '🏆' : rachas.sinHormiga.actual >= 15 ? '🔥' : rachas.sinHormiga.actual >= 7 ? '🦋' : '🐜'}
            </div>
            <div style="font-family:var(--fm);font-size:26px;font-weight:800;color:var(--a2);">
              ${rachas.sinHormiga.actual}
            </div>
            <div style="font-size:10px;color:var(--t3);margin-top:3px;">días sin hormiga</div>
            ${rachas.sinHormiga.max > 0 ? `
            <div style="font-size:10px;color:var(--t3);margin-top:4px;opacity:.7;">
              Récord: ${rachas.sinHormiga.max} días
            </div>` : ''}
          </div>

          <div style="text-align:center;padding:16px 8px;
                      background:rgba(0,220,130,.06);border:1px solid rgba(0,220,130,.2);
                      border-radius:12px;"
               aria-label="Racha de ahorro: ${rachas.ahorro.actual} quincenas">
            <div style="font-size:30px;margin-bottom:4px;">💰</div>
            <div style="font-family:var(--fm);font-size:26px;font-weight:800;color:var(--a1);">
              ${rachas.ahorro.actual}
            </div>
            <div style="font-size:10px;color:var(--t3);margin-top:3px;">quincenas ahorrando</div>
            ${rachas.ahorro.max > 0 ? `
            <div style="font-size:10px;color:var(--t3);margin-top:4px;opacity:.7;">
              Récord: ${rachas.ahorro.max} quincenas
            </div>` : ''}
          </div>

        </div>

        ${obtenidos === 0 ? `
        <div style="text-align:center;padding:16px 0 0;color:var(--t3);font-size:12px;line-height:1.6;">
          Registrá tu primer gasto para desbloquear tu primer logro. ¡El camino empieza acá! 🚀
        </div>` : ''}
      </div>

    </div>`;

  // Marcar todos los logros actuales como vistos
  S.logros.vistos = [...desbloqueados];
}

// ─── PREDICTOR DE FIN DE QUINCENA ─────────────────────────────────────────────
// Primer banner forward-looking. Los 13 nudges previos miran hacia atrás (lo
// que ya gastaste, pagaste, ahorraste). Este responde la pregunta más cotidiana
// del usuario: "¿voy bien o voy mal este periodo?" — toma el ritmo de gasto del
// periodo en curso y proyecta linealmente hasta la fecha de cierre. Pesimista
// por diseño: si el usuario va al ritmo del primer pico, prefiere que se asuste
// hoy a que se sorprenda al final.

/**
 * Pure helper. Calcula el rango [inicio, fin] del periodo según tipoPeriodo.
 * Usa Date.UTC para evitar drift por DST en el conteo de días.
 *
 * @param {string} hoyStr        Fecha 'YYYY-MM-DD' que define el mes del periodo.
 * @param {string} tipoPeriodo   'q1' | 'q2' | 'mensual'.
 * @returns {null | {inicio:string, fin:string, diasTotales:number}}
 *   null si tipoPeriodo no es válido o hoyStr no parsea.
 */
export function _rangoPeriodo(hoyStr, tipoPeriodo) {
  if (typeof hoyStr !== 'string')                            return null;
  const m = hoyStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m)                                                    return null;
  const year  = +m[1];
  const month = +m[2];
  if (month < 1 || month > 12)                               return null;

  // Último día del mes: día 0 del mes siguiente.
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let diaInicio, diaFin;
  if      (tipoPeriodo === 'q1')      { diaInicio = 1;  diaFin = Math.min(15, ultimoDia); }
  else if (tipoPeriodo === 'q2')      { diaInicio = 16; diaFin = ultimoDia; }
  else if (tipoPeriodo === 'mensual') { diaInicio = 1;  diaFin = ultimoDia; }
  else                                                       return null;

  // Si q2 cae en un mes con 15 días o menos (imposible en gregoriano, pero
  // defensivo), retornar null en vez de un rango invertido.
  if (diaInicio > diaFin)                                    return null;

  const pad = n => String(n).padStart(2, '0');
  const inicio = `${year}-${pad(month)}-${pad(diaInicio)}`;
  const fin    = `${year}-${pad(month)}-${pad(diaFin)}`;
  const diasTotales = diaFin - diaInicio + 1;

  return { inicio, fin, diasTotales };
}

/**
 * Pure: valida que el tipoPeriodo actual sea consistente con el día del mes.
 * Si no coincide, retorna el tipoPeriodo correcto basado en el día.
 *
 * La lógica es simple: día 1-15 → 'q1', día 16-31 → 'q2'. No usa Date.UTC
 * ni cálculos complejos — es determinístico basado solo en día del mes,
 * garantizando consistencia con _rangoPeriodo().
 *
 * @param {string} hoyStr — Fecha en formato 'YYYY-MM-DD'.
 * @param {string} tipoPeriodoActual — Valor actual de S.tipoPeriodo.
 *
 * @returns {{
 *   tipoPeriodo: 'q1' | 'q2' | 'mensual',
 *   valido: boolean,
 *   motivo?: string
 * }}
 *   - tipoPeriodo: el valor correcto para hoy (siempre q1 o q2; mensual nunca es corregido)
 *   - valido: true si tipoPeriodoActual === tipoPeriodo
 *   - motivo: razón del desajuste si !valido (debug/audit)
 */
export function validarTipoPeriodo(hoyStr, tipoPeriodoActual) {
  // Parse hoyStr
  if (typeof hoyStr !== 'string') {
    return { tipoPeriodo: 'q1', valido: false, motivo: 'fecha-invalida' };
  }

  const m = hoyStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return { tipoPeriodo: 'q1', valido: false, motivo: 'fecha-invalida' };
  }

  const dia = +m[3];
  if (dia < 1 || dia > 31) {
    return { tipoPeriodo: 'q1', valido: false, motivo: 'fecha-invalida' };
  }

  // Determinar tipoPeriodo correcto basado en día del mes
  const tipoPeriodoCorrecto = dia <= 15 ? 'q1' : 'q2';

  // Validar: ¿el actual coincide con el correcto?
  const valido = tipoPeriodoActual === tipoPeriodoCorrecto;

  return {
    tipoPeriodo: tipoPeriodoCorrecto,
    valido,
    motivo: !valido ? `dia-${dia}-fuera-de-rango-${tipoPeriodoActual}` : undefined,
  };
}

/**
 * Pure: proyecta el saldo al cierre del periodo asumiendo que el ritmo de gasto
 * actual se mantiene. Devuelve un objeto rico con el detalle, o `null` cuando
 * los inputs son inservibles. El render decide qué hacer con cada `diagnostico`.
 *
 * El cálculo es lineal (gastoActual / diasTranscurridos × diasRestantes). No
 * modela picos esperados (servicios, mercado quincenal). Aceptable porque (a)
 * es transparente y predecible, (b) la heurística pesimista es preferible a
 * optimista para una herramienta preventiva.
 *
 * @param {Array<{fecha?:string, monto?:number, montoTotal?:number, tipo?:string}>} gastos
 * @param {number} ingreso          S.ingreso del periodo (>= 0).
 * @param {number} saldoActual      S.saldos.efectivo + S.saldos.banco hoy.
 * @param {string} tipoPeriodo      'q1' | 'q2' | 'mensual'.
 * @param {string} hoyStr           'YYYY-MM-DD' (inyectable para testing).
 * @param {object} [config]
 *   - minDiasParaProyectar (2): bajo este umbral → diagnostico='periodo-sin-iniciar'.
 *   - umbralCritico    (0):    saldoProyectado<umbralCritico → 'critico'.
 *   - umbralAlerta     (0.05): saldoProyectado<ingreso*umbralAlerta → 'alerta'.
 *   - umbralCuidado    (0.95): pctIngresoProyectado>=umbralCuidado*100 → 'cuidado'.
 *   - umbralExcelente  (0.70): pctIngresoProyectado<umbralExcelente*100 → 'excelente'.
 *
 * @returns {null | {
 *   fechaInicio:string, fechaFin:string,
 *   diasTotales:number, diasTranscurridos:number, diasRestantes:number,
 *   gastoActual:number, ritmoDiario:number,
 *   proyeccionAdicional:number, proyeccionTotal:number,
 *   saldoProyectado:number, pctIngresoProyectado:number|null,
 *   severidad:'critico'|'alerta'|'cuidado'|'ok'|'excelente',
 *   diagnostico:'normal'|'sin-datos'|'periodo-sin-iniciar'|'fin-de-periodo'|'fuera-de-periodo',
 *   mensaje:string
 * }}
 */
export function predecirFinQuincena(
  gastos, ingreso, saldoActual, tipoPeriodo, hoyStr, config = {}
) {
  const minDiasParaProyectar = Number.isFinite(config.minDiasParaProyectar) ? config.minDiasParaProyectar : 2;
  const umbralCritico   = Number.isFinite(config.umbralCritico)   ? config.umbralCritico   : 0;
  const umbralAlerta    = Number.isFinite(config.umbralAlerta)    ? config.umbralAlerta    : 0.05;
  const umbralCuidado   = Number.isFinite(config.umbralCuidado)   ? config.umbralCuidado   : 0.95;
  const umbralExcelente = Number.isFinite(config.umbralExcelente) ? config.umbralExcelente : 0.70;

  // Sanitizar inputs.
  const lista       = Array.isArray(gastos) ? gastos : [];
  const ing         = (Number.isFinite(ingreso)     && ingreso     > 0) ? ingreso     : 0;
  const saldo       = Number.isFinite(saldoActual)                       ? saldoActual : 0;

  // Rango del periodo.
  const rango = _rangoPeriodo(hoyStr, tipoPeriodo);
  if (!rango) return null;
  const { inicio, fin, diasTotales } = rango;

  // hoy en formato Date.UTC para conteo limpio.
  const m       = hoyStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const hoyUTC  = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const iniUTC  = Date.UTC(+inicio.slice(0, 4), +inicio.slice(5, 7) - 1, +inicio.slice(8, 10));
  const finUTC  = Date.UTC(+fin   .slice(0, 4), +fin   .slice(5, 7) - 1, +fin   .slice(8, 10));
  const DAY_MS  = 86400000;

  // Diagnóstico: ¿hoy cae fuera del periodo?
  if (hoyUTC < iniUTC || hoyUTC > finUTC) {
    return {
      fechaInicio: inicio, fechaFin: fin, diasTotales,
      diasTranscurridos: 0, diasRestantes: diasTotales,
      gastoActual: 0, ritmoDiario: 0,
      proyeccionAdicional: 0, proyeccionTotal: 0,
      saldoProyectado: saldo, pctIngresoProyectado: null,
      severidad: 'ok', diagnostico: 'fuera-de-periodo',
      mensaje: 'Hoy no cae dentro del periodo configurado.',
    };
  }

  const diasTranscurridos = Math.round((hoyUTC - iniUTC) / DAY_MS) + 1; // incluye hoy
  const diasRestantes     = Math.max(0, Math.round((finUTC - hoyUTC) / DAY_MS));

  // Sumar gastos cuya fecha cae dentro del periodo. Robusto al campo monto vs montoTotal.
  let gastoActual = 0;
  for (const g of lista) {
    if (!g || typeof g !== 'object')         continue;
    if (typeof g.fecha !== 'string')         continue;
    const mg = g.fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!mg)                                  continue;
    const fUTC = Date.UTC(+mg[1], +mg[2] - 1, +mg[3]);
    if (fUTC < iniUTC || fUTC > hoyUTC)       continue; // solo gastos hasta hoy
    // Excluir tipo 'ahorro' — no es gasto consumido del bolsillo del periodo
    if (g.tipo === 'ahorro')                  continue;
    const monto = Number.isFinite(g.montoTotal) ? g.montoTotal
               : Number.isFinite(g.monto)      ? g.monto
               : 0;
    if (monto > 0) gastoActual += monto;
  }
  gastoActual = Math.round(gastoActual);

  // Sin gastos: nada útil que proyectar. Igualmente devolvemos estructura.
  if (gastoActual === 0) {
    return {
      fechaInicio: inicio, fechaFin: fin, diasTotales,
      diasTranscurridos, diasRestantes,
      gastoActual: 0, ritmoDiario: 0,
      proyeccionAdicional: 0, proyeccionTotal: 0,
      saldoProyectado: saldo, pctIngresoProyectado: ing > 0 ? 0 : null,
      severidad: 'ok', diagnostico: 'sin-datos',
      mensaje: 'Aún no hay gastos registrados en este periodo.',
    };
  }

  // Periodo recién iniciado: 1 día con datos no es base para proyectar.
  if (diasTranscurridos < minDiasParaProyectar) {
    return {
      fechaInicio: inicio, fechaFin: fin, diasTotales,
      diasTranscurridos, diasRestantes,
      gastoActual, ritmoDiario: gastoActual,
      proyeccionAdicional: 0, proyeccionTotal: gastoActual,
      saldoProyectado: saldo, pctIngresoProyectado: ing > 0 ? +(gastoActual / ing * 100).toFixed(1) : null,
      severidad: 'ok', diagnostico: 'periodo-sin-iniciar',
      mensaje: 'Llevás muy pocos días; aún no hay base suficiente para proyectar.',
    };
  }

  // Cálculo central.
  const ritmoDiario         = gastoActual / diasTranscurridos;
  const proyeccionAdicional = Math.round(ritmoDiario * diasRestantes);
  const proyeccionTotal     = gastoActual + proyeccionAdicional;
  const saldoProyectado     = saldo - proyeccionAdicional;
  const pctIngresoProyectado = ing > 0
    ? +((proyeccionTotal / ing) * 100).toFixed(1)
    : null;

  // Diagnóstico secundario: último día del periodo (ya no hay nada que proyectar).
  const finDePeriodo = diasRestantes === 0;

  // Heurística de severidad.
  let severidad;
  if (ing > 0) {
    if      (saldoProyectado < umbralCritico)            severidad = 'critico';
    else if (saldoProyectado < ing * umbralAlerta)       severidad = 'alerta';
    else if (pctIngresoProyectado >= umbralCuidado * 100) severidad = 'cuidado';
    else if (pctIngresoProyectado < umbralExcelente * 100) severidad = 'excelente';
    else                                                  severidad = 'ok';
  } else {
    // Sin ingreso, juzgamos solo por saldo.
    if      (saldoProyectado < umbralCritico)            severidad = 'critico';
    else if (saldoProyectado < saldo * 0.10)             severidad = 'alerta';
    else                                                  severidad = 'ok';
  }

  // Mensaje principal en español Colombia.
  let mensaje;
  if (severidad === 'critico') {
    mensaje = `Si seguís a este ritmo, terminás el periodo en rojo (${proyeccionAdicional > saldo ? 'faltan' : 'sobran'} ~${Math.abs(saldoProyectado).toLocaleString('es-CO')}).`;
  } else if (severidad === 'alerta') {
    mensaje = `Vas con margen muy ajustado: terminarías con apenas ~${saldoProyectado.toLocaleString('es-CO')} disponible.`;
  } else if (severidad === 'cuidado') {
    mensaje = `A este ritmo gastarías el ${pctIngresoProyectado}% de tu ingreso del periodo.`;
  } else if (severidad === 'excelente') {
    mensaje = `Vas en muy buen ritmo: ${pctIngresoProyectado}% del ingreso proyectado.`;
  } else {
    mensaje = `Proyección al cierre: ~${saldoProyectado.toLocaleString('es-CO')} disponible.`;
  }

  return {
    fechaInicio: inicio, fechaFin: fin, diasTotales,
    diasTranscurridos, diasRestantes,
    gastoActual, ritmoDiario: +ritmoDiario.toFixed(2),
    proyeccionAdicional, proyeccionTotal,
    saldoProyectado, pctIngresoProyectado,
    severidad,
    diagnostico: finDePeriodo ? 'fin-de-periodo' : 'normal',
    mensaje,
  };
}

/**
 * Renderiza la tarjeta "predicción de fin de periodo" en el dashboard.
 * Solo aparece cuando severidad ∈ {'critico','alerta','cuidado'} y diagnóstico
 * es 'normal'. Para 'ok'/'excelente' se calla — la tarjeta de salud financiera
 * habla por los lados positivos. Para diagnósticos no-normales (sin-datos,
 * periodo-sin-iniciar, fuera-de-periodo, fin-de-periodo) tampoco aparece: no
 * hay base sólida para proyección o ya no hay tiempo de reaccionar.
 */
export function renderPrediccionFinPeriodo() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-prediccion-fin-periodo');
  if (!el) return;

  // Validar tipoPeriodo: auto-corrección defensiva
  const hoyStr = hoy();
  const validacion = validarTipoPeriodo(hoyStr, S.tipoPeriodo);
  if (!validacion.valido) {
    console.debug('[Finko] Sincronizando tipoPeriodo:', validacion.motivo);
    S.tipoPeriodo = validacion.tipoPeriodo;
    save();
  }

  const saldoActual = (S.saldos?.efectivo || 0) + (S.saldos?.banco || 0);
  const r = predecirFinQuincena(
    S.gastos || [], S.ingreso || 0, saldoActual,
    S.tipoPeriodo || 'q1', hoyStr,
  );

  const mostrar = r
    && r.diagnostico === 'normal'
    && (r.severidad === 'critico' || r.severidad === 'alerta' || r.severidad === 'cuidado');

  if (!mostrar) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  // Color según severidad.
  const palette = {
    critico: { borde: 'rgba(255,68,68,.45)',  fondo: 'rgba(255,68,68,.06)',  titulo: '#ff4444', emoji: '🚨' },
    alerta:  { borde: 'rgba(255,140,0,.40)',  fondo: 'rgba(255,140,0,.06)',  titulo: '#ff8c00', emoji: '⚠️' },
    cuidado: { borde: 'rgba(255,200,0,.35)',  fondo: 'rgba(255,200,0,.05)',  titulo: '#e6a700', emoji: '👀' },
  }[r.severidad];

  const periodoLabel = (S.tipoPeriodo === 'mensual') ? 'mes' : 'quincena';
  const subPctIngreso = (r.pctIngresoProyectado != null)
    ? `<div style="font-size:11px;color:var(--t2);line-height:1.5;margin-top:4px;">Sería el <strong>${r.pctIngresoProyectado}%</strong> de tu ingreso del periodo.</div>`
    : '';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:${palette.borde};background:${palette.fondo};">
      <div style="font-size:11px;font-weight:800;color:${palette.titulo};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        ${palette.emoji} Predicción de fin de ${periodoLabel}
      </div>
      <div style="font-size:13px;color:var(--t1);line-height:1.45;margin-bottom:6px;">
        ${he(r.mensaje)}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;">
        Llevás <strong>${f(r.gastoActual)}</strong> en ${r.diasTranscurridos} día${r.diasTranscurridos !== 1 ? 's' : ''} (~<strong>${f(Math.round(r.ritmoDiario))}/día</strong>).
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;">
        Quedan <strong>${r.diasRestantes}</strong> día${r.diasRestantes !== 1 ? 's' : ''}; proyección adicional: <strong>${f(r.proyeccionAdicional)}</strong>.
      </div>
      ${subPctIngreso}
    </div>
  `;
}

// ─── TANDA 21: CHECKLIST DE SALUD FINANCIERA ────────────────────────────────
// La pantalla "Estadísticas" muestra un checklist ✅/❌/ℹ️ con las mismas
// dimensiones que evalúa detectarAlertasFinancieras(). Antes ese checklist
// vivía inline en calcScore() con los mismos umbrales hardcodeados en dos
// lugares. Esta función pura centraliza la lógica; calcScore() la llama para
// construir su HTML, y los tests verifican las condiciones sin DOM ni S.

/**
 * Evalúa 5 dimensiones de salud financiera del periodo.
 * Función pura: no lee S, no toca DOM.
 *
 * @param {{
 *   totalGastos:    number,
 *   totalAhorro:    number,
 *   totalHormiga:   number,
 *   ingreso:        number,
 *   cuotasPeriodo:  number,
 *   tieneObjetivos: boolean,
 * }} inputs
 * @param {{
 *   umbralGasto?:   number,   // fracción del ingreso, default 0.9
 *   umbralHormiga?: number,   // fracción del ingreso, default 0.15
 *   umbralCuotas?:  number,   // fracción del ingreso, default 0.3
 * }} [config]
 * @returns {Array<{
 *   tipo:    'gastos'|'ahorro'|'hormiga'|'deudas'|'metas',
 *   estado:  'ok'|'mal'|'info',
 *   etiqueta: string,
 * }>}
 */
export function calcularChecklistSalud(inputs, config = {}) {
  if (!inputs || typeof inputs !== 'object') return [];

  const totalGastos  = Number(inputs.totalGastos)  || 0;
  const totalAhorro  = Number(inputs.totalAhorro)  || 0;
  const totalHormiga = Number(inputs.totalHormiga) || 0;
  const ingreso      = Number(inputs.ingreso)      || 0;
  const cuotasPer    = Number(inputs.cuotasPeriodo)|| 0;
  const tieneObjs    = Boolean(inputs.tieneObjetivos);

  const cfg = (config && typeof config === 'object') ? config : {};
  const umbralGasto   = Number.isFinite(+cfg.umbralGasto)   ? +cfg.umbralGasto   : 0.9;
  const umbralHormiga = Number.isFinite(+cfg.umbralHormiga) ? +cfg.umbralHormiga : 0.15;
  const umbralCuotas  = Number.isFinite(+cfg.umbralCuotas)  ? +cfg.umbralCuotas  : 0.3;

  const items = [];

  // 1. Gastos vs ingreso
  const gastosExceden = ingreso > 0 && totalGastos > ingreso * umbralGasto;
  items.push({
    tipo:     'gastos',
    estado:   gastosExceden ? 'mal' : 'ok',
    etiqueta: gastosExceden
      ? `Gastos exceden el ${Math.round(umbralGasto * 100)}%`
      : 'Gastos bajo control',
  });

  // 2. Ahorro
  items.push({
    tipo:     'ahorro',
    estado:   totalAhorro > 0 ? 'ok' : 'mal',
    etiqueta: totalAhorro > 0 ? 'Ahorro constante' : 'Sin ahorro registrado',
  });

  // 3. Gastos hormiga
  const hormigaAlta = ingreso > 0 && totalHormiga > ingreso * umbralHormiga;
  items.push({
    tipo:     'hormiga',
    estado:   hormigaAlta ? 'mal' : 'ok',
    etiqueta: hormigaAlta ? 'Fuga hormiga alta' : 'Hormiga controlada',
  });

  // 4. Cuotas de deuda (solo si hay cuotas registradas)
  if (cuotasPer > 0) {
    const cuotasAltas = ingreso > 0 && cuotasPer > ingreso * umbralCuotas;
    items.push({
      tipo:     'deudas',
      estado:   cuotasAltas ? 'info' : 'ok',
      etiqueta: cuotasAltas
        ? `Deudas >${Math.round(umbralCuotas * 100)}% del ingreso`
        : 'Deudas bajo control',
    });
  }

  // 5. Metas activas (solo si el usuario tiene objetivos configurados)
  if (tieneObjs) {
    items.push({ tipo: 'metas', estado: 'info', etiqueta: 'Metas de ahorro activas' });
  }

  return items;
}

// ─── TANDA 20: ALERTAS FINANCIERAS ───────────────────────────────────────────
// Extrae las 6 condiciones de salud financiera del periodo que antes vivían
// como código inline en updateDash() — imposibles de testear. Ahora son una
// función pura con contrato documentado. updateDash() construye el HTML final
// uniendo estas alertas con las de calendario (prima/cesantías/DIAN) que siguen
// siendo date-dependent y no viajan aquí.

/**
 * Detecta alertas de salud financiera del periodo en curso.
 * Función pura: no lee S, no toca DOM, no llama funciones de fecha.
 *
 * Cubre 6 condiciones:
 *   1. saldo-cero      — saldos efectivo+banco en $0 con ingreso registrado
 *   2. gasto-excesivo  — totalGastos > 90% del ingreso
 *   3. hormiga-alta    — totalHormiga > 15% del ingreso
 *   4. sin-ahorro      — 0 ahorros con > 3 gastos registrados
 *   5. cuotas-altas    — cuotasPeriodo > 30% del ingreso
 *   6. fijos-sin-pagar — gastos fijos del mes sin registrar pago
 *
 * @param {{
 *   totalGastos:    number,
 *   totalAhorro:    number,
 *   totalHormiga:   number,
 *   numGastos:      number,
 *   ingreso:        number,
 *   cuotasPeriodo:  number,
 *   saldos:         {efectivo:number, banco:number},
 *   gastosFijos:    Array<{nombre:string, pagadoEn?:string[]}>,
 *   mesActual:      string,   // 'YYYY-MM' del mes en curso
 * }} inputs
 * @param {{
 *   umbralGasto?:   number,   // fracción del ingreso, default 0.9
 *   umbralHormiga?: number,   // fracción del ingreso, default 0.15
 *   umbralCuotas?:  number,   // fracción del ingreso, default 0.3
 * }} [config]
 * @returns {Array<{ tipo:string, html:string }>}
 */
export function detectarAlertasFinancieras(inputs, config = {}) {
  if (!inputs || typeof inputs !== 'object') return [];

  const totalGastos   = Number(inputs.totalGastos)   || 0;
  const totalAhorro   = Number(inputs.totalAhorro)   || 0;
  const totalHormiga  = Number(inputs.totalHormiga)  || 0;
  const numGastos     = Number(inputs.numGastos)     || 0;
  const ingreso       = Number(inputs.ingreso)       || 0;
  const cuotasPer     = Number(inputs.cuotasPeriodo) || 0;
  const saldos        = (inputs.saldos && typeof inputs.saldos === 'object')
    ? inputs.saldos : { efectivo: 0, banco: 0 };
  const gastosFijos   = Array.isArray(inputs.gastosFijos) ? inputs.gastosFijos : [];
  const mesActual     = typeof inputs.mesActual === 'string' ? inputs.mesActual : '';

  const cfg = (config && typeof config === 'object') ? config : {};
  const umbralGasto   = Number.isFinite(+cfg.umbralGasto)   ? +cfg.umbralGasto   : 0.9;
  const umbralHormiga = Number.isFinite(+cfg.umbralHormiga) ? +cfg.umbralHormiga : 0.15;
  const umbralCuotas  = Number.isFinite(+cfg.umbralCuotas)  ? +cfg.umbralCuotas  : 0.3;

  const alertas = [];

  // 1. Saldo cero con ingreso registrado (usuario olvidó configurar saldos)
  if ((Number(saldos.efectivo) || 0) === 0 && (Number(saldos.banco) || 0) === 0 && ingreso > 0) {
    alertas.push({
      tipo: 'saldo-cero',
      html: `<div class="al alb"><span class="al-icon" aria-hidden="true">💡</span><div>Saldos en $0. Ve a <strong>Quincena</strong> y configura cuánto tenés en efectivo y banco.</div></div>`,
    });
  }

  // 2. Gasto excesivo (> umbralGasto % del ingreso)
  if (ingreso > 0 && totalGastos > ingreso * umbralGasto) {
    alertas.push({
      tipo: 'gasto-excesivo',
      html: `<div class="al ald"><span class="al-icon" aria-hidden="true">🚨</span><div>Gastás más del ${Math.round(umbralGasto * 100)}% de tu ingreso esta quincena. Revisá tus finanzas urgente.</div></div>`,
    });
  }

  // 3. Gastos hormiga altos (> umbralHormiga % del ingreso)
  if (ingreso > 0 && totalHormiga > ingreso * umbralHormiga) {
    const pctH = Math.round((totalHormiga / ingreso) * 100);
    alertas.push({
      tipo: 'hormiga-alta',
      html: `<div class="al alw"><span class="al-icon" aria-hidden="true">🐜</span><div>Tus gastos hormiga ya representan el <strong>${pctH}%</strong> de tu ingreso (${f(totalHormiga)}). ¡Es una fuga de capital muy alta!</div></div>`,
    });
  }

  // 4. Sin ahorro registrado habiendo gastos suficientes
  if (totalAhorro === 0 && numGastos > 3) {
    alertas.push({
      tipo: 'sin-ahorro',
      html: `<div class="al alw"><span class="al-icon" aria-hidden="true">💰</span><div>No registraste ningún ahorro esta quincena. ¡Págate a vos primero!</div></div>`,
    });
  }

  // 5. Cuotas de deuda altas (> umbralCuotas % del ingreso)
  if (ingreso > 0 && cuotasPer > ingreso * umbralCuotas) {
    alertas.push({
      tipo: 'cuotas-altas',
      html: `<div class="al ald"><span class="al-icon" aria-hidden="true">💳</span><div>Las cuotas de tus deudas (${f(cuotasPer)}) superan el ${Math.round(umbralCuotas * 100)}% de tu ingreso. Estás en zona de riesgo financiero.</div></div>`,
    });
  }

  // 6. Gastos fijos sin pagar este mes
  const fijNP = gastosFijos.filter(g =>
    g && typeof g === 'object' &&
    !Array.isArray(g.pagadoEn || []) === false &&
    !(g.pagadoEn || []).includes(mesActual)
  );
  if (fijNP.length > 0) {
    const nombres = fijNP.map(g => (typeof g.nombre === 'string' ? g.nombre : '?')).join(', ');
    alertas.push({
      tipo: 'fijos-sin-pagar',
      html: `<div class="al alb"><span class="al-icon" aria-hidden="true">📌</span><div><strong>${fijNP.length}</strong> gasto(s) fijo(s) sin pagar este mes: ${nombres}.</div></div>`,
    });
  }

  return alertas;
}

// ─── TANDA 19: ALERTAS INTELIGENTES ──────────────────────────────────────────
// Detecta condiciones de riesgo NO cubiertas por el sistema de alertas inline
// de updateDash() (saldo cero, gasto/ingreso, cuotas, fijos). Cubre:
//   1. saldo-negativo  — saldo efectivo+banco < 0 (sobredraft / déficit de caja)
//   2. evento-excedido — objetivo tipo evento con gastado > presupuesto
//   3. evento-cerca    — objetivo tipo evento con gastado ≥ pctCercaLimite del presupuesto
//   4. sin-registro    — ningún movimiento en los últimos N días (app olvidada)

/**
 * Detecta alertas urgentes basadas en estado financiero actual.
 * Función pura: no lee S, no toca DOM.
 *
 * @param {{
 *   saldos?:   {efectivo:number, banco:number},
 *   objetivos?: Array,
 *   gastos?:    Array<{fecha:string}>,
 *   hoyStr?:   string,
 * }} inputs
 * @param {{
 *   diasSinRegistroUmbral?: number,  // default 7 — días sin gasto antes de avisar
 *   pctCercaLimite?:        number,  // default 0.85 — % del presupuesto que activa "cerca"
 * }} [config]
 * @returns {Array<{tipo:string, nivel:'critico'|'alerta'|'cuidado', icono:string, mensaje:string}>}
 */
export function detectarAlertasUrgentes(inputs, config = {}) {
  if (!inputs || typeof inputs !== 'object') return [];

  const saldos   = (inputs.saldos && typeof inputs.saldos === 'object')
    ? inputs.saldos : { efectivo: 0, banco: 0 };
  const objetivos = Array.isArray(inputs.objetivos) ? inputs.objetivos : [];
  const gastos    = Array.isArray(inputs.gastos)    ? inputs.gastos    : [];
  const hoyStr    = typeof inputs.hoyStr === 'string' ? inputs.hoyStr : '';

  const cfg = (config && typeof config === 'object') ? config : {};

  const diasUmbral = (Number.isFinite(+cfg.diasSinRegistroUmbral) && +cfg.diasSinRegistroUmbral >= 1)
    ? Math.floor(+cfg.diasSinRegistroUmbral) : 7;

  const pctCerca = (Number.isFinite(+cfg.pctCercaLimite) && +cfg.pctCercaLimite > 0 && +cfg.pctCercaLimite < 1)
    ? +cfg.pctCercaLimite : 0.85;

  const alertas = [];

  // ── 1. Saldo negativo ──────────────────────────────────────────────────────
  const ef = Number(saldos.efectivo) || 0;
  const bk = Number(saldos.banco)    || 0;
  const saldoTotal = ef + bk;
  if (saldoTotal < 0) {
    alertas.push({
      tipo:    'saldo-negativo',
      nivel:   'critico',
      icono:   '🔴',
      mensaje: `Saldo negativo: efectivo + banco suman ${f(saldoTotal)}. Revisá urgente.`,
    });
  }

  // ── 2. Objetivos tipo evento: excedido o cerca del límite ─────────────────
  for (const o of objetivos) {
    if (!o || typeof o !== 'object' || o.tipo !== 'evento') continue;
    const pres = Math.max(0, Number(o.presupuesto) || 0);
    const gast = Math.max(0, Number(o.gastado)     || 0);
    if (pres <= 0) continue;  // sin presupuesto no aplica

    const nombre = (typeof o.nombre === 'string' && o.nombre.trim()) ? o.nombre.trim() : 'Evento';
    const pct    = gast / pres;

    if (gast > pres) {
      alertas.push({
        tipo:    'evento-excedido',
        nivel:   'alerta',
        icono:   '⚠️',
        mensaje: `"${nombre}" superó el presupuesto: ${f(gast)} de ${f(pres)} (${Math.round(pct * 100)}%).`,
      });
    } else if (pct >= pctCerca) {
      alertas.push({
        tipo:    'evento-cerca',
        nivel:   'cuidado',
        icono:   '🟡',
        mensaje: `"${nombre}" casi agotado: ${f(gast)} de ${f(pres)} (${Math.round(pct * 100)}%).`,
      });
    }
  }

  // ── 3. Sin registros en N días ────────────────────────────────────────────
  const mHoy = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoyStr);
  if (mHoy && gastos.length > 0) {
    let maxFecha = '';
    for (const g of gastos) {
      if (typeof g.fecha === 'string' && g.fecha > maxFecha) maxFecha = g.fecha;
    }
    if (maxFecha) {
      const mMax = /^(\d{4})-(\d{2})-(\d{2})/.exec(maxFecha);
      if (mMax) {
        const tHoy = Date.UTC(+mHoy[1], +mHoy[2] - 1, +mHoy[3]);
        const tMax = Date.UTC(+mMax[1], +mMax[2] - 1, +mMax[3]);
        const dias = Math.floor((tHoy - tMax) / 86_400_000);
        if (dias >= diasUmbral) {
          alertas.push({
            tipo:    'sin-registro',
            nivel:   'cuidado',
            icono:   '📅',
            mensaje: `Hace ${dias} día${dias !== 1 ? 's' : ''} sin registrar movimientos. ¿Olvidaste algo?`,
          });
        }
      }
    }
  }

  return alertas;
}

/**
 * Renderiza el panel de alertas inteligentes en el dashboard.
 * Muestra alertas de saldo negativo, presupuesto de evento excedido/cercano,
 * y ausencia prolongada de registros. Solo se muestra cuando hay ≥1 alerta.
 */
export function renderAlertasUrgentes() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-alertas-inteligentes');
  if (!el) return;

  const alertas = detectarAlertasUrgentes({
    saldos:   S.saldos   || { efectivo: 0, banco: 0 },
    objetivos: S.objetivos || [],
    gastos:   S.gastos   || [],
    hoyStr:   hoy(),
  });

  if (!alertas.length) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const PALETTE = {
    critico: { borde: 'rgba(255,68,68,.35)',  fondo: 'rgba(255,68,68,.05)',  titulo: '#ff4444' },
    alerta:  { borde: 'rgba(255,140,0,.35)',  fondo: 'rgba(255,140,0,.05)',  titulo: '#ff8c00' },
    cuidado: { borde: 'rgba(255,180,0,.35)',  fondo: 'rgba(255,180,0,.05)',  titulo: '#ffb400' },
  };

  const items = alertas.map(a => {
    const p = PALETTE[a.nivel] || PALETTE.cuidado;
    return `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-left:3px solid ${p.titulo};margin-bottom:6px;border-radius:0 6px 6px 0;background:${p.fondo};">
        <span style="font-size:15px;flex-shrink:0;" aria-hidden="true">${a.icono}</span>
        <span style="font-size:12px;color:var(--t1);line-height:1.4;">${he(a.mensaje)}</span>
      </div>`;
  }).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,100,0,.3);background:rgba(255,100,0,.03);padding:10px 12px;">
      <div style="font-size:11px;font-weight:800;color:#ff8c00;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
        🔔 Alertas activas
      </div>
      ${items}
    </div>
  `;
}

// ─── TANDA 23: PATRÓN DE GASTO SEMANAL ───────────────────────────────────────
// Detecta si el usuario gasta sistemáticamente más en ciertos días de la semana.
// "Los viernes gastás 3× más que el promedio" es el insight preventivo que falta
// en el dashboard. Usa Date.UTC anti-DST para consistencia con el resto del
// codebase.

const _DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const _RX_PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Analiza los gastos y detecta si hay días de la semana con gasto
 * sistemáticamente mayor al promedio.
 * Función pura: no lee S, no toca DOM.
 *
 * @param {Array<{fecha:string, monto?:number, montoTotal?:number, tipo?:string}>} gastos
 * @param {string} hoyISO  'YYYY-MM-DD' — límite superior de la ventana de análisis.
 * @param {{
 *   ventanaDias?:      number,   // cuántos días hacia atrás analizar (default 90)
 *   factorUmbral?:     number,   // cuántas veces por encima del promedio para destacar (default 2.0)
 *   minGastos?:        number,   // mínimo de gastos totales para activar (default 7)
 *   minOcurrencias?:   number,   // mínimo de veces que debe aparecer un día (default 2)
 *   excluirAhorro?:    boolean,  // ignorar tipo='ahorro' (default true)
 * }} [config]
 * @returns {{
 *   porDia:            Array<{dia:number, nombre:string, total:number, ocurrencias:number, promedioPorOcurrencia:number}>,
 *   diasDestacados:    Array<{dia:number, nombre:string, factor:number, severidad:'alta'|'media', etiqueta:string}>,
 *   promedioGlobalDia: number,
 *   totalAnalizado:    number,
 *   gastosAnalizados:  number,
 * } | null}  null si inputs inválidos o datos insuficientes
 */
export function detectarPatronGastoSemanal(gastos, hoyISO, config = {}) {
  if (!Array.isArray(gastos))            return null;
  if (typeof hoyISO !== 'string')        return null;
  const mHoy = _RX_PATRON.exec(hoyISO);
  if (!mHoy)                             return null;

  const cfg = (config && typeof config === 'object') ? config : {};
  const ventana        = (Number.isFinite(+cfg.ventanaDias)    && +cfg.ventanaDias    > 0) ? Math.floor(+cfg.ventanaDias)    : 90;
  const factorUmbral   = (Number.isFinite(+cfg.factorUmbral)   && +cfg.factorUmbral   > 0) ? +cfg.factorUmbral               : 2.0;
  const minGastos      = (Number.isFinite(+cfg.minGastos)      && +cfg.minGastos      > 0) ? Math.floor(+cfg.minGastos)      : 7;
  const minOcurrencias = (Number.isFinite(+cfg.minOcurrencias) && +cfg.minOcurrencias > 0) ? Math.floor(+cfg.minOcurrencias) : 2;
  const excluirAhorro  = cfg.excluirAhorro !== false; // default true

  const tHoy      = Date.UTC(+mHoy[1], +mHoy[2] - 1, +mHoy[3]);
  const tLimite   = tHoy - ventana * 86_400_000;

  // Acumular por día de semana: [0..6] = Dom..Sáb
  const totales     = new Array(7).fill(0);
  const ocurrencias = new Array(7).fill(0);
  let gastosContados = 0;
  let totalAnalizado = 0;

  for (const g of gastos) {
    if (!g || typeof g !== 'object')                               continue;
    if (excluirAhorro && g.tipo === 'ahorro')                      continue;
    if (typeof g.fecha !== 'string')                               continue;
    const mg = _RX_PATRON.exec(g.fecha);
    if (!mg)                                                       continue;
    const tG = Date.UTC(+mg[1], +mg[2] - 1, +mg[3]);
    if (tG < tLimite || tG > tHoy)                                 continue;

    const monto = Number(g.montoTotal) || Number(g.monto) || 0;
    if (monto <= 0)                                                continue;

    // getUTCDay(): 0=Sun…6=Sat
    const diaSemana = new Date(tG).getUTCDay();
    totales[diaSemana]     += monto;
    ocurrencias[diaSemana] += 1;
    gastosContados++;
    totalAnalizado += monto;
  }

  if (gastosContados < minGastos) return null;

  // Construir porDia solo con días que tienen datos
  const diasConDatos = totales.filter((t, i) => ocurrencias[i] > 0).length;
  if (diasConDatos === 0) return null;

  // Promedio global: total / días distintos con datos
  const promedioGlobalDia = totalAnalizado / diasConDatos;

  const porDia = _DIAS_ES.map((nombre, dia) => ({
    dia,
    nombre,
    total:                  totales[dia],
    ocurrencias:            ocurrencias[dia],
    promedioPorOcurrencia:  ocurrencias[dia] > 0 ? Math.round(totales[dia] / ocurrencias[dia]) : 0,
  }));

  // Días destacados: total del día >= factorUmbral × promedio global Y ocurrencias suficientes
  const diasDestacados = porDia
    .filter(d => d.ocurrencias >= minOcurrencias && d.total >= promedioGlobalDia * factorUmbral)
    .map(d => {
      const factor     = +(d.total / promedioGlobalDia).toFixed(1);
      const severidad  = factor >= 3.0 ? 'alta' : 'media';
      return {
        dia:       d.dia,
        nombre:    d.nombre,
        factor,
        severidad,
        etiqueta:  `Los ${d.nombre.toLowerCase()} gastás ${factor}× el promedio`,
      };
    })
    .sort((a, b) => b.factor - a.factor);

  return { porDia, diasDestacados, promedioGlobalDia: Math.round(promedioGlobalDia), totalAnalizado, gastosAnalizados: gastosContados };
}

/**
 * Renderiza el nudge de patrón de gasto semanal en el dashboard.
 * Solo aparece cuando hay ≥1 día destacado con severidad 'alta' o 'media'.
 */
export function renderPatronGastoSemanal() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-patron-semanal');
  if (!el) return;

  const r = detectarPatronGastoSemanal(S.gastos || [], hoy());
  if (!r || r.diasDestacados.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const destacados = r.diasDestacados.slice(0, 3);
  const hayAlta    = destacados.some(d => d.severidad === 'alta');
  const palette    = hayAlta
    ? { borde: 'rgba(255,68,68,.35)',  fondo: 'rgba(255,68,68,.05)',  titulo: '#ff4444', emoji: '📊' }
    : { borde: 'rgba(255,180,0,.35)',  fondo: 'rgba(255,180,0,.05)',  titulo: '#ffb400', emoji: '📊' };

  const filas = destacados.map(d => {
    const barPct   = Math.min(Math.round((d.factor / 4) * 100), 100);
    const colorBar = d.severidad === 'alta' ? '#ff4444' : '#ffb400';
    return `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <span style="font-size:12px;color:var(--t1);font-weight:600;">${he(d.nombre)}</span>
          <span style="font-size:11px;color:${colorBar};font-weight:700;">${d.factor}× el promedio</span>
        </div>
        <div style="height:4px;border-radius:4px;background:var(--s3);">
          <div style="width:${barPct}%;height:4px;border-radius:4px;background:${colorBar};transition:width .4s ease;"></div>
        </div>
      </div>`;
  }).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:${palette.borde};background:${palette.fondo};">
      <div style="font-size:11px;font-weight:800;color:${palette.titulo};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
        ${palette.emoji} Patrón de gasto semanal
      </div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:10px;">
        Estos días de la semana concentran más gasto del habitual (últimos ${90} días):
      </div>
      ${filas}
      <div style="font-size:10px;color:var(--t3);margin-top:6px;">
        Promedio diario de referencia: ${f(r.promedioGlobalDia)}
      </div>
    </div>
  `;
}

// ─── REGISTRO DE ACCIONES ─────────────────────────────────────────────────────
registerAction('renderStats',          () => renderStats());
registerAction('calcDistribucionReal', () => calcDistribucionReal());
registerAction('evaluarLogros',        () => evaluarLogros());
registerAction('renderLogros',         () => renderLogros());
registerAction('renderRachaWidget',    () => renderRachaWidget());
registerAction('calcularRachas',       () => calcularRachas());
registerAction('renderMesesSinCerrar',   () => renderMesesSinCerrar());
registerAction('renderHormigaAcumulada', () => renderHormigaAcumulada());
registerAction('renderSaludFinanciera',  () => renderSaludFinanciera());
registerAction('renderComparacionCategorias', () => renderComparacionCategorias());
registerAction('renderTendencias',       () => renderTendencias());
registerAction('renderPrediccionFinPeriodo', () => renderPrediccionFinPeriodo());
registerAction('renderAlertasUrgentes',     () => renderAlertasUrgentes());
registerAction('renderPatronGastoSemanal',  () => renderPatronGastoSemanal());
// Helper compuesto: navega a la sección stat y renderiza logros tras la
// transición de UI (~120 ms). Antes era un onclick inline encadenado.
registerAction('irALogros', () => {
  if (typeof window === 'undefined') return;
  window.go?.('stat');
  setTimeout(() => window.renderLogros?.(), 120);
});

// ─── EXPOSICIÓN GLOBAL ────────────────────────────────────────────────────────
// Guard `typeof window` para soportar tests/SSR sin DOM.
if (typeof window !== 'undefined') {
  window.renderStats            = renderStats;
  window.calcDistribucionReal   = calcDistribucionReal;
  window.evaluarLogros          = evaluarLogros;
  window.renderLogros           = renderLogros;
  window.renderRachaWidget      = renderRachaWidget;
  window.calcularRachas         = calcularRachas;
  window.renderMesesSinCerrar   = renderMesesSinCerrar;   // updateDash
  window.renderHormigaAcumulada = renderHormigaAcumulada; // updateDash
  window.renderSaludFinanciera  = renderSaludFinanciera;  // updateDash
  window.renderComparacionCategorias = renderComparacionCategorias; // updateDash
  window.renderTendencias       = renderTendencias;       // updateDash
  window.renderPrediccionFinPeriodo  = renderPrediccionFinPeriodo;  // updateDash
  window.renderAlertasUrgentes       = renderAlertasUrgentes;       // updateDash
  window.renderPatronGastoSemanal    = renderPatronGastoSemanal;    // updateDash
}
