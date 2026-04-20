import { S }              from './state.js';
import { save }           from './storage.js';
import { f, he, setEl, setHtml, hoy, mesStr } from './utils.js';
import { CATS, TASA_USURA_EA } from './constants.js';
import { totalCuentas, updSaldo } from './render.js';

// ─── RENDER DE CUENTAS ───────────────────────────────────────────────────────
export function renderDashCuentas() {
  const el = document.getElementById('d-cuentas');
  if (!el) return;
  if (!S.cuentas || !S.cuentas.length) {
    el.innerHTML = '<div class="tm" style="padding:10px 0;">Agrega tus cuentas en la sección Quincena.</div>';
    return;
  }
  const total = totalCuentas();
  let html = S.cuentas.map(c => {
    const pct = total > 0 ? (c.saldo / total * 100).toFixed(1) : 0;
    return `
    <div style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:var(--t2);">
          <span style="font-size:16px;">${c.icono}</span><span>${he(c.nombre)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="mono" style="color:var(--a1); font-weight:600; font-size:13px;">${f(c.saldo)}</span>
          <button class="btn bg bsm" onclick="editSaldoCuentaDash(${c.id})" style="padding:3px 8px; border-radius:6px; font-size:11px;" title="Editar saldo">✏️</button>
          <button class="btn bd bsm" onclick="delCuenta(${c.id})" style="padding:3px 8px; border-radius:6px; font-size:12px; font-weight:bold;" title="Eliminar cuenta">×</button>
        </div>
      </div>
      <div class="pw" style="height:4px; margin-top:0; background:var(--s3); border-radius:4px;">
        <div class="pf" style="width:${pct}%; background:${c.color || 'var(--a1)'}; border-radius:4px;"></div>
      </div>
    </div>`;
  }).join('');
  html += `<div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--b1); padding-top:14px; margin-top:8px;">
    <span style="font-size:11px; font-weight:800; color:var(--t3); text-transform:uppercase; letter-spacing:1px;">Total Cuentas</span>
    <span class="mono" style="font-size:14px; font-weight:700; color:var(--a4);">${f(total)}</span>
  </div>`;
  el.innerHTML = html;
}

// ─── HELPERS INTERNOS ────────────────────────────────────────────────────────
function _getPct() {
  const m   = document.getElementById('q-met')?.value || '50-30-20';
  const MAP = { '50-30-20': { n: 50, d: 30, a: 20 }, '50-20-30': { n: 50, d: 20, a: 30 }, '70-20-10': { n: 70, d: 20, a: 10 } };
  if (MAP[m]) return MAP[m];
  const valN = document.getElementById('pn')?.value;
  const valD = document.getElementById('pd')?.value;
  const valA = document.getElementById('pa')?.value;
  return {
    n: valN === '' || valN == null ? 50 : Number(valN),
    d: valD === '' || valD == null ? 30 : Number(valD),
    a: valA === '' || valA == null ? 20 : Number(valA)
  };
}

function _cuotasPeriodo() {
  const sq = S.deudas.filter(d => d.periodicidad === 'quincenal').reduce((s, d) => s + d.cuota, 0);
  const sm = S.deudas.filter(d => d.periodicidad === 'mensual').reduce((s, d) => s + d.cuota, 0);
  if (S.tipoPeriodo === 'mensual') return (sq * 2) + sm;
  if (S.tipoPeriodo === 'q1')     return sq + sm;
  return sq;
}

function _consolMes() {
  const mes  = mesStr();
  const hist = S.historial.filter(h => h.mes === mes);
  let ing = 0, eg = 0;
  hist.forEach(h => { ing += h.ingreso; eg += h.gastado; });
  const gasAct = S.gastos.filter(g => g.tipo !== 'ahorro').reduce((s, g) => s + (g.montoTotal ?? g.monto), 0);
  return { ing: ing + S.ingreso, eg: eg + gasAct, bal: (ing + S.ingreso) - (eg + gasAct), q: hist.length + (S.ingreso > 0 ? 1 : 0) };
}

