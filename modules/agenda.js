import { S }    from './state.js';
import { save } from './storage.js';
import { f, he, hoy, mesStr, setEl, setHtml, openM, closeM, showAlert, showConfirm, descontarFondo } from './utils.js';
import { renderSmart } from './render.js';

let _calDate          = null;
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

  const now           = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const todayDate     = now.getDate();
  const calMesStr     = `${year}-${String(month + 1).padStart(2, '0')}`;
  const firstDay      = new Date(year, month, 1).getDay();
  const startOffset   = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth   = new Date(year, month + 1, 0).getDate();

  _currentDaysEvents = {};

  // Pagos agendados
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

  // Gastos fijos pendientes
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

  // Cuotas de deuda pendientes
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
      onclick="showDayDetails(${day}, this)"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showDayDetails(${day},this)}"
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
    element.style.border     = '2px solid transparent';
    element.style.background = 'rgba(0,220,130,.15)';
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
    const nextDate     = new Date(p.fecha + 'T12:00:00');
    const diaOriginal  = nextDate.getDate();
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
  const p   = S.pagosAgendados.find(x => x.id === id); if (!p) return;
  const ok  = await showConfirm(`⚠️ ¿Eliminar el pago "${he(p.desc)}"?`, 'Eliminar Pago');
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
  const prox7  = up.filter(p => { const d = new Date(p.fecha + 'T12:00:00'); d.setHours(0,0,0,0); const dias = Math.ceil((d - now) / 86_400_000); return dias >= 0 && dias <= 7; });
  const vencidos = up.filter(p => { const d = new Date(p.fecha + 'T12:00:00'); d.setHours(0,0,0,0); return d < now; });

  setEl('ag-tot-monto',  f(totalLiquidez));
  setEl('ag-prox7',      f(prox7.reduce((s, p) => s + p.monto, 0)));
  setEl('ag-prox7-count', `${prox7.length} pago${prox7.length !== 1 ? 's' : ''}`);

  const vencMonto    = vencidos.reduce((s, p) => s + p.monto, 0);
  const vencMontoEl  = document.getElementById('ag-vencidos-monto');
  const vencMsg      = document.getElementById('ag-vencidos-msg');
  const vencCount    = document.getElementById('ag-vencidos-count');
  if (vencMontoEl) { vencMontoEl.textContent = f(vencMonto); vencMontoEl.style.color = vencidos.length ? 'var(--dan)' : 'var(--a1)'; }
  if (vencMsg)     { vencMsg.textContent = vencidos.length ? 'requieren atención urgente' : 'sin pagos vencidos ✅'; vencMsg.style.color = vencidos.length ? 'var(--dan)' : 'var(--t3)'; }
  if (vencCount)   { vencCount.textContent = vencidos.length ? `${vencidos.length} pago${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''}` : ''; vencCount.style.color = 'var(--dan)'; }

  // Avisos
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

    // Fin de semana
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
            <button class="btn bp bsm" onclick="marcarPagado(${p.id})" style="padding:8px 16px;" aria-label="Pagar ${he(p.desc)}">✓ Pagar</button>
            <button class="btn-eliminar-deu" onclick="delPago(${p.id})" style="padding:6px 12px;" aria-label="Eliminar ${he(p.desc)}">🗑️</button>
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

  // Preview dashboard
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

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.renderCal              = renderCal;
window.prevMonth              = prevMonth;
window.nextMonth              = nextMonth;
window.showDayDetails         = showDayDetails;
window.guardarPago            = guardarPago;
window.marcarPagado           = marcarPagado;
window.ejecutarPagoAgendado   = ejecutarPagoAgendado;
window.delPago                = delPago;
window.renderPagos            = renderPagos;