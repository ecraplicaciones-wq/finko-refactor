// ─── COMPROMISOS ─────────────────────────────────────────────────────────────
// Fusión de: fijos.js + agenda.js + deudas.js
// Dominio: obligaciones financieras periódicas — gastos fijos recurrentes,
//          pagos agendados en calendario y deudas con cuotas.

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import {
  f, he, hoy, mesStr, setEl, setHtml,
  openM, closeM, showAlert, showConfirm,
  descontarFondo, reintegrarFondo
} from '../infra/utils.js';
import { CATS, GMF_TASA, TASA_USURA_EA } from '../core/constants.js';
import { renderSmart, updSaldo, totalCuentas } from '../infra/render.js';
import { registerAction } from '../ui/actions.js';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PURAS DEL DOMINIO (R1 auditoría v5)
// ═══════════════════════════════════════════════════════════════════════════════
// Estas funciones no leen S ni tocan DOM — son testables aisladamente y las
// usa renderDeudas / _obtenerAlertaMora / abrirPagarCuota más abajo.

/**
 * Ordena un array de deudas según la estrategia de pago.
 *
 * • avalancha (la financieramente más eficiente):
 *     orden por tasa DESC → menos intereses totales pagados.
 *     desempate: pendiente DESC.
 *
 * • bola de nieve (la psicológicamente más motivadora):
 *     orden por pendiente ASC → primeras victorias rápidas.
 *     desempate: tasa DESC.
 *
 * @param {Array<{tasa:number, total:number, pagado:number}>} deudas
 * @param {'avalancha'|'bola'} modo
 * @returns {Array} nueva lista ordenada (no muta el input).
 */
export function ordenarDeudas(deudas, modo = 'avalancha') {
  const copia = [...(deudas || [])];
  if (modo === 'bola') {
    copia.sort((a, b) => {
      const dSaldo = ((a.total ?? 0) - (a.pagado ?? 0)) - ((b.total ?? 0) - (b.pagado ?? 0));
      if (dSaldo !== 0) return dSaldo;
      return (b.tasa || 0) - (a.tasa || 0);
    });
  } else {
    copia.sort((a, b) => {
      const dTasa = (b.tasa || 0) - (a.tasa || 0);
      if (dTasa !== 0) return dTasa;
      return ((b.total ?? 0) - (b.pagado ?? 0)) - ((a.total ?? 0) - (a.pagado ?? 0));
    });
  }
  return copia;
}

/**
 * Días de mora de una deuda relativos a una fecha de referencia.
 * Si la fecha límite (diaPago del mes corriente) aún no llegó o la deuda ya
 * fue pagada en el mes, devuelve 0.
 *
 * @param {{diaPago?:number, total:number, pagado:number, id?:number,
 *          nombre?:string}} deuda
 * @param {Date|string} [fechaRef] — default: ahora.
 * @param {Array} [gastos] — historial de gastos para detectar pago del mes
 *                           corriente (S.gastos en el call site real).
 * @returns {number} días de mora (≥ 0).
 */
