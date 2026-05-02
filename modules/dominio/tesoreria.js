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
import { registerAction } from '../ui/actions.js';

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
        <button class="btn bg bsm" data-action="editSaldoCuenta" data-arg-id="${c.id}" title="Editar">✏️</button>
        <button class="btn bd bsm" data-action="delCuenta" data-arg-id="${c.id}">×</button>
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

// ─── TANDA 22: PROYECCIÓN DE FONDO DE EMERGENCIA ────────────────────────────
/**
 * Proyecta cuántos meses faltan para completar el fondo de emergencia
 * al ritmo de ahorro mensual estimado.
 * Función pura: no lee S, no toca DOM.
 *
 * @param {{
 *   faltaPorAhorrar:        number,   // monto que aún falta (de calcularFondoEmergencia)
 *   ahorroMensualEstimado:  number,   // ahorro promedio mensual del usuario
 *   hoyISO:                 string,   // 'YYYY-MM-DD' para proyectar fecha
 * }} params
 * @returns {{
 *   yaCompletado:       boolean,
 *   mesesFaltantes:     number | null,   // null si ahorroMensual = 0
 *   fechaEstimada:      string | null,   // 'YYYY-MM' cuando se alcanza la meta
 *   ahorroMensualUsado: number,
 * } | null}  null si inputs inválidos
 */
export function calcularProyeccionFondo({ faltaPorAhorrar, ahorroMensualEstimado, hoyISO } = {}) {
  const falta   = Number(faltaPorAhorrar)       || 0;
  const ahorro  = Number(ahorroMensualEstimado) || 0;
  const mHoy    = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof hoyISO === 'string' ? hoyISO : '');

  if (!mHoy) return null;

  if (falta <= 0) {
    return { yaCompletado: true, mesesFaltantes: 0, fechaEstimada: null, ahorroMensualUsado: ahorro };
  }

  if (ahorro <= 0) {
    return { yaCompletado: false, mesesFaltantes: null, fechaEstimada: null, ahorroMensualUsado: 0 };
  }

  const mesesFaltantes = Math.ceil(falta / ahorro);

  // Proyectar la fecha: avanzar mesesFaltantes desde el mes actual
  let anio = +mHoy[1];
  let mes  = +mHoy[2] - 1 + mesesFaltantes; // 0-indexed
  anio += Math.floor(mes / 12);
  mes   = mes % 12;
  const fechaEstimada = `${anio}-${String(mes + 1).padStart(2, '0')}`;

  return { yaCompletado: false, mesesFaltantes, fechaEstimada, ahorroMensualUsado: ahorro };
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

  // ── Proyección de tiempo ────────────────────────────────────────────────
  const elProyeccion = document.getElementById('fe-proyeccion');
  if (!elProyeccion) return;

  // Estimar ahorro mensual: promedio de los últimos 4 periodos del historial
  // (quincenas × 2 → mensual). Fallback: ahorro del periodo actual.
  const tA = (S.gastos || []).filter(g => g.tipo === 'ahorro')
    .reduce((s, g) => s + (g.monto || 0), 0);
  const periodosRecientes = (S.historial || []).slice(0, 4).map(h => h.ahorro || 0);
  const promedioHistorial = periodosRecientes.length > 0
    ? periodosRecientes.reduce((a, b) => a + b, 0) / periodosRecientes.length
    : 0;
  // Convertir periodo → mensual (estimando quincenas × 2)
  const ahorroMensualEstimado = Math.round(
    (promedioHistorial > 0 ? promedioHistorial : tA) * 2
  );

  const proj = calcularProyeccionFondo({
    faltaPorAhorrar:       stats.faltaPorAhorrar,
    ahorroMensualEstimado,
    hoyISO:                hoy(),
  });

  if (!proj) { elProyeccion.style.display = 'none'; return; }

  if (proj.yaCompletado) {
    elProyeccion.style.display = 'block';
    elProyeccion.innerHTML = `<span style="color:var(--a1);font-size:11px;font-weight:700;">✅ ¡Meta alcanzada! Tu fondo está listo.</span>`;
    return;
  }

  const textoFecha = proj.fechaEstimada
    ? ` (aprox. ${proj.fechaEstimada.replace('-', '/')})`
    : '';
  const textoRitmo = ahorroMensualEstimado > 0
    ? ` ahorrando ${f(ahorroMensualEstimado)}/mes`
    : '';

  elProyeccion.style.display = 'block';
  elProyeccion.innerHTML = proj.mesesFaltantes !== null
    ? `<span style="color:var(--t2);font-size:11px;">📅 A este ritmo, completarás el fondo en <strong style="color:var(--t1);">${proj.mesesFaltantes} mes${proj.mesesFaltantes !== 1 ? 'es' : ''}</strong>${textoFecha}${textoRitmo}.</span>`
    : `<span style="color:var(--t3);font-size:11px;">💡 Registrá ahorro este periodo para ver la proyección.</span>`;
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