// ─── UPDATE DASH ─────────────────────────────────────────────────────────────
export function updateDash() {
  // Una sola pasada
  let tG = 0, tA = 0, tH = 0;
  for (let i = 0; i < S.gastos.length; i++) {
    const g = S.gastos[i];
    const m = g.montoTotal || g.monto;
    if (g.tipo === 'ahorro') tA += m; else tG += m;
    if (g.tipo === 'hormiga' || g.hormiga) tH += m;
  }

  setEl('d-ing', f(S.ingreso));
  setEl('d-gas', f(tG));
  setEl('d-pgc', `${S.ingreso > 0 ? Math.round(tG / S.ingreso * 100) : 0}% del ingreso`);
  setEl('d-aho', f(tA));
  const pctHormiga = S.ingreso > 0 ? Math.min(Math.round(tH / S.ingreso * 100), 100) : 0;
  setEl('d-hor', f(tH));
  setEl('d-phc', `${pctHormiga}% del ingreso`);
  const horBarra = document.getElementById('d-hor-barra');
  if (horBarra) horBarra.style.width = `${pctHormiga}%`;

  updSaldo();

  // Barras de distribución
  if (S.ingreso > 0) {
    const p = _getPct();
    const bar = (l, g, b, col) => {
      const u  = b > 0 ? Math.min(g / b * 100, 100) : 0;
      const ov = g > b;
      return `
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
          <span style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--t2);">${l}</span>
          <div style="text-align:right;">
            <div class="mono" style="font-size:18px; font-weight:800; color:${ov ? 'var(--dan)' : col}; line-height:1;">${f(g)}</div>
            <div class="tm" style="font-size:11px; color:var(--t3); margin-top:4px;">de ${f(b)} presupuestado</div>
          </div>
        </div>
        <div class="pw" style="height:8px; border-radius:8px; background:var(--s3);">
          <div class="pf" style="width:${u}%; background:${ov ? 'var(--dan)' : col}; border-radius:8px; transition:width 0.5s ease;"></div>
        </div>
      </div>`;
    };
    const gN = S.gastos.filter(g => g.tipo === 'necesidad').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
    const gD = S.gastos.filter(g => g.tipo === 'deseo').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
    setHtml('d-bud',
      bar('🏠 Necesidades', gN, S.ingreso * p.n / 100, 'var(--a4)') +
      bar('🎉 Deseos',      gD, S.ingreso * p.d / 100, 'var(--a2)') +
      bar('💰 Ahorro',      tA, S.ingreso * p.a / 100, 'var(--a1)')
    );
  }

  // Flujo mensual
  const cm = _consolMes();
  setEl('m-ing', f(cm.ing));
  setEl('m-eg',  f(cm.eg));
  const balEl = document.getElementById('m-bal');
  if (balEl) { balEl.textContent = f(cm.bal); balEl.style.color = cm.bal >= 0 ? 'var(--a1)' : 'var(--dan)'; }
  setHtml('m-det', `${cm.q} quincena(s) del mes`);

  // Últimos movimientos (máx 3 — tarjetas horizontales, amigables en móvil)
  const filasMovimientos = S.gastos.slice(0, 3).map(g => {
    let cIcono = '🏦', cNom = 'Banco';
    if (g.fondo === 'efectivo') { cIcono = '💵'; cNom = 'Efectivo'; }
    else if (g.fondo?.startsWith('cuenta_')) {
      const c = S.cuentas.find(x => x.id === +g.fondo.split('_')[1]);
      if (c) { cIcono = c.icono; cNom = c.nombre; }
    }
    const colorMonto = g.tipo === 'ahorro' ? 'var(--a1)' : 'var(--a3)';
    const colorPill  = g.tipo === 'necesidad' ? 'pb' : (g.tipo === 'ahorro' ? 'pg' : 'py');
    const signo      = g.tipo === 'ahorro' ? '+' : '-';
    const catLabel   = CATS[g.cat] || '📦 Otro';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--s2);border:1px solid var(--b1);border-radius:10px;margin-bottom:6px;"
         role="listitem">
      <div style="font-size:22px;line-height:1;flex-shrink:0;" aria-hidden="true">${cIcono}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${he(g.desc)}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:3px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
          <span class="mono">${g.fecha}</span>
          <span aria-hidden="true">·</span>
          <span>${catLabel}</span>
          <span class="pill ${colorPill}" style="font-size:9px;padding:1px 5px;">${g.tipo}</span>
        </div>
      </div>
      <div class="mono" style="color:${colorMonto};font-weight:700;font-size:14px;flex-shrink:0;"
           aria-label="${g.tipo === 'ahorro' ? 'Ahorro' : 'Gasto'} de ${f(g.montoTotal || g.monto)}">${signo}${f(g.montoTotal || g.monto)}</div>
    </div>`;
  });
  setHtml('d-rec', S.gastos.length
    ? `<div role="list">${filasMovimientos.join('')}</div>`
    : '<div class="emp"><span class="emp-icon">🕐</span>Sin movimientos registrados</div>'
  );
  // Mostrar "Ver todos" si hay más de 3 movimientos
  const verMasEl = document.getElementById('d-rec-ver-mas');
  if (verMasEl) verMasEl.style.display = S.gastos.length > 3 ? 'block' : 'none';

  // Preview objetivos
  const dMetEl = document.getElementById('d-met');
  if (dMetEl) {
    if (!S.objetivos || !S.objetivos.length) {
      dMetEl.innerHTML = '<div class="emp"><span class="emp-icon">◯</span>Sin objetivos creados</div>';
    } else {
      dMetEl.innerHTML = S.objetivos.slice(0, 3).map(o => {
        const pct = o.objetivoAhorro > 0 ? Math.min((o.ahorrado / o.objetivoAhorro) * 100, 100) : 0;
        const col = pct >= 100 ? 'var(--a1)' : pct > 50 ? 'var(--a2)' : 'var(--a4)';
        return `<div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:600;">${o.icono} ${he(o.nombre)}</span>
            <span style="font-family:var(--fm); font-size:11px; font-weight:700; color:${col};">${Math.round(pct)}%</span>
          </div>
          <div class="pw" style="height:4px;"><div class="pf" style="width:${pct}%; background:${col};"></div></div>
          <div style="display:flex; justify-content:space-between; margin-top:4px;">
            <span class="tm" style="font-size:10px;">${f(o.ahorrado)} ahorrado</span>
            <span class="tm" style="font-size:10px;">Meta: ${f(o.objetivoAhorro)}</span>
          </div>
        </div>`;
      }).join('') + (S.objetivos.length > 3
        ? `<div class="tm" style="text-align:center; margin-top:4px;">+${S.objetivos.length - 3} objetivos más</div>`
        : '');
    }
  }

  // ─── ALERTAS FINANCIERAS ─────────────────────────────────────────────────
  const al  = [];
  const cPer = _cuotasPeriodo();
  const mes  = mesStr();

  // Prima / Bono — junio y diciembre
  const mesActual = new Date().getMonth() + 1;
  if (mesActual === 6 || mesActual === 12) {
    al.push(`<div class="al alg" style="align-items:center; border-width:2px;"><span class=\"al-icon\" style=\"font-size:24px;\" aria-hidden=\"true\">🎉</span><div style="flex:1"><strong>¡Es época de Prima/Bono!</strong> Si recibiste este dinero extra, regístralo aquí para simular su distribución inteligente.</div><button class="btn bp bsm" onclick="openM('m-prima')" style="white-space:nowrap; padding:8px 12px; font-size:12px;">+ Registrar Prima</button></div>`);
  }

  // DIAN — tope declaración de renta
  const anioActual = new Date().getFullYear().toString();
  let ingresosAnio = S.ingreso;
  S.historial.forEach(h => { if (h.periodo && h.periodo.includes(anioActual)) ingresosAnio += h.ingreso; });
  const TOPE_DIAN_VALOR = 73_323_600; // 1.400 UVT × $52.374 (UVT 2026)
  if (ingresosAnio >= TOPE_DIAN_VALOR) {
    al.push(`<div class="al ald"><span class=\"al-icon\" aria-hidden=\"true\">🏛️</span><div><strong>Alerta DIAN (Declaración de Renta):</strong> Tus ingresos este año suman <strong>${f(ingresosAnio)}</strong>. Has superado el tope legal aproximado (${f(TOPE_DIAN_VALOR)}). Contacta a un contador público.</div></div>`);
  } else if (ingresosAnio >= 50_000_000) {
    al.push(`<div class="al alw"><span class=\"al-icon\" aria-hidden=\"true\">🏛️</span><div><strong>Aviso DIAN:</strong> Llevas <strong>${f(ingresosAnio)}</strong> este año. Estás próximo al tope legal para declarar renta (aprox. ${f(TOPE_DIAN_VALOR)}). Ve reuniendo tus soportes.</div></div>`);
  }

  // Saldos en cero con ingreso registrado
  if (S.saldos.efectivo === 0 && S.saldos.banco === 0 && S.ingreso > 0) {
    al.push(`<div class="al alb"><span class=\"al-icon\" aria-hidden=\"true\">💡</span><div>Saldos en $0. Ve a <strong>Quincena</strong> y configura cuánto tienes en efectivo y banco.</div></div>`);
  }

  // Gasto > 90% del ingreso
  if (tG > S.ingreso * 0.9 && S.ingreso > 0) {
    al.push(`<div class="al ald"><span class=\"al-icon\" aria-hidden=\"true\">🚨</span><div>Gastas más del 90% de tu ingreso esta quincena. Revisa tus finanzas urgente.</div></div>`);
  }

  // Gasto hormiga > 15% del ingreso
  if (tH > S.ingreso * 0.15 && S.ingreso > 0) {
    const pctH = Math.round((tH / S.ingreso) * 100);
    al.push(`<div class="al alw"><span class=\"al-icon\" aria-hidden=\"true\">🐜</span><div>Tus gastos hormiga ya representan el <strong>${pctH}%</strong> de tu ingreso (${f(tH)}). ¡Es una fuga de capital muy alta!</div></div>`);
  }

  // Sin ahorro registrado
  if (tA === 0 && S.gastos.length > 3) {
    al.push(`<div class="al alw"><span class=\"al-icon\" aria-hidden=\"true\">💰</span><div>No has registrado ningún ahorro esta quincena. ¡Págate a ti primero!</div></div>`);
  }

  // Cuotas de deuda > 30% del ingreso
  if (cPer > S.ingreso * 0.3 && S.ingreso > 0) {
    al.push(`<div class="al ald"><span class=\"al-icon\" aria-hidden=\"true\">💳</span><div>Las cuotas de tus deudas (${f(cPer)}) superan el 30% de tu ingreso. Estás en zona de riesgo financiero.</div></div>`);
  }

  // Gastos fijos sin pagar este mes
  const fijNP = S.gastosFijos.filter(g => !(g.pagadoEn || []).includes(mes));
  if (fijNP.length) {
    al.push(`<div class="al alb"><span class=\"al-icon\" aria-hidden=\"true\">📌</span><div><strong>${fijNP.length}</strong> gasto(s) fijo(s) sin pagar este mes: ${fijNP.map(g => g.nombre).join(', ')}.</div></div>`);
  }

  setHtml('d-alr', al.join(''));
}

