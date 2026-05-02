// Fusión de: objetivos.js + inversiones.js
import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import { f, he, hoy, setEl, openM, closeM, showAlert, showConfirm, descontarFondo } from '../infra/utils.js';
import { renderSmart } from '../infra/render.js';
import { registerAction } from '../ui/actions.js';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PURAS DEL DOMINIO (R1 auditoría v5)
// ═══════════════════════════════════════════════════════════════════════════════
// Sin S, sin DOM. Las usan los renders y los modales más abajo.

/**
 * Progreso de la fase de ahorro de un objetivo.
 *
 * @param {{ahorrado:number, objetivoAhorro:number}} obj
 * @returns {{pct:number, falta:number, completado:boolean,
 *            colorVar:'var(--a1)'|'var(--a2)'|'var(--a4)'}}
 */
export function calcularProgresoObjetivo(obj) {
  const ahorrado = obj?.ahorrado || 0;
  const meta     = obj?.objetivoAhorro || 0;
  const pctRaw   = meta > 0 ? (ahorrado / meta) * 100 : 0;
  const pct      = Math.min(pctRaw, 100);
  const falta    = Math.max(0, meta - ahorrado);
  const completado = pct >= 100;
  let colorVar;
  if (pct >= 100)      colorVar = 'var(--a1)';
  else if (pct > 50)   colorVar = 'var(--a2)';
  else                 colorVar = 'var(--a4)';
  return { pct, falta, completado, colorVar };
}

/**
 * Progreso de gasto de un objetivo tipo evento (presupuesto consumido).
 *
 * @param {{gastado:number, presupuesto:number}} obj
 * @returns {{pct:number, disponible:number, excedido:boolean,
 *            colorVar:'var(--dan)'|'var(--a2)'|'var(--a1)'}}
 */
export function calcularProgresoEvento(obj) {
  const gastado     = obj?.gastado || 0;
  const presupuesto = obj?.presupuesto || 0;
  const pctRaw      = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;
  const pct         = Math.min(pctRaw, 100);
  const disponible  = Math.max(0, presupuesto - gastado);
  const excedido    = pctRaw >= 100 && presupuesto > 0;
  let colorVar;
  if (pct >= 100)     colorVar = 'var(--dan)';
  else if (pct > 75)  colorVar = 'var(--a2)';
  else                colorVar = 'var(--a1)';
  return { pct, disponible, excedido, colorVar };
}

/**
 * Simulación de tiempo para llegar a una meta de ahorro.
 *
 * @param {{aporte:number, diasPer:number, falta:number}} inputs
 *   • aporte  — pesos por período.
 *   • diasPer — duración de un período (1=día, 7=semana, 15=quincena, 30=mes).
 *   • falta   — pesos restantes para la meta.
 * @returns {null|{periodos:number, diasTotal:number, frecNombre:string,
 *                 tiempoStr:string}}  null si los inputs no permiten estimación.
 */
export function calcularSimObjetivo({ aporte, diasPer, falta }) {
  if (!(aporte > 0) || !(falta > 0)) return null;
  const dp        = diasPer > 0 ? diasPer : 15;
  const periodos  = Math.ceil(falta / aporte);
  const diasTotal = periodos * dp;
  const nombres   = { 30: 'mes', 15: 'quincena', 7: 'semana', 1: 'día' };
  const frecNombre = nombres[dp] || 'período';

  let tiempoStr;
  if (diasTotal < 30) {
    tiempoStr = `${diasTotal} días`;
  } else if (diasTotal < 365) {
    const m = Math.ceil(diasTotal / 30);
    tiempoStr = `${m} mes${m !== 1 ? 'es' : ''}`;
  } else {
    const a  = Math.floor(diasTotal / 365);
    const mr = Math.floor((diasTotal % 365) / 30);
    tiempoStr = `${a} año${a !== 1 ? 's' : ''}` +
                (mr > 0 ? ` y ${mr} mes${mr !== 1 ? 'es' : ''}` : '');
  }
  return { periodos, diasTotal, frecNombre, tiempoStr };
}

/**
 * Aporte por frecuencia para llegar a `falta` en `diasRestantes`.
 * Usa min 1 período para evitar división por 0.
 *
 * @param {number} falta
 * @param {number} diasRestantes
 * @returns {{diario:number, semanal:number, quincenal:number, mensual:number}}
 */
export function calcularAportePorFrecuencia(falta, diasRestantes) {
  if (!(falta > 0) || !(diasRestantes > 0)) {
    return { diario: 0, semanal: 0, quincenal: 0, mensual: 0 };
  }
  const calc = dias => falta / Math.max(1, diasRestantes / dias);
  return {
    diario:    calc(1),
    semanal:   calc(7),
    quincenal: calc(15),
    mensual:   calc(30),
  };
}

/**
 * Rendimiento de una inversión: porcentaje y semaforización.
 *
 * @param {{capital:number, rendimiento:number}} inv
 * @returns {{valorTotal:number, pct:number, signo:'+'|'',
 *            colorVar:'var(--a1)'|'var(--dan)', positivo:boolean}}
 */
export function calcularRendimientoInversion(inv) {
  const capital     = inv?.capital || 0;
  const rendimiento = inv?.rendimiento || 0;
  const valorTotal  = capital + rendimiento;
  const pct         = capital > 0 ? (rendimiento / capital) * 100 : 0;
  const positivo    = rendimiento >= 0;
  return {
    valorTotal,
    pct,
    signo:    positivo ? '+' : '',
    colorVar: positivo ? 'var(--a1)' : 'var(--dan)',
    positivo,
  };
}