export function calcularDiasMora(deuda, fechaRef = new Date(), gastos = []) {
  const ref     = fechaRef instanceof Date ? fechaRef : new Date(fechaRef);
  const hoyDate = new Date(ref); hoyDate.setHours(0, 0, 0, 0);
  const diaPago = deuda?.diaPago || 1;
  const ultimoDiaMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0).getDate();
  const diaReal      = Math.min(diaPago, ultimoDiaMes);
  const fechaLimite  = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), diaReal);

  if (hoyDate <= fechaLimite) return 0;

  const _norm = s => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const mesPago    = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}`;
  const nombreNorm = _norm(deuda?.nombre);

  const pagadoEsteMes = (gastos || []).find(g => {
    if (g.cat !== 'deudas' || !String(g.fecha || '').startsWith(mesPago)) return false;
    if (g.deudaId != null) return g.deudaId === deuda.id;
    return _norm(g.desc).includes(nombreNorm);
  });

  if (pagadoEsteMes || ((deuda?.total ?? 0) - (deuda?.pagado ?? 0) <= 0)) return 0;

  const dias = Math.floor((hoyDate - fechaLimite) / 86_400_000);
  return Math.max(0, dias);
}

/**
 * Clasifica los días de mora en niveles para alertas y reportes.
 *
 * • leve:  1–29 días — recordatorio amable.
 * • media: 30–89 días — riesgo de reporte a centrales (Datacrédito).
 * • grave: 90+ días — debe haber recibido aviso legal (Ley 1266/2008 Art. 13).
 *
 * @param {number} dias
 * @returns {null|'leve'|'media'|'grave'} null si no hay mora.
 */
export function clasificarMora(dias) {
  if (!dias || dias <= 0) return null;
  if (dias < 30) return 'leve';
  if (dias < 90) return 'media';
  return 'grave';
}

/**
 * Tiempo proyectado para liquidar una deuda dado el pago periódico.
 * Devuelve un objeto con descomposición meses/años/meses-restantes y un
 * `nivel` que el render usa para elegir tono ('liquidada','final','corto','largo').
 *
 * @param {number} pendiente — saldo restante.
 * @param {number} cuota     — pago por período (asumimos mensual).
 * @returns {{
 *   liquidada: boolean, mesesRestantes: number,
 *   anos: number, mesesTras: number,
 *   nivel: 'liquidada'|'final'|'corto'|'largo'
 * }}
 */
export function calcularTiempoRestanteDeuda(pendiente, cuota) {
  if (pendiente <= 0) {
    return { liquidada: true, mesesRestantes: 0, anos: 0, mesesTras: 0, nivel: 'liquidada' };
  }
  if (!cuota || cuota <= 0) {
    return { liquidada: false, mesesRestantes: Infinity, anos: Infinity, mesesTras: 0, nivel: 'largo' };
  }
  const mesesRestantes = Math.ceil(pendiente / cuota);
  const anos      = Math.floor(mesesRestantes / 12);
  const mesesTras = mesesRestantes % 12;
  let nivel;
  if (mesesRestantes === 1)      nivel = 'final';
  else if (mesesRestantes <= 6)  nivel = 'corto';
  else                           nivel = 'largo';
  return { liquidada: false, mesesRestantes, anos, mesesTras, nivel };
}

/**
 * Clasifica la carga de cuotas como porcentaje del ingreso mensual.
 *
 * • critico : >100% — cuotas exceden ingresos.
 * • alerta  : 41–100% — sobre-endeudamiento riesgoso.
 * • bien    : 1–40% — manejable.
 * • cero    : 0% — sin deudas.
 *
 * Estos cortes son los recomendados por SuperFinanciera Colombia: la cuota
 * total no debería superar el 40% del ingreso disponible.
 *
 * @param {number} pct — porcentaje cuotas/ingreso (0–N, no normalizado).
 * @returns {{ nivel:'critico'|'alerta'|'bien'|'cero', emoji:string }}
 */
export function clasificarCargaDeuda(pct) {
  if (pct > 100) return { nivel: 'critico', emoji: '🚨' };
  if (pct > 40)  return { nivel: 'alerta',  emoji: '⚠️' };
  if (pct > 0)   return { nivel: 'bien',    emoji: '✅' };
  return { nivel: 'cero', emoji: '✅' };
}

/**
 * Calcula la cuota sugerida (sistema francés / cuota fija) a partir del
 * capital, tasa anual E.A. y número de períodos. Es la fórmula estándar de
 * amortización colombiana — la misma que usa la calculadora de crédito.
 *
 *     cuota = C × i × (1+i)^n / ((1+i)^n − 1)
 *
 * Donde i es la tasa por período (mensual o quincenal) y n el plazo en
 * períodos. La conversión de E.A. a tasa mensual usa equivalencia financiera
 * estricta:  i_mensual = (1 + EA)^(1/12) − 1.
 *
 * Si tasaEA = 0 ó no se proporciona, la cuota es simplemente capital / n
 * (préstamo sin intereses, ej: amigos / familiares).
 *
 * @param {object} params
 * @param {number} params.total       — capital prestado (positivo).
 * @param {number} [params.tasaEA=0]  — tasa anual E.A. en %, no decimal.
 * @param {number} params.plazoMeses  — número de meses a pagar.
 * @param {'mensual'|'quincenal'} [params.periodicidad='mensual']
 *     Si es quincenal, se duplica el número de cuotas y se usa tasa quincenal
 *     equivalente: (1+EA)^(1/24) − 1.
 * @returns {{
 *   cuota: number,           // pago por período (cifra absoluta).
 *   totalPagado: number,     // cuota × n períodos.
 *   totalInteres: number,    // totalPagado − total.
 *   nPeriodos: number,       // n usado en la fórmula.
 *   tasaPeriodo: number,     // i por período en decimal (0.02 = 2%).
 * } | null}
 *     null si los inputs son inválidos (total≤0, plazo≤0).
 */
export function calcularCuotaSugerida({ total, tasaEA = 0, plazoMeses, periodicidad = 'mensual' } = {}) {
  if (!total || total <= 0)            return null;
  if (!plazoMeses || plazoMeses <= 0)  return null;

  const ea = Math.max(0, +tasaEA || 0) / 100;       // a decimal
  const periodosPorAno = periodicidad === 'quincenal' ? 24 : 12;
  const nPeriodos      = periodicidad === 'quincenal' ? plazoMeses * 2 : plazoMeses;
  const i              = ea > 0 ? Math.pow(1 + ea, 1 / periodosPorAno) - 1 : 0;

  const cuota = i === 0
    ? total / nPeriodos
    : (total * i * Math.pow(1 + i, nPeriodos)) / (Math.pow(1 + i, nPeriodos) - 1);

  const totalPagado  = cuota * nPeriodos;
  const totalInteres = totalPagado - total;

  return { cuota, totalPagado, totalInteres, nPeriodos, tasaPeriodo: i };
}

// ─── DETECTOR DE DEUDAS DURMIENDO ────────────────────────────────────────────
// Distinto de `calcularDiasMora` (atraso del mes corriente):
//   - Mora = "no pagaste lo del mes pasado"
//   - Durmiendo = "hace 3+ meses que no le ponés nada — ¿la abandonaste?"
//
// Por qué importa: una deuda con tasa de usura sigue creciendo aunque vos no
// le hagas seguimiento. Las pequeñas (cuota chica olvidada) se vuelven grandes,
// y las grandes terminan en Datacrédito sin que el usuario lo dimensione.
//
// Fuente del "último pago" en orden de prioridad:
//   1. `deuda.fechaUltimoPago` — set por `confPagarCuota` (preferido).
//   2. Búsqueda en `gastos` por `deudaId === d.id` (fallback para usuarios
//      pre-fechaUltimoPago, mientras la quincena en curso conserve los gastos).
//   3. Fecha de creación derivada de `id` (Date.now() ms) — el peor caso útil.

const _MES_RX_DEUDA = /^(\d{4})-(\d{2})-(\d{2})/;

/** Diferencia en días entre dos fechas YYYY-MM-DD. null si malformadas. */
function _diffDias(desdeISO, hastaISO) {
  const a = _MES_RX_DEUDA.exec(desdeISO);
  const b = _MES_RX_DEUDA.exec(hastaISO);
  if (!a || !b) return null;
  // Date.UTC evita drift por DST entre fechas en distintos meses.
  const dA = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const dB = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  return Math.floor((dB - dA) / 86_400_000);
}

/**
 * Pure: detecta deudas vivas (pendiente > 0) sin pago reciente. Devuelve un
 * array ordenado por severidad (peor caso primero).
 *
 * @param {Array<{
 *   id:number, nombre?:string, total?:number, pagado?:number, cuota?:number,
 *   tipo?:string, fechaUltimoPago?:string
 * }>} deudas
 * @param {Array<{deudaId?:number|null, fecha?:string}>} gastos — para fallback
 *   cuando la deuda no tiene `fechaUltimoPago` aún.
 * @param {string} hoyISO 'YYYY-MM-DD'.
 * @param {{mesesUmbral?:number}} [config]
 *   - mesesUmbral (default 2): meses sin pago para considerar la deuda durmiendo.
 * @returns {Array<{
 *   id:number, nombre:string, tipo:string,
 *   totalPendiente:number, cuota:number,
 *   ultimoPago:string|null, diasSinPago:number, mesesSinPago:number,
 *   fuenteUltimoPago:'fechaUltimoPago'|'gasto'|'creacion',
 *   severidad:'alta'|'media'|'baja',
 *   sugerencia:'liquidar'|'retomar'
 * }>}
 */
export function detectarDeudasDurmiendo(deudas, gastos, hoyISO, config = {}) {
  if (!Array.isArray(deudas) || deudas.length === 0)         return [];
  if (typeof hoyISO !== 'string' || !_MES_RX_DEUDA.test(hoyISO)) return [];

  const cfg = (config && typeof config === 'object') ? config : {};
  const umbral = (Number.isFinite(+cfg.mesesUmbral) && +cfg.mesesUmbral > 0)
    ? Math.floor(+cfg.mesesUmbral) : 2;

  // Index gastos por deudaId para O(1) lookup. Solo el más reciente importa.
  const ultimoGastoPorDeuda = new Map();
  if (Array.isArray(gastos)) {
    for (const g of gastos) {
      if (!g || typeof g !== 'object') continue;
      if (g.deudaId == null) continue;
      if (typeof g.fecha !== 'string' || !_MES_RX_DEUDA.test(g.fecha)) continue;
      const prev = ultimoGastoPorDeuda.get(g.deudaId);
      if (!prev || g.fecha > prev) ultimoGastoPorDeuda.set(g.deudaId, g.fecha);
    }
  }

  const out = [];

  for (const d of deudas) {
    if (!d || typeof d !== 'object')               continue;
    if (typeof d.id !== 'number' || d.id <= 0)     continue;

    const total  = Number(d.total)  || 0;
    const pagado = Number(d.pagado) || 0;
    const pendiente = total - pagado;
    if (pendiente <= 0) continue;     // deuda liquidada → no es "durmiendo"

    // Fuente del último pago — orden de prioridad
    let ultimoPago = null;
    let fuente = 'creacion';
    if (typeof d.fechaUltimoPago === 'string' && _MES_RX_DEUDA.test(d.fechaUltimoPago)) {
      ultimoPago = d.fechaUltimoPago.slice(0, 10);
      fuente = 'fechaUltimoPago';
    } else if (ultimoGastoPorDeuda.has(d.id)) {
      ultimoPago = ultimoGastoPorDeuda.get(d.id).slice(0, 10);
      fuente = 'gasto';
    } else {
      // Derivar de `id` = Date.now() en ms. Ojo: si el id viene de un import o
      // es manualmente bajo (no Date.now), el cálculo puede salir raro — por
      // eso el ISO se construye via UTC para no depender del timezone del host.
      const ms = +d.id;
      if (Number.isFinite(ms) && ms > 0) {
        const dt = new Date(ms);
        const yyyy = dt.getUTCFullYear();
        const mm   = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd   = String(dt.getUTCDate()).padStart(2, '0');
        ultimoPago = `${yyyy}-${mm}-${dd}`;
        fuente = 'creacion';
      }
    }
    if (!ultimoPago) continue;        // sin fuente válida → no podemos juzgar

    const dias = _diffDias(ultimoPago, hoyISO);
    if (dias === null || dias < 0) continue;
    const meses = Math.floor(dias / 30);
    if (meses < umbral) continue;     // dentro de tolerancia → no es durmiendo

    let severidad;
    if (meses >= 6)      severidad = 'alta';
    else if (meses >= 3) severidad = 'media';
    else                 severidad = 'baja';

    const cuota = Number(d.cuota) || 0;
    const sugerencia = (cuota > 0 && pendiente <= cuota) ? 'liquidar' : 'retomar';

    out.push({
      id:               d.id,
      nombre:           (typeof d.nombre === 'string' && d.nombre.length > 0) ? d.nombre : 'Sin nombre',
      tipo:             (typeof d.tipo   === 'string' && d.tipo.length   > 0) ? d.tipo   : 'otro',
      totalPendiente:   pendiente,
      cuota,
      ultimoPago,
      diasSinPago:      dias,
      mesesSinPago:     meses,
      fuenteUltimoPago: fuente,
      severidad,
      sugerencia,
    });
  }

  // Orden: alta → media → baja. Dentro de cada nivel, mayor pendiente primero
  // (más plata acumulando intereses). Empate → menor id (determinístico).
  const rank = { alta: 0, media: 1, baja: 2 };
  out.sort((a, b) => {
    const r = rank[a.severidad] - rank[b.severidad];
    if (r !== 0) return r;
    const dp = b.totalPendiente - a.totalPendiente;
    if (dp !== 0) return dp;
    return a.id - b.id;
  });

  return out;
}

// ─── DETECTOR DE FIJOS SIN PAGAR DEL MES CORRIENTE ───────────────────────────
// Caso de uso: el usuario tiene gastos fijos (arriendo, internet, servicios)
// con día de pago definido. Si el día ya pasó y el mes actual no aparece en
// `pagadoEn`, se trata de un olvido — los fijos no pagados a tiempo generan
// recargos, intereses moratorios o cortes de servicio.
//
// Para quincenales (raros, pero existen — ej. arriendos divididos): se espera
// el día `dia` y `dia+15`. Conteo por ocurrencias del mes en `pagadoEn`.
//
// Distinto de:
//   - calcularDiasMora (deudas) — esto es para gastos fijos, no cuotas.
//   - _renderFijosEnDeudas — ese muestra TODOS los pendientes del mes (incluso
//     los del futuro). Este detector es solo para los YA atrasados.

const _RX_FECHA_FIJO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Último día calendario de un mes dado (1-12). 28-31. */
function _lastDayOfMonth(year, month1to12) {
  // Mes 0 = enero. month1to12 - 1 + 1 = month1to12 → da el día 0 del mes
  // siguiente, que es el último del actual. Funciona para febrero bisiesto.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/**
 * Pure: detecta gastos fijos con día de pago ya pasado este mes que no han
 * sido marcados como pagados (mes actual no está en `pagadoEn`).
 *
 * @param {Array<{
 *   id:number, nombre?:string, cat?:string, dia?:number,
 *   periodicidad?:'mensual'|'quincenal',
 *   monto?:number, montoTotal?:number, fondo?:string,
 *   pagadoEn?:string[]
 * }>} gastosFijos
 * @param {string} hoyISO 'YYYY-MM-DD'.
 * @param {{umbralDiasAtraso?:number}} [config]
 *   - umbralDiasAtraso (default 0): solo flag si diasAtraso >= umbral.
 *     Default 0 = avisa el mismo día del vencimiento.
 * @returns {Array<{
 *   id:number, nombre:string, cat:string, dia:number,
 *   periodicidad:string, monto:number, montoTotal:number, fondo:string,
 *   diaEsperado:number, diasAtraso:number,
 *   pagosEsperados:number, pagosRealizados:number,
 *   severidad:'leve'|'moderada'|'urgente',
 *   tipoFalta:'mensual'|'quincenal-q1'|'quincenal-q2'|'quincenal-ambos'
 * }>}
 */
export function detectarFijosSinPagarEsteMes(gastosFijos, hoyISO, config = {}) {
  if (!Array.isArray(gastosFijos) || gastosFijos.length === 0)   return [];
  if (typeof hoyISO !== 'string')                                return [];
  const mh = _RX_FECHA_FIJO.exec(hoyISO);
  if (!mh)                                                       return [];

  const year  = +mh[1];
  const month = +mh[2];
  const day   = +mh[3];
  if (month < 1 || month > 12 || day < 1 || day > 31)            return [];

  const cfg = (config && typeof config === 'object') ? config : {};
  const umbral = (Number.isFinite(+cfg.umbralDiasAtraso) && +cfg.umbralDiasAtraso >= 0)
    ? Math.floor(+cfg.umbralDiasAtraso)
    : 0;

  const lastDay = _lastDayOfMonth(year, month);
  const mesActual = `${mh[1]}-${mh[2]}`;

  const out = [];

  for (const fx of gastosFijos) {
    if (!fx || typeof fx !== 'object')           continue;
    if (typeof fx.id !== 'number' || fx.id <= 0) continue;

    // Día de pago. Sin dia → asumimos día 1.
    const diaRaw = Number(fx.dia) || 1;
    if (diaRaw < 1 || diaRaw > 31)               continue;

    const periodicidad = (fx.periodicidad === 'quincenal') ? 'quincenal' : 'mensual';
    const dia1 = Math.min(diaRaw, lastDay);
    // Para quincenales, el segundo pago va ~15 días después, clampeado al
    // último día del mes (si dia=20 y febrero tiene 28, dia2=28 no 35).
    const dia2 = (periodicidad === 'quincenal') ? Math.min(diaRaw + 15, lastDay) : null;

    // Cuenta cuántas veces el mes actual aparece en pagadoEn.
    const pagosRealizados = Array.isArray(fx.pagadoEn)
      ? fx.pagadoEn.filter(m => m === mesActual).length
      : 0;

    // Determinar pagos esperados según los checkpoints que ya pasaron.
    let pagosEsperados;
    let diaEsperado;
    if (periodicidad === 'quincenal') {
      if (day >= dia2) {
        pagosEsperados = 2;
        diaEsperado    = dia2;
      } else if (day >= dia1) {
        pagosEsperados = 1;
        diaEsperado    = dia1;
      } else {
        pagosEsperados = 0;
        diaEsperado    = dia1;
      }
    } else {
      if (day >= dia1) {
        pagosEsperados = 1;
        diaEsperado    = dia1;
      } else {
        pagosEsperados = 0;
        diaEsperado    = dia1;
      }
    }

    // No hay nada esperado todavía → no es atraso.
    if (pagosEsperados === 0)                     continue;
    if (pagosRealizados >= pagosEsperados)        continue;

    const diasAtraso = day - diaEsperado;
    if (diasAtraso < umbral)                       continue;

    let severidad;
    if (diasAtraso <= 3)       severidad = 'leve';
    else if (diasAtraso <= 10) severidad = 'moderada';
    else                       severidad = 'urgente';

    let tipoFalta;
    if (periodicidad === 'mensual') {
      tipoFalta = 'mensual';
    } else if (pagosRealizados === 0 && pagosEsperados === 2) {
      tipoFalta = 'quincenal-ambos';
    } else if (pagosRealizados === 0 && pagosEsperados === 1) {
      tipoFalta = 'quincenal-q1';
    } else {
      // pagosEsperados === 2 && pagosRealizados === 1
      tipoFalta = 'quincenal-q2';
    }

    const monto      = Number(fx.monto)      || 0;
    const montoTotal = Number(fx.montoTotal) || monto;

    out.push({
      id:              fx.id,
      nombre:          (typeof fx.nombre === 'string' && fx.nombre.length > 0) ? fx.nombre : 'Sin nombre',
      cat:             (typeof fx.cat    === 'string' && fx.cat.length    > 0) ? fx.cat    : 'otros',
      dia:             diaRaw,
      periodicidad,
      monto,
      montoTotal,
      fondo:           (typeof fx.fondo === 'string' && fx.fondo.length > 0) ? fx.fondo : 'banco',
      diaEsperado,
      diasAtraso,
      pagosEsperados,
      pagosRealizados,
      severidad,
      tipoFalta,
    });
  }

  // Orden: urgente → moderada → leve. Dentro, mayor monto primero (impacto
  // financiero). Empate → menor id (determinístico para tests).
  const rank = { urgente: 0, moderada: 1, leve: 2 };
  out.sort((a, b) => {
    const r = rank[a.severidad] - rank[b.severidad];
    if (r !== 0) return r;
    const dm = b.montoTotal - a.montoTotal;
    if (dm !== 0) return dm;
    return a.id - b.id;
  });

  return out;
}

/**
 * Renderiza la tarjeta de "fijos sin pagar este mes" en el dashboard.
 * CTA por fila → `abrirModalFijo` (reusa el modal existente m-pagar-fijo).
 */
export function renderFijosSinPagar() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-fijos-sin-pagar');
  if (!el) return;

  const sinPagar = detectarFijosSinPagarEsteMes(S.gastosFijos || [], hoy());
  if (sinPagar.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = sinPagar.slice(0, 3);
  const totalAtraso = sinPagar.reduce((s, f) => s + (f.montoTotal || f.monto), 0);

  const filas = top.map(fx => {
    const labelDias = fx.diasAtraso === 0
      ? 'Vence hoy'
      : fx.diasAtraso === 1
        ? '1 día atrasado'
        : `${fx.diasAtraso} días atrasado`;
    const sufijoQ = fx.tipoFalta === 'quincenal-q2'
      ? ' (2do pago)'
      : fx.tipoFalta === 'quincenal-ambos'
        ? ' (los 2 pagos)'
        : fx.tipoFalta === 'quincenal-q1' && fx.periodicidad === 'quincenal'
          ? ' (1er pago)'
          : '';
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--b1);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:22px;flex-shrink:0;" aria-hidden="true">📌</span>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${he(fx.nombre)}">${he(fx.nombre)}${he(sufijoQ)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">
            <strong>${he(labelDias)}</strong> · ${f(fx.montoTotal)}
          </div>
        </div>
      </div>
      <button class="btn bbl bsm" data-action="abrirModalFijo" data-arg-id="${fx.id}" aria-label="Pagar el fijo ${he(fx.nombre)}">Pagar</button>
    </div>`;
  }).join('');

  const titulo = sinPagar.length === 1
    ? '1 fijo sin pagar este mes'
    : `${sinPagar.length} fijos sin pagar este mes`;

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,68,68,.35);background:rgba(255,68,68,.05);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <div style="font-size:11px;font-weight:800;color:#ff4444;text-transform:uppercase;letter-spacing:.5px;">
          ⏰ ${he(titulo)}
        </div>
        <div class="mono" style="font-size:11px;color:var(--t3);">Total atraso: <strong style="color:var(--t2);">${f(totalAtraso)}</strong></div>
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Fijos no pagados a tiempo te cuestan recargos. Marcalos pagados o paga ahora.
      </div>
      ${filas}
    </div>
  `;
}

/**
 * Renderiza la tarjeta de "deudas durmiendo" en el dashboard. Si no hay
 * detectadas, oculta el contenedor. Muestra los 3 peor parados, con CTA
 * según la sugerencia: liquidar (un pago la cierra) o retomar (varios pagos).
 */
export function renderDeudasDurmiendo() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-deudas-durmiendo');
  if (!el) return;

  const durmiendo = detectarDeudasDurmiendo(S.deudas || [], S.gastos || [], hoy());
  if (durmiendo.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = durmiendo.slice(0, 3);

  const filas = top.map(d => {
    const labelMeses = d.mesesSinPago === 1 ? '1 mes' : `${d.mesesSinPago} meses`;
    const ctaTxt = d.sugerencia === 'liquidar' ? 'Liquidar' : 'Pagar cuota';
    const cta = `<button class="btn bbl bsm" data-action="abrirPagarCuota" data-arg-id="${d.id}" aria-label="${ctaTxt} de la deuda ${he(d.nombre)}">${ctaTxt}</button>`;
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--b1);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:22px;flex-shrink:0;" aria-hidden="true">💤</span>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${he(d.nombre)}">${he(d.nombre)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">
            Sin pago hace <strong>${labelMeses}</strong> · Pendiente: ${f(d.totalPendiente)}
          </div>
        </div>
      </div>
      ${cta}
    </div>`;
  }).join('');

  const titulo = durmiendo.length === 1
    ? 'Una deuda lleva tiempo sin movimiento'
    : `${durmiendo.length} deudas llevan tiempo sin movimiento`;

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(180,80,255,.35);background:rgba(180,80,255,.05);">
      <div style="font-size:11px;font-weight:800;color:#b450ff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        💤 ${he(titulo)}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Las deudas no pagadas siguen acumulando intereses aunque vos no las mires. Retomalas o liquidalas si una cuota las cierra.
      </div>
      ${filas}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GASTOS FIJOS RECURRENTES