/**
 * Detecta bolsillos "olvidados": aquellos sin aportes (abono o saldo_inicial)
 * en al menos `umbralDias` días. Si el bolsillo no tiene movimientos pero sí
 * `fechaCreado`, se mide desde esa fecha (creado pero nunca alimentado).
 *
 * Pura: no depende de S, no toca el DOM. La consume el dashboard para mostrar
 * un nudge cariñoso "estos bolsillos te están esperando".
 *
 * @param {Array<{
 *   id:number, nombre:string, monto:number, icono?:string,
 *   fechaCreado?:string,
 *   movimientos?: Array<{tipo:string, fecha:string}>
 * }>} bolsillos
 * @param {string} hoyISO       'YYYY-MM-DD' actual.
 * @param {number} [umbralDias=15]
 * @returns {Array<{
 *   id:number, nombre:string, icono:string, monto:number,
 *   diasSinAporte:number, ultimoAporte:string|null
 * }>} ordenado por diasSinAporte DESC.
 */
export function bolsillosOlvidados(bolsillos, hoyISO, umbralDias = 15) {
  if (!Array.isArray(bolsillos) || bolsillos.length === 0) return [];
  if (!hoyISO) return [];
  const hoyD = new Date(hoyISO + 'T12:00:00');
  if (isNaN(hoyD.getTime())) return [];

  // 'saldo_inicial' cuenta como aporte al crear; 'retiro' NO interrumpe el conteo.
  const TIPOS_APORTE = new Set(['abono', 'saldo_inicial']);
  const out = [];

  for (const b of bolsillos) {
    if (!b) continue;
    let ultimoAporte = null;
    if (Array.isArray(b.movimientos)) {
      for (const m of b.movimientos) {
        if (!m || !TIPOS_APORTE.has(m.tipo)) continue;
        const f = m.fecha;
        if (!f) continue;
        if (!ultimoAporte || f > ultimoAporte) ultimoAporte = f;
      }
    }
    if (!ultimoAporte) ultimoAporte = b.fechaCreado || null;
    if (!ultimoAporte) continue; // sin fecha base, no podemos juzgar

    const fAporte = new Date(ultimoAporte + 'T12:00:00');
    if (isNaN(fAporte.getTime())) continue;
    const dias = Math.floor((hoyD - fAporte) / 86_400_000);
    if (dias < umbralDias) continue;

    out.push({
      id:           b.id,
      nombre:       b.nombre || 'Sin nombre',
      icono:        b.icono  || '🪙',
      monto:        Number(b.monto) || 0,
      diasSinAporte: dias,
      ultimoAporte,
    });
  }

  return out.sort((a, b) => b.diasSinAporte - a.diasSinAporte);
}

// ─── REBALANCEO DE BOLSILLOS SOBRE-ASIGNADOS ─────────────────────────────────
// Caso: platoLibre() devuelve Math.max(0, ...) y por eso oculta cuando los
// bolsillos suman MÁS que el saldo real disponible. Pero esto puede pasar:
//   - Eliminar una cuenta cuyo saldo era parte de bolsillos.
//   - Import de un backup donde los números no encajan.
//   - Edición manual del JSON via DevTools.
//   - Bug viejo que reducía saldo sin ajustar bolsillos.
//
// Sin rebalanceo, el usuario ve "tienes $0 libre" cuando realmente tiene
// menos de cero — y los retiros de bolsillos siguen funcionando como si la
// plata estuviera ahí. Detector + auto-fix proporcional.

/**
 * Pure: si la suma de bolsillos excede el saldo real, calcula los ajustes
 * proporcionales para que cada bolsillo conserve el mismo porcentaje del
 * total reducido. Devuelve null si no hay sobre-asignación.
 *
 * @param {{efectivo?:number, banco?:number}} saldos
 * @param {Array<{id:number, nombre?:string, icono?:string, monto?:number}>} bolsillos
 * @param {{}} [config] reservado.
 * @returns {null | {
 *   saldoReal:number, sumBolActual:number, exceso:number,
 *   ajustes: Array<{
 *     id:number, nombre:string, icono:string,
 *     montoActual:number, montoNuevo:number, reduccion:number
 *   }>
 * }}
 */
