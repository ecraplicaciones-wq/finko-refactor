// ─── TESORERÍA ───────────────────────────────────────────────────────────────
// Fusión de: cuentas.js + fondo.js + ahorrado.js
// Dominio: gestión de fondos propios — cuentas bancarias, fondo de emergencia,
//          y bolsillos de ahorro con propósito.

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import {
  f, he, hoy, setEl, setHtml,
  openM, closeM, showAlert, showConfirm, showPrompt,
  descontarFondo
} from '../infra/utils.js';
import { sr }         from '../infra/a11y.js';
import { BANCOS_CO }  from '../core/constants.js';
import { renderSmart, updSaldo, totalCuentas } from '../infra/render.js';
import { registerAction } from '../ui/events.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUENTAS BANCARIAS
// ═══════════════════════════════════════════════════════════════════════════════

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
  _renderAllCuentas();
}

// ─── ELIMINAR ────────────────────────────────────────────────────────────────
export async function delCuenta(id) {
  const c  = S.cuentas.find(x => x.id === id); if (!c) return;
  const ok = await showConfirm(`⚠️ ¿Eliminar la cuenta "${he(c.nombre)}"?\n\nEsto restará su saldo de tu Total Disponible.`, 'Eliminar Cuenta');
  if (!ok) return;
  S.cuentas = S.cuentas.filter(x => x.id !== id);
  save();
  _renderAllCuentas();
}

// ─── EDITAR SALDO (pantalla cuentas sidebar) ─────────────────────────────────
export async function editSaldoCuenta(id) {
  const c = S.cuentas.find(x => x.id === id); if (!c) return;
  const val = await showPrompt(`Saldo actual: ${f(c.saldo)}\n\nIngresa el nuevo saldo:`, `Editar ${c.nombre}`, c.saldo);
  if (val === null) return;
  c.saldo = Math.max(0, +val || 0);
  save();
  _renderAllCuentas();
}