// ═══════════════════════════════════════════════════════════════════════════════

let _idFijoPendiente = null;

// ─── GUARDAR ─────────────────────────────────────────────────────────────────
export async function guardarFijo() {
  const no = document.getElementById('gf-no').value.trim();
  const mo = +document.getElementById('gf-mn').value;
  if (!no || !mo) return;

  const fx         = document.getElementById('gf-4k').checked;
  const montoTotal = fx ? Math.round(mo * (1 + GMF_TASA)) : mo;

  S.gastosFijos.push({
    id:           Date.now(),
    nombre:       no,
    monto:        mo,
    montoTotal,
    cuatroXMil:   fx,
    dia:          +document.getElementById('gf-di').value || 1,
    periodicidad: document.getElementById('gf-pe')?.value || 'mensual',
    tipo:         document.getElementById('gf-ti')?.value || 'necesidad',
    cat:          document.getElementById('gf-ca')?.value || 'vivienda',
    fondo:        document.getElementById('gf-fo')?.value || 'banco',
    pagadoEn:     []
  });

  ['gf-no', 'gf-mn'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
  const ck = document.getElementById('gf-4k'); if (ck) ck.checked = false;
  window.setDayPicker?.('gf-di', '');

  const body  = document.getElementById('form-fijo-body');
  const arrow = document.getElementById('form-fijo-arrow');
  const icon  = document.getElementById('form-fijo-icon');
  if (body)  body.style.display = 'none';
  if (arrow) arrow.style.transform = '';
  if (icon)  { icon.textContent = '📌'; icon.style.background = 'rgba(255,214,10,.15)'; icon.style.borderColor = 'rgba(255,214,10,.3)'; }

  save(); renderFijos(); window.updateDash?.();
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderFijos() {
  const mes    = mesStr();
  const tot    = S.gastosFijos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const pag    = S.gastosFijos.filter(g => g.pagadoEn.includes(mes));
  const totPag = pag.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const pend   = tot - totPag;

  setEl('fi-tot',      f(tot));
  setEl('fi-pag',      f(totPag));
  setEl('fi-np',       pag.length);
  setEl('fi-nt',       S.gastosFijos.length);
  setEl('fi-pend',     f(pend));
  setEl('fi-pend-txt', pend <= 0
    ? '✅ Todo pagado'
    : `${S.gastosFijos.length - pag.length} fijo${S.gastosFijos.length - pag.length !== 1 ? 's' : ''} por cubrir`);

  _renderFijosEnDeudas();

  const el = document.getElementById('fi-lst');
  if (!el) return;

  if (!S.gastosFijos.length) {
    el.innerHTML = `
      <div style="text-align:center; padding:40px 20px; background:var(--s1); border-radius:16px; border:1px dashed rgba(0,220,130,.3);">
        <div style="font-size:48px; margin-bottom:14px;">📌</div>
        <div style="font-weight:800; font-size:17px; color:var(--t1); margin-bottom:8px;">Sin gastos fijos</div>
        <div style="color:var(--t3); font-size:13px; max-width:260px; margin:0 auto; line-height:1.6;">Agrega tus gastos recurrentes para tenerlos siempre bajo control.</div>
      </div>`;
    return;
  }

  el.innerHTML = S.gastosFijos.map(g => {
    const paid     = g.pagadoEn.includes(mes);
    const mMostrar = g.cuatroXMil ? (g.montoTotal || Math.round(g.monto * (1 + GMF_TASA))) : g.monto;
    const icono    = CATS[g.cat] ? CATS[g.cat].split(' ')[0] : '📦';
    const tiBadge  = (g.tipo || 'necesidad') === 'deseo'
      ? '<span class="pill py">Deseo</span>'
      : '<span class="pill pb">Necesidad</span>';
    const perBadge = g.periodicidad === 'quincenal'
      ? '<span class="pill pm">↻ Quincenal</span>'
      : '<span class="pill pg">↻ Mensual</span>';
    const fondoLabel = g.fondo === 'efectivo' ? '💵 Efectivo' : '🏦 Banco';
    const gmfBadge   = g.cuatroXMil ? '<span class="pill pt">+4×1000</span>' : '';

    return `
    <article class="fijo-card${paid ? ' pagado' : ''}" aria-label="Gasto fijo: ${he(g.nombre)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:16px 20px 14px; border-bottom:1px solid var(--b1); gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <div style="width:44px; height:44px; border-radius:12px; background:var(--s2); border:1px solid var(--b2); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;" aria-hidden="true">${icono}</div>
          <div style="min-width:0;">
            <div class="fijo-nombre" style="font-weight:800; font-size:15px; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${he(g.nombre)}">${he(g.nombre)}</div>
            <div style="margin-top:5px; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">${tiBadge} ${perBadge} ${gmfBadge}</div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-family:var(--fm); font-size:26px; font-weight:800; color:${paid ? 'var(--t3)' : 'var(--a4)'}; letter-spacing:-1px; line-height:1;">${f(mMostrar)}</div>
          <div style="font-size:10px; color:var(--t3); margin-top:4px;">📅 Día ${g.dia} · ${fondoLabel}</div>
        </div>
      </div>
      <div style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        ${paid
          ? `<div style="display:flex; align-items:center; gap:8px; background:rgba(0,220,130,.1); border:1px solid rgba(0,220,130,.25); border-radius:8px; padding:6px 12px; flex-shrink:0;">
               <span style="font-size:14px;" aria-hidden="true">✅</span>
               <span style="font-size:12px; font-weight:700; color:var(--a1);">Pagado este mes</span>
             </div>`
          : `<div style="display:flex; align-items:center; gap:6px;">
               <div style="width:8px; height:8px; border-radius:50%; background:var(--a2); flex-shrink:0;" aria-hidden="true"></div>
               <span style="font-size:12px; font-weight:600; color:var(--a2);">Pendiente</span>
             </div>`}
        <div style="display:flex; gap:8px; margin-left:auto; align-items:center;">
          ${paid
            ? `<button class="btn bsm" data-action="desmFijo" data-arg-id="${g.id}" style="color:var(--t3); background:transparent; border:1px solid var(--b2); font-size:11px; padding:5px 10px; border-radius:6px;" aria-label="Revertir pago de ${he(g.nombre)}">↩ Revertir</button>`
            : `<button class="btn bp bsm" data-action="abrirModalFijo" data-arg-id="${g.id}" aria-label="Marcar como pagado ${he(g.nombre)}">✓ Pagar</button>`}
          <button class="btn-eliminar-deu" data-action="delFijo" data-arg-id="${g.id}" style="padding:6px 12px;" aria-label="Eliminar ${he(g.nombre)}">🗑️</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

// ─── MODAL PAGO ───────────────────────────────────────────────────────────────
export function abrirModalFijo(id) {
  const fx = S.gastosFijos.find(x => x.id == id); if (!fx) return;
  _idFijoPendiente = id;
  document.getElementById('mf-nombre').innerText = fx.nombre;
  document.getElementById('mf-monto').innerText  = f(fx.cuatroXMil ? (fx.montoTotal || Math.round(fx.monto * (1 + GMF_TASA))) : fx.monto);
  window.actualizarListasFondos?.();
  window.updCustomFundButton?.('mf-fo');
  openM('modal-pagar-fijo');
}

export function cerrarModalFijo() { closeM('modal-pagar-fijo'); _idFijoPendiente = null; }

export async function ejecutarPagoFijo() {
  const fx = S.gastosFijos.find(x => x.id == _idFijoPendiente); if (!fx) return;
  const fo = document.getElementById('mf-fo').value;
  const m  = fx.cuatroXMil ? (fx.montoTotal || Math.round(fx.monto * (1 + GMF_TASA))) : fx.monto;

  let disp = fo === 'efectivo' ? S.saldos.efectivo
    : fo.startsWith('cuenta_') ? (S.cuentas.find(x => x.id === +fo.split('_')[1])?.saldo ?? 0)
    : S.saldos.banco;

  if (disp < m) {
    const ok = await showConfirm(`⚠️ Saldo insuficiente en la cuenta seleccionada (${f(disp)} disponible).\n¿Pagar de todas formas?`, 'Saldo');
    if (!ok) return;
  }

  S.gastos.unshift({
    id: Date.now(), desc: `📌 Fijo: ${fx.nombre}`, monto: fx.monto, montoTotal: m,
    cat: fx.cat || 'vivienda', tipo: fx.tipo || 'necesidad', fondo: fo,
    hormiga: false, cuatroXMil: fx.cuatroXMil || false,
    fecha: hoy(), autoFijo: true, fijoRef: fx.id
  });

  descontarFondo(fo, m);
  if (!fx.pagadoEn) fx.pagadoEn = [];
  fx.pagadoEn.push(mesStr());

  cerrarModalFijo();
  save(); renderFijos(); renderSmart(['gastos']); window.updateDash?.();
}

// ─── DESMARCAR ───────────────────────────────────────────────────────────────
export async function desmFijo(id) {
  const g = S.gastosFijos.find(x => x.id === id); if (!g) return;
  const ok = await showConfirm(`¿Marcar "${g.nombre}" como NO pagado?\n\nEsto revertirá el descuento de tu saldo.`, 'Desmarcar pago');
  if (!ok) return;

  const mes = mesStr();
  g.pagadoEn = g.pagadoEn.filter(m => m !== mes);

  const idx = S.gastos.findIndex(x => x.autoFijo && x.fijoRef === id && x.fecha.slice(0, 7) === mes);
  if (idx !== -1) {
    const gasto = S.gastos[idx];
    reintegrarFondo(gasto.fondo, gasto.montoTotal || gasto.monto);
    S.gastos.splice(idx, 1);
  }
  save(); renderFijos(); renderSmart(['gastos']); window.updateDash?.();
}

// ─── ELIMINAR ────────────────────────────────────────────────────────────────
export async function delFijo(id) {
  const ok = await showConfirm('¿Eliminar gasto fijo?', 'Eliminar');
  if (!ok) return;
  S.gastosFijos = S.gastosFijos.filter(x => x.id !== id);
  save(); renderFijos();
}

// ─── FIJOS EN DEUDAS (resumen) ───────────────────────────────────────────────
function _renderFijosEnDeudas() {
  const el = document.getElementById('deu-fijos-resumen'); if (!el) return;
  const mes        = mesStr();
  const pendientes = S.gastosFijos.filter(g => !(g.pagadoEn || []).includes(mes));
  if (!pendientes.length) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  const totalPendiente = pendientes.reduce((s, g) => s + (g.monto || 0), 0);

  const filas = pendientes.map(g => {
    const icono    = CATS[g.cat] ? CATS[g.cat].split(' ')[0] : '📦';
    const mMostrar = g.cuatroXMil ? (g.montoTotal || Math.round(g.monto * (1 + GMF_TASA))) : g.monto;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--b1);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:16px;" aria-hidden="true">${icono}</span>
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--t1);">${he(g.nombre)}</div>
            <div style="font-size:10px; color:var(--t3);">📅 Día ${g.dia} · ${g.periodicidad}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--fm); font-weight:700; font-size:14px; color:var(--a2);">${f(mMostrar)}</div>
          ${g.cuatroXMil ? '<div style="font-size:9px; color:var(--t3);">incluye 4×1000</div>' : ''}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
      <div>
        <div class="ct" style="margin-bottom:2px;">📌 Fijos pendientes este mes</div>
        <div class="tm">Compromisos fijos que aún no has cubierto</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; margin-bottom:2px;">${pendientes.length} pendiente${pendientes.length > 1 ? 's' : ''}</div>
        <div style="font-family:var(--fm); font-weight:800; font-size:18px; color:var(--a2);">${f(totalPendiente)}</div>
      </div>
    </div>
    ${filas}
    <div style="display:flex; justify-content:flex-end; margin-top:12px;">
      <button class="btn bg bsm" data-action="go" data-arg-sec="gast" style="font-size:11px;">Ver todos los fijos →</button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENDA / PAGOS AGENDADOS
// ═══════════════════════════════════════════════════════════════════════════════

let _calDate           = null;
let _currentDaysEvents = {};

// ─── NAVEGACIÓN ──────────────────────────────────────────────────────────────
export function prevMonth() {
  if (!_calDate) _calDate = new Date();
  _calDate.setMonth(_calDate.getMonth() - 1);
  renderCal();
  const det = document.getElementById('cal-details');
  if (det) det.style.display = 'none';
}

export function nextMonth() {
  if (!_calDate) _calDate = new Date();
  _calDate.setMonth(_calDate.getMonth() + 1);
  renderCal();
  const det = document.getElementById('cal-details');
  if (det) det.style.display = 'none';
}

// ─── RENDER CALENDARIO ───────────────────────────────────────────────────────
export function renderCal() {
  const el = document.getElementById('cal-g'); if (!el) return;
  if (!_calDate) _calDate = new Date();

  const year  = _calDate.getFullYear();
  const month = _calDate.getMonth();
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  setEl('cal-month-title', `${MONTHS[month]} ${year}`);

  const now            = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const todayDate      = now.getDate();
  const calMesStr      = `${year}-${String(month + 1).padStart(2, '0')}`;
  const firstDay       = new Date(year, month, 1).getDay();
  const startOffset    = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth    = new Date(year, month + 1, 0).getDate();

  _currentDaysEvents = {};

  (S.pagosAgendados || []).forEach(p => {
    if (!p.pagado) {
      const pDate = new Date(p.fecha + 'T12:00:00');
      if (pDate.getFullYear() === year && pDate.getMonth() === month) {
        const d = pDate.getDate();
        if (!_currentDaysEvents[d]) _currentDaysEvents[d] = { agendados: [], fijos: [], deudas: [] };
        _currentDaysEvents[d].agendados.push(p);
      }
    }
  });

  (S.gastosFijos || []).forEach(fijo => {
    if (!(fijo.pagadoEn || []).includes(calMesStr)) {
      const diaReal = Math.min(fijo.dia, daysInMonth);
      if (!_currentDaysEvents[diaReal]) _currentDaysEvents[diaReal] = { agendados: [], fijos: [], deudas: [] };
      _currentDaysEvents[diaReal].fijos.push(fijo);
      if (fijo.periodicidad === 'quincenal') {
        const diaQ2 = diaReal + 15;
        if (diaQ2 <= daysInMonth) {
          if (!_currentDaysEvents[diaQ2]) _currentDaysEvents[diaQ2] = { agendados: [], fijos: [], deudas: [] };
          _currentDaysEvents[diaQ2].fijos.push(fijo);
        }
      }
    }
  });

  (S.deudas || []).forEach(deuda => {
    if ((deuda.total - deuda.pagado) <= 0) return;
    const diaPago = Math.min(deuda.diaPago || 1, daysInMonth);
    const pagadoEsteMes = (S.gastos || []).some(g =>
      g.cat === 'deudas' && g.fecha.startsWith(calMesStr) && g.desc.includes(deuda.nombre));
    if (!pagadoEsteMes) {
      if (!_currentDaysEvents[diaPago]) _currentDaysEvents[diaPago] = { agendados: [], fijos: [], deudas: [] };
      _currentDaysEvents[diaPago].deudas.push(deuda);
    }
  });

  let html = '';
  for (let i = 0; i < startOffset; i++) html += `<div></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && day === todayDate;
    const ev      = _currentDaysEvents[day];
    const baseBg  = isToday ? 'var(--s2)' : 'rgba(255,255,255,0.02)';
    const color   = isToday ? 'color:var(--a1);' : 'color:var(--t2);';

    const daySpan = isToday
      ? `<span style="background:rgba(0,0,0,0); border:2px solid var(--a1); color:var(--a1); width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-weight:800; box-shadow:0 3px 8px rgba(0,220,130,.5);">${day}</span>`
      : `<span>${day}</span>`;

    let dots = '';
    if (ev) {
      dots += `<div style="display:flex; gap:3px; margin-top:4px; height:5px;">`;
      if (ev.agendados.length) dots += `<div style="width:5px; height:5px; border-radius:50%; background:var(--dan); box-shadow:0 0 4px var(--dan);"></div>`;
      if (ev.fijos.length)    dots += `<div style="width:5px; height:5px; border-radius:50%; background:var(--a4); box-shadow:0 0 4px var(--a4);"></div>`;
      if (ev.deudas.length)   dots += `<div style="width:5px; height:5px; border-radius:50%; background:var(--a2); box-shadow:0 0 4px var(--a2);"></div>`;
      dots += `</div>`;
    } else {
      dots = `<div style="height:5px; margin-top:4px;"></div>`;
    }

    html += `<div
      class="cal-day-box${isToday ? ' today' : ''}"
      role="button" tabindex="0"
      aria-label="Día ${day}${ev ? ', tiene compromisos' : ''}"
      data-action="showDayDetails" data-arg-day="${day}"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
      style="padding:6px 0; border-radius:8px; text-align:center; font-size:13px; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:48px; cursor:pointer; transition:all 0.2s; background:${baseBg}; border:2px solid transparent; ${color}"
    >${daySpan}${dots}</div>`;
  }

  el.innerHTML = html;
}

// ─── DETALLE DEL DÍA ─────────────────────────────────────────────────────────
export function showDayDetails(day, element = null) {
  const el = document.getElementById('cal-details'); if (!el) return;

  if (element) {
    document.querySelectorAll('.cal-day-box').forEach(box => {
      box.classList.remove('selected-day');
      box.style.border = '2px solid transparent';
      box.style.background = box.classList.contains('today') ? 'var(--s2)' : 'rgba(255,255,255,0.02)';
    });
    element.classList.add('selected-day');
    element.style.border       = '2px solid transparent';
    element.style.background   = 'rgba(0,220,130,.15)';
    element.style.borderRadius = '16px';
  }

  const ev = _currentDaysEvents[day];
  if (!ev || (!ev.agendados.length && !ev.fijos.length && !(ev.deudas || []).length)) {
    el.innerHTML = `<div style="padding:16px; text-align:center; color:var(--t3); font-size:13px; font-weight:500; background:rgba(255,255,255,0.02); border-radius:8px; border:1px dashed var(--b2); display:flex; flex-direction:column; align-items:center; gap:8px;">
      <span style="font-size:20px;">☕</span>
      <span>No hay pagos programados para el día ${day}. ¡Un respiro para tu bolsillo!</span>
    </div>`;
    el.style.display = 'block'; return;
  }

  const getFondoLabel = fo => {
    if (fo === 'efectivo') return '💵 Efectivo';
    if (fo && fo.startsWith('cuenta_')) {
      const c = S.cuentas.find(x => x.id === +fo.split('_')[1]);
      if (c) return `${c.icono} ${c.nombre}`;
    }
    return '🏦 Banco';
  };

  let html = `<div style="font-weight:700; font-size:14px; margin-bottom:10px; color:var(--t1);">📅 Compromisos del día ${day}</div>`;

  if (ev.agendados.length) {
    html += `<div style="font-size:11px; font-weight:700; color:var(--dan); margin-bottom:6px; text-transform:uppercase;">Pagos Agendados</div>`;
    ev.agendados.forEach(p => {
      html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,68,68,0.05); padding:8px; border-radius:6px; margin-bottom:6px; border:1px solid rgba(255,68,68,0.1);">
        <div><div style="font-size:13px; font-weight:600; color:var(--t1);">${he(p.desc)}</div><div style="font-size:10px; color:var(--t3);">${getFondoLabel(p.fondo)}</div></div>
        <div style="font-family:var(--fm); font-weight:700; color:var(--dan);">${f(p.monto)}</div>
      </div>`;
    });
  }

  if (ev.fijos.length) {
    html += `<div style="font-size:11px; font-weight:700; color:var(--a4); margin-bottom:6px; margin-top:10px; text-transform:uppercase;">Gastos Fijos</div>`;
    ev.fijos.forEach(fx => {
      const m = fx.cuatroXMil ? Math.round(fx.monto * 1.004) : fx.monto;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(59,158,255,0.05); padding:8px; border-radius:6px; margin-bottom:6px; border:1px solid rgba(59,158,255,0.1);">
        <div><div style="font-size:13px; font-weight:600; color:var(--t1);">${he(fx.nombre)}</div><div style="font-size:10px; color:var(--t3);">${getFondoLabel(fx.fondo)}</div></div>
        <div style="font-family:var(--fm); font-weight:700; color:var(--a4);">${f(m)}</div>
      </div>`;
    });
  }

  if ((ev.deudas || []).length) {
    html += `<div style="font-size:11px; font-weight:700; color:var(--a2); margin-bottom:6px; margin-top:10px; text-transform:uppercase;">💳 Cuotas de Deudas</div>`;
    ev.deudas.forEach(d => {
      html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,214,10,0.05); padding:8px; border-radius:6px; margin-bottom:6px; border:1px solid rgba(255,214,10,0.15);">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--t1);">${he(d.nombre)}</div>
          <div style="font-size:10px; color:var(--t3);">Vence el día ${d.diaPago || 1} · ${d.periodicidad || 'mensual'}</div>
        </div>
        <div style="font-family:var(--fm); font-weight:700; color:var(--a2);">${f(d.cuota)}</div>
      </div>`;
    });
  }

  el.innerHTML = html;
  el.style.display = 'block';
}

// ─── GUARDAR PAGO ────────────────────────────────────────────────────────────
export async function guardarPago() {
  const de = document.getElementById('ag-de').value.trim();
  const mo = +document.getElementById('ag-mo').value;
  const fe = document.getElementById('ag-fe').value;
  if (!de || !mo || !fe) { await showAlert('Completa la descripción, el monto y la fecha del pago.', 'Faltan datos'); return; }

  S.pagosAgendados.push({
    id:      Date.now(),
    desc:    de,
    monto:   mo,
    fecha:   fe,
    repetir: document.getElementById('ag-re').value,
    fondo:   document.getElementById('ag-fo').value,
    pagado:  false
  });
  closeM('m-pago');
  save();
  renderSmart(['pagos']);
}

// ─── MARCAR PAGADO ───────────────────────────────────────────────────────────
export function marcarPagado(id) {
  const p = S.pagosAgendados.find(x => x.id === id); if (!p) return;
  const hiddenFo = document.getElementById('cp-fo');
  if (hiddenFo) hiddenFo.value = p.fondo || 'efectivo';
  window.actualizarListasFondos?.();
  document.getElementById('cp-desc').innerHTML = `Vas a pagar <strong style="color:var(--t1); font-size:15px;">${f(p.monto)}</strong> por "${he(p.desc)}".`;
  document.getElementById('cp-id').value = id;
  openM('m-conf-pago');
}

export async function ejecutarPagoAgendado() {
  const id = +document.getElementById('cp-id').value;
  const p  = S.pagosAgendados.find(x => x.id === id); if (!p) return;

  const fo = document.getElementById('cp-fo').value;
  let disp = 0, nombreCuenta = 'Efectivo';
  if (fo === 'efectivo') { disp = S.saldos.efectivo; }
  else if (fo.startsWith('cuenta_')) {
    const c = S.cuentas.find(x => x.id === +fo.split('_')[1]);
    if (c) { disp = c.saldo; nombreCuenta = c.nombre; }
  } else { disp = S.saldos.banco; nombreCuenta = 'Banco'; }

  if (disp < p.monto) {
    const ok = await showConfirm(`⚠️ Saldo insuficiente en ${nombreCuenta} (${f(disp)} disponible).\n¿Pagar de todas formas?`, 'Saldo');
    if (!ok) return;
  }

  descontarFondo(fo, p.monto);
  S.gastos.unshift({ id: Date.now(), desc: `📅 Pago: ${p.desc}`, monto: p.monto, montoTotal: p.monto, cat: 'otro', tipo: 'necesidad', fondo: fo, hormiga: false, cuatroXMil: false, fecha: hoy(), metaId: '', autoFijo: false });
  p.pagado = true;

  if (p.repetir === 'mensual' || p.repetir === 'quincenal') {
    const nextDate    = new Date(p.fecha + 'T12:00:00');
    const diaOriginal = nextDate.getDate();
    if (p.repetir === 'mensual') {
      nextDate.setDate(1);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const maxDia = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      nextDate.setDate(Math.min(diaOriginal, maxDia));
    } else {
      nextDate.setDate(nextDate.getDate() + 15);
    }
    const yyyy = nextDate.getFullYear();
    const mm   = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd   = String(nextDate.getDate()).padStart(2, '0');
    S.pagosAgendados.push({ id: Date.now() + Math.random(), desc: p.desc, monto: p.monto, fecha: `${yyyy}-${mm}-${dd}`, repetir: p.repetir, fondo: p.fondo, pagado: false });
  }

  closeM('m-conf-pago');
  save();
  renderSmart(['pagos', 'gastos']);
}

export async function delPago(id) {
  const p  = S.pagosAgendados.find(x => x.id === id); if (!p) return;
  const ok = await showConfirm(`⚠️ ¿Eliminar el pago "${he(p.desc)}"?`, 'Eliminar Pago');
  if (!ok) return;
  S.pagosAgendados = S.pagosAgendados.filter(x => x.id !== id);
  save();
  renderSmart(['pagos']);
  renderCal();
}

// ─── RENDER LISTA DE PAGOS ───────────────────────────────────────────────────
export function renderPagos() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const up  = S.pagosAgendados.filter(p => !p.pagado).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const totalLiquidez = up.reduce((s, p) => s + p.monto, 0);
  const prox7    = up.filter(p => { const d = new Date(p.fecha + 'T12:00:00'); d.setHours(0,0,0,0); const dias = Math.ceil((d - now) / 86_400_000); return dias >= 0 && dias <= 7; });
  const vencidos = up.filter(p => { const d = new Date(p.fecha + 'T12:00:00'); d.setHours(0,0,0,0); return d < now; });

  setEl('ag-tot-monto',   f(totalLiquidez));
  setEl('ag-prox7',       f(prox7.reduce((s, p) => s + p.monto, 0)));
  setEl('ag-prox7-count', `${prox7.length} pago${prox7.length !== 1 ? 's' : ''}`);

  const vencMonto   = vencidos.reduce((s, p) => s + p.monto, 0);
  const vencMontoEl = document.getElementById('ag-vencidos-monto');
  const vencMsg     = document.getElementById('ag-vencidos-msg');
  const vencCount   = document.getElementById('ag-vencidos-count');
  if (vencMontoEl) { vencMontoEl.textContent = f(vencMonto); vencMontoEl.style.color = vencidos.length ? 'var(--dan)' : 'var(--a1)'; }
  if (vencMsg)     { vencMsg.textContent = vencidos.length ? 'requieren atención urgente' : 'sin pagos vencidos ✅'; vencMsg.style.color = vencidos.length ? 'var(--dan)' : 'var(--t3)'; }
  if (vencCount)   { vencCount.textContent = vencidos.length ? `${vencidos.length} pago${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''}` : ''; vencCount.style.color = 'var(--dan)'; }

  const avisosEl = document.getElementById('ag-avisos');
  if (avisosEl) {
    const avisos = [];
    if (vencidos.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,68,68,.03);">
      <span style="font-size:20px; flex-shrink:0;">🚨</span>
      <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--dan); margin-bottom:3px;">Tienes ${vencidos.length} pago${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''}</div>
      <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong style="color:var(--t2);">${vencidos.map(p => he(p.desc)).join(', ')}</strong> ya pasaron su fecha límite.</div></div>
    </div>`);
    else if (prox7.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,214,10,.03);">
      <span style="font-size:20px; flex-shrink:0;">📆</span>
      <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--a2); margin-bottom:3px;">Tienes ${prox7.length} pago${prox7.length > 1 ? 's' : ''} en los próximos 7 días</div>
      <div style="font-size:11px; color:var(--t3); line-height:1.6;">Asegúrate de tener <strong style="color:var(--t2);">${f(prox7.reduce((s,p)=>s+p.monto,0))}</strong> disponibles esta semana.</div></div>
    </div>`);
    if (!up.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; background:rgba(0,220,130,.03);">
      <span style="font-size:20px; flex-shrink:0;">🌟</span>
      <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--a1); margin-bottom:3px;">Sin pagos pendientes</div>
      <div style="font-size:11px; color:var(--t3); line-height:1.6;">Todo al día. Agenda tus próximos compromisos.</div></div>
    </div>`);

    const finSemana = up.filter(p => { const d = new Date(p.fecha + 'T12:00:00'); const dia = d.getDay(); const dias = Math.ceil((d - now) / 86_400_000); return (dia === 0 || dia === 6) && dias >= 0 && dias <= 14; });
    if (finSemana.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(59,158,255,.03);">
      <span style="font-size:20px; flex-shrink:0;">📆</span>
      <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--a4); margin-bottom:3px;">Pago en fin de semana — revisa con tu banco</div>
      <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong style="color:var(--t2);">${finSemana.map(p => he(p.desc)).join(', ')}</strong> cae en sábado o domingo. Paga antes del viernes para estar seguro.</div></div>
    </div>`);

    avisosEl.innerHTML = avisos.join('');
  }

  const getFondo = fo => {
    if (fo === 'efectivo') return { icon: '💵', name: 'Efectivo' };
    if (fo && fo.startsWith('cuenta_')) { const c = S.cuentas.find(x => x.id === +fo.split('_')[1]); if (c) return { icon: c.icono, name: c.nombre }; }
    return { icon: '🏦', name: 'Banco' };
  };
  const iconoFrec = { mensual: '↻', quincenal: '↻', unico: '✦' };
  const classFrec = { mensual: 'pill pb', quincenal: 'pill py', unico: 'pill pg' };
  const labelFrec = { mensual: 'Mensual', quincenal: 'Quincenal', unico: 'Único' };

  let htmlLista = '';
  if (up.length) {
    htmlLista = up.map(p => {
      const dObj = new Date(p.fecha + 'T12:00:00'); dObj.setHours(0,0,0,0);
      const dias = Math.ceil((dObj - now) / 86_400_000);
      const fechaFmt = new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' });
      const fondo = getFondo(p.fondo);

      let colorEstado = 'var(--a2)', textoEstado = `En ${dias} días`, borderLeft = 'transparent';
      if (dias < 0)        { colorEstado = 'var(--dan)'; textoEstado = `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) > 1 ? 's' : ''}`; borderLeft = 'var(--dan)'; }
      else if (dias === 0) { colorEstado = 'var(--a1)';  textoEstado = '¡Hoy!'; borderLeft = 'var(--a1)'; }
      else if (dias === 1) { colorEstado = 'var(--a3)';  textoEstado = 'Mañana'; borderLeft = 'var(--a3)'; }

      const frec = p.repetir || 'unico';
      return `
      <article class="pago-card" style="border-left:4px solid ${borderLeft};" aria-label="Pago: ${he(p.desc)}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:16px 20px 14px; border-bottom:1px solid var(--b1); flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
            <div style="width:44px; height:44px; border-radius:12px; background:var(--s2); border:1px solid var(--b2); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;" aria-hidden="true">📅</div>
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:14px; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${he(p.desc)}">${he(p.desc)}</div>
              <div style="margin-top:5px; display:flex; align-items:center; gap:6px;">
                <span class="${classFrec[frec] || 'pill pg'}" style="font-size:9px;">${iconoFrec[frec] || '✦'} ${labelFrec[frec] || 'Único'}</span>
                <span style="font-size:10px; color:var(--t3); text-transform:capitalize;">${fechaFmt}</span>
              </div>
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-family:var(--fm); font-size:22px; font-weight:800; color:var(--t1); letter-spacing:-1px; line-height:1;">${f(p.monto)}</div>
          </div>
        </div>
        <div style="padding:12px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;" aria-hidden="true">${fondo.icon}</span>
            <div>
              <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Sale de</div>
              <div style="font-size:12px; font-weight:600; color:var(--t2);">${he(fondo.name)}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:8px; height:8px; border-radius:50%; background:${colorEstado}; flex-shrink:0;" aria-hidden="true"></div>
            <span style="font-size:12px; font-weight:700; color:${colorEstado};">${textoEstado}</span>
          </div>
          <div style="display:flex; gap:8px; margin-left:auto;">
            <button class="btn bp bsm" data-action="marcarPagado" data-arg-id="${p.id}" style="padding:8px 16px;" aria-label="Pagar ${he(p.desc)}">✓ Pagar</button>
            <button class="btn-eliminar-deu" data-action="delPago" data-arg-id="${p.id}" style="padding:6px 12px;" aria-label="Eliminar ${he(p.desc)}">🗑️</button>
          </div>
        </div>
      </article>`;
    }).join('');
  } else {
    htmlLista = `<div style="text-align:center; padding:40px 20px;"><div style="font-size:48px; margin-bottom:14px;">🗓️</div><div style="font-weight:800; font-size:17px; color:var(--t1); margin-bottom:8px;">Sin pagos pendientes</div><div style="color:var(--t3); font-size:13px; max-width:260px; margin:0 auto; line-height:1.6;">Agenda tus próximos compromisos para no perder el control de tu liquidez.</div></div>`;
  }

  const countEl = document.getElementById('pa-lst-count');
  if (countEl) countEl.textContent = up.length ? `${up.length} pago${up.length !== 1 ? 's' : ''} pendiente${up.length !== 1 ? 's' : ''}` : '';
  setHtml('pa-lst', htmlLista);

  const rowDash = p => {
    const dObj = new Date(p.fecha + 'T12:00:00'); dObj.setHours(0,0,0,0);
    const dias  = Math.ceil((dObj - now) / 86_400_000);
    const col   = dias < 0 ? 'var(--dan)' : dias === 0 ? 'var(--a1)' : dias <= 3 ? 'var(--a3)' : 'var(--t3)';
    const fechaFmt = new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    return `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--b1);">
      <div style="font-size:11px; color:${col}; min-width:55px; font-weight:700; text-transform:capitalize;">${fechaFmt}</div>
      <div style="flex:1; font-size:12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${he(p.desc)}</div>
      <div style="font-family:var(--fm); font-weight:700; font-size:13px; color:var(--a2); flex-shrink:0;">${f(p.monto)}</div>
    </div>`;
  };
  setHtml('d-prox', up.length ? up.slice(0, 4).map(p => rowDash(p)).join('') : '<div class="emp">Sin pagos próximos</div>');
  renderCal();
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEUDAS
// ═══════════════════════════════════════════════════════════════════════════════

let _modoTimer = null;

// ─── GUARDAR ─────────────────────────────────────────────────────────────────
export async function guardarDeuda() {
  const no = document.getElementById('dn-no').value.trim();
  const to = +document.getElementById('dn-to').value;
  const cu = +document.getElementById('dn-cu').value;
  if (!no || !to || !cu) { await showAlert('Falta el nombre de la deuda, cuánto debés en total y cuánto pagás cada vez. Sin eso no podemos registrarla.', 'Falta info'); return; }

  S.deudas.push({
    id:           Date.now(),
    nombre:       no,
    total:        to,
    cuota:        cu,
    periodicidad: document.getElementById('dn-pe')?.value || 'mensual',
    tasa:         +document.getElementById('dn-ta')?.value || 0,
    tipo:         document.getElementById('dn-ti')?.value || 'otro',
    diaPago:      +document.getElementById('dn-dia')?.value || 1,
    pagado:       0
  });

  ['dn-no', 'dn-to', 'dn-cu', 'dn-ta', 'dn-dia', 'dn-plazo'].forEach(i => {
    const e = document.getElementById(i); if (e) e.value = '';
  });
  // Reset panel auto-cuota
  const panel  = document.getElementById('panel-auto-cuota');
  const btnAuto = document.getElementById('btn-auto-cuota');
  const out    = document.getElementById('auto-cuota-out');
  if (panel)   panel.hidden = true;
  if (btnAuto) btnAuto.setAttribute('aria-expanded', 'false');
  if (out)     out.innerHTML = '';

  closeM('m-deu'); save(); renderSmart(['deudas']);
}

// ─── AUTO-CUOTA (I2 auditoría v5) ────────────────────────────────────────────
/**
 * Abre/cierra el panel "Calcular cuota automática" en el modal de nueva deuda.
 * No depende de S — solo toca DOM del modal.
 */
export function toggleAutoCuota() {
  const panel = document.getElementById('panel-auto-cuota');
  const btn   = document.getElementById('btn-auto-cuota');
  if (!panel || !btn) return;
  const oculto = panel.hidden;
  panel.hidden = !oculto;
  btn.setAttribute('aria-expanded', String(oculto));
  if (oculto) {
    // Al abrir, focus en plazo para teclar de una
    const plazo = document.getElementById('dn-plazo');
    if (plazo) plazo.focus();
  }
}

/**
 * Lee total + tasa + plazo + periodicidad del modal, calcula la cuota sugerida
 * y la inserta en `dn-cu`, mostrando un mensaje con los intereses totales.
 *
 * Si los inputs son insuficientes (falta total o plazo), muestra un hint en el
 * `aria-live` del panel sin romper el flujo.
 */
export async function calcularCuotaAuto() {
  const total      = +document.getElementById('dn-to')?.value || 0;
  const tasaEA     = +document.getElementById('dn-ta')?.value || 0;
  const plazoMeses = +document.getElementById('dn-plazo')?.value || 0;
  const periodicidad = document.getElementById('dn-pe')?.value || 'mensual';
  const out        = document.getElementById('auto-cuota-out');

  if (!total) {
    if (out) out.innerHTML = '<span style="color:var(--a3);">Primero ponele el total que debés (arriba ↑).</span>';
    return;
  }
  if (!plazoMeses) {
    if (out) out.innerHTML = '<span style="color:var(--a3);">Decinos en cuántos meses la querés pagar.</span>';
    return;
  }

  const r = calcularCuotaSugerida({ total, tasaEA, plazoMeses, periodicidad });
  if (!r) {
    if (out) out.innerHTML = '<span style="color:var(--dan);">No se puede calcular con esos datos. Revisá total y plazo.</span>';
    return;
  }

  // Inserta la cuota en el campo
  const cu = document.getElementById('dn-cu');
  if (cu) cu.value = Math.round(r.cuota);

  // Aviso usura si la tasa supera el límite legal colombiano
  const avisoUsura = (tasaEA > TASA_USURA_EA)
    ? `<div style="margin-top:6px;color:var(--dan);font-weight:700;">🚨 ¡Ojo! Esa tasa supera la usura legal en Colombia (${TASA_USURA_EA}% E.A.). Es ilegal cobrarte tanto.</div>`
    : '';

  const sufijoPeriodo = periodicidad === 'quincenal' ? 'quincena' : 'mes';
  const totalCuotas   = r.nPeriodos;
  const interesPct    = total > 0 ? Math.round((r.totalInteres / total) * 100) : 0;

  if (out) {
    out.innerHTML = `
      <div style="background:var(--s2);border-radius:8px;padding:10px;margin-top:6px;">
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;margin-bottom:4px;">
          <span>Cuota por <strong>${sufijoPeriodo}</strong>:</span>
          <strong style="color:var(--a1);font-family:var(--fm);">${f(Math.round(r.cuota))}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;margin-bottom:4px;">
          <span>Total de cuotas:</span>
          <strong style="font-family:var(--fm);">${totalCuotas}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;margin-bottom:4px;">
          <span>Vas a pagar en total:</span>
          <strong style="font-family:var(--fm);">${f(Math.round(r.totalPagado))}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;">
          <span>De los cuales son intereses:</span>
          <strong style="color:${interesPct > 30 ? 'var(--dan)' : 'var(--a3)'};font-family:var(--fm);">${f(Math.round(r.totalInteres))} (${interesPct}%)</strong>
        </div>
        ${avisoUsura}
      </div>
      <div style="margin-top:6px;font-size:10px;color:var(--t3);">✅ Cuota copiada al campo de arriba. Podés ajustarla a mano si querés.</div>
    `;
  }
}

// ─── ESTRATEGIA: AVALANCHA / BOLA DE NIEVE ───────────────────────────────────
export function setModoDeuda(m) {
  S.modoDeuda = m;
  const btnAva  = document.getElementById('btn-ava');
  const btnBola = document.getElementById('btn-bola');
  if (btnAva)  btnAva.className  = m === 'avalancha' ? 'btn bp' : 'btn bg';
  if (btnBola) btnBola.className = m === 'bola'      ? 'btn bp' : 'btn bg';

  const lista = document.getElementById('de-lst');
  if (lista) {
    lista.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    lista.style.opacity = '0'; lista.style.transform = 'translateY(6px)';
    if (_modoTimer) clearTimeout(_modoTimer);
    _modoTimer = setTimeout(() => {
      _modoTimer = null;
      save(); renderDeudas();
      requestAnimationFrame(() => { lista.style.opacity = '1'; lista.style.transform = 'translateY(0)'; });
    }, 300);
  } else { save(); renderDeudas(); }
}

// ─── MORA REAL ───────────────────────────────────────────────────────────────
function _obtenerAlertaMora(deuda) {
  const diasMora = calcularDiasMora(deuda, new Date(), S.gastos);
  const nivel    = clasificarMora(diasMora);
  if (!nivel) return '';

  if (nivel === 'leve') {
    return `<div class="alerta-mora alerta-leve" role="status" aria-live="polite" style="margin-top:10px; padding:10px; background:rgba(255,214,10,.1); color:var(--a2); border-radius:8px; border:1px solid rgba(255,214,10,.3); font-size:12px;"><span aria-hidden="true">⏳</span> <strong>Llevás ${diasMora} día${diasMora !== 1 ? 's' : ''} sin cubrir esta cuota.</strong> Entre más esperés, más se acumulan los intereses de mora. No dejés que eso pase.</div>`;
  }
  if (nivel === 'media') {
    return `<div class="alerta-mora alerta-media" role="alert" aria-live="assertive" style="margin-top:10px; padding:10px; background:rgba(255,107,53,.1); color:var(--a3); border-radius:8px; border:1px solid rgba(255,107,53,.3); font-size:12px;"><span aria-hidden="true">⚠️</span> <strong>¡${diasMora} días sin pagar es mucho!</strong> Tu historial en Datacrédito puede estar tomando nota. Llamá al banco antes de que la cosa se ponga más difícil.</div>`;
  }
  return `<div class="alerta-mora alerta-grave" role="alert" aria-live="assertive" style="margin-top:10px; padding:10px; background:rgba(255,68,68,.1); color:var(--dan); border-radius:8px; border:1px solid rgba(255,68,68,.3); font-size:12px;"><span aria-hidden="true">🚨</span> <strong>¡Cuidadito! Llevás ${diasMora} días en mora.</strong> Pero ojo: la ley te protege. El banco debe avisarte con 20 días de anticipación antes de reportarte a Datacrédito (Ley 1266/2008, Art. 13). ¡Actuá hoy!</div>`;
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderDeudas() {
  const sq    = S.deudas.filter(d => d.periodicidad === 'quincenal').reduce((s, d) => s + d.cuota, 0);
  const sm    = S.deudas.filter(d => d.periodicidad === 'mensual').reduce((s, d) => s + d.cuota, 0);
  let   cPer  = 0;
  if (S.tipoPeriodo === 'mensual') cPer = (sq * 2) + sm;
  else if (S.tipoPeriodo === 'q1') cPer = sq + sm;
  else                             cPer = sq;

  const totD          = S.deudas.reduce((s, d) => s + Math.max(0, d.total - d.pagado), 0);
  const cuotaMensual  = (sq * 2) + sm;
  let   ingresoBase   = S.ingreso > 0 ? S.ingreso : (S.saldos.efectivo + totalCuentas());
  let   ingresoMensual = (S.tipoPeriodo === 'q1' || S.tipoPeriodo === 'q2') ? ingresoBase * 2 : ingresoBase;
  const pct           = ingresoMensual > 0 ? Math.round((cuotaMensual / ingresoMensual) * 100) : 0;

  setEl('de-tot', f(totD));
  setEl('de-cp',  f(cPer));

  const pe = document.getElementById('de-pct');
  const cardPct = document.getElementById('card-pct-ingreso');
  const cardMsg = document.getElementById('de-pct-msg');
  if (pe && cardPct) {
    const cfg = pct > 100
      ? { badge: `🚨 ${pct}%`, color: 'var(--dan)', bg: 'rgba(255,68,68,.08)', border: 'rgba(255,68,68,.3)', msg: '¡Tus deudas cuestan más de lo que ganás! Esto es urgente, hay que actuar ya.' }
      : pct > 40
      ? { badge: `⚠️ ${pct}%`, color: 'var(--a2)', bg: 'rgba(255,214,10,.08)', border: 'rgba(255,214,10,.3)', msg: 'Más del 40% de tu quincena se va en deudas. Por favor, no agarrés más compromisos por ahora.' }
      : pct > 0
      ? { badge: `✅ ${pct}%`, color: 'var(--a1)', bg: 'var(--s1)', border: 'var(--b1)', msg: '¡Bien! Tus deudas están bajo control. Seguí así.' }
      : { badge: '✅ 0%',      color: 'var(--a1)', bg: 'var(--s1)', border: 'var(--b1)', msg: '' };

    pe.innerHTML = cfg.badge.replace(/%/, '<span style="font-size:16px; font-weight:600; margin-left:2px;">%</span>');
    pe.style.color = cfg.color;
    cardPct.style.background  = cfg.bg;
    cardPct.style.borderColor = cfg.border;
    if (cardMsg) { cardMsg.textContent = cfg.msg; cardMsg.style.color = cfg.color; }
  }

  _renderAvisosDeudas(pct, totD);
  window.renderFijos?.();

  const el = document.getElementById('de-lst');
  if (!S.deudas.length) {
    el.innerHTML = `
      <div style="text-align:center; padding:48px 20px; background:var(--s1); border-radius:16px; border:1px dashed var(--a1); margin-top:20px;">
        <div style="font-size:64px; margin-bottom:16px;">🏆</div>
        <h3 style="color:var(--t1); margin-bottom:8px; font-size:22px;">¡Estás libre de deudas! ¡Eso es enorme!</h3>
        <p style="color:var(--t3); font-size:14px; max-width:320px; margin:0 auto; line-height:1.6;">Lograste uno de los hitos financieros más importantes. Ahora redirigí esa plata de las cuotas a hacer crecer tu patrimonio. ¡Felicitaciones!</p>
      </div>`;
    return;
  }

  const modo    = S.modoDeuda || 'avalancha';
  const btnAva  = document.getElementById('btn-ava');
  const btnBola = document.getElementById('btn-bola');
  if (btnAva)  btnAva.className  = modo === 'avalancha' ? 'btn bp' : 'btn bg';
  if (btnBola) btnBola.className = modo === 'bola'      ? 'btn bp' : 'btn bg';

  let copia  = [...S.deudas];
  const msgEl = document.getElementById('deu-coach-msg');

  if (modo === 'avalancha') {
    copia.sort((a, b) => { const dTasa = (b.tasa || 0) - (a.tasa || 0); if (dTasa !== 0) return dTasa; return (b.total - b.pagado) - (a.total - a.pagado); });
    if (msgEl) msgEl.innerHTML = `
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <span style="font-size:20px; flex-shrink:0;">🔥</span>
        <div>
          <div style="font-weight:700; font-size:12px; color:var(--t1); margin-bottom:4px;">Estrategia Avalancha — La más inteligente para tu bolsillo</div>
          <div style="font-size:11px; color:var(--t3); line-height:1.6;">Pagá el <strong style="color:var(--t2);">mínimo en todas</strong> y mandá todo el dinero extra a atacar la deuda con la <strong style="color:var(--dan);">tasa más alta</strong>. Cuando la liquides, ese dinero cae en cascada sobre la siguiente. Así es como pagás menos intereses en total. ¡Duro de cabeza!</div>
        </div>
      </div>`;
  } else {
    copia.sort((a, b) => { const dSaldo = (a.total - a.pagado) - (b.total - b.pagado); if (dSaldo !== 0) return dSaldo; return (b.tasa || 0) - (a.tasa || 0); });
    if (msgEl) msgEl.innerHTML = `
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <span style="font-size:20px; flex-shrink:0;">⛄</span>
        <div>
          <div style="font-weight:700; font-size:12px; color:var(--t1); margin-bottom:4px;">Estrategia Bola de Nieve — La más motivadora para el corazón</div>
          <div style="font-size:11px; color:var(--t3); line-height:1.6;">Pagá el <strong style="color:var(--t2);">mínimo en todas</strong> y liquidá primero la deuda <strong style="color:var(--a1);">más pequeña</strong>. Cada victoria te da el empuje para la siguiente. ¡Nada como ver cómo van cayendo!</div>
        </div>
      </div>`;
  }

  const primeraVivaId  = copia.find(d => (d.total - d.pagado) > 0)?.id;
  const iconoTipoMap   = { tarjeta:'💳', credito:'🏦', hipoteca:'🏠', vehiculo:'🚗', educacion:'🎓', persona:'👤', salud:'🏥', otro:'📦' };
  const nombreTipoMap  = { tarjeta:'Tarjeta de Crédito', credito:'Crédito Libre Inversión', hipoteca:'Crédito Hipotecario', vehiculo:'Crédito Vehicular', educacion:'Crédito Educativo', persona:'Préstamo Personal', salud:'Deuda Médica', otro:'Otra Deuda' };
  const consejoMap     = {
    tarjeta:   { texto: `💳 <strong>Truco clave:</strong> Comprá siempre a <strong>1 sola cuota</strong> y pagá el total antes del corte. Nunca saques plata en efectivo con la tarjeta — te cobran intereses desde el primer día, sin período de gracia. La tarjeta es una herramienta, no una extensión del sueldo.`, ley: '' },
    credito:   { texto: `🏦 <strong>Tu derecho colombiano:</strong> Podés pagar más del mínimo sin penalización ni multa. Pedile al banco un <strong>"abono extraordinario a capital con reducción de plazo"</strong>. Así, cada peso extra que metas te acorta la deuda, no solo el tiempo.`, ley: 'Ley 546/1999' },
    hipoteca:  { texto: `🏠 <strong>Ahorrá millones sin hacer nada raro:</strong> En Colombia podés llevar tu crédito hipotecario a otro banco con mejor tasa sin que te cobren penalización. Se llama <strong>"traslado de cartera"</strong> y es tu derecho. Cotizá en otros bancos antes de resignarte a la tasa actual.`, ley: 'Ley 546/1999, Art. 20' },
    vehiculo:  { texto: `🚗 <strong>Salí más rápido de esta:</strong> Hacé abonos extra a capital cuando puedas, aunque sean pequeños. Cada abono te reduce la deuda real, no solo aplaza el calendario. El carro se devalúa con los años, ¡que no le debás más de lo que vale!`, ley: '' },
    educacion: { texto: `🎓 <strong>Buscá los alivios antes de entrar en mora:</strong> El ICETEX tiene períodos de gracia y programas de apoyo para graduados sin empleo. Llamá y preguntá antes de dejar de pagar. La ignorancia aquí sale carísima.`, ley: 'Ley 1002/2005' },
    persona:   { texto: `👤 <strong>Regla de oro con familia y amigos:</strong> Aunque sea de confianza, escribí en un papel cuánto debés, cuánto pagás y cada cuándo. Los dos firman. Un trato claro evita que una deuda dañe una relación que vale más que la plata.`, ley: '' },
    salud:     { texto: `🏥 <strong>Negociá sin pena, que a nadie le sobra la plata:</strong> Las clínicas y hospitales prefieren recibir algo a no recibir nada. Preguntá por descuento de contado o un plan de pagos sin intereses. Son más flexibles de lo que parecen.`, ley: '' },
    otro:      { texto: `📦 <strong>Tres reglas de oro para cualquier deuda:</strong> Nunca la ignorés. Siempre negociá. Pagá primero la de mayor tasa. Y una más: ninguna deuda te define como persona, solo como alguien que está aprendiendo a manejar su plata.`, ley: '' }
  };

  el.innerHTML = copia.map(d => {
    const pend        = Math.max(0, d.total - d.pagado);
    const p           = d.total > 0 ? Math.min((d.pagado / d.total) * 100, 100) : 0;
    const esPrioridad = d.id === primeraVivaId;
    const icono       = iconoTipoMap[d.tipo]  || '📦';
    const nombreTipo  = nombreTipoMap[d.tipo] || 'Otra Deuda';
    const { texto: consejoTexto, ley: consejoLey } = consejoMap[d.tipo] || { texto: '', ley: '' };
    const colorBarra  = p >= 100 ? 'var(--a1)' : p > 50 ? 'var(--a2)' : 'var(--a4)';
    const textoBarra  = p >= 100 ? '🏆 ¡La liquidaste!' : p > 0 ? `${Math.round(p)}% pagado` : '';
    const borderLeft  = esPrioridad ? (modo === 'avalancha' ? 'border-left:4px solid var(--dan);' : 'border-left:4px solid var(--a1);') : 'border-left:4px solid transparent;';
    const badgePrio   = esPrioridad
      ? (modo === 'avalancha'
        ? `<span style="background:rgba(255,68,68,.12); color:var(--dan); border:1px solid rgba(255,68,68,.2); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px;">🔥 ¡A ESTA PRIMERO!</span>`
        : `<span style="background:rgba(0,220,130,.12); color:var(--a1); border:1px solid rgba(0,220,130,.2); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px;">⛄ ¡A ESTA PRIMERO!</span>`)
      : '';

    const mesesRestantes = d.cuota > 0 ? Math.ceil(pend / d.cuota) : 0;
    let tiempoTexto = '';
    if (pend <= 0)               tiempoTexto = `<span style="color:var(--a1); font-weight:700;">🏆 ¡Esta la liquidaste! ¡Qué orgullo!</span>`;
    else if (mesesRestantes === 1) tiempoTexto = `<span style="color:var(--a1); font-weight:700;">🔥 ¡Un cuotazo más y quedás libre de esta! ¡Dale con todo!</span>`;
    else if (mesesRestantes <= 6)  tiempoTexto = `<span style="color:var(--a2);">📅 Cumpliendo tu cuota, en <strong>${mesesRestantes} meses</strong> ya no le debés nada a nadie por aquí.</span>`;
    else {
      const anos = Math.floor(mesesRestantes / 12);
      const meses = mesesRestantes % 12;
      const tiempo = anos > 0 ? `${anos} año${anos > 1 ? 's' : ''}${meses > 0 ? ` y ${meses} mes${meses > 1 ? 'es' : ''}` : ''}` : `${mesesRestantes} meses`;
      tiempoTexto = `<span style="color:var(--t3);">📅 Cumpliendo tu cuota, en <strong style="color:var(--t2);">${tiempo}</strong> quedás libre de esta deuda. ¡Tené paciencia y constancia!</span>`;
    }

    const alertaMora    = _obtenerAlertaMora(d);
    // ⚠️ Boolean() obligatorio: si dejamos `esPrioridad && consejoTexto`, JS
    // devuelve el ÚLTIMO operando truthy (el string del consejo entero), no un
    // booleano. Eso se inyecta más abajo en `aria-expanded="${consejoAbierto}"`
    // y la primera comilla doble del consejo (ej. credito: <strong>"abono…"</strong>)
    // cierra el atributo prematuramente, dejando el resto del HTML del botón
    // como texto visible. Bug visual reportado el 2026-04-26.
    const consejoAbierto = Boolean(esPrioridad && consejoTexto);

    return `
    <article class="deuda-card-animada gc"
      style="background:var(--s1); border:1px solid var(--b1); border-radius:16px; margin-bottom:16px; overflow:hidden; ${borderLeft} animation-delay:${copia.indexOf(d) * 0.08}s;"
      aria-label="Deuda: ${he(d.nombre)}">

      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:20px 20px 16px; border-bottom:1px solid var(--b1); flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <div style="width:44px; height:44px; border-radius:12px; background:var(--s2); border:1px solid var(--b2); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;" aria-hidden="true">${icono}</div>
          <div style="min-width:0;">
            <div style="font-weight:800; font-size:17px; color:var(--t1); line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${he(d.nombre)}</div>
            <div style="font-size:11px; color:var(--t3); margin-top:3px;">${nombreTipo}${d.tasa > 0 ? ` · ${d.tasa}% E.A.` : ''} · ${d.periodicidad}</div>
            <div style="margin-top:6px;">${badgePrio}</div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:10px; font-weight:700; color:var(--t3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Tu cuota</div>
          <div style="font-family:var(--fm); font-size:26px; font-weight:800; color:var(--t1); line-height:1;">${f(d.cuota)}</div>
          ${d.diaPago ? `<div style="font-size:10px; color:var(--t3); margin-top:4px;">📅 Cada mes el día ${d.diaPago}</div>` : ''}
        </div>
      </div>

      <div style="padding:16px 20px; border-bottom:1px solid var(--b1);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:12px;">
          <div>
            <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Lo que te falta</div>
            <div style="font-family:var(--fm); font-size:24px; font-weight:800; color:var(--dan);">${f(pend)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Ya le diste</div>
            <div style="font-family:var(--fm); font-size:24px; font-weight:800; color:${colorBarra};">${f(d.pagado)}</div>
          </div>
        </div>
        <div style="height:10px; background:var(--s3); border-radius:999px; overflow:hidden; margin-bottom:8px;" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100">
          <div style="height:100%; width:${p}%; background:${colorBarra}; border-radius:999px; transition:width .6s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:11px; color:${p > 0 ? colorBarra : 'var(--t3)'}; font-weight:${p > 0 ? '700' : '400'};">${textoBarra || 'Todavía no has abonado a esta'}</span>
          <span style="font-size:11px; color:var(--t3);">Total: ${f(d.total)}</span>
        </div>
        <div style="font-size:12px; line-height:1.5;">${tiempoTexto}</div>
        ${alertaMora}
      </div>

      <div style="padding:14px 20px;">
        ${consejoTexto ? `
        <div style="margin-bottom:12px;">
          <button id="btn-consejo-${d.id}" aria-expanded="${consejoAbierto ? 'true' : 'false'}" aria-controls="consejo-${d.id}"
            data-action="toggleConsejoDeuda" data-arg-id="${d.id}"
            style="background:none; border:none; color:var(--a4); font-size:12px; font-weight:600; cursor:pointer; padding:0; display:flex; align-items:center; gap:6px;">
            <span class="consejo-txt">${consejoAbierto ? '💡 Ocultar consejo' : '💡 Ver consejo'}</span>
          </button>
          <div id="consejo-${d.id}" style="display:${consejoAbierto ? 'block' : 'none'}; margin-top:8px; padding:12px; background:var(--s2); border:1px solid var(--b2); border-left:3px solid var(--a4); border-radius:8px; font-size:12px; color:var(--t2); line-height:1.6;">
            ${consejoTexto}
            ${consejoLey ? `<div style="margin-top:8px;"><span style="display:inline-flex; align-items:center; gap:4px; background:var(--s3); border:1px solid var(--b2); border-radius:6px; padding:3px 8px; font-size:10px; font-weight:700; color:var(--t3); font-family:var(--fm);">⚖️ ${consejoLey}</span></div>` : ''}
          </div>
        </div>` : ''}
        <div class="deu-card-footer">
          <button class="btn bg bsm" data-action="abrirEditarDeuda" data-arg-id="${d.id}" aria-label="Editar ${he(d.nombre)}">✏️ Editar</button>
          <button class="btn-eliminar-deu" data-action="delDeu" data-arg-id="${d.id}" aria-label="Eliminar ${he(d.nombre)}">🗑️ Borrar</button>
          <button class="btn bp btn-pagar-cuota" data-action="abrirPagarCuota" data-arg-id="${d.id}" aria-label="Pagar cuota de ${he(d.nombre)}">Registrar Pago →</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

// ─── TOGGLE CONSEJO DEUDA ────────────────────────────────────────────────────
// Helper UI para expandir/contraer el bloque de "💡 consejo" de cada deuda.
// Antes vivía como un onclick inline gigante en el botón; extraído aquí para
// participar en la delegación data-action (sin duplicación de lógica DOM).
export function toggleConsejoDeuda(id) {
  if (typeof document === 'undefined') return;
  const c   = document.getElementById(`consejo-${id}`);
  const btn = document.getElementById(`btn-consejo-${id}`);
  if (!c || !btn) return;
  const abierto = c.style.display === 'block';
  c.style.display = abierto ? 'none' : 'block';
  btn.setAttribute('aria-expanded', abierto ? 'false' : 'true');
  const txt = btn.querySelector('.consejo-txt');
  if (txt) txt.textContent = abierto ? '💡 Ver consejo' : '💡 Ocultar consejo';
}

// ─── PAGAR CUOTA ─────────────────────────────────────────────────────────────
export function abrirPagarCuota(id) {
  const d = S.deudas.find(x => x.id === id); if (!d) return;
  const pendiente = Math.max(0, d.total - d.pagado);
  const pct       = d.total > 0 ? Math.min(Math.round((d.pagado / d.total) * 100), 100) : 0;
  const nuevoPct  = d.total > 0 ? Math.min(Math.round(((d.pagado + d.cuota) / d.total) * 100), 100) : 0;

  setEl('pgc-no',        d.nombre);
  setEl('pgc-mo',        f(d.cuota));
  setEl('pgc-pagado',    f(d.pagado));
  setEl('pgc-pct',       `${pct}% pagado → ${nuevoPct}% al confirmar este abono`);
  setEl('pgc-pendiente', `Pendiente: ${f(pendiente)}`);
  const barra = document.getElementById('pgc-barra');
  if (barra) barra.style.width = `${pct}%`;
  document.getElementById('pgc-id').value = id;
  window.actualizarListasFondos?.();
  openM('m-pgc');
}

export async function confPagarCuota() {
  const id = +document.getElementById('pgc-id').value;
  const d  = S.deudas.find(x => x.id === id);
  if (!d) { closeM('m-pgc'); return; }

  const fo   = document.getElementById('pgc-fo').value;
  let   disp = fo === 'efectivo' ? S.saldos.efectivo
    : fo.startsWith('cuenta_') ? (S.cuentas.find(x => x.id === +fo.split('_')[1])?.saldo ?? 0)
    : S.saldos.banco;

  if (disp < d.cuota) {
    const ok = await showConfirm(`⚠️ En esa fuente solo hay ${f(disp)} y la cuota es de ${f(d.cuota)}.\n¿La anotamos de todas formas?`, 'Saldo insuficiente');
    if (!ok) return;
  }

  descontarFondo(fo, d.cuota);
  d.pagado = Math.min(d.pagado + d.cuota, d.total);
  // Persistir la fecha del último pago en la deuda misma — sobrevive a
  // cerrarQ() (que vacía S.gastos). Es la fuente principal del detector
  // detectarDeudasDurmiendo. Set-and-forget, sin migración.
  d.fechaUltimoPago = hoy();
  S.gastos.unshift({
    id: Date.now(), desc: `💳 Cuota: ${d.nombre}`, monto: d.cuota, montoTotal: d.cuota,
    cat: 'deudas', tipo: 'necesidad', fondo: fo, hormiga: false, cuatroXMil: false,
    fecha: hoy(), metaId: '', autoFijo: false,
    deudaId: d.id
  });
  closeM('m-pgc'); save(); renderSmart(['deudas', 'gastos']);
}

// ─── EDITAR ──────────────────────────────────────────────────────────────────
export function abrirEditarDeuda(id) {
  const d = S.deudas.find(x => x.id === id); if (!d) return;
  document.getElementById('ed-id').value  = id;
  document.getElementById('ed-no').value  = d.nombre;
  document.getElementById('ed-ti').value  = d.tipo;
  document.getElementById('ed-to').value  = d.total;
  document.getElementById('ed-cu').value  = d.cuota;
  document.getElementById('ed-pe').value  = d.periodicidad;
  document.getElementById('ed-ta').value  = d.tasa;
  document.getElementById('ed-dia').value = d.diaPago || 1;
  openM('m-edit-deu');
}

export async function guardarEditarDeuda() {
  const id         = +document.getElementById('ed-id').value;
  const d          = S.deudas.find(x => x.id === id); if (!d) return;
  const nuevoTotal = +document.getElementById('ed-to').value;
  const nuevaCuota = +document.getElementById('ed-cu').value;
  if (!nuevoTotal || !nuevaCuota) { await showAlert('El saldo que debés y la cuota no pueden quedar en blanco. ¡Completalos!', 'Falta info'); return; }
  d.nombre       = document.getElementById('ed-no').value.trim();
  d.tipo         = document.getElementById('ed-ti').value;
  d.total        = nuevoTotal; d.cuota = nuevaCuota;
  d.periodicidad = document.getElementById('ed-pe').value;
  d.tasa         = +document.getElementById('ed-ta').value || 0;
  d.diaPago      = +document.getElementById('ed-dia').value || 1;
  closeM('m-edit-deu'); save(); renderSmart(['deudas']);
}

export async function delDeu(id) {
  const ok = await showConfirm('¿Borramos esta deuda del registro? Si ya la pagaste completa, ¡felicitaciones! Pero si no, mejor editala.', 'Borrar deuda'); if (!ok) return;
  S.deudas = S.deudas.filter(d => d.id !== id); save(); renderSmart(['deudas']);
}

// ─── SELECCIÓN UI ────────────────────────────────────────────────────────────
function _selTipoDeudaBase(inputId, selectorClass, tipo, el) {
  document.getElementById(inputId).value = tipo;
  document.querySelectorAll(selectorClass).forEach(b => {
    b.style.background = 'var(--s2)'; b.style.border = '2px solid var(--b2)';
    b.querySelector('span:last-child').style.color = 'var(--t3)';
  });
  el.style.background = 'rgba(59,158,255,.1)'; el.style.border = '2px solid var(--a4)';
  el.querySelector('span:last-child').style.color = 'var(--a4)';
}

function _selFrecDeudaBase(inputId, idMensual, idQuincenal, frec) {
  document.getElementById(inputId).value = frec;
  const btnM = document.getElementById(idMensual);
  const btnQ = document.getElementById(idQuincenal);
  if (!btnM || !btnQ) return;
  const activo   = { border: '2px solid var(--a1)', background: 'rgba(0,220,130,.1)', color: 'var(--a1)' };
  const inactivo = { border: '2px solid var(--b2)', background: 'var(--s2)',           color: 'var(--t3)' };
  const esMensual = frec === 'mensual';
  Object.assign(btnM.style, esMensual ? activo : inactivo);
  Object.assign(btnQ.style, esMensual ? inactivo : activo);
}

export function selTipoDeuda(tipo, el)     { _selTipoDeudaBase('dn-ti', '.btn-tipo-deuda',      tipo, el); }
export function selTipoDeudaEdit(tipo, el) { _selTipoDeudaBase('ed-ti', '.btn-tipo-deuda-edit', tipo, el); }
export function selFrecDeuda(frec)         { _selFrecDeudaBase('dn-pe', 'btn-frec-mensual',      'btn-frec-quincenal',      frec); }
export function selFrecDeudaEdit(frec)     { _selFrecDeudaBase('ed-pe', 'btn-edit-frec-mensual', 'btn-edit-frec-quincenal', frec); }

// ─── AVISOS INTELIGENTES ─────────────────────────────────────────────────────
function _renderAvisosDeudas(pct, totD) {
  const avisosEl = document.getElementById('de-avisos'); if (!avisosEl) return;
  const deudasVivas = S.deudas.filter(d => (d.total - d.pagado) > 0);
  const avisos = [];

  const deudasUsura = deudasVivas.filter(d => (d.tasa || 0) > TASA_USURA_EA);
  if (deudasUsura.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,68,68,.03);">
      <span style="font-size:20px; flex-shrink:0;">⚖️</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--dan); margin-bottom:3px;">¡Ojo! Posible cobro ilegal — Tasa de Usura</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong style="color:var(--t2);">${deudasUsura.map(d => d.nombre).join(', ')}</strong> supera el tope legal (${TASA_USURA_EA}% E.A.). En Colombia cobrar por encima de la tasa de usura es un delito, no una cortesía. Consultá con un asesor o la Superintendencia Financiera. <span style="background:var(--s2); border:1px solid var(--b2); border-radius:4px; padding:2px 6px; font-size:10px; font-weight:700; font-family:var(--fm);">⚖️ Art. 305 C.P.</span></div>
      </div>
    </div>`);
  }

  const deudasCaras = deudasVivas.filter(d => (d.tasa || 0) >= 2);
  if (deudasCaras.length >= 2) {
    const totalCaro = deudasCaras.reduce((s, d) => s + (d.total - d.pagado), 0);
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(59,158,255,.03);">
      <span style="font-size:20px; flex-shrink:0;">🏦</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a4); margin-bottom:3px;">Oportunidad: unite a una sola deuda y pagá menos</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Tenés <strong style="color:var(--t2);">${deudasCaras.length} deudas con tasas altas</strong> que suman <strong style="color:var(--t2);">${f(totalCaro)}</strong>. Preguntale a tu banco por una <strong style="color:var(--a4);">compra de cartera</strong>: es unirlas todas en una sola con mejor tasa. ¡Puede ahorrarte mucha plata!</div>
      </div>
    </div>`);
  }

  const deudasEstancadas = deudasVivas.filter(d => {
    if (!d.tasa || d.tasa <= 0 || !d.cuota) return false;
    const tm = Math.pow(1 + d.tasa / 100, 1 / 12) - 1;
    return d.cuota <= (d.total - d.pagado) * tm * 1.1;
  });
  if (deudasEstancadas.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,68,68,.03);">
      <span style="font-size:20px; flex-shrink:0;">🚨</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--dan); margin-bottom:3px;">¡Trampa del mínimo! Tu deuda casi no está bajando</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">En <strong style="color:var(--t2);">${deudasEstancadas.map(d => d.nombre).join(', ')}</strong> tu cuota apenas alcanza a cubrir los intereses del mes. La deuda se estanca. Agregar $20.000–$50.000 extra al pago puede cambiar completamente cuándo te liberás de ella.</div>
      </div>
    </div>`);
  }

  const candidatasRefin = deudasVivas.filter(d => {
    const p = d.total > 0 ? (d.pagado / d.total) * 100 : 0;
    return p >= 50 && (d.tasa || 0) >= 1.5;
  });
  if (candidatasRefin.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(0,220,130,.03);">
      <span style="font-size:20px; flex-shrink:0;">🔄</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a1); margin-bottom:3px;">¡Buen momento para negociar una tasa mejor!</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Ya llevás más del 50% pagado en <strong style="color:var(--t2);">${candidatasRefin.map(d => d.nombre).join(', ')}</strong>. Eso te convierte en buen cliente a ojos del banco. Llamá y pedí que te bajen la tasa. El que no llora, no mama.</div>
      </div>
    </div>`);
  }

  if (pct > 20 && pct <= 40 && S.ingreso > 0) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,214,10,.03);">
      <span style="font-size:20px; flex-shrink:0;">⚠️</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a2); margin-bottom:3px;">Más del 20% de tu ingreso ya va en deudas</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Estás en el <strong style="color:var(--t2);">${pct}%</strong>. No es una catástrofe, pero ojo: no agarrés más compromisos financieros por ahora. Concentrate en liquidar lo que ya tenés.</div>
      </div>
    </div>`);
  }

  if ((S.fondoEmergencia?.actual || 0) === 0 && deudasVivas.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(180,78,255,.03);">
      <span style="font-size:20px; flex-shrink:0;">🛡️</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a5); margin-bottom:3px;">Sin colchoneta de emergencia — eso es riesgo alto</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Antes de abonarte más a las deudas, guardá aunque sea el 5%–10% de tu ingreso en una cuenta aparte que no toques. Si llega un imprevisto y no tenés ese colchón, vas a terminar adquiriendo más deuda. ¡Primero el seguro!</div>
      </div>
    </div>`);
  }

  if (pct > 0 && pct <= 20 && deudasVivas.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(0,220,130,.03);">
      <span style="font-size:20px; flex-shrink:0;">🌟</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a1); margin-bottom:3px;">¡Tus deudas están súper bien manejadas!</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Solo el <strong style="color:var(--a1);">${pct}%</strong> de tu ingreso va en deudas. ¡Eso es salud financiera! Cuando las termines, redirigí esas cuotas al ahorro y verás cómo tu plata empieza a trabajar para vos.</div>
      </div>
    </div>`);
  }

  const tiposFormales = ['tarjeta', 'credito', 'hipoteca', 'vehiculo', 'educacion', 'salud'];
  const hoyMora = new Date(); hoyMora.setHours(0, 0, 0, 0);
  const deudasConMora = deudasVivas
    .filter(d => tiposFormales.includes(d.tipo) && d.diaPago)
    .map(d => {
      const ultima = new Date(hoyMora.getFullYear(), hoyMora.getMonth(), Math.min(d.diaPago, new Date(hoyMora.getFullYear(), hoyMora.getMonth() + 1, 0).getDate()));
      const mesVerif = `${ultima.getFullYear()}-${String(ultima.getMonth() + 1).padStart(2, '0')}`;
      const pagado   = S.gastos.some(g => g.cat === 'deudas' && g.fecha.startsWith(mesVerif) && g.desc.includes(d.nombre));
      if (pagado) return null;
      const diasMora = Math.floor((hoyMora - ultima) / 86_400_000);
      return diasMora > 0 ? { d, diasMora } : null;
    })
    .filter(Boolean);

  const m30 = deudasConMora.filter(x => x.diasMora >= 30 && x.diasMora < 60);
  const m60 = deudasConMora.filter(x => x.diasMora >= 60 && x.diasMora < 90);
  const m90 = deudasConMora.filter(x => x.diasMora >= 90);

  if (m90.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,68,68,.03);">
    <span style="font-size:20px; flex-shrink:0;">🚨</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--dan); margin-bottom:3px;">¡Peligro de reporte en Datacrédito!</div>
    <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong>${m90.map(x => x.d.nombre).join(', ')}</strong> lleva${m90.length > 1 ? 'n' : ''} más de 90 días sin pago. Pero tranquilo: el banco está obligado a avisarte con <strong>20 días de anticipación</strong> antes de reportarte (Ley 1266/2008, Art. 13). Llamá hoy y negociá. ¡Aún estás a tiempo!</div></div>
  </div>`);
  if (m60.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,107,53,.03);">
    <span style="font-size:20px; flex-shrink:0;">📞</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--a3); margin-bottom:3px;">El banco puede estar a punto de llamarte</div>
    <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong>${m60.map(x => x.d.nombre).join(', ')}</strong> lleva${m60.length > 1 ? 'n' : ''} entre 60–90 días sin pago. Llamá vos primero y negociá antes de llegar a los 90 días críticos. El que pide de buenas, consigue de buenas.</div></div>
  </div>`);
  if (m30.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,214,10,.03);">
    <span style="font-size:20px; flex-shrink:0;">⏳</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--a2); margin-bottom:3px;">Retraso detectado — todavía se puede resolver</div>
    <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong>${m30.map(x => x.d.nombre).join(', ')}</strong> lleva${m30.length > 1 ? 'n' : ''} más de 30 días sin pago. Ponete al día pronto para no llegar a los 90 días donde la cosa se complica de verdad.</div></div>
  </div>`);

  avisosEl.innerHTML = avisos.join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DE ACCIONES