// ─── DETECTOR DE OBJETIVOS SIN PROGRESO ──────────────────────────────────────
// Cierra el set de detectores defensivos: ya tenemos para gastos (atípicos +
// duplicados), deudas (durmiendo), fijos (sin pagar), bolsillos (olvidados +
// fuga), hormigas (acumuladas). Faltaba el caso del objetivo abandonado: el
// usuario crea "Viaje Diciembre $3M", abona dos veces y se olvida.
//
// Por qué importa: un objetivo sin progreso es un compromiso fantasma que
// distorsiona la sensación de planificación. El usuario "tiene" 4 metas pero
// realmente solo está alimentando 1 — mejor reconocerlo y replantear.
//
// Fuente del último aporte (orden de prioridad, similar a deudas durmiendo):
//   1. obj.fechaUltimoAporte — preferido (set por ejecutarAccionObjetivo).
//   2. gastos[metaId === obj.id, tipo === 'ahorro'] — fallback (se pierde tras cerrarQ).
//   3. obj.id como Date.now() ms — fecha de creación.

const _RX_FECHA_OBJ = /^(\d{4})-(\d{2})-(\d{2})/;

/** Diferencia en días entre dos fechas YYYY-MM-DD. null si malformadas. UTC anti-DST. */
function _diffDiasObj(desdeISO, hastaISO) {
  const a = _RX_FECHA_OBJ.exec(desdeISO);
  const b = _RX_FECHA_OBJ.exec(hastaISO);
  if (!a || !b) return null;
  const dA = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const dB = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  return Math.floor((dB - dA) / 86_400_000);
}

/**
 * Pure: detecta objetivos vivos (no completados) sin aportes hace N+ meses.
 *
 * @param {Array<{
 *   id:number, nombre?:string, tipo?:string, icono?:string,
 *   objetivoAhorro?:number, ahorrado?:number,
 *   fechaUltimoAporte?:string
 * }>} objetivos
 * @param {Array<{metaId?:number|null|string, tipo?:string, fecha?:string}>} gastos
 * @param {string} hoyISO 'YYYY-MM-DD'.
 * @param {{mesesUmbral?:number}} [config]
 *   - mesesUmbral (default 2): meses sin aporte para considerar el objetivo abandonado.
 * @returns {Array<{
 *   id:number, nombre:string, tipo:string, icono:string,
 *   objetivoAhorro:number, ahorrado:number, faltante:number, pctProgreso:number,
 *   ultimoAporte:string|null, fuenteUltimoAporte:'fechaUltimoAporte'|'gasto'|'creacion',
 *   diasSinAporte:number, mesesSinAporte:number,
 *   severidad:'alta'|'media'|'baja',
 *   sugerencia:'eliminar'|'replantear'
 * }>}
 */
export function detectarObjetivosSinProgreso(objetivos, gastos, hoyISO, config = {}) {
  if (!Array.isArray(objetivos) || objetivos.length === 0)         return [];
  if (typeof hoyISO !== 'string' || !_RX_FECHA_OBJ.test(hoyISO))   return [];

  const cfg = (config && typeof config === 'object') ? config : {};
  const umbral = (Number.isFinite(+cfg.mesesUmbral) && +cfg.mesesUmbral > 0)
    ? Math.floor(+cfg.mesesUmbral) : 2;

  // Index del último aporte por metaId. Solo gastos tipo 'ahorro' cuentan
  // como aporte (los gastos tipo 'deseo' de objetivos evento son retiros).
  const ultimoAportePorMeta = new Map();
  if (Array.isArray(gastos)) {
    for (const g of gastos) {
      if (!g || typeof g !== 'object')                       continue;
      if (g.tipo !== 'ahorro')                               continue;
      if (g.metaId == null || g.metaId === '')               continue;
      if (typeof g.fecha !== 'string' || !_RX_FECHA_OBJ.test(g.fecha)) continue;
      // metaId puede venir como number o string — normalizamos a number.
      const mid = Number(g.metaId);
      if (!Number.isFinite(mid))                             continue;
      const prev = ultimoAportePorMeta.get(mid);
      if (!prev || g.fecha > prev) ultimoAportePorMeta.set(mid, g.fecha);
    }
  }

  const out = [];

  for (const obj of objetivos) {
    if (!obj || typeof obj !== 'object')               continue;
    if (typeof obj.id !== 'number' || obj.id <= 0)     continue;

    const meta     = Number(obj.objetivoAhorro) || 0;
    const ahorrado = Number(obj.ahorrado)       || 0;
    if (meta <= 0)                                     continue;  // sin meta no se puede juzgar
    if (ahorrado >= meta)                              continue;  // completado, no es "sin progreso"

    // Fuente del último aporte
    let ultimoAporte = null;
    let fuente = 'creacion';
    if (typeof obj.fechaUltimoAporte === 'string' && _RX_FECHA_OBJ.test(obj.fechaUltimoAporte)) {
      ultimoAporte = obj.fechaUltimoAporte.slice(0, 10);
      fuente = 'fechaUltimoAporte';
    } else if (ultimoAportePorMeta.has(obj.id)) {
      ultimoAporte = ultimoAportePorMeta.get(obj.id).slice(0, 10);
      fuente = 'gasto';
    } else {
      const ms = +obj.id;
      if (Number.isFinite(ms) && ms > 0) {
        const dt = new Date(ms);
        const yyyy = dt.getUTCFullYear();
        const mm   = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd   = String(dt.getUTCDate()).padStart(2, '0');
        ultimoAporte = `${yyyy}-${mm}-${dd}`;
        fuente = 'creacion';
      }
    }
    if (!ultimoAporte)                                  continue;

    const dias = _diffDiasObj(ultimoAporte, hoyISO);
    if (dias === null || dias < 0)                     continue;
    const meses = Math.floor(dias / 30);
    if (meses < umbral)                                continue;

    let severidad;
    if (meses >= 6)      severidad = 'alta';
    else if (meses >= 3) severidad = 'media';
    else                 severidad = 'baja';

    // Sugerencia: si nunca aportaste nada, mejor borrar y replantear desde cero.
    // Si ya hay progreso, sugerir replantear (cambiar plazo, monto o eliminar).
    const sugerencia = (ahorrado <= 0) ? 'eliminar' : 'replantear';

    const faltante    = Math.max(0, meta - ahorrado);
    const pctProgreso = +(ahorrado / meta * 100).toFixed(1);

    out.push({
      id:                 obj.id,
      nombre:             (typeof obj.nombre === 'string' && obj.nombre.length > 0) ? obj.nombre : 'Sin nombre',
      tipo:               (typeof obj.tipo   === 'string' && obj.tipo.length   > 0) ? obj.tipo   : 'ahorro',
      icono:              (typeof obj.icono  === 'string' && obj.icono.length  > 0) ? obj.icono  : '🎯',
      objetivoAhorro:     meta,
      ahorrado,
      faltante,
      pctProgreso,
      ultimoAporte,
      fuenteUltimoAporte: fuente,
      diasSinAporte:      dias,
      mesesSinAporte:     meses,
      severidad,
      sugerencia,
    });
  }

  // Orden: alta → media → baja. Dentro, mayor faltante primero (más plata
  // pendiente). Empate → menor id (determinístico).
  const rank = { alta: 0, media: 1, baja: 2 };
  out.sort((a, b) => {
    const r = rank[a.severidad] - rank[b.severidad];
    if (r !== 0) return r;
    const df = b.faltante - a.faltante;
    if (df !== 0) return df;
    return a.id - b.id;
  });

  return out;
}