export function calcularRebalanceoBolsillos(saldos, bolsillos, _config = {}) {
  if (!saldos || typeof saldos !== 'object' || Array.isArray(saldos)) return null;
  if (!Array.isArray(bolsillos) || bolsillos.length === 0)            return null;

  const efectivo  = Number(saldos.efectivo) || 0;
  const banco     = Number(saldos.banco)    || 0;
  const saldoReal = efectivo + banco;

  // Suma considerando solo bolsillos válidos con monto positivo.
  let sumBolActual = 0;
  const validos = [];
  let largestIdx = -1;
  let largestMonto = -1;
  for (const b of bolsillos) {
    if (!b || typeof b !== 'object')                  continue;
    if (typeof b.id !== 'number' || b.id <= 0)        continue;
    const monto = Number(b.monto) || 0;
    if (monto <= 0)                                   continue;
    sumBolActual += monto;
    validos.push(b);
    if (monto > largestMonto) {
      largestMonto = monto;
      largestIdx = validos.length - 1;
    }
  }

  if (validos.length === 0)                            return null;
  if (sumBolActual <= saldoReal)                       return null;

  const exceso = sumBolActual - saldoReal;
  // Si saldoReal === 0, factor = 0 → todos los bolsillos van a 0.
  const factor = saldoReal > 0 ? (saldoReal / sumBolActual) : 0;

  const ajustes = validos.map(b => {
    const montoActual = Number(b.monto) || 0;
    const montoNuevo  = Math.floor(montoActual * factor);
    return {
      id:      b.id,
      nombre:  (typeof b.nombre === 'string' && b.nombre.length > 0) ? b.nombre : 'Sin nombre',
      icono:   (typeof b.icono  === 'string' && b.icono.length  > 0) ? b.icono  : '🪙',
      montoActual,
      montoNuevo,
      reduccion: montoActual - montoNuevo,
    };
  });

  // Ajuste de redondeo: por floor() la suma puede ser menor que saldoReal.
  // Asignamos la diferencia al bolsillo con mayor montoActual (índice trackeado
  // durante la pasada) — el más grande absorbe el ruido sin romper proporciones.
  if (saldoReal > 0 && largestIdx >= 0) {
    const sumaNueva = ajustes.reduce((s, a) => s + a.montoNuevo, 0);
    const dif = saldoReal - sumaNueva;
    if (dif > 0) {
      ajustes[largestIdx].montoNuevo += dif;
      ajustes[largestIdx].reduccion  -= dif;
    }
  }

  // Orden de salida: mayor reducción primero (más impacto). Empate → id asc
  // para determinismo en tests.
  ajustes.sort((a, b) => {
    const dr = b.reduccion - a.reduccion;
    if (dr !== 0) return dr;
    return a.id - b.id;
  });

  return { saldoReal, sumBolActual, exceso, ajustes };
}

/**
 * Aplica el rebalanceo: actualiza `b.monto` de cada bolsillo según el plan
 * pure y registra un movimiento tipo 'retiro' con nota descriptiva. Persiste
 * y dispara los re-renders. Idempotente: tras aplicar, calcular vuelve null.
 */
export function aplicarRebalanceoBolsillos() {
  const r = calcularRebalanceoBolsillos(S.saldos || {}, S.bolsillos || []);
  if (!r) return;

  const fechaHoy = hoy();
  for (const a of r.ajustes) {
    const b = S.bolsillos.find(x => x.id === a.id);
    if (!b) continue;
    b.monto = a.montoNuevo;
    // Tipo 'retiro' es seguro — los renders existentes lo manejan. La nota
    // identifica el origen para auditoría futura.
    b.movimientos = Array.isArray(b.movimientos) ? b.movimientos : [];
    b.movimientos.unshift({
      tipo:  'retiro',
      monto: a.reduccion,
      fecha: fechaHoy,
      nota:  `Rebalanceo automático (sobre-asignación)`,
    });
  }

  save();
  if (typeof window !== 'undefined') {
    window.renderBolsillos?.();
    window.updateDash?.();
    window.sr?.(`Bolsillos rebalanceados — ${r.ajustes.length} ${r.ajustes.length === 1 ? 'ajustado' : 'ajustados'}.`);
  }
}

/**
 * Renderiza la card "bolsillos sobre-asignados" en el dashboard. Solo aparece
 * cuando hay sobre-asignación. CTA "Rebalancear" ejecuta el plan calculado.
 */
export function renderRebalanceoBolsillos() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-rebalanceo-bolsillos');
  if (!el) return;

  const r = calcularRebalanceoBolsillos(S.saldos || {}, S.bolsillos || []);
  if (!r) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = r.ajustes.slice(0, 3);
  const restantes = r.ajustes.length > 3
    ? `<div style="font-size:10px;color:var(--t3);padding-top:6px;border-top:1px solid var(--b1);">Y ${r.ajustes.length - 3} bolsillo${r.ajustes.length - 3 !== 1 ? 's' : ''} más se ajustarán proporcionalmente…</div>`
    : '';

  const filas = top.map(a => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--b1);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:18px;flex-shrink:0;" aria-hidden="true">${he(a.icono)}</span>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:12px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${he(a.nombre)}</div>
          <div style="font-size:10px;color:var(--t3);">
            ${f(a.montoActual)} → <strong style="color:#ff8c00;">${f(a.montoNuevo)}</strong>
          </div>
        </div>
      </div>
      <span class="mono" style="font-size:11px;color:#ff4444;font-weight:700;flex-shrink:0;">−${f(a.reduccion)}</span>
    </div>
  `).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,140,0,.4);background:rgba(255,140,0,.06);">
      <div style="font-size:11px;font-weight:800;color:#ff8c00;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        ⚖️ Bolsillos sobre-asignados
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:6px;">
        Tus bolsillos suman <strong>${f(r.sumBolActual)}</strong> pero solo tenés <strong>${f(r.saldoReal)}</strong> disponible. Sobran <strong style="color:#ff4444;">${f(r.exceso)}</strong>. Esto puede pasar tras un import o eliminar una cuenta.
      </div>
      ${filas}
      ${restantes}
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn bbl bsm" data-action="aplicarRebalanceoBolsillos" aria-label="Rebalancear los bolsillos proporcionalmente al saldo real">⚖️ Rebalancear</button>
      </div>
    </div>
  `;
}