// ═══════════════════════════════════════════════════════════════════════════════

// fijos
registerAction('guardarFijo',      () => guardarFijo());
registerAction('renderFijos',      () => renderFijos());
registerAction('abrirModalFijo',   ({ id }) => abrirModalFijo(id != null ? +id : undefined));
registerAction('cerrarModalFijo',  () => cerrarModalFijo());
registerAction('ejecutarPagoFijo', ({ id }) => ejecutarPagoFijo(id));
registerAction('desmFijo',         ({ id }) => desmFijo(id));
registerAction('delFijo',          ({ id }) => delFijo(id));
// agenda
registerAction('renderCal',              () => renderCal());
registerAction('prevMonth',              () => prevMonth());
registerAction('nextMonth',              () => nextMonth());
registerAction('showDayDetails',         ({ day }, el) => showDayDetails(+day, el));
registerAction('guardarPago',            () => guardarPago());
registerAction('marcarPagado',           ({ id }) => marcarPagado(id));
registerAction('ejecutarPagoAgendado',   ({ id }) => ejecutarPagoAgendado(id));
registerAction('delPago',                ({ id }) => delPago(id));
registerAction('renderPagos',            () => renderPagos());
// deudas
registerAction('guardarDeuda',          () => guardarDeuda());
registerAction('renderDeudas',          () => renderDeudas());
registerAction('renderDeudasDurmiendo', () => renderDeudasDurmiendo());
registerAction('renderFijosSinPagar',   () => renderFijosSinPagar());
registerAction('setModoDeuda',       ({ modo }) => setModoDeuda(modo));
registerAction('abrirPagarCuota',    ({ id }) => abrirPagarCuota(id));
registerAction('confPagarCuota',     () => confPagarCuota());
registerAction('abrirEditarDeuda',   ({ id }) => abrirEditarDeuda(id));
registerAction('guardarEditarDeuda', () => guardarEditarDeuda());
registerAction('delDeu',             ({ id }) => delDeu(id));
registerAction('selTipoDeuda',       ({ tipo }, el) => selTipoDeuda(tipo, el));
registerAction('selTipoDeudaEdit',   ({ tipo }, el) => selTipoDeudaEdit(tipo, el));
registerAction('selFrecDeuda',       ({ frec }) => selFrecDeuda(frec));
registerAction('selFrecDeudaEdit',   ({ frec }) => selFrecDeudaEdit(frec));
registerAction('toggleAutoCuota',    () => toggleAutoCuota());
registerAction('calcularCuotaAuto',  () => calcularCuotaAuto());
registerAction('toggleConsejoDeuda', ({ id }) => toggleConsejoDeuda(id));

