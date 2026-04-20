import { S }    from '../core/state.js';
import { f, setEl, setHtml } from '../infra/utils.js';
import { CATS, CCOLORS } from '../core/constants.js';

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

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.renderStats           = renderStats;
window.calcDistribucionReal  = calcDistribucionReal;