// ─── VALIDADOR DE COHERENCIA DE SALDOS ───────────────────────────────────────
// Convención de Finko (post-migración v5):
//   - Si hay cuentas registradas: `S.saldos.banco === Σ S.cuentas[].saldo`.
//     Las cuentas individuales son la fuente de verdad; saldos.banco es
//     redundante (sincronizado en cada descontarFondo/reintegrarFondo).
//   - Si NO hay cuentas: `S.saldos.banco` ES el saldo del banco genérico.
//
// Drift posible cuando:
//   - Import de un backup viejo (pre-v5) sin migración aplicada.
//   - Edición manual del JSON via DevTools.
//   - Bug viejo que tocaba saldos.banco sin recalcular.
//
// Detector preventivo: identifica drift y otros invariantes rotos para que el
// usuario sepa que sus números están "torcidos" antes de tomar decisiones
// financieras con datos malos.

/**
 * Pure: detecta incoherencias entre `saldos`, `cuentas` y los invariantes de
 * Finko. Devuelve un array de issues. Vacío si todo coherente.
 *
 * @param {{efectivo?:number, banco?:number}} saldos
 * @param {Array<{id:number, nombre?:string, saldo?:number, banco?:string}>} cuentas
 * @param {{umbralPesos?:number}} [config]
 *   - umbralPesos (default 1000): tolerancia para drift de saldos.banco vs
 *     suma de cuentas. Pequeño drift por redondeo es aceptable; ≥ 1k es bug.
 * @returns {Array<{
 *   tipo:'drift-banco'|'cuenta-negativa'|'banco-negativo'|'efectivo-negativo',
 *   severidad:'leve'|'moderada'|'grave',
 *   bancoSaldos?:number, sumaCuentas?:number, diferencia?:number,
 *   cuenta?:{id:number, nombre:string, saldo:number},
 *   monto?:number,
 *   mensaje:string
 * }>}
 */