// ─── EDITAR SALDO DESDE DASHBOARD ────────────────────────────────────────────
export async function editSaldoCuentaDash(id) {
  const c = S.cuentas.find(x => x.id === id); if (!c) return;
  const nuevoNombre = await showPrompt(`Nombre actual: "${c.nombre}"\n\nCambia el nombre (o déjalo igual):`, `Editar cuenta`, c.nombre);
  if (nuevoNombre === null) return;
  if (nuevoNombre.trim()) c.nombre = nuevoNombre.trim();
  const val = await showPrompt(`Saldo actual: ${f(c.saldo)}\n\nIngresa el nuevo saldo:`, `Saldo de ${c.nombre}`, c.saldo);
  if (val === null) return;
  c.saldo = Math.max(0, +val || 0);
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
    // Migrado a data-action: el onclick="selFundOpt('…','${fo.nombre}'…)" se
    // rompía si el nombre de la cuenta tenía comilla simple (ej. "Juan's Bank").
    // he() escapa ' → &#39;, pero el parser de HTML decodifica entities ANTES de
    // pasar el string al parser de JS, así que el bug persistía. Los data-arg-*
    // están entre comillas dobles y el browser resuelve el escape correctamente.
    optsEl.innerHTML = fondos.map(fo => `
      <div class="fund-sel-opt" data-action="selFundOpt"
           data-arg-id="${id}"
           data-arg-value="${fo.value}"
           data-arg-icon="${fo.icon}"
           data-arg-nombre="${fo.nombre}"
           data-arg-saldo="${fo.saldo == null ? '' : fo.saldo}">
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

function _renderAllCuentas() {
  renderCuentas();
  window.renderDashCuentas?.();
  S.saldos.banco = totalCuentas();
  updSaldo();
  window.updateDash?.();
  window.actualizarListasFondos?.();
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONDO DE EMERGENCIA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── CÁLCULO BASE ─────────────────────────────────────────────────────────────
export function calcularFondoEmergencia() {
  const gastoFijoMensual = (S.gastosFijos || []).reduce((acc, g) => {
    const monto        = Number(g.monto) || 0;
    const montoMensual = g.periodicidad === 'quincenal' ? monto * 2 : monto;
    return acc + montoMensual;
  }, 0);

  const baseCalculo = gastoFijoMensual > 0
    ? gastoFijoMensual
    : S.ingreso * 0.6;

  const mesesMeta            = S.fondoEmergencia?.objetivoMeses || 6;
  const montoObjetivoTotal   = baseCalculo * mesesMeta;
  const dineroActual         = Number(S.fondoEmergencia?.actual) || 0;
  const faltaPorAhorrar      = Math.max(0, montoObjetivoTotal - dineroActual);
  const porcentajeCompletado = montoObjetivoTotal > 0
    ? Math.min((dineroActual / montoObjetivoTotal) * 100, 100)
    : 0;
  const mesesCubiertos = baseCalculo > 0 ? dineroActual / baseCalculo : 0;

  return {
    gastoMensualFijo:    baseCalculo,
    montoObjetivoTotal,
    actual:              dineroActual,
    faltaPorAhorrar,
    porcentajeCompletado: porcentajeCompletado.toFixed(1),
    mesesCubiertos:       mesesCubiertos.toFixed(1)
  };
}

// ─── RENDER / VISTA ──────────────────────────────────────────────────────────
export function actualizarVistaFondo() {
  const stats   = calcularFondoEmergencia();
  const elMeses = document.getElementById('fe-meses-cobertura');
  const elBarra = document.getElementById('fe-barra-progreso');

  if (elMeses) elMeses.innerHTML = `<strong>${stats.mesesCubiertos}</strong> de ${S.fondoEmergencia?.objetivoMeses || 6} meses cubiertos`;
  if (elBarra) elBarra.style.width = `${stats.porcentajeCompletado}%`;

  setEl('fe-dinero-actual',   f(stats.actual));
  setEl('fe-dinero-objetivo', f(stats.faltaPorAhorrar));
}

// ─── ABONO AL FONDO ──────────────────────────────────────────────────────────
export async function registrarAbonoFondo() {
  const inputAbono  = document.getElementById('fe-monto-abono');
  const monto       = +(inputAbono?.value || 0);
  const fondoOrigen = document.getElementById('fe-fo')?.value;

  if (monto <= 0) { await showAlert('Ingresa un monto válido.', 'Inválido'); return; }

  if (fondoOrigen) descontarFondo(fondoOrigen, monto);

  S.gastos.unshift({
    id:          Date.now(),
    desc:        '🛡️ Abono Fondo Emergencia',
    monto,
    montoTotal:  monto,
    cat:         'ahorro',
    tipo:        'ahorro',
    fondo:       fondoOrigen || 'banco',
    hormiga:     false,
    cuatroXMil:  false,
    fecha:       hoy(),
    metaId:      '',
    autoFijo:    false
  });

  if (!S.fondoEmergencia) S.fondoEmergencia = { objetivoMeses: 6, actual: 0 };
  S.fondoEmergencia.actual += monto;

  if (inputAbono) inputAbono.value = '';
  closeM('m-fondo-emergencia');
  save();
  actualizarVistaFondo();
  renderSmart(['gastos', 'stats']);
  await showAlert('¡Dinero blindado con éxito en tu Fondo de Emergencia! 🛡️', 'Fondo Actualizado');
}

// ─── ABRIR MODAL ─────────────────────────────────────────────────────────────
export function abrirFondoEmergencia() {
  window.actualizarListasFondos?.();
  openM('m-fondo-emergencia');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOLSILLOS DE AHORRO
// ═══════════════════════════════════════════════════════════════════════════════

const ICONOS_BOLS = [
  '🏠','✈️','🚗','📱','🎓','👶','💊','🛒','🎉','🐾',
  '💻','👗','🍔','⛽','💈','🏋️','🎮','📦','🛡️','🌱',
  '🎁','📚','🔧','🏥','🎵','🐶','🚌','🍕','👟','🌎'
];

function _initBolsillos() {
  if (!Array.isArray(S.bolsillos)) S.bolsillos = [];
}

// ─── CÁLCULOS BASE ────────────────────────────────────────────────────────────

export function totalBolsillos() {
  _initBolsillos();
  return S.bolsillos.reduce((s, b) => s + (Number(b.monto) || 0), 0);
}

export function platoLibre() {
  const saldoReal = (S.saldos?.efectivo || 0) + (S.saldos?.banco || 0);
  return Math.max(0, saldoReal - totalBolsillos());
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
export function renderBolsillos() {
  _initBolsillos();

  const total     = totalBolsillos();
  const libre     = platoLibre();
  const saldoReal = (S.saldos?.efectivo || 0) + (S.saldos?.banco || 0);

  setEl('bols-total-ap',  f(total));
  setEl('bols-libre-txt', f(libre));
  setEl('bols-count-txt', `${S.bolsillos.length} bolsillo${S.bolsillos.length !== 1 ? 's' : ''} activo${S.bolsillos.length !== 1 ? 's' : ''}`);

  setEl('d-bols-ap', f(total));
  setEl('d-libre',   f(libre));
  const dBolsBarra = document.getElementById('d-bols-barra');
  if (dBolsBarra) {
    const pctAp = saldoReal > 0 ? Math.min((total / saldoReal) * 100, 100) : 0;
    dBolsBarra.style.width = `${pctAp.toFixed(1)}%`;
  }

  const cont = document.getElementById('bols-lista');
  if (!cont) return;

  if (!S.bolsillos.length) {
    cont.innerHTML = `
      <div class="emp" style="padding:40px 16px; text-align:center;">
        <div style="font-size:56px; margin-bottom:14px; animation:none;">🪙</div>
        <div style="font-size:16px; font-weight:700; color:var(--t1); margin-bottom:10px;">
          Aún no tienes ningún bolsillo
        </div>
        <p class="tm" style="line-height:1.75; max-width:290px; margin:0 auto 22px;">
          Un bolsillo es plata que ya sabes para qué es: el arriendo, el viaje de diciembre,
          la cuota del carro, la fiesta de grado de tu peladito... Así no la tocas por accidente. 👀
        </p>
        <button class="btn bp bfw"
                onclick="abrirNuevoBolsillo()"
                aria-label="Crear mi primer bolsillo de ahorro con propósito">
          🪙 Crear mi primer bolsillo
        </button>
      </div>`;
    return;
  }

  const pctApartado = saldoReal > 0 ? Math.min((total / saldoReal) * 100, 100) : 0;
  const pctLibre    = Math.max(0, 100 - pctApartado);

  let html = `
    <div role="region" aria-label="Distribución de tu plata"
         style="background:var(--s2); border-radius:14px; padding:16px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:11px; font-weight:700; color:var(--t3); text-transform:uppercase; letter-spacing:.8px;">
          Así está repartida tu plata
        </span>
        <span style="font-size:11px; color:var(--t3);">
          Saldo real: <strong>${f(saldoReal)}</strong>
        </span>
      </div>
      <div style="height:16px; border-radius:999px; background:var(--s3); overflow:hidden; display:flex; gap:2px;"
           role="img" aria-label="${pctApartado.toFixed(0)}% apartado, ${pctLibre.toFixed(0)}% libre">
        <div style="width:${pctApartado.toFixed(1)}%; background:var(--a2); border-radius:999px 0 0 999px;
                    transition:width .6s cubic-bezier(.4,0,.2,1);" title="Apartado en bolsillos"></div>
        <div style="width:${pctLibre.toFixed(1)}%; background:var(--a1); border-radius:0 999px 999px 0;
                    transition:width .6s cubic-bezier(.4,0,.2,1);" title="Libre para gastar"></div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:10px; flex-wrap:wrap; gap:6px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:10px; height:10px; border-radius:50%; background:var(--a2); flex-shrink:0;"></div>
          <span style="font-size:12px; color:var(--t2);">
            🪙 Apartado: <strong style="color:var(--a2);">${f(total)}</strong>
            <span style="color:var(--t3);"> (${pctApartado.toFixed(0)}%)</span>
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:10px; height:10px; border-radius:50%; background:var(--a1); flex-shrink:0;"></div>
          <span style="font-size:12px; color:var(--t2);">
            ✅ Libre: <strong style="color:var(--a1);">${f(libre)}</strong>
            <span style="color:var(--t3);"> (${pctLibre.toFixed(0)}%)</span>
          </span>
        </div>
      </div>
    </div>`;

  html += S.bolsillos.map(b => {
    const banco    = BANCOS_CO.find(x => x.id === b.banco) || { icono: '🏦', nombre: 'Otro banco', color: '#888888' };
    const color    = b.color || banco.color || 'var(--a2)';
    const pctReal  = saldoReal > 0 ? Math.min((b.monto / saldoReal) * 100, 100).toFixed(1) : '0.0';
    const pctDeBols = total > 0 ? Math.min((b.monto / total) * 100, 100).toFixed(0) : '0';
    const ultimaMov = b.movimientos?.length ? b.movimientos[0] : null;

    return `
    <article class="card mb"
             style="border-left:4px solid ${color}; padding:16px 16px 12px;"
             aria-label="Bolsillo ${he(b.nombre)}: ${f(b.monto)} guardados en ${banco.nombre}">

      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <div style="font-size:32px; line-height:1; flex-shrink:0;"
               role="img" aria-label="Ícono del bolsillo">${b.icono || '🪙'}</div>
          <div style="min-width:0;">
            <div style="font-size:15px; font-weight:700; color:var(--t1);
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${he(b.nombre)}
            </div>
            <div style="font-size:11px; color:var(--t3); margin-top:4px;
                        display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="background:${color}22; color:${color}; padding:2px 7px; border-radius:6px;
                           font-weight:600; font-size:10px;">
                ${banco.icono} ${banco.nombre}
              </span>
              ${b.descripcion
                ? `<span style="color:var(--t3);">${he(b.descripcion)}</span>`
                : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div class="mono"
               style="font-size:22px; font-weight:800; color:${color}; line-height:1;"
               aria-label="${f(b.monto)} en este bolsillo">${f(b.monto)}</div>
          <div style="font-size:10px; color:var(--t3); margin-top:4px;">
            ${pctReal}% de tu saldo · ${pctDeBols}% de lo apartado
          </div>
        </div>
      </div>

      <div class="pw" style="height:6px; border-radius:999px; margin-bottom:12px;"
           role="progressbar" aria-valuenow="${pctReal}" aria-valuemin="0" aria-valuemax="100"
           aria-label="${pctReal}% de tu saldo total">
        <div class="pf" style="width:${pctReal}%; background:${color}; border-radius:999px;
                                transition:width .5s ease;"></div>
      </div>

      ${ultimaMov ? `
      <div style="font-size:10px; color:var(--t3); margin-bottom:12px; padding:6px 10px;
                  background:var(--s2); border-radius:6px;">
        Último movimiento: ${ultimaMov.tipo === 'abono' ? '➕' : ultimaMov.tipo === 'retiro' ? '➖' : '🌱'}
        <strong>${f(ultimaMov.monto)}</strong> el ${ultimaMov.fecha}
        ${ultimaMov.nota ? `· "${he(ultimaMov.nota)}"` : ''}
      </div>` : ''}

      <div style="display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn bg bsm"
                onclick="abrirAbonarBolsillo(${b.id})"
                aria-label="Agregar plata al bolsillo ${he(b.nombre)}">
          ➕ Abonar
        </button>
        <button class="btn bbl bsm"
                onclick="abrirRetirarBolsillo(${b.id})"
                aria-label="Sacar plata del bolsillo ${he(b.nombre)}">
          ➖ Retirar
        </button>
        <button class="btn bd bsm"
                onclick="eliminarBolsillo(${b.id})"
                aria-label="Eliminar el bolsillo ${he(b.nombre)} y liberar los ${f(b.monto)}">
          🗑️
        </button>
      </div>
    </article>`;
  }).join('');

  cont.innerHTML = html;
}

// ─── ABRIR MODAL: NUEVO BOLSILLO ─────────────────────────────────────────────
export function abrirNuevoBolsillo() {
  ['bols-nombre', 'bols-monto-ini', 'bols-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const iconVal = document.getElementById('bols-icono-val');
  if (iconVal) iconVal.value = '🪙';
  renderIconosBolsillo();
  _poblarSelectBancos('bols-banco');
  openM('m-nuevo-bolsillo');
  sr('Modal: Crear nuevo bolsillo');
}

// ─── GUARDAR NUEVO BOLSILLO ───────────────────────────────────────────────────
export async function guardarNuevoBolsillo() {
  _initBolsillos();

  const nombre = document.getElementById('bols-nombre')?.value.trim();
  const monto  = +(document.getElementById('bols-monto-ini')?.value || 0);
  const banco  = document.getElementById('bols-banco')?.value || 'otro';
  const icono  = document.getElementById('bols-icono-val')?.value || '🪙';
  const desc   = document.getElementById('bols-desc')?.value.trim() || '';

  if (!nombre) {
    await showAlert(
      'Dale un nombre al bolsillo — ¿para qué es esa plata? Ej: "Arriendo julio", "Viaje diciembre".',
      '¡Falta el nombre! ✋'
    );
    document.getElementById('bols-nombre')?.focus();
    return;
  }

  const bancoInfo = BANCOS_CO.find(x => x.id === banco) || { color: '#888888' };

  const bolsillo = {
    id:          Date.now(),
    nombre,
    monto,
    banco,
    icono,
    color:       bancoInfo.color,
    descripcion: desc,
    fechaCreado: hoy(),
    movimientos: monto > 0
      ? [{ tipo: 'saldo_inicial', monto, fecha: hoy(), banco, nota: 'Saldo al crear' }]
      : []
  };

  S.bolsillos.push(bolsillo);
  save();
  closeM('m-nuevo-bolsillo');
  renderBolsillos();
  if (typeof window.updateDash === 'function') window.updateDash();
  sr(`Bolsillo "${nombre}" creado. Tiene ${f(monto)} apartados.`);

  const mensaje = monto > 0
    ? `¡Bolsillo creado! 🎉\n\nYa tienes ${f(monto)} apartados para "${nombre}". Esa plata sigue en tu cuenta, pero ahora sabés que ya tiene dueño. 💪`
    : `¡Bolsillo "${nombre}" listo! 🪙\n\nCuando consigas la plata, usa el botón ➕ Abonar para irlo llenando poco a poco.`;

  await showAlert(mensaje, 'Bolsillo creado 🪙');
}

// ─── ABRIR MODAL: ABONAR ─────────────────────────────────────────────────────
export function abrirAbonarBolsillo(id) {
  _initBolsillos();
  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;
  _prepModalMov(id, 'abono', `Guardar plata en "${b.nombre}"`, b);
  openM('m-bolsillo-mov');
  sr(`Modal: abonar al bolsillo ${b.nombre}`);
}

// ─── ABRIR MODAL: RETIRAR ─────────────────────────────────────────────────────
export function abrirRetirarBolsillo(id) {
  _initBolsillos();
  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;
  _prepModalMov(id, 'retiro', `Sacar plata de "${b.nombre}"`, b);
  openM('m-bolsillo-mov');
  sr(`Modal: retirar del bolsillo ${b.nombre}`);
}

function _prepModalMov(id, tipo, titulo, b) {
  setEl('bols-mov-titulo', titulo);
  const fields = { 'bols-mov-id': id, 'bols-mov-tipo': tipo, 'bols-mov-monto': '', 'bols-mov-nota': '' };
  Object.entries(fields).forEach(([elId, val]) => {
    const el = document.getElementById(elId);
    if (el) el.value = val;
  });
  _poblarSelectBancos('bols-mov-banco');
  setHtml('bols-mov-ctx', b ? `
    <div style="background:var(--s2); border-radius:8px; padding:10px 12px; margin-bottom:14px;
                display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
      <span style="font-size:12px; color:var(--t3);">${b.icono} En este bolsillo ahora</span>
      <strong class="mono" style="font-size:16px; color:var(--a1);">${f(b.monto)}</strong>
    </div>` : '');
}

// ─── CONFIRMAR MOVIMIENTO (abono o retiro) ────────────────────────────────────
export async function confirmarMovBolsillo() {
  _initBolsillos();

  const id    = +document.getElementById('bols-mov-id')?.value;
  const tipo  = document.getElementById('bols-mov-tipo')?.value;
  const monto = +(document.getElementById('bols-mov-monto')?.value || 0);
  const banco = document.getElementById('bols-mov-banco')?.value || 'otro';
  const nota  = document.getElementById('bols-mov-nota')?.value.trim() || '';

  if (!monto || monto <= 0) {
    await showAlert('Escribe cuánta plata vas a mover — tiene que ser mayor a cero. 🙏', '¡Falta el monto!');
    document.getElementById('bols-mov-monto')?.focus();
    return;
  }

  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;

  if (tipo === 'abono') {
    b.monto += monto;
    b.movimientos = b.movimientos || [];
    b.movimientos.unshift({ tipo: 'abono', monto, fecha: hoy(), banco, nota });
    closeM('m-bolsillo-mov');
    save();
    renderBolsillos();
    if (typeof window.updateDash === 'function') window.updateDash();
    sr(`Abonaste ${f(monto)} al bolsillo ${b.nombre}. Total: ${f(b.monto)}`);
    await showAlert(
      `¡${f(monto)} guardados en el bolsillo "${b.nombre}"! 💪\n\nAhora tienes ${f(b.monto)} ahí apartados.`,
      'Abono exitoso ✅'
    );
  } else {
    if (monto > b.monto) {
      await showAlert(
        `En el bolsillo "${b.nombre}" solo hay ${f(b.monto)}. No puedes retirar ${f(monto)}.\n\nBaja el monto o retira todo.`,
        'No alcanza 😅'
      );
      return;
    }
    b.monto = Math.max(0, b.monto - monto);
    b.movimientos = b.movimientos || [];
    b.movimientos.unshift({ tipo: 'retiro', monto, fecha: hoy(), banco, nota });
    closeM('m-bolsillo-mov');
    save();
    renderBolsillos();
    if (typeof window.updateDash === 'function') window.updateDash();
    sr(`Retiraste ${f(monto)} del bolsillo ${b.nombre}. Quedó en ${f(b.monto)}`);
    await showAlert(
      `Retiraste ${f(monto)} del bolsillo "${b.nombre}".\n\nEl bolsillo quedó en ${f(b.monto)}. La plata ya está "libre" para gastar. 👌`,
      'Retiro listo ✅'
    );
  }
}

// ─── ELIMINAR BOLSILLO ────────────────────────────────────────────────────────
export async function eliminarBolsillo(id) {
  _initBolsillos();
  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;

  const ok = await showConfirm(
    `¿Eliminar el bolsillo "${b.nombre}"?\n\nLos ${f(b.monto)} que tenías ahí quedan "libres" en tu saldo — no desaparecen, solo dejan de estar apartados.`,
    '¿Borrar este bolsillo? 🗑️'
  );
  if (!ok) return;

  S.bolsillos = S.bolsillos.filter(x => x.id !== id);
  save();
  renderBolsillos();
  if (typeof window.updateDash === 'function') window.updateDash();
  sr(`Bolsillo "${b.nombre}" eliminado.`);
}

// ─── RENDER GRID DE ÍCONOS ────────────────────────────────────────────────────
export function renderIconosBolsillo() {
  const cont = document.getElementById('bols-iconos-grid');
  if (!cont) return;
  const actual = document.getElementById('bols-icono-val')?.value || '🪙';
  cont.innerHTML = ICONOS_BOLS.map(ic => {
    const sel = ic === actual;
    return `
      <button type="button"
              class="bols-icono-btn${sel ? ' sel' : ''}"
              onclick="selIconoBolsillo('${ic}', this)"
              aria-label="Usar ícono ${ic}" aria-pressed="${sel}"
              style="font-size:22px; padding:7px; border-radius:9px; line-height:1;
                     border:2px solid ${sel ? 'var(--a1)' : 'transparent'};
                     background:${sel ? 'rgba(0,220,130,.12)' : 'var(--s2)'};
                     cursor:pointer; transition:all .15s; min-width:40px;">
        ${ic}
      </button>`;
  }).join('');
}

export function selIconoBolsillo(icono, btn) {
  const val = document.getElementById('bols-icono-val');
  if (val) val.value = icono;
  document.querySelectorAll('.bols-icono-btn').forEach(b => {
    b.classList.remove('sel');
    b.style.borderColor  = 'transparent';
    b.style.background   = 'var(--s2)';
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('sel');
  btn.style.borderColor = 'var(--a1)';
  btn.style.background  = 'rgba(0,220,130,.12)';
  btn.setAttribute('aria-pressed', 'true');
}

function _poblarSelectBancos(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = [
    `<option value="efectivo">💵 Efectivo en mano</option>`,
    ...BANCOS_CO.map(b => `<option value="${b.id}">${b.icono} ${b.nombre}</option>`)
  ].join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DE ACCIONES
// ═══════════════════════════════════════════════════════════════════════════════

// cuentas
registerAction('guardarCuenta',          () => guardarCuenta());
registerAction('delCuenta',              ({ id }) => delCuenta(id));
registerAction('editSaldoCuenta',        ({ id }) => editSaldoCuenta(id));
registerAction('editSaldoCuentaDash',    ({ id }) => editSaldoCuentaDash(id));
registerAction('renderCuentas',          () => renderCuentas());
registerAction('actualizarListasFondos', () => actualizarListasFondos());
registerAction('toggleFundSelect',       ({ id }) => toggleFundSelect(id));
registerAction('selFundOpt',             ({ id, value, icon, nombre, saldo }) =>
  selFundOpt(id, value, icon, nombre, saldo === '' || saldo == null ? null : Number(saldo))
);
// fondo de emergencia
registerAction('calcularFondoEmergencia', () => calcularFondoEmergencia());
registerAction('actualizarVistaFondo',    () => actualizarVistaFondo());
registerAction('registrarAbonoFondo',     () => registrarAbonoFondo());
registerAction('abrirFondoEmergencia',    () => abrirFondoEmergencia());
// bolsillos
registerAction('totalBolsillos',       () => totalBolsillos());
registerAction('platoLibre',           () => platoLibre());
registerAction('renderBolsillos',      () => renderBolsillos());
registerAction('abrirNuevoBolsillo',   () => abrirNuevoBolsillo());
registerAction('guardarNuevoBolsillo', () => guardarNuevoBolsillo());
registerAction('abrirAbonarBolsillo',  ({ id }) => abrirAbonarBolsillo(id));
registerAction('abrirRetirarBolsillo', ({ id }) => abrirRetirarBolsillo(id));
registerAction('confirmarMovBolsillo', () => confirmarMovBolsillo());
registerAction('eliminarBolsillo',     ({ id }) => eliminarBolsillo(id));
registerAction('renderIconosBolsillo', () => renderIconosBolsillo());
registerAction('selIconoBolsillo',     ({ icon }) => selIconoBolsillo(icon));

// ═══════════════════════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL (onclick desde HTML)
// ═══════════════════════════════════════════════════════════════════════════════

// cuentas — guardarCuenta → data-action; del*/edit* en HTML dinámico
window.delCuenta              = delCuenta;
window.editSaldoCuenta        = editSaldoCuenta;
window.editSaldoCuentaDash    = editSaldoCuentaDash;
window.renderCuentas          = renderCuentas;
window.actualizarListasFondos = actualizarListasFondos;
window.toggleFundSelect       = toggleFundSelect;
window.selFundOpt             = selFundOpt;

// fondo de emergencia — registrarAbonoFondo → data-action; resto desde JS
window.calcularFondoEmergencia = calcularFondoEmergencia;
window.actualizarVistaFondo    = actualizarVistaFondo;
window.abrirFondoEmergencia    = abrirFondoEmergencia;

// bolsillos — guardarNuevoBolsillo/confirmarMovBolsillo → data-action
// abrirNuevoBolsillo → data-action; abrir*/eliminar* desde JS/dinámico
window.totalBolsillos       = totalBolsillos;
window.platoLibre           = platoLibre;
window.renderBolsillos      = renderBolsillos;
window.abrirAbonarBolsillo  = abrirAbonarBolsillo;
window.abrirRetirarBolsillo = abrirRetirarBolsillo;
window.eliminarBolsillo     = eliminarBolsillo;
window.renderIconosBolsillo = renderIconosBolsillo;
window.selIconoBolsillo     = selIconoBolsillo;
