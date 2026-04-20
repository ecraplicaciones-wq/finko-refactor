import { S }    from './core/state.js';
import { save } from './core/storage.js';
import { f, he, hoy, setEl, openM, closeM, showAlert, showConfirm, descontarFondo } from './infra/utils.js';
import { renderSmart } from './infra/render.js';

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
        <button class="btn bd bsm" onclick="delObjetivo(${o.id})">×</button>
      </div>`;

    html += `
      <div class="pcard-meta" style="margin-bottom:${o.tipo === 'evento' ? '12px' : '0'}">
        <div class="pcard-section-title">
          <span style="color:var(--a4)">💰 FASE DE AHORRO</span>
          <button class="btn bbl bsm" onclick="abrirAccionObj(${o.id},'abonar')">+ Abonar</button>
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
            <button class="btn bp bsm" onclick="abrirAccionObj(${o.id},'gastar')">+ Gastar</button>
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
  if (aporte <= 0 || falta <= 0) { resEl.innerHTML = ''; return; }

  const periodos  = Math.ceil(falta / aporte);
  const diasTotal = periodos * diasPer;
  const nombres   = { 30: 'mes', 15: 'quincena', 7: 'semana', 1: 'día' };
  const frecNom   = nombres[diasPer] || 'período';

  let tiempoStr = '';
  if (diasTotal < 30)       tiempoStr = `${diasTotal} días`;
  else if (diasTotal < 365) { const m = Math.ceil(diasTotal / 30); tiempoStr = `${m} mes${m !== 1 ? 'es' : ''}`; }
  else { const a = Math.floor(diasTotal / 365); const mr = Math.floor((diasTotal % 365) / 30); tiempoStr = `${a} año${a !== 1 ? 's' : ''}${mr > 0 ? ` y ${mr} mes${mr !== 1 ? 'es' : ''}` : ''}`; }

  resEl.innerHTML = `
    <div style="background:rgba(157,115,235,.1); border:1px solid rgba(157,115,235,.2); border-radius:8px; padding:10px; text-align:center; margin-top:8px;">
      <div style="font-size:11px; color:var(--t2); margin-bottom:3px;">Ahorrando <strong>${f(aporte)}</strong> por ${frecNom} llegarás en:</div>
      <div style="font-family:var(--fm); font-size:20px; font-weight:800; color:var(--a5);">${tiempoStr}</div>
      <div style="font-size:10px; color:var(--t3); margin-top:3px;">${periodos} ${frecNom}${periodos !== 1 ? 's' : ''}</div>
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

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.guardarObjetivo        = guardarObjetivo;
window.toggleTipoObjetivo     = toggleTipoObjetivo;
window.openNuevoObjetivo      = openNuevoObjetivo;
window.renderObjetivos        = renderObjetivos;
window.abrirAccionObj         = abrirAccionObj;
window.evaluarGastoEvento     = evaluarGastoEvento;
window.ejecutarAccionObjetivo = ejecutarAccionObjetivo;
window.delObjetivo            = delObjetivo;
window.calcSimObj             = calcSimObj;
window.populateSelectObjetivos = populateSelectObjetivos;