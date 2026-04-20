import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import { f, he, hoy, mesStr, setEl, openM, closeM, showConfirm, descontarFondo, reintegrarFondo } from '../infra/utils.js';
import { CATS, GMF_TASA } from '../core/constants.js';
import { renderSmart } from '../infra/render.js';

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

  // Colapsar acordeón
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
            ? `<button class="btn bsm" onclick="desmFijo(${g.id})" style="color:var(--t3); background:transparent; border:1px solid var(--b2); font-size:11px; padding:5px 10px; border-radius:6px;" aria-label="Revertir pago de ${he(g.nombre)}">↩ Revertir</button>`
            : `<button class="btn bp bsm" onclick="abrirModalFijo(${g.id})" aria-label="Marcar como pagado ${he(g.nombre)}">✓ Pagar</button>`}
          <button class="btn-eliminar-deu" onclick="delFijo(${g.id})" style="padding:6px 12px;" aria-label="Eliminar ${he(g.nombre)}">🗑️</button>
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

  // Registrar en historial de gastos
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
  const mes       = mesStr();
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
      <button class="btn bg bsm" onclick="go('gast')" style="font-size:11px;">Ver todos los fijos →</button>
    </div>`;
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.guardarFijo     = guardarFijo;
window.renderFijos     = renderFijos;
window.abrirModalFijo  = abrirModalFijo;
window.cerrarModalFijo = cerrarModalFijo;
window.ejecutarPagoFijo = ejecutarPagoFijo;
window.desmFijo        = desmFijo;
window.delFijo         = delFijo;