// ═══════════════════════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL (onclick desde HTML)
// ═══════════════════════════════════════════════════════════════════════════════
// Guard `typeof window` para soportar tests/SSR sin DOM.
if (typeof window !== 'undefined') {
  // fijos — solo los usados en HTML dinámico (desmFijo, delFijo, abrirModalFijo)
  window.renderFijos      = renderFijos;
  window.abrirModalFijo   = abrirModalFijo;
  window.desmFijo         = desmFijo;
  window.delFijo          = delFijo;

  // agenda — solo los usados en HTML dinámico (marcarPagado, delPago, showDayDetails)
  window.renderCal       = renderCal;
  window.showDayDetails  = showDayDetails;
  window.marcarPagado    = marcarPagado;
  window.delPago         = delPago;
  window.renderPagos     = renderPagos;

  // deudas — solo los usados en HTML dinámico (abrirPagarCuota, abrirEditarDeuda, delDeu)
  window.renderDeudas          = renderDeudas;
  window.renderDeudasDurmiendo = renderDeudasDurmiendo;  // updateDash
  window.renderFijosSinPagar   = renderFijosSinPagar;    // updateDash
  window.abrirPagarCuota       = abrirPagarCuota;
  window.abrirEditarDeuda      = abrirEditarDeuda;
  window.delDeu           = delDeu;
}
