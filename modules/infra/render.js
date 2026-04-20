import { S } from '../core/state.js';
import { f, mesStr, setEl }       from './utils.js';
import { renderBolsillos }        from '../ahorrado.js';

// ─── SALDO TOTAL ─────────────────────────────────────────────────────────────
export function totalCuentas() {
  return (S.cuentas || []).reduce((s, c) => s + c.saldo, 0);
}

export function updSaldo() {
  if (S.cuentas && S.cuentas.length > 0) {
    S.saldos.banco = totalCuentas();
  }
  const ef  = S.saldos.efectivo;
  const bk  = S.saldos.banco;
  const tot = ef + bk;

  ['d-ef', 'g-ef', 'q-efc'].forEach(id => setEl(id, f(ef)));
  ['d-bk', 'g-bk', 'q-bkc'].forEach(id => setEl(id, f(bk)));
  setEl('d-tot', f(tot));

  // ── DONUT RING + SEMÁFORO ────────────────────────────────────────────────────
  const totalBols = (S.bolsillos || []).reduce((s, b) => s + (Number(b.monto) || 0), 0);
  const libre     = Math.max(0, tot - totalBols);
  const CIRC      = 175.9; // 2π × r=28

  const pctLibre = tot > 0 ? libre / tot : 1;
  const pctBols  = tot > 0 ? 1 - pctLibre : 0;
  const libreArc = +(CIRC * pctLibre).toFixed(1);
  const bolsArc  = +(CIRC * pctBols).toFixed(1);

  const donutLibre = document.getElementById('d-donut-libre');
  const donutBols  = document.getElementById('d-donut-bols');
  const donutPct   = document.getElementById('d-donut-pct');

  if (donutLibre) donutLibre.setAttribute('stroke-dasharray', `${libreArc} ${CIRC}`);
  if (donutBols)  {
    donutBols.setAttribute('stroke-dasharray',  `${bolsArc} ${CIRC}`);
    donutBols.setAttribute('stroke-dashoffset', `${(44 - libreArc).toFixed(1)}`);
  }

  // Semáforo: color del número principal + porcentaje central del donut
  let colorSemaforo = 'var(--a1)'; // verde — tranquilo
  if (tot > 0) {
    if (pctLibre < 0.15)      colorSemaforo = 'var(--dan)'; // rojo — ¡pilas!
    else if (pctLibre < 0.40) colorSemaforo = 'var(--a2)'; // amarillo — cuidado
  }
  const totEl = document.getElementById('d-tot');
  if (totEl) totEl.style.color = colorSemaforo;
  if (donutPct) {
    donutPct.textContent = tot > 0 ? `${Math.round(pctLibre * 100)}%` : '—';
    donutPct.style.color = colorSemaforo;
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Actualiza preview de quincena si la sección está activa
  if (typeof window.actualizarListasFondos === 'function') {
    window.actualizarListasFondos();
  }
  if (typeof window.renderBolsillos === 'function') {
    window.renderBolsillos();
  }
}

// ─── BADGE DE PERÍODO ────────────────────────────────────────────────────────
export function updateBadge() {
  const n   = new Date();
  const txt = `${n.getDate() <= 15 ? '1ra' : '2da'} quincena · ${n.toLocaleString('es-CO', { month: 'short' })} ${n.getFullYear()}`;
  setEl('hbadge', txt);
}

// ─── RENDER SELECTIVO ────────────────────────────────────────────────────────
let _renderTimer = null;

/**
 * Renderiza solo las secciones indicadas.
 * El dashboard y saldos siempre se actualizan.
 * @param {string[]} sections - Claves: 'gastos','objetivos','inversiones','deudas','fijos','pagos','historial','stats'
 */
export function renderSmart(sections = []) {
  if (_renderTimer) cancelAnimationFrame(_renderTimer);
  _renderTimer = requestAnimationFrame(() => {
    updSaldo();
    if (typeof window.renderCuentas      === 'function') window.renderCuentas();
    if (typeof window.renderDashCuentas  === 'function') window.renderDashCuentas();
    if (typeof window.actualizarVistaFondo === 'function') window.actualizarVistaFondo();
    if (typeof window.updateDash         === 'function') window.updateDash();

    if (sections.includes('gastos'))      window.renderGastos?.();
    if (sections.includes('objetivos'))   window.renderObjetivos?.();
    if (sections.includes('inversiones')) window.renderInversiones?.();
    if (sections.includes('deudas'))      window.renderDeudas?.();
    if (sections.includes('fijos'))       window.renderFijos?.();
    if (sections.includes('pagos'))       window.renderPagos?.();
    if (sections.includes('historial'))   window.renderHistorial?.();
    if (sections.includes('stats'))       window.renderStats?.();
    if (sections.includes('bolsillos'))   window.renderBolsillos?.();

    // Gamificación: evaluar y actualizar widget de racha en dashboard.
    // Se ejecuta al final para no bloquear el render principal.
    window.evaluarLogros?.();
    window.renderRachaWidget?.();
  });
}

/**
 * Renderiza todo. Solo para arranque inicial, imports y resets.
 */
export function renderAll() {
  renderSmart(['gastos', 'objetivos', 'inversiones', 'deudas', 'fijos', 'pagos', 'historial', 'stats']);
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.renderSmart = renderSmart;
window.renderAll   = renderAll;
window.updSaldo    = updSaldo;
window.totalCuentas = totalCuentas;
window.updateBadge = updateBadge;