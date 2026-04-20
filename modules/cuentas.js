import { S }    from './core/state.js';
import { save } from './core/storage.js';
import { f, he, setEl, openM, closeM, showConfirm, showPrompt } from './utils.js';
import { renderSmart, updSaldo, totalCuentas } from './render.js';
import { BANCOS_CO } from './core/constants.js';

// ─── GUARDAR ─────────────────────────────────────────────────────────────────
export function guardarCuenta() {
  const banco = document.getElementById('cu-banco').value;
  const alias = document.getElementById('cu-alias').value.trim();
  const saldo = +document.getElementById('cu-saldo').value || 0;
  if (!banco) return;

  const info = BANCOS_CO.find(b => b.id === banco) || { id: banco, nombre: alias || banco, icono: '🏦', color: '#888' };
  S.cuentas.push({ id: Date.now(), banco, nombre: alias || info.nombre, icono: info.icono, color: info.color, saldo });

  closeM('m-cuenta');
  save();
  renderAll_cuentas();
}

// ─── ELIMINAR ────────────────────────────────────────────────────────────────
export async function delCuenta(id) {
  const c  = S.cuentas.find(x => x.id === id); if (!c) return;
  const ok = await showConfirm(`⚠️ ¿Eliminar la cuenta "${he(c.nombre)}"?\n\nEsto restará su saldo de tu Total Disponible.`, 'Eliminar Cuenta');
  if (!ok) return;
  S.cuentas    = S.cuentas.filter(x => x.id !== id);
  save();
  renderAll_cuentas();
}

// ─── EDITAR SALDO (pantalla cuentas sidebar) ─────────────────────────────────
export async function editSaldoCuenta(id) {
  const c = S.cuentas.find(x => x.id === id); if (!c) return;
  const val = await showPrompt(`Saldo actual: ${f(c.saldo)}\n\nIngresa el nuevo saldo:`, `Editar ${c.nombre}`, c.saldo);
  if (val === null) return;
  c.saldo        = Math.max(0, +val || 0);
  save();
  renderAll_cuentas();
}

// ─── EDITAR SALDO DESDE DASHBOARD ────────────────────────────────────────────
export async function editSaldoCuentaDash(id) {
  const c = S.cuentas.find(x => x.id === id); if (!c) return;
  const nuevoNombre = await showPrompt(`Nombre actual: "${c.nombre}"\n\nCambia el nombre (o déjalo igual):`, `Editar cuenta`, c.nombre);
  if (nuevoNombre === null) return;
  if (nuevoNombre.trim()) c.nombre = nuevoNombre.trim();
  const val = await showPrompt(`Saldo actual: ${f(c.saldo)}\n\nIngresa el nuevo saldo:`, `Saldo de ${c.nombre}`, c.saldo);
  if (val === null) return;
  c.saldo        = Math.max(0, +val || 0);
  save();
  window.renderDashCuentas?.();
  updSaldo();
  window.updateDash?.();
}

// ─── RENDER SIDEBAR ──────────────────────────────────────────────────────────
export function renderCuentas() {
  const el = document.getElementById('cu-lst'); if (!el) return;
  if (!S.cuentas.length) {
    el.innerHTML = '<div class="tm" style="padding:8px 0">Sin cuentas. Agrega tus bancos o entidades.</div>';
  } else {
    el.innerHTML = S.cuentas.map(c => `
      <div style="display:flex; align-items:center; gap:10px; padding:10px; background:var(--s2); border:1px solid var(--b1); border-radius:var(--r1); margin-bottom:6px;">
        <span style="font-size:18px;">${c.icono}</span>
        <div style="flex:1;">
          <div>${he(c.nombre)}</div>
          <div class="mono" style="color:${c.color || 'var(--a1)'};">${f(c.saldo)}</div>
        </div>
        <button class="btn bg bsm" onclick="editSaldoCuenta(${c.id})" title="Editar">✏️</button>
        <button class="btn bd bsm" onclick="delCuenta(${c.id})">×</button>
      </div>`).join('');
  }
  window.actualizarListasFondos?.();
}

