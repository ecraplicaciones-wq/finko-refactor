// Fusión de: objetivos.js + inversiones.js
import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import { f, he, hoy, setEl, openM, closeM, showAlert, showConfirm, descontarFondo } from '../infra/utils.js';
import { renderSmart } from '../infra/render.js';

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
        <button class="btn bg bsm" onclick="openRendimiento(${i.id})" data-name="${he(i.nombre).replace(/'/g, '&#39;')}" aria-label="Actualizar valor de ${he(i.nombre)}">📊 Actualizar valor</button>
        <button class="btn-eliminar-deu" onclick="delInversion(${i.id})" style="padding:6px 12px;" aria-label="Eliminar ${he(i.nombre)}">🗑️</button>
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

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.guardarObjetivo         = guardarObjetivo;
window.toggleTipoObjetivo      = toggleTipoObjetivo;
window.openNuevoObjetivo       = openNuevoObjetivo;
window.renderObjetivos         = renderObjetivos;
window.abrirAccionObj          = abrirAccionObj;
window.evaluarGastoEvento      = evaluarGastoEvento;
window.ejecutarAccionObjetivo  = ejecutarAccionObjetivo;
window.delObjetivo             = delObjetivo;
window.calcSimObj              = calcSimObj;
window.populateSelectObjetivos = populateSelectObjetivos;
window.guardarInversion        = guardarInversion;
window.renderInversiones       = renderInversiones;
window.openRendimiento         = openRendimiento;
window.guardarRendimiento      = guardarRendimiento;
window.delInversion            = delInversion;
