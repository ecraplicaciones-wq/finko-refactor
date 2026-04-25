import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import { f, hoy, setEl, setHtml } from '../infra/utils.js';
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
         onclick="go('stat');setTimeout(()=>window.renderLogros?.(),120)"
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

// ─── REGISTRO DE ACCIONES ─────────────────────────────────────────────────────
registerAction('renderStats',          () => renderStats());
registerAction('calcDistribucionReal', () => calcDistribucionReal());
registerAction('evaluarLogros',        () => evaluarLogros());
registerAction('renderLogros',         () => renderLogros());
registerAction('renderRachaWidget',    () => renderRachaWidget());
registerAction('calcularRachas',       () => calcularRachas());

// ─── EXPOSICIÓN GLOBAL ────────────────────────────────────────────────────────
// Guard `typeof window` para soportar tests/SSR sin DOM.
if (typeof window !== 'undefined') {
  window.renderStats           = renderStats;
  window.calcDistribucionReal  = calcDistribucionReal;
  window.evaluarLogros         = evaluarLogros;
  window.renderLogros          = renderLogros;
  window.renderRachaWidget     = renderRachaWidget;
  window.calcularRachas        = calcularRachas;
}