// ─── LISTAS DE FONDOS PARA SELECTS ───────────────────────────────────────────
export function actualizarListasFondos() {
  // Selectores nativos
  const selectores = ['gf-fo', 'oa-fo', 'ag-fo', 'inv-fo', 'prm-fo', 'fe-fo', 'mf-fo'];
  selectores.forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const valorActual = sel.value;
    let opciones = `<option value="efectivo">💵 Efectivo (Disponible: ${f(S.saldos.efectivo)})</option>`;
    if (S.cuentas && S.cuentas.length) {
      opciones += S.cuentas.map(c => `<option value="cuenta_${c.id}">${c.icono} ${he(c.nombre)} (Disponible: ${f(c.saldo)})</option>`).join('');
    } else {
      opciones += `<option value="banco">🏦 Banco (General) (Disponible: ${f(S.saldos.banco)})</option>`;
    }
    if (id === 'inv-fo') opciones = '<option value="">No descontar (solo registrar)</option>' + opciones;
    sel.innerHTML = opciones;
    if (valorActual && sel.querySelector(`option[value="${valorActual}"]`)) sel.value = valorActual;
  });

  // Selectores personalizados (fund-select)
  const fondosDisponibles = () => {
    const lista = [{ value: 'efectivo', icon: '💵', nombre: 'Efectivo', tipo: 'Bolsillo personal', saldo: S.saldos.efectivo }];
    if (S.cuentas && S.cuentas.length) {
      S.cuentas.forEach(c => lista.push({ value: `cuenta_${c.id}`, icon: c.icono, nombre: he(c.nombre), tipo: 'Entidad bancaria', saldo: c.saldo }));
    } else {
      lista.push({ value: 'banco', icon: '🏦', nombre: 'Banco (General)', tipo: 'Fondo predeterminado', saldo: S.saldos.banco });
    }
    return lista;
  };

  ['g-fo', 'eg-fo', 'pgc-fo', 'cp-fo'].forEach(id => {
    const wrap   = document.getElementById(id + '-wrap');
    const hidden = document.getElementById(id);
    if (!wrap || !hidden) return;
    const optsEl = wrap.querySelector('.fund-sel-opts'); if (!optsEl) return;

    const fondos = fondosDisponibles();
    optsEl.innerHTML = fondos.map(fo => `
      <div class="fund-sel-opt" onclick="selFundOpt('${id}','${fo.value}','${fo.icon}','${fo.nombre}',${fo.saldo})">
        <span class="fund-sel-opt-icon">${fo.icon}</span>
        <div class="fund-sel-opt-info">
          <div class="fund-sel-opt-name">${fo.nombre}</div>
          <div class="fund-sel-opt-bal">${f(fo.saldo)}</div>
        </div>
      </div>`).join('');

    const actual  = fondos.find(fo => fo.value === hidden.value) || fondos[0];
    if (!hidden.value) hidden.value = actual.value;
    const trigger = wrap.querySelector('.fund-sel-trigger');
    if (trigger) {
      trigger.querySelector('.fund-sel-icon').textContent = actual.icon;
      trigger.querySelector('.fund-sel-name').textContent = actual.nombre;
      trigger.querySelector('.fund-sel-bal').textContent  = `Disponible: ${f(actual.saldo)}`;
    }
  });
}

export function toggleFundSelect(id) {
  const wrap = document.getElementById(id + '-wrap'); if (!wrap) return;
  document.querySelectorAll('.fund-sel-opts.open').forEach(el => {
    if (el !== wrap.querySelector('.fund-sel-opts')) { el.classList.remove('open'); el.closest('.fund-select')?.querySelector('.fund-sel-trigger')?.classList.remove('open'); el.style.cssText = ''; }
  });
  const trigger = wrap.querySelector('.fund-sel-trigger');
  const opts    = wrap.querySelector('.fund-sel-opts');
  if (!trigger || !opts) return;
  const yaAbierto = opts.classList.contains('open');
  trigger.classList.toggle('open');
  opts.classList.toggle('open');
  if (!yaAbierto && opts.classList.contains('open') && wrap.closest('.modal')) {
    const rect        = trigger.getBoundingClientRect();
    const alturaOpts  = 280;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const abrirArriba  = espacioAbajo < alturaOpts && rect.top > alturaOpts;
    opts.style.position = 'fixed';
    opts.style.left     = rect.left + 'px';
    opts.style.width    = rect.width + 'px';
    opts.style.zIndex   = '600';
    opts.style.top      = abrirArriba ? (rect.top - alturaOpts) + 'px' : rect.bottom + 'px';
  } else if (yaAbierto) { opts.style.cssText = ''; }
}

export function selFundOpt(id, value, icon, nombre, saldo) {
  const wrap   = document.getElementById(id + '-wrap'); if (!wrap) return;
  const hidden = document.getElementById(id); if (hidden) hidden.value = value;
  const trigger = wrap.querySelector('.fund-sel-trigger');
  if (trigger) {
    trigger.querySelector('.fund-sel-icon').textContent = icon;
    trigger.querySelector('.fund-sel-name').textContent = nombre;
    trigger.querySelector('.fund-sel-bal').textContent  = saldo !== null ? `Disponible: ${f(saldo)}` : 'Solo registro';
    trigger.classList.remove('open');
  }
  wrap.querySelector('.fund-sel-opts')?.classList.remove('open');
  wrap.querySelectorAll('.fund-sel-opt').forEach(opt => opt.classList.remove('fso-sel'));
  wrap.querySelectorAll('.fund-sel-check').forEach(el => el.remove());
  const optSel = [...wrap.querySelectorAll('.fund-sel-opt')].find(opt => opt.querySelector('.fund-sel-opt-name')?.textContent === nombre);
  if (optSel) { optSel.classList.add('fso-sel'); optSel.insertAdjacentHTML('beforeend', '<span class="fund-sel-check">✓</span>'); }
}

// ─── HELPER INTERNO ──────────────────────────────────────────────────────────
function renderAll_cuentas() {
  renderCuentas();
  window.renderDashCuentas?.();
  S.saldos.banco = totalCuentas();
  updSaldo();
  window.updateDash?.();
  window.actualizarListasFondos?.();
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.guardarCuenta          = guardarCuenta;
window.delCuenta              = delCuenta;
window.editSaldoCuenta        = editSaldoCuenta;
window.editSaldoCuentaDash    = editSaldoCuentaDash;
window.renderCuentas          = renderCuentas;
window.actualizarListasFondos = actualizarListasFondos;
window.toggleFundSelect       = toggleFundSelect;
window.selFundOpt             = selFundOpt;