/**
 * Renderiza la tarjeta de "objetivos sin progreso" en el dashboard. Muestra
 * los 3 peor parados con CTA según sugerencia: replantear → abrir el modal
 * de aportar; eliminar → llevar a la sección de objetivos para gestionarlo.
 */
export function renderObjetivosSinProgreso() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-objetivos-sin-progreso');
  if (!el) return;

  const sinProg = detectarObjetivosSinProgreso(S.objetivos || [], S.gastos || [], hoy());
  if (sinProg.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = sinProg.slice(0, 3);

  const filas = top.map(o => {
    const labelMeses = o.mesesSinAporte === 1 ? '1 mes' : `${o.mesesSinAporte} meses`;
    const ctaTxt = o.sugerencia === 'eliminar' ? 'Revisar' : 'Aportar';
    // Para 'eliminar' enviamos a la sección de metas; para 'replantear' abrimos
    // el modal de acción directamente.
    const cta = o.sugerencia === 'eliminar'
      ? `<button class="btn bg bsm" data-action="go" data-arg-sec="metas" aria-label="Revisar el objetivo ${he(o.nombre)} en su sección">Revisar</button>`
      : `<button class="btn bbl bsm" data-action="abrirAccionObj" data-arg-id="${o.id}" data-arg-accion="abonar" aria-label="Aportar al objetivo ${he(o.nombre)} para retomar el progreso">Aportar</button>`;
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--b1);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:22px;flex-shrink:0;" aria-hidden="true">${he(o.icono)}</span>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${he(o.nombre)}">${he(o.nombre)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">
            Sin aporte hace <strong>${labelMeses}</strong> · ${o.pctProgreso}% (${f(o.ahorrado)} de ${f(o.objetivoAhorro)})
          </div>
        </div>
      </div>
      ${cta}
    </div>`;
  }).join('');

  const titulo = sinProg.length === 1
    ? 'Un objetivo lleva tiempo sin progreso'
    : `${sinProg.length} objetivos llevan tiempo sin progreso`;

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(0,180,200,.35);background:rgba(0,180,200,.05);">
      <div style="font-size:11px;font-weight:800;color:#00b4c8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        🎯 ${he(titulo)}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Los objetivos sin movimiento son compromisos fantasma. Aportá algo para retomar el ritmo o replanteálos si el plan cambió.
      </div>
      ${filas}
    </div>
  `;
}

// ─── DETECTOR DE INVERSIONES SIN ACTUALIZAR ──────────────────────────────────
// El usuario registra CDT, fondos, acciones, etc. pero los olvida en el dashboard.
// Sin actualización del rendimiento hace N+ meses, no hay visibilidad de cambios:
// ¿rinde?, ¿se redactó?, ¿cambió de condiciones?
//
// Diferencia con renderInversiones() ("state snapshot"): ese es inventario de
// posiciones. Este es "call to action" — informa dónde hay oportunidades para
// sincronizar tracking o rebalancear.
//
// Fuente de fecha: sin campo `fechaUltimaActualizacion` (agregado post-v17),
// usamos `inversion.id` (Date.now()) como proxy de última vez que se conoció
// la inversión. Post-v17, guardarRendimiento() puede setear el campo explícito.

const _RX_FECHA_INV = /^(\d{4})-(\d{2})-(\d{2})/;

/** Diferencia en días entre dos fechas YYYY-MM-DD. null si malformadas. UTC anti-DST. */
function _diffDiasInv(desdeISO, hastaISO) {
  const a = _RX_FECHA_INV.exec(desdeISO);
  const b = _RX_FECHA_INV.exec(hastaISO);
  if (!a || !b) return null;
  const dA = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const dB = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  return Math.floor((dB - dA) / 86_400_000);
}

/**
 * Pure: detecta inversiones sin actualización hace N+ meses.
 *
 * @param {Array<{
 *   id:number, nombre?:string, plataforma?:string, capital?:number,
 *   rendimiento?:number, tasa?:number, fechaUltimaActualizacion?:string
 * }>} inversiones
 * @param {string} hoyISO 'YYYY-MM-DD'.
 * @param {{mesesUmbral?:number}} [config]
 *   - mesesUmbral (default 2): meses sin actualizar para incluir en el detector.
 * @returns {Array<{
 *   id:number, nombre:string, plataforma:string, capital:number,
 *   rendimiento:number, ultimaActualizacion:string|null,
 *   diasSinActualizar:number, mesesSinActualizar:number,
 *   severidad:'alta'|'media'|'baja',
 *   sugerencia:'actualizar'|'revisar', mensaje:string
 * }>}
 */
export function detectarInversionesSinActualizar(inversiones, hoyISO, config = {}) {
  if (!Array.isArray(inversiones) || inversiones.length === 0)      return [];
  if (typeof hoyISO !== 'string' || !_RX_FECHA_INV.test(hoyISO))    return [];

  const cfg = (config && typeof config === 'object') ? config : {};
  const umbral = (Number.isFinite(+cfg.mesesUmbral) && +cfg.mesesUmbral > 0)
    ? Math.floor(+cfg.mesesUmbral) : 2;

  const out = [];

  for (const inv of inversiones) {
    if (!inv || typeof inv !== 'object')              continue;
    if (typeof inv.id !== 'number' || inv.id <= 0)   continue;

    // Fecha de última actualización
    let ultimaActualizacion = null;
    if (typeof inv.fechaUltimaActualizacion === 'string' && _RX_FECHA_INV.test(inv.fechaUltimaActualizacion)) {
      ultimaActualizacion = inv.fechaUltimaActualizacion.slice(0, 10);
    } else {
      // Fallback: convertir id (Date.now() en ms) a YYYY-MM-DD
      const ms = +inv.id;
      if (Number.isFinite(ms) && ms > 0) {
        const dt = new Date(ms);
        const yyyy = dt.getUTCFullYear();
        const mm   = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd   = String(dt.getUTCDate()).padStart(2, '0');
        ultimaActualizacion = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (!ultimaActualizacion)                          continue;

    const dias = _diffDiasInv(ultimaActualizacion, hoyISO);
    if (dias === null || dias < 0)                     continue;
    const meses = Math.floor(dias / 30);
    if (meses < umbral)                                continue;

    let severidad;
    if (meses >= 6)      severidad = 'alta';
    else if (meses >= 3) severidad = 'media';
    else                 severidad = 'baja';

    // Sugerencia contextual: capital grande → 'actualizar' (importante),
    // capital pequeño → 'revisar' (posible prueba o inversión menor).
    const capital    = Number(inv.capital) || 0;
    const sugerencia = capital > 10_000_000 ? 'actualizar' : 'revisar';

    const rendimiento = Number(inv.rendimiento) || 0;
    const labelMeses = meses === 1 ? '1 mes' : `${meses} meses`;
    const mensaje = `Sin actualizar hace ${labelMeses}`;

    out.push({
      id:                   inv.id,
      nombre:               (typeof inv.nombre === 'string' && inv.nombre.length > 0) ? inv.nombre : 'Sin nombre',
      plataforma:           (typeof inv.plataforma === 'string' && inv.plataforma.length > 0) ? inv.plataforma : 'Desconocida',
      capital,
      rendimiento,
      ultimaActualizacion,
      diasSinActualizar:    dias,
      mesesSinActualizar:   meses,
      severidad,
      sugerencia,
      mensaje,
    });
  }

  // Orden: alta → media → baja. Dentro, mayor meses primero (más vieja).
  // Empate → menor id (determinístico).
  const rank = { alta: 0, media: 1, baja: 2 };
  out.sort((a, b) => {
    const r = rank[a.severidad] - rank[b.severidad];
    if (r !== 0) return r;
    const dm = b.mesesSinActualizar - a.mesesSinActualizar;
    if (dm !== 0) return dm;
    return a.id - b.id;
  });

  return out;
}

/**
 * Renderiza la tarjeta de "inversiones sin actualizar" en el dashboard.
 * Muestra los 3 más antiguos con CTA "Actualizar" (abre el modal de rendimiento).
 */
export function renderInversionesSinActualizar() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-inversiones-sin-actualizar');
  if (!el) return;

  const sinAct = detectarInversionesSinActualizar(S.inversiones || [], hoy());
  // Solo mostrar si hay al menos una con severidad alta o media
  const relevantes = sinAct.filter(i => i.severidad === 'alta' || i.severidad === 'media');
  if (relevantes.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = sinAct.slice(0, 3);

  const filas = top.map(i => {
    const pctRendimiento = i.capital > 0 ? ((i.rendimiento / i.capital) * 100).toFixed(1) : '0.0';
    const signo = i.rendimiento >= 0 ? '+' : '';
    const colorRendimiento = i.rendimiento >= 0 ? 'var(--a1)' : 'var(--dan)';
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--b1);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="font-size:24px;flex-shrink:0;" aria-hidden="true">📈</div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${he(i.nombre)}">${he(i.nombre)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">
            ${he(i.plataforma)} • ${f(i.capital)} · <span style="color:${colorRendimiento};">${signo}${f(i.rendimiento)} (${signo}${pctRendimiento}%)</span>
          </div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">
            ${i.mensaje}
          </div>
        </div>
      </div>
      <button class="btn bbl bsm" data-action="openRendimiento" data-arg-id="${i.id}" aria-label="Actualizar rendimiento de ${he(i.nombre)}">Actualizar</button>
    </div>`;
  }).join('');

  const titulo = relevantes.length === 1
    ? 'Una inversión sin actualizar'
    : `${relevantes.length} inversiones sin actualizar`;

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,140,0,.35);background:rgba(255,140,0,.06);">
      <div style="font-size:11px;font-weight:800;color:#ff8c00;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        📈 ${he(titulo)}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Invertiste sin verlas crecer. Actualizá los valores para sincronizar tu vista de lo invertido.
      </div>
      ${filas}
    </div>
  `;
}

// ═══ OBJETIVOS ════════════════════════════════════════════════════════════════

// ─── GUARDAR ─────────────────────────────────────────────────────────────────
export async function guardarObjetivo() {
  const nombre    = document.getElementById('obj-no').value.trim();
  const tipo      = document.getElementById('obj-tipo').value;
  const objAhorro = +document.getElementById('obj-ahorro').value || 0;
  if (!nombre || !objAhorro) { await showAlert('Completa el nombre y la meta de ahorro.', 'Campos requeridos'); return; }

  S.objetivos.push({
    id:            Date.now(),
    nombre,
    tipo,
    icono:         document.getElementById('obj-ic').value,
    fecha:         document.getElementById('obj-fe').value,
    objetivoAhorro: objAhorro,
    ahorrado:      0,
    presupuesto:   tipo === 'evento' ? (+document.getElementById('obj-pres').value || 0) : 0,
    gastado:       0,
    gastos:        []
  });

  closeM('m-objetivo');
  save();
  renderObjetivos();
  populateSelectObjetivos();
  window.updateDash?.();
}

// ─── TOGGLE TIPO ─────────────────────────────────────────────────────────────
export function toggleTipoObjetivo() {
  const isEvento = document.getElementById('obj-tipo').value === 'evento';
  document.getElementById('obj-pres-container').style.display = isEvento ? 'block' : 'none';
}

export function openNuevoObjetivo() {
  document.getElementById('obj-tipo').value = 'ahorro';
  toggleTipoObjetivo();
  ['obj-no', 'obj-ahorro', 'obj-pres', 'obj-fe'].forEach(i => {
    const e = document.getElementById(i); if (e) e.value = '';
  });
  openM('m-objetivo');
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderObjetivos() {
  const el = document.getElementById('obj-lst'); if (!el) return;
  if (!S.objetivos || !S.objetivos.length) {
    el.innerHTML = '<div class="emp"><span class="emp-icon">🎯</span>Sin objetivos. ¡Crea el primero!</div>';
    return;
  }

  el.innerHTML = S.objetivos.map(o => {
    const pctAhorro = o.objetivoAhorro > 0 ? Math.min((o.ahorrado / o.objetivoAhorro) * 100, 100) : 0;
    const colAhorro = pctAhorro >= 100 ? 'var(--a1)' : pctAhorro > 50 ? 'var(--a2)' : 'var(--a4)';

    let html = `<article class="pcard">
      <div class="pcard-header">
        <div><div class="pname">${o.icono} ${he(o.nombre)} <span class="pill ${o.tipo === 'evento' ? 'pb' : 'pp'}">${o.tipo === 'evento' ? 'Evento' : 'Ahorro'}</span></div></div>
        <button class="btn bd bsm" data-action="delObjetivo" data-arg-id="${o.id}">×</button>
      </div>`;

    html += `
      <div class="pcard-meta" style="margin-bottom:${o.tipo === 'evento' ? '12px' : '0'}">
        <div class="pcard-section-title">
          <span style="color:var(--a4)">💰 FASE DE AHORRO</span>
          <button class="btn bbl bsm" data-action="abrirAccionObj" data-arg-id="${o.id}" data-arg-accion="abonar">+ Abonar</button>
        </div>
        <div class="ga">
          <span class="tm">Meta: <strong>${f(o.objetivoAhorro)}</strong></span>
          <span class="tm">Ahorrado: <strong style="color:${colAhorro}">${f(o.ahorrado)}</strong></span>
          <strong style="color:${colAhorro};font-family:var(--fm)">${Math.round(pctAhorro)}%</strong>
        </div>
        <div class="pw" style="margin-top:8px"><div class="pf" style="width:${pctAhorro}%;background:${colAhorro}"></div></div>
      </div>`;

    if (o.tipo === 'evento') {
      const pctGasto = o.presupuesto > 0 ? Math.min((o.gastado / o.presupuesto) * 100, 100) : 0;
      const colGasto = pctGasto >= 100 ? 'var(--dan)' : pctGasto > 75 ? 'var(--a2)' : 'var(--a1)';
      html += `
        <div class="pcard-budget">
          <div class="pcard-section-title">
            <span style="color:var(--a1)">📦 PRESUPUESTO DE GASTOS</span>
            <button class="btn bp bsm" data-action="abrirAccionObj" data-arg-id="${o.id}" data-arg-accion="gastar">+ Gastar</button>
          </div>
          <div class="ga">
            <span class="tm">Presupuesto: <strong>${f(o.presupuesto)}</strong></span>
            <span class="tm">Gastado: <strong style="color:${colGasto}">${f(o.gastado)}</strong></span>
            <strong style="color:${colGasto};font-family:var(--fm)">${Math.round(pctGasto)}% usado</strong>
          </div>
          <div class="pw" style="margin-top:8px"><div class="pf" style="width:${pctGasto}%;background:${colGasto}"></div></div>
        </div>`;
    }

    // Simulador de frecuencias
    const falta = Math.max(0, o.objetivoAhorro - o.ahorrado);
    if (falta > 0) {
      const tienesFecha    = o.fecha && new Date(o.fecha + 'T12:00:00') > new Date();
      const diasRestantes  = tienesFecha ? Math.ceil((new Date(o.fecha + 'T12:00:00') - new Date()) / 86_400_000) : 0;

      html += `<div style="padding:0 20px 20px;">`;
      if (tienesFecha) {
        const frecs = [{ label: 'Diario', dias: 1 }, { label: 'Semanal', dias: 7 }, { label: 'Quincenal', dias: 15 }, { label: 'Mensual', dias: 30 }];
        const celdas = frecs.map(fr => {
          const periodos = Math.max(1, diasRestantes / fr.dias);
          return `<div style="background:rgba(157,115,235,.06); border:1px solid rgba(157,115,235,.15); border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:9px; color:var(--a5); font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px;">${fr.label}</div>
            <div style="font-family:var(--fm); font-size:15px; font-weight:800; color:var(--t1);">${f(falta / periodos)}</div>
          </div>`;
        }).join('');
        html += `
          <div style="background:rgba(157,115,235,.04); border:1px solid rgba(157,115,235,.12); border-radius:var(--r2); padding:14px;">
            <div style="font-size:11px; font-weight:700; color:var(--a5); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <span>📅 ¿Cuánto apartar para llegar a tiempo?</span>
              <span style="font-weight:400; color:var(--t3);">${diasRestantes} días restantes</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px;">${celdas}</div>
          </div>`;
      } else {
        html += `
          <div style="background:rgba(157,115,235,.04); border:1px solid rgba(157,115,235,.12); border-radius:var(--r2); padding:14px;">
            <div style="font-size:11px; font-weight:700; color:var(--a5); margin-bottom:10px;">📅 Simula cómo llegar a tu meta</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <input type="number" id="sim-ap-${o.id}" placeholder="¿Cuánto puedes apartar?" inputmode="decimal"
                style="flex:1; min-width:130px; font-size:12px;" oninput="calcSimObj(${o.id},${falta})">
              <select id="sim-fr-${o.id}" onchange="calcSimObj(${o.id},${falta})" style="flex:1; min-width:110px; font-size:12px;">
                <option value="30">Mensual</option>
                <option value="15" selected>Quincenal</option>
                <option value="7">Semanal</option>
                <option value="1">Diario</option>
              </select>
            </div>
            <div id="sim-rs-${o.id}"></div>
          </div>`;
      }
      html += `</div>`;
    }

    return html + `</article>`;
  }).join('');
}

// ─── ACCIONES (ABONAR / GASTAR) ───────────────────────────────────────────────
export function abrirAccionObj(id, accion) {
  const obj = S.objetivos.find(x => x.id === id); if (!obj) return;
  document.getElementById('oa-id').value          = id;
  document.getElementById('oa-tipo-accion').value = accion;
  document.getElementById('oa-tit').textContent   = accion === 'abonar' ? `Abonar a: ${obj.nombre}` : `Gasto en: ${obj.nombre}`;
  document.getElementById('oa-lbl-mo').textContent = accion === 'abonar' ? 'Monto a guardar (COP)' : 'Monto gastado (COP)';
  document.getElementById('oa-fg-desc').style.display = accion === 'gastar' ? 'block' : 'none';
  document.getElementById('oa-mo').value   = '';
  document.getElementById('oa-desc').value = '';
  const coachEl = document.getElementById('oa-coach-msg');
  if (coachEl) coachEl.style.display = 'none';
  openM('m-obj-accion');
  if (accion === 'gastar') evaluarGastoEvento();
}

export function evaluarGastoEvento() {
  const accion = document.getElementById('oa-tipo-accion').value;
  if (accion !== 'gastar') return;
  const id      = +document.getElementById('oa-id').value;
  const obj     = S.objetivos.find(x => x.id === id);
  const coachEl = document.getElementById('oa-coach-msg');
  if (!obj || obj.tipo !== 'evento' || !coachEl || obj.presupuesto <= 0) {
    if (coachEl) coachEl.style.display = 'none'; return;
  }
  const inputMonto      = +document.getElementById('oa-mo').value || 0;
  const totalProyectado = obj.gastado + inputMonto;
  const porcentaje      = (totalProyectado / obj.presupuesto) * 100;
  const disponibleReal  = obj.presupuesto - obj.gastado;

  coachEl.style.display = 'block';
  if (totalProyectado > obj.presupuesto) {
    coachEl.style.cssText = 'display:block; padding:12px; border-radius:8px; font-size:12px; line-height:1.4; background:rgba(255,68,68,.1); color:var(--dan); border:1px solid rgba(255,68,68,.3);';
    coachEl.innerHTML = `🚨 <strong>¡Presupuesto superado!</strong> Te estás pasando por ${f(totalProyectado - obj.presupuesto)}.`;
  } else if (porcentaje >= 80) {
    coachEl.style.cssText = 'display:block; padding:12px; border-radius:8px; font-size:12px; line-height:1.4; background:rgba(255,214,10,.1); color:var(--a2); border:1px solid rgba(255,214,10,.3);';
    coachEl.innerHTML = `⚠️ <strong>¡Cuidado!</strong> Alcanzarás el ${Math.round(porcentaje)}% de tu presupuesto. Te quedarán ${f(obj.presupuesto - totalProyectado)} para el resto.`;
  } else {
    coachEl.style.cssText = 'display:block; padding:12px; border-radius:8px; font-size:12px; line-height:1.4; background:rgba(0,220,130,.1); color:var(--a1); border:1px solid rgba(0,220,130,.3);';
    coachEl.innerHTML = `✅ <strong>Vas súper bien.</strong> Tienes ${f(disponibleReal)} disponibles. Al registrar esto, te seguirán quedando ${f(obj.presupuesto - totalProyectado)}.`;
  }
}

export async function ejecutarAccionObjetivo() {
  const id     = +document.getElementById('oa-id').value;
  const accion = document.getElementById('oa-tipo-accion').value;
  const monto  = +document.getElementById('oa-mo').value;
  const fondo  = document.getElementById('oa-fo').value;
  const desc   = document.getElementById('oa-desc').value.trim();
  const obj    = S.objetivos.find(x => x.id === id);
  if (!obj || !monto) return;

  if (accion === 'gastar') {
    if (!desc) { await showAlert('Escribe en qué gastaste el dinero.', 'Falta descripción'); return; }
    if (obj.tipo === 'evento' && obj.presupuesto > 0 && (obj.gastado + monto) > obj.presupuesto) {
      const ok = await showConfirm(`🚨 Vas a superar el presupuesto de este evento por ${f((obj.gastado + monto) - obj.presupuesto)}.\n\n¿Estás completamente seguro?`, 'Presupuesto Roto');
      if (!ok) return;
    }
  }

  if (accion === 'abonar') {
    obj.ahorrado = Math.min(obj.ahorrado + monto, obj.objetivoAhorro);
    // Persistir la fecha del último aporte en el objetivo mismo — sobrevive a
    // cerrarQ() (que vacía S.gastos). Es la fuente principal del detector
    // detectarObjetivosSinProgreso. Set-and-forget, sin migración.
    obj.fechaUltimoAporte = hoy();
    descontarFondo(fondo, monto);
    S.gastos.unshift({ id: Date.now(), desc: `🎯 Ahorro: ${obj.nombre}`, monto, montoTotal: monto, cat: 'ahorro', tipo: 'ahorro', fondo, hormiga: false, cuatroXMil: false, fecha: hoy(), metaId: id, autoFijo: false });
  } else {
    obj.gastado += monto;
    if (!obj.gastos) obj.gastos = [];
    obj.gastos.push({ desc, monto, fecha: hoy() });
    descontarFondo(fondo, monto);
    S.gastos.unshift({ id: Date.now(), desc: `${obj.icono} ${desc} (${obj.nombre})`, monto, montoTotal: monto, cat: 'otro', tipo: 'deseo', fondo, hormiga: false, cuatroXMil: false, fecha: hoy(), metaId: '', autoFijo: false });
  }

  closeM('m-obj-accion');
  save();
  renderObjetivos();
  window.updateDash?.();
}

export async function delObjetivo(id) {
  const ok = await showConfirm('¿Eliminar este objetivo por completo?', 'Eliminar Objetivo');
  if (!ok) return;
  S.objetivos = S.objetivos.filter(o => o.id !== id);
  save(); renderObjetivos(); populateSelectObjetivos(); window.updateDash?.();
}

// ─── SIMULADOR INLINE ────────────────────────────────────────────────────────
export function calcSimObj(objId, falta) {
  const aporteEl = document.getElementById(`sim-ap-${objId}`);
  const frecEl   = document.getElementById(`sim-fr-${objId}`);
  const resEl    = document.getElementById(`sim-rs-${objId}`);
  if (!aporteEl || !frecEl || !resEl) return;
  const aporte  = +aporteEl.value || 0;
  const diasPer = +frecEl.value || 15;

  const sim = calcularSimObjetivo({ aporte, diasPer, falta });
  if (!sim) { resEl.innerHTML = ''; return; }

  resEl.innerHTML = `
    <div style="background:rgba(157,115,235,.1); border:1px solid rgba(157,115,235,.2); border-radius:8px; padding:10px; text-align:center; margin-top:8px;">
      <div style="font-size:11px; color:var(--t2); margin-bottom:3px;">Ahorrando <strong>${f(aporte)}</strong> por ${sim.frecNombre} llegarás en:</div>
      <div style="font-family:var(--fm); font-size:20px; font-weight:800; color:var(--a5);">${sim.tiempoStr}</div>
      <div style="font-size:10px; color:var(--t3); margin-top:3px;">${sim.periodos} ${sim.frecNombre}${sim.periodos !== 1 ? 's' : ''}</div>
    </div>`;
}

export function populateSelectObjetivos() {
  const sel = document.getElementById('g-me'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Sin objetivo —</option>';
  S.objetivos.forEach(o => {
    const pct = o.objetivoAhorro > 0 ? Math.round((o.ahorrado / o.objetivoAhorro) * 100) : 0;
    sel.innerHTML += `<option value="${o.id}">${o.icono} ${he(o.nombre)} (${pct}%)</option>`;
  });
  if (prev && S.objetivos.find(o => o.id == prev)) sel.value = prev;
}

// ═══ INVERSIONES ══════════════════════════════════════════════════════════════

// ─── GUARDAR ─────────────────────────────────────────────────────────────────
export async function guardarInversion() {
  const no  = document.getElementById('inv-no').value.trim();
  const pl  = document.getElementById('inv-pl').value.trim();
  const cap = +document.getElementById('inv-cap').value || 0;
  const ta  = +document.getElementById('inv-ta').value || 0;

  if (!no || !pl || !cap) {
    const faltantes = [
      !no  && 'el nombre de la inversión',
      !pl  && 'la plataforma o entidad',
      !cap && 'el capital invertido',
    ].filter(Boolean).join(', ');
    await window.showAlert?.(
      `Falta completar: ${faltantes}. Sin esos datos no podemos registrar la inversión.`,
      'Faltan datos'
    );
    return;
  }

  const fo = document.getElementById('inv-fo').value;
  if (fo) descontarFondo(fo, cap);

  S.inversiones.push({ id: Date.now(), nombre: no, plataforma: pl, capital: cap, rendimiento: 0, tasa: ta });
  closeM('m-inversion');
  save();
  renderInversiones();
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderInversiones() {
  const el = document.getElementById('inv-lst'); if (!el) return;

  const tc = S.inversiones.reduce((s, i) => s + i.capital, 0);
  const tr = S.inversiones.reduce((s, i) => s + i.rendimiento, 0);
  setEl('inv-tot-cap',  f(tc));
  setEl('inv-tot-rend', f(tr));
  setEl('inv-tot-gral', f(tc + tr));

  if (!S.inversiones.length) {
    el.innerHTML = `
      <div style="text-align:center; padding:40px 20px; background:var(--s1); border-radius:16px; border:1px dashed rgba(59,158,255,.3);">
        <div style="font-size:48px; margin-bottom:14px;">📈</div>
        <div style="font-weight:800; font-size:17px; color:var(--t1); margin-bottom:8px;">Sin inversiones registradas</div>
        <div style="color:var(--t3); font-size:13px; max-width:260px; margin:0 auto; line-height:1.6;">Registra tus CDTs, FICs o acciones para ver cómo crece tu dinero.</div>
      </div>`;
    return;
  }

  el.innerHTML = S.inversiones.map(i => {
    const valorTotal = i.capital + i.rendimiento;
    const rendPct    = i.capital > 0 ? ((i.rendimiento / i.capital) * 100).toFixed(1) : 0;
    const colorRend  = i.rendimiento >= 0 ? 'var(--a1)' : 'var(--dan)';
    const signo      = i.rendimiento >= 0 ? '+' : '';
    const tasaBadge  = i.tasa > 0 ? `<span class="pill pg" style="font-size:9px;">${i.tasa}% E.A.</span>` : '';

    return `
    <article class="inv-card" aria-label="Inversión: ${he(i.nombre)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:16px 20px 14px; border-bottom:1px solid var(--b1); gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <div style="width:44px; height:44px; border-radius:12px; background:rgba(59,158,255,.1); border:1px solid rgba(59,158,255,.2); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;" aria-hidden="true">📊</div>
          <div style="min-width:0;">
            <div style="font-weight:800; font-size:15px; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${he(i.nombre)}">${he(i.nombre)}</div>
            <div style="margin-top:5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:11px; color:var(--t3);">📍 ${he(i.plataforma)}</span>
              ${tasaBadge}
            </div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:10px; font-weight:700; color:var(--t3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Valor total</div>
          <div style="font-family:var(--fm); font-size:26px; font-weight:800; color:var(--t1); letter-spacing:-1px; line-height:1;">${f(valorTotal)}</div>
        </div>
      </div>

      <div style="padding:14px 20px; border-bottom:1px solid var(--b1); display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:120px; background:var(--s2); border:1px solid var(--b1); border-radius:10px; padding:12px;">
          <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Capital invertido</div>
          <div style="font-family:var(--fm); font-size:18px; font-weight:800; color:var(--a4);">${f(i.capital)}</div>
        </div>
        <div style="flex:1; min-width:120px; background:${i.rendimiento >= 0 ? 'rgba(0,220,130,.05)' : 'rgba(255,96,96,.05)'}; border:1px solid ${i.rendimiento >= 0 ? 'rgba(0,220,130,.2)' : 'rgba(255,96,96,.2)'}; border-radius:10px; padding:12px;">
          <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Rendimiento</div>
          <div style="font-family:var(--fm); font-size:18px; font-weight:800; color:${colorRend};">${signo}${f(i.rendimiento)}</div>
          <div style="font-size:11px; color:${colorRend}; margin-top:2px; font-weight:600;">${signo}${rendPct}%</div>
        </div>
      </div>

      <div style="padding:12px 20px; display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn bg bsm" data-action="openRendimiento" data-arg-id="${i.id}" data-name="${he(i.nombre).replace(/'/g, '&#39;')}" aria-label="Actualizar valor de ${he(i.nombre)}">📊 Actualizar valor</button>
        <button class="btn-eliminar-deu" data-action="delInversion" data-arg-id="${i.id}" style="padding:6px 12px;" aria-label="Eliminar ${he(i.nombre)}">🗑️</button>
      </div>
    </article>`;
  }).join('');
}

// ─── RENDIMIENTO ─────────────────────────────────────────────────────────────
export function openRendimiento(id) {
  const inv = S.inversiones.find(x => x.id === id);
  if (!inv) return;
  document.getElementById('rend-id').value       = id;
  document.getElementById('rend-t').textContent  = `Actualizar: ${inv.nombre}`;
  openM('m-rendimiento');
}

export async function guardarRendimiento() {
  const id  = +document.getElementById('rend-id').value;
  const nv  = +document.getElementById('rend-val').value;
  const inv = S.inversiones.find(x => x.id === id);
  if (!inv) { closeM('m-rendimiento'); return; }

  if (!nv || nv <= 0) {
    await window.showAlert?.(
      'El saldo actual no puede ser 0 ni estar vacío. Ingresá el valor total actual de la inversión (capital + rendimientos acumulados).',
      'Valor inválido'
    );
    return;
  }

  if (nv < inv.capital) {
    const perdida = inv.capital - nv;
    const ok = await window.showConfirm?.(
      `El valor que ingresaste (${window.f?.(nv) || nv}) es menor al capital invertido (${window.f?.(inv.capital) || inv.capital}).\n\n¿Confirmás que la inversión perdió ${window.f?.(perdida) || perdida}? Esto quedará registrado como rendimiento negativo.`,
      'Confirmar pérdida'
    );
    if (!ok) return;
  }

  inv.rendimiento = nv - inv.capital;
  closeM('m-rendimiento');
  save();
  renderInversiones();
}

// ─── ELIMINAR ────────────────────────────────────────────────────────────────
export async function delInversion(id) {
  const inv = S.inversiones.find(x => x.id === id); if (!inv) return;
  const ok  = await showConfirm(`¿Eliminar la inversión "${he(inv.nombre)}"? Esta acción no se puede deshacer.`, 'Eliminar inversión');
  if (!ok) return;
  S.inversiones = S.inversiones.filter(x => x.id !== id);
  save(); renderInversiones();
}

// ─── REGISTRO DE ACCIONES ─────────────────────────────────────────────────────
registerAction('guardarObjetivo',         () => guardarObjetivo());
registerAction('toggleTipoObjetivo',      ({ tipo }) => toggleTipoObjetivo(tipo));
registerAction('openNuevoObjetivo',       () => openNuevoObjetivo());
registerAction('renderObjetivos',         () => renderObjetivos());
// data-arg-* siempre llega como string. abrirAccionObj usa `find(x => x.id === id)`
// con comparación estricta — coerce a number para que coincida con S.objetivos[].id.
registerAction('abrirAccionObj',          ({ id, accion }) => abrirAccionObj(+id, accion));
registerAction('evaluarGastoEvento',      () => evaluarGastoEvento());
registerAction('ejecutarAccionObjetivo',  ({ id }) => ejecutarAccionObjetivo(id));
registerAction('delObjetivo',             ({ id }) => delObjetivo(id));
registerAction('calcSimObj',              () => calcSimObj());
registerAction('populateSelectObjetivos', () => populateSelectObjetivos());
registerAction('guardarInversion',        () => guardarInversion());
registerAction('renderInversiones',       () => renderInversiones());
registerAction('openRendimiento',         ({ id }) => openRendimiento(id));
registerAction('guardarRendimiento',      () => guardarRendimiento());
registerAction('delInversion',            ({ id }) => delInversion(id));
registerAction('renderObjetivosSinProgreso', () => renderObjetivosSinProgreso());
registerAction('renderInversionesSinActualizar', () => renderInversionesSinActualizar());

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
// guardarObjetivo, openNuevoObjetivo, ejecutarAccionObjetivo,
// guardarInversion, guardarRendimiento → migrados a data-action
// Guard `typeof window` para soportar tests/SSR sin DOM.
if (typeof window !== 'undefined') {
  window.toggleTipoObjetivo      = toggleTipoObjetivo;      // llamado desde JS
  window.renderObjetivos         = renderObjetivos;          // llamado desde JS
  window.abrirAccionObj          = abrirAccionObj;           // HTML dinámico
  window.evaluarGastoEvento      = evaluarGastoEvento;       // llamado desde JS
  window.delObjetivo             = delObjetivo;              // HTML dinámico
  window.calcSimObj              = calcSimObj;               // HTML dinámico
  window.populateSelectObjetivos = populateSelectObjetivos;  // llamado desde JS
  window.renderInversiones       = renderInversiones;        // llamado desde JS
  window.openRendimiento         = openRendimiento;          // HTML dinámico
  window.delInversion            = delInversion;             // HTML dinámico
  window.renderObjetivosSinProgreso = renderObjetivosSinProgreso; // updateDash
  window.renderInversionesSinActualizar = renderInversionesSinActualizar; // updateDash
}