export function detectarIncoherenciaSaldos(saldos, cuentas, config = {}) {
  const cfg = (config && typeof config === 'object') ? config : {};
  const umbral = (Number.isFinite(+cfg.umbralPesos) && +cfg.umbralPesos >= 0)
    ? Math.floor(+cfg.umbralPesos)
    : 1000;

  const sValid = saldos && typeof saldos === 'object' && !Array.isArray(saldos);
  const efectivo = sValid ? (Number(saldos.efectivo) || 0) : 0;
  const banco    = sValid ? (Number(saldos.banco)    || 0) : 0;
  const ctas     = Array.isArray(cuentas) ? cuentas : [];

  const issues = [];

  // ── 1) Saldo efectivo negativo (defensivo, Math.max debería prevenirlo) ──
  if (sValid && Number(saldos.efectivo) < 0) {
    issues.push({
      tipo:      'efectivo-negativo',
      severidad: 'grave',
      monto:     Number(saldos.efectivo),
      mensaje:   'El saldo en efectivo está en negativo. Esto no debería pasar — revisá los movimientos recientes o restaurá un backup.',
    });
  }

  // ── 2) Saldo banco negativo ──────────────────────────────────────────────
  if (sValid && Number(saldos.banco) < 0) {
    issues.push({
      tipo:      'banco-negativo',
      severidad: 'grave',
      monto:     Number(saldos.banco),
      mensaje:   'El saldo bancario está en negativo. Revisá si hay un retiro mal registrado o un import dañado.',
    });
  }

  // ── 3) Cuentas con saldo negativo ────────────────────────────────────────
  for (const c of ctas) {
    if (!c || typeof c !== 'object')                    continue;
    if (typeof c.id !== 'number')                       continue;
    const cs = Number(c.saldo);
    if (Number.isFinite(cs) && cs < 0) {
      issues.push({
        tipo:      'cuenta-negativa',
        severidad: 'grave',
        cuenta:    {
          id:     c.id,
          nombre: (typeof c.nombre === 'string' && c.nombre.length > 0) ? c.nombre : 'Cuenta sin nombre',
          saldo:  cs,
        },
        mensaje:   'Una cuenta tiene saldo negativo. Esto no debería pasar — revisá los movimientos recientes.',
      });
    }
  }

  // ── 4) Drift: saldos.banco vs Σ cuentas[].saldo ──────────────────────────
  // Solo aplica cuando hay cuentas. Sin cuentas, saldos.banco ES la verdad.
  if (ctas.length > 0) {
    const sumaCuentas = ctas.reduce((s, c) => {
      const v = Number(c?.saldo);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);
    const dif    = banco - sumaCuentas;
    const difAbs = Math.abs(dif);
    if (difAbs >= umbral) {
      let severidad;
      if      (difAbs >= 100_000) severidad = 'grave';
      else if (difAbs >=  10_000) severidad = 'moderada';
      else                        severidad = 'leve';

      const direccion = dif > 0
        ? 'sobra en saldos.banco'      // banco > sumaCuentas → fantasma en banco
        : 'sobra en cuentas';           // sumaCuentas > banco → faltante en banco
      issues.push({
        tipo:        'drift-banco',
        severidad,
        bancoSaldos: banco,
        sumaCuentas,
        diferencia:  dif,
        mensaje:     `Tu saldo bancario y la suma de tus cuentas no coinciden (${direccion}). Recalculalo para alinear.`,
      });
    }
  }

  // Orden: grave → moderada → leve. Dentro: drift-banco primero (más común
  // y accionable), luego negativos. Empate → orden de inserción estable.
  const sevRank = { grave: 0, moderada: 1, leve: 2 };
  const tipoRank = { 'drift-banco': 0, 'cuenta-negativa': 1, 'banco-negativo': 2, 'efectivo-negativo': 3 };
  issues.sort((a, b) => {
    const r = sevRank[a.severidad] - sevRank[b.severidad];
    if (r !== 0) return r;
    return tipoRank[a.tipo] - tipoRank[b.tipo];
  });

  return issues;
}

/**
 * Recalcula `saldos.banco` como `Σ cuentas[].saldo` y guarda. Es la acción
 * que el usuario invoca desde el banner de drift. No se llama automáticamente
 * porque el drift puede tener una causa válida que el usuario debe revisar.
 */
export function recalcularSaldoBanco() {
  if (!Array.isArray(S.cuentas) || S.cuentas.length === 0) return;
  const suma = S.cuentas.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
  S.saldos = S.saldos || { efectivo: 0, banco: 0 };
  S.saldos.banco = suma;
  save();
  if (typeof window !== 'undefined') {
    window.updSaldo?.();
    window.renderAll?.();
    window.sr?.(`Saldo bancario recalculado: ${f(suma)}`);
  }
}

/**
 * Renderiza el banner "saldos incoherentes" en el dashboard. Solo muestra el
 * primer issue (el más severo) para no saturar visualmente. CTA depende del
 * tipo: drift → "Recalcular", negativos → "Revisar".
 */
export function renderIncoherenciaSaldos() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-saldos-incoherentes');
  if (!el) return;

  const issues = detectarIncoherenciaSaldos(S.saldos, S.cuentas || []);
  if (issues.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = issues[0];

  // CTA según tipo. drift-banco tiene auto-fix (recalcular); el resto solo
  // ofrece "Revisar" porque la corrección depende del contexto del usuario.
  const cta = top.tipo === 'drift-banco'
    ? `<button class="btn bbl bsm" data-action="recalcularSaldoBanco" aria-label="Recalcular el saldo bancario sumando las cuentas">Recalcular</button>`
    : `<button class="btn bg bsm" data-action="go" data-arg-sec="cta" aria-label="Revisar cuentas">Revisar cuentas</button>`;

  // Detalle según tipo
  let detalle = '';
  if (top.tipo === 'drift-banco') {
    detalle = `Banco: <strong class="mono">${f(top.bancoSaldos)}</strong> · Suma cuentas: <strong class="mono">${f(top.sumaCuentas)}</strong> · Diferencia: <strong class="mono" style="color:#ff4444;">${f(Math.abs(top.diferencia))}</strong>`;
  } else if (top.tipo === 'cuenta-negativa' && top.cuenta) {
    detalle = `Cuenta: <strong>${he(top.cuenta.nombre)}</strong> · Saldo: <strong class="mono" style="color:#ff4444;">${f(top.cuenta.saldo)}</strong>`;
  } else if (top.tipo === 'banco-negativo' || top.tipo === 'efectivo-negativo') {
    const nombre = top.tipo === 'banco-negativo' ? 'Banco' : 'Efectivo';
    detalle = `<strong>${nombre}</strong>: <strong class="mono" style="color:#ff4444;">${f(top.monto)}</strong>`;
  }

  const sufijo = issues.length > 1
    ? ` <span style="font-size:10px;color:var(--t3);">+${issues.length - 1} más</span>`
    : '';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,68,68,.4);background:rgba(255,68,68,.06);">
      <div style="font-size:11px;font-weight:800;color:#ff4444;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        ⚠️ Saldos incoherentes${sufijo}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:6px;">
        ${he(top.mensaje)}
      </div>
      <div style="font-size:11px;color:var(--t1);line-height:1.5;margin-bottom:8px;">
        ${detalle}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${cta}</div>
    </div>
  `;
}

// ─── DETECTOR DE BOLSILLOS EN FUGA ───────────────────────────────────────────
// Distinto de bolsillosOlvidados (sin aportes hace M días):
//   - "Olvidado" = no se le hace nada. Pasivo. Plata estancada con propósito olvidado.
//   - "En fuga"  = sí hay actividad — pero la actividad es predominantemente
//                  retirar plata, no abonar. El bolsillo se está usando como
//                  cuenta de paso en vez de cuenta con propósito.
//
// Por qué importa: la app valida que monto - retiro >= 0, así que un bolsillo
// nunca queda en negativo. Pero un bolsillo que tenía $500k para "Viaje", se
// desangra a $50k en 3 meses sin un solo abono, y nadie nota nada → fuga real.

const _MES_RX_BOL = /^(\d{4})-(\d{2})/;

/** "2026-04-25" → "2026-04". null si malformado. */
function _mesISO(fechaISO) {
  if (typeof fechaISO !== 'string') return null;
  const m = _MES_RX_BOL.exec(fechaISO);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Diferencia en meses calendarios entre dos fechas YYYY-MM-DD (b - a). null si malformados. */
function _difMeses(desdeISO, hastaISO) {
  const a = _MES_RX_BOL.exec(desdeISO);
  const b = _MES_RX_BOL.exec(hastaISO);
  if (!a || !b) return null;
  return (+b[1] - +a[1]) * 12 + (+b[2] - +a[2]);
}

/** "2026-04" + N → ['2026-04', '2026-03', '2026-02']. Usa aritmética modular pura. */
function _mesesPrevios(hoyISO, n) {
  const m = _MES_RX_BOL.exec(hoyISO);
  if (!m || n <= 0) return [];
  let y = +m[1];
  let mo = +m[2];
  if (mo < 1 || mo > 12) return [];
  const res = [];
  for (let i = 0; i < n; i++) {
    res.push(`${y}-${String(mo).padStart(2, '0')}`);
    mo -= 1;
    if (mo === 0) { mo = 12; y -= 1; }
  }
  return res;
}

/**
 * Detecta bolsillos cuyos movimientos en los últimos N meses calendarios son
 * predominantemente retiros. Concretamente: en la ventana, hay ≥1 retiro y el
 * neto es < 0 (retirado > abonado). Bolsillos sin movimientos en la ventana se
 * ignoran (esos los maneja `bolsillosOlvidados`).
 *
 * Pura: sin acceso a S, DOM, Date.now() ni locale. Testeable al 100%.
 *
 * Severidad:
 *   - 'alta'  : saldo > 0 + abonado === 0 → fuga limpia (peor caso, mostrar primero)
 *   - 'media' : saldo > 0 + abonado > 0 pero retirado > abonado → fuga parcial
 *   - 'baja'  : saldo === 0 → la fuga ya consumó el bolsillo (sugerir cerrar)
 *
 * Sugerencia:
 *   - 'cerrar'     : saldoActual === 0 → no queda plata, mejor liberar el slot
 *   - 'replantear' : saldoActual > 0   → revisar si el propósito sigue válido
 *
 * @param {Array<{
 *   id:number, nombre?:string, monto?:number, icono?:string,
 *   fechaCreado?:string,
 *   movimientos?: Array<{tipo:string, fecha:string, monto:number}>
 * }>} bolsillos
 * @param {string} hoyISO 'YYYY-MM-DD'.
 * @param {{mesesVentana?:number, antiguedadMinMeses?:number}} [config]
 * @returns {Array<{
 *   id:number, nombre:string, icono:string, saldoActual:number,
 *   abonadoVentana:number, retiradoVentana:number, netoVentana:number,
 *   severidad:'alta'|'media'|'baja',
 *   sugerencia:'cerrar'|'replantear',
 *   mesesVentana:number
 * }>}
 */
export function detectarBolsillosEnFuga(bolsillos, hoyISO, config = {}) {
  if (!Array.isArray(bolsillos) || bolsillos.length === 0)        return [];
  if (typeof hoyISO !== 'string' || !_MES_RX_BOL.test(hoyISO))    return [];

  const cfg = (config && typeof config === 'object') ? config : {};
  const ventana = (Number.isFinite(+cfg.mesesVentana) && +cfg.mesesVentana > 0)
    ? Math.floor(+cfg.mesesVentana) : 3;
  const antMin = (Number.isFinite(+cfg.antiguedadMinMeses) && +cfg.antiguedadMinMeses >= 0)
    ? Math.floor(+cfg.antiguedadMinMeses) : 3;

  const meses = new Set(_mesesPrevios(hoyISO, ventana));
  if (meses.size === 0) return [];

  const out = [];

  for (const b of bolsillos) {
    if (!b || typeof b !== 'object')                  continue;
    if (typeof b.id === 'undefined' || b.id === null) continue;

    // Antigüedad: bolsillos muy nuevos no se juzgan — no hay suficiente
    // historia para distinguir fuga real de un par de retiros legítimos.
    if (typeof b.fechaCreado === 'string') {
      const dif = _difMeses(b.fechaCreado, hoyISO);
      if (dif === null || dif < antMin) continue;
    }

    let abonado = 0;
    let retirado = 0;
    if (Array.isArray(b.movimientos)) {
      for (const m of b.movimientos) {
        if (!m || typeof m !== 'object') continue;
        const mes = _mesISO(m.fecha);
        if (!mes || !meses.has(mes)) continue;
        const monto = Number(m.monto) || 0;
        if (monto <= 0) continue;
        if (m.tipo === 'abono' || m.tipo === 'saldo_inicial') abonado  += monto;
        else if (m.tipo === 'retiro')                         retirado += monto;
      }
    }

    if (retirado <= 0)        continue;   // sin retiros en la ventana → no es fuga
    if (abonado >= retirado)  continue;   // neto >= 0 → no es fuga

    const saldoActual = Number(b.monto) || 0;
    const neto        = abonado - retirado;   // siempre negativo acá

    let severidad;
    if (saldoActual <= 0)         severidad = 'baja';
    else if (abonado === 0)       severidad = 'alta';
    else                          severidad = 'media';

    const sugerencia = saldoActual <= 0 ? 'cerrar' : 'replantear';

    out.push({
      id:              b.id,
      nombre:          (typeof b.nombre === 'string' && b.nombre.length > 0) ? b.nombre : 'Sin nombre',
      icono:           (typeof b.icono  === 'string' && b.icono.length  > 0) ? b.icono  : '🪙',
      saldoActual,
      abonadoVentana:  abonado,
      retiradoVentana: retirado,
      netoVentana:     neto,
      severidad,
      sugerencia,
      mesesVentana:    ventana,
    });
  }

  // Orden: peor caso primero. 'alta' (saldo + sin abonar) > 'media' > 'baja'.
  // Dentro de cada nivel, mayor monto perdido primero. Empate → id asc para
  // que el orden sea determinístico en tests.
  const rank = { alta: 0, media: 1, baja: 2 };
  out.sort((a, b) => {
    const r = rank[a.severidad] - rank[b.severidad];
    if (r !== 0) return r;
    const dn = Math.abs(b.netoVentana) - Math.abs(a.netoVentana);
    if (dn !== 0) return dn;
    return a.id - b.id;
  });

  return out;
}

/**
 * Renderiza la tarjeta de "bolsillos en fuga" en el dashboard. Muestra los 3
 * peor parados, con CTA según la sugerencia: replantear → abrir el modal de
 * abono (para frenar la fuga); cerrar → abrir el bolsillo en su sección.
 * Si no hay fugas, oculta el contenedor.
 */
export function renderBolsillosEnFuga() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-bolsillos-fuga');
  if (!el) return;

  const fugas = detectarBolsillosEnFuga(S.bolsillos || [], hoy());
  if (fugas.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = fugas.slice(0, 3);

  const filas = top.map(b => {
    const cta = b.sugerencia === 'replantear'
      ? `<button class="btn bbl bsm" data-action="abrirAbonarBolsillo" data-arg-id="${b.id}" aria-label="Abonar al bolsillo ${he(b.nombre)} para frenar la fuga">+ Abonar</button>`
      : `<button class="btn bbl bsm" data-action="renderBolsillos" aria-label="Revisar el bolsillo ${he(b.nombre)} en su sección">Revisar</button>`;
    const txtNeto = `Saliendo neto ${f(Math.abs(b.netoVentana))} en ${b.mesesVentana} ${b.mesesVentana === 1 ? 'mes' : 'meses'}`;
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--b1);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:22px;flex-shrink:0;" aria-hidden="true">${b.icono}</span>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${he(b.nombre)}">${he(b.nombre)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">
            ${txtNeto} · Tiene ${f(b.saldoActual)}
          </div>
        </div>
      </div>
      ${cta}
    </div>`;
  }).join('');

  const titulo = fugas.length === 1
    ? 'Un bolsillo se está vaciando solo'
    : `${fugas.length} bolsillos se están vaciando solos`;

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,68,68,.3);background:rgba(255,68,68,.04);">
      <div style="font-size:11px;font-weight:800;color:#ff4444;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        🩸 ${he(titulo)}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Salieron retiros pero no entraron abonos. Si el propósito sigue activo, abonale ya; si no, mejor cerralo.
      </div>
      ${filas}
    </div>
  `;
}

/**
 * Renderiza la tarjeta de "bolsillos esperando atención" en el dashboard.
 * Si no hay olvidados, oculta el contenedor. Muestra los 3 más viejos.
 */
export function renderBolsillosOlvidados() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-bolsillos-olvidados');
  if (!el) return;

  const olvidados = bolsillosOlvidados(S.bolsillos || [], hoy(), 15);
  if (olvidados.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const top = olvidados.slice(0, 3);

  const fmtTiempo = (dias) => {
    if (dias >= 30) {
      const m = Math.floor(dias / 30);
      return `${m} mes${m !== 1 ? 'es' : ''}`;
    }
    if (dias >= 14) {
      const sem = Math.floor(dias / 7);
      return `${sem} semanas`;
    }
    return `${dias} días`;
  };

  const filas = top.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--b1);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:22px;flex-shrink:0;" aria-hidden="true">${b.icono}</span>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${he(b.nombre)}">${he(b.nombre)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">
            Sin aportes hace <strong>${fmtTiempo(b.diasSinAporte)}</strong> · Tiene ${f(b.monto)}
          </div>
        </div>
      </div>
      <button class="btn bbl bsm" data-action="abrirAbonarBolsillo" data-arg-id="${b.id}" aria-label="Abonar al bolsillo ${he(b.nombre)}">+ Abonar</button>
    </div>
  `).join('');

  const titulo = olvidados.length === 1
    ? 'Un bolsillo te está esperando'
    : `${olvidados.length} bolsillos te están esperando`;

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(255,214,10,.3);background:rgba(255,214,10,.04);">
      <div style="font-size:11px;font-weight:800;color:var(--a2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        🪙 ${he(titulo)}
      </div>
      <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:4px;">
        Llevan tiempo sin recibir un aporte. Un poquito ahora les vuelve a dar vida.
      </div>
      ${filas}
    </div>
  `;
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
                data-action="abrirNuevoBolsillo"
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
                data-action="abrirAbonarBolsillo" data-arg-id="${b.id}"
                aria-label="Agregar plata al bolsillo ${he(b.nombre)}">
          ➕ Abonar
        </button>
        <button class="btn bbl bsm"
                data-action="abrirRetirarBolsillo" data-arg-id="${b.id}"
                aria-label="Sacar plata del bolsillo ${he(b.nombre)}">
          ➖ Retirar
        </button>
        <button class="btn bd bsm"
                data-action="eliminarBolsillo" data-arg-id="${b.id}"
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
              data-action="selIconoBolsillo" data-arg-icon="${ic}"
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
registerAction('totalBolsillos',           () => totalBolsillos());
registerAction('platoLibre',               () => platoLibre());
registerAction('renderBolsillos',          () => renderBolsillos());
registerAction('renderBolsillosOlvidados',  () => renderBolsillosOlvidados());
registerAction('renderBolsillosEnFuga',     () => renderBolsillosEnFuga());
registerAction('renderIncoherenciaSaldos',  () => renderIncoherenciaSaldos());
registerAction('recalcularSaldoBanco',      () => recalcularSaldoBanco());
registerAction('renderRebalanceoBolsillos', () => renderRebalanceoBolsillos());
registerAction('aplicarRebalanceoBolsillos', () => aplicarRebalanceoBolsillos());
registerAction('abrirNuevoBolsillo',       () => abrirNuevoBolsillo());
registerAction('guardarNuevoBolsillo',     () => guardarNuevoBolsillo());
registerAction('abrirAbonarBolsillo',      ({ id }) => abrirAbonarBolsillo(id));
registerAction('abrirRetirarBolsillo',     ({ id }) => abrirRetirarBolsillo(id));
registerAction('confirmarMovBolsillo',     () => confirmarMovBolsillo());
registerAction('eliminarBolsillo',         ({ id }) => eliminarBolsillo(id));
registerAction('renderIconosBolsillo',     () => renderIconosBolsillo());
registerAction('selIconoBolsillo',         ({ icon }, el) => selIconoBolsillo(icon, el));

// ═══════════════════════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL (onclick desde HTML)
// ═══════════════════════════════════════════════════════════════════════════════
// Guard `typeof window` para soportar tests/SSR sin DOM.
if (typeof window !== 'undefined') {
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
  window.calcularProyeccionFondo = calcularProyeccionFondo;  // Tanda 22
  window.actualizarVistaFondo    = actualizarVistaFondo;
  window.abrirFondoEmergencia    = abrirFondoEmergencia;

  // bolsillos — guardarNuevoBolsillo/confirmarMovBolsillo → data-action
  // abrirNuevoBolsillo → data-action; abrir*/eliminar* desde JS/dinámico
  window.totalBolsillos           = totalBolsillos;
  window.platoLibre               = platoLibre;
  window.renderBolsillos          = renderBolsillos;
  window.renderBolsillosOlvidados   = renderBolsillosOlvidados;   // updateDash
  window.renderBolsillosEnFuga      = renderBolsillosEnFuga;      // updateDash
  window.renderIncoherenciaSaldos   = renderIncoherenciaSaldos;   // updateDash
  window.recalcularSaldoBanco       = recalcularSaldoBanco;       // CTA del banner
  window.renderRebalanceoBolsillos  = renderRebalanceoBolsillos;  // updateDash
  window.aplicarRebalanceoBolsillos = aplicarRebalanceoBolsillos; // CTA del banner
  window.abrirAbonarBolsillo      = abrirAbonarBolsillo;
  window.abrirRetirarBolsillo     = abrirRetirarBolsillo;
  window.eliminarBolsillo         = eliminarBolsillo;
  window.renderIconosBolsillo     = renderIconosBolsillo;
  window.selIconoBolsillo         = selIconoBolsillo;
}