// ─── SCORE DE SALUD FINANCIERA ───────────────────────────────────────────────
export function calcScore() {
  const elScore = document.getElementById('stat-score');
  const elLabel = document.getElementById('stat-score-label');
  const elMsg   = document.getElementById('stat-score-msg');
  if (!elScore || !elMsg || !elLabel) return;

  const tG = S.gastos.filter(g => g.tipo !== 'ahorro').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tA = S.gastos.filter(g => g.tipo === 'ahorro').reduce((s, g) => s + g.monto, 0);
  const tH = S.gastos.filter(g => g.tipo === 'hormiga' || g.hormiga).reduce((s, g) => s + g.monto, 0);

  if (S.ingreso === 0 && S.gastos.length === 0) {
    elScore.textContent = '-'; elLabel.textContent = 'Sin datos'; elMsg.innerHTML = '';
    return;
  }

  // Puntaje ahorro (max 40 pts)
  const ptsAhorro = S.ingreso > 0 ? Math.min(((tA / S.ingreso) / 0.20) * 40, 40) : 0;

  // Puntaje deuda (max 30 pts)
  const cPer     = _cuotasPeriodo();
  const pctDeuda = S.ingreso > 0 ? cPer / S.ingreso : 0;
  const ptsDeuda = pctDeuda <= 0.30 ? 30 : Math.max(0, 30 - ((pctDeuda - 0.30) * 100));

  // Puntaje fondo de emergencia (max 30 pts)
  let ptsFondo = 0;
  if (typeof window.calcularFondoEmergencia === 'function') {
    const statsFondo = window.calcularFondoEmergencia();
    ptsFondo = Math.min(((parseFloat(statsFondo.porcentajeCompletado) || 0) / 100) * 30, 30);
  }

  const totalScore = Math.round(ptsAhorro + ptsDeuda + ptsFondo);
  elScore.textContent = totalScore;

  let colorClass = '', frase = '';
  if (totalScore >= 80)      { colorClass = 'fs-excellent';  frase = 'Excelente — Finanzas muy saludables'; }
  else if (totalScore >= 60) { colorClass = 'fs-acceptable'; frase = 'Buen camino — Hay margen de mejora'; }
  else if (totalScore >= 40) { colorClass = 'fs-bad';        frase = 'Alerta — Revisa tus gastos pronto'; }
  else                       { colorClass = 'fs-very-bad';   frase = 'Riesgo — Necesitas un plan de acción'; }

  elScore.className   = `fin-score ${colorClass}`;
  elLabel.textContent = frase;
  elLabel.style.cssText = 'color:var(--t3); text-transform:none; font-weight:500; font-size:12px;';

  // Checklist
  const ok  = (txt) => `<div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;"><span style="color:var(--a1); font-size:13px;">✅</span><span style="color:var(--a1); font-size:13px;">${txt}</span></div>`;
  const bad = (txt) => `<div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;"><span style="font-size:13px;">❌</span><span style="color:var(--t3); font-size:13px;">${txt}</span></div>`;
  const inf = (icon, txt) => `<div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;"><span style="font-size:13px;">${icon}</span><span style="color:var(--a1); font-size:13px;">${txt}</span></div>`;

  const checklist = [];
  checklist.push(S.ingreso > 0 && tG > S.ingreso * 0.9 ? bad('Gastos exceden el 90%') : ok('Gastos bajo control'));
  checklist.push(tA > 0 ? ok('Ahorro constante') : bad('Sin ahorro registrado'));
  checklist.push(S.ingreso > 0 && tH > S.ingreso * 0.15 ? bad('Fuga hormiga alta') : ok('Hormiga controlada'));
  if (cPer > 0) checklist.push(cPer > S.ingreso * 0.3 ? inf('💳', 'Deudas >30% del ingreso') : ok('Deudas bajo control'));
  if (S.objetivos && S.objetivos.length > 0) checklist.push(inf('🎯', 'Metas de ahorro activas'));

  elMsg.className = 'score-checklist';
  elMsg.innerHTML = checklist.join('');
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.updateDash       = updateDash;
window.calcScore        = calcScore;
window.renderDashCuentas = renderDashCuentas;