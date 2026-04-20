import { S, resetAppState } from './core/state.js';
import { f, he } from './infra/utils.js';

// ─── DAY PICKER ──────────────────────────────────────────────────────────────
export function toggleDayPicker(id) {
  const wrap    = document.getElementById('dp-' + id);
  const hidden  = document.getElementById(id);
  if (!wrap || !hidden) return;
  const trigger = wrap.querySelector('.day-pick-trigger');
  const grid    = wrap.querySelector('.day-pick-grid');
  if (!trigger || !grid) return;

  const yaAbierto = grid.classList.contains('open');
  document.querySelectorAll('.day-pick-grid.open').forEach(el => {
    el.classList.remove('open');
    el.closest('.day-picker')?.querySelector('.day-pick-trigger')?.classList.remove('open');
    el.style.cssText = '';
  });
  if (yaAbierto) return;

  if (!grid.children.length) {
    grid.innerHTML = `
      <div class="day-pick-header">Día de pago mensual</div>
      <div class="day-pick-days">
        ${Array.from({ length: 31 }, (_, i) => i + 1).map(d =>
          `<button type="button" class="day-pick-btn" data-day="${d}" onclick="selectDay('${id}',${d})">${d}</button>`
        ).join('')}
      </div>`;
  }

  const currentVal = +hidden.value;
  if (currentVal) {
    grid.querySelectorAll('.day-pick-btn').forEach(btn => {
      btn.classList.toggle('selected', +btn.dataset.day === currentVal);
    });
    const valEl = trigger.querySelector('.day-pick-val');
    if (valEl) valEl.textContent = `Día ${currentVal} de cada mes`;
  }

  trigger.classList.add('open');
  grid.classList.add('open');

  const rect        = trigger.getBoundingClientRect();
  const gridW       = Math.max(268, rect.width);
  let   left        = rect.left;
  if (left + gridW > window.innerWidth - 10) left = window.innerWidth - gridW - 10;
  const espacioAbajo = window.innerHeight - rect.bottom;

  grid.style.position = 'fixed';
  grid.style.width    = gridW + 'px';
  grid.style.left     = left + 'px';
  grid.style.zIndex   = '600';
  if (espacioAbajo < 220 && rect.top > 220) {
    grid.style.top    = 'auto';
    grid.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  } else {
    grid.style.top    = (rect.bottom + 4) + 'px';
    grid.style.bottom = 'auto';
  }
}

export function selectDay(id, day) {
  const hidden = document.getElementById(id);
  const wrap   = document.getElementById('dp-' + id);
  if (!hidden || !wrap) return;
  hidden.value = day;
  const valEl  = wrap.querySelector('.day-pick-val');
  if (valEl) valEl.textContent = `Día ${day} de cada mes`;
  wrap.querySelectorAll('.day-pick-btn').forEach(btn => {
    btn.classList.toggle('selected', +btn.dataset.day === day);
  });
  const grid    = wrap.querySelector('.day-pick-grid');
  const trigger = wrap.querySelector('.day-pick-trigger');
  if (grid)    { grid.classList.remove('open'); grid.style.cssText = ''; }
  if (trigger) trigger.classList.remove('open');
}

export function setDayPicker(id, day) {
  const hidden = document.getElementById(id);
  const wrap   = document.getElementById('dp-' + id);
  if (!hidden) return;
  hidden.value = day || '';
  if (!wrap) return;
  const valEl = wrap.querySelector('.day-pick-val');
  if (valEl) valEl.textContent = day ? `Día ${day} de cada mes` : 'Selecciona el día';
  wrap.querySelectorAll('.day-pick-btn').forEach(btn => {
    btn.classList.toggle('selected', +btn.dataset.day === +day);
  });
}

// ─── FUND BUTTON (modal de pago fijo) ────────────────────────────────────────
export function updCustomFundButton(selectorId) {
  const original = document.getElementById(selectorId);
  const custom   = document.getElementById(selectorId + '-custom');
  if (!original || !custom) return;

  const val = original.value;
  let icon = '💵', name = 'Efectivo', bal = f(S.saldos.efectivo);

  if (val && val.startsWith('cuenta_')) {
    const c = S.cuentas.find(c => c.id === +val.replace('cuenta_', ''));
    if (c) { icon = c.icono; name = he(c.nombre); bal = f(c.saldo); }
  } else if (val === 'banco') {
    icon = '🏦'; name = 'Banco (General)'; bal = f(S.saldos.banco);
  }

  custom.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="font-size:1.2rem;">${icon}</span>
      <div style="display:flex; flex-direction:column; text-align:left;">
        <span style="font-size:14px; font-weight:500; color:var(--t1);">${name}</span>
        <span style="font-size:12px; color:var(--t2); font-family:'DM Mono', monospace;">${bal}</span>
      </div>
    </div>
    <span style="font-size:0.8rem; color:var(--t2);">▼</span>`;
}

// ─── FORM TOGGLES ────────────────────────────────────────────────────────────
export function toggleFormGasto() {
  const card = document.getElementById('form-gasto-card'); if (!card) return;
  const isOpen  = card.classList.toggle('form-open');
  const header  = card.querySelector('.form-gasto-header');
  const icon    = document.getElementById('form-gasto-icon');
  if (header) header.setAttribute('aria-expanded', String(isOpen));
  if (icon) {
    icon.textContent         = isOpen ? '✕' : '➕';
    icon.style.background    = isOpen ? 'rgba(255,68,68,.15)' : 'rgba(0,220,130,.15)';
    icon.style.borderColor   = isOpen ? 'rgba(255,68,68,.3)'  : 'rgba(0,220,130,.3)';
  }
}

export function toggleFijoInline() {
  const body  = document.getElementById('form-fijo-body');
  const arrow = document.getElementById('form-fijo-arrow');
  const icon  = document.getElementById('form-fijo-icon');
  const btn   = document.querySelector('#form-fijo-card > button');
  if (!body) return;
  const isOpen = body.style.display === 'block';
  if (!isOpen) {
    body.style.display   = 'block';
    requestAnimationFrame(() => { body.style.animation = 'fadeInSlide .25s ease'; });
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    if (icon)  { icon.textContent = '✕'; icon.style.background = 'rgba(255,68,68,.15)'; icon.style.borderColor = 'rgba(255,68,68,.3)'; }
    if (btn)   btn.setAttribute('aria-expanded', 'true');
  } else {
    body.style.display   = 'none';
    if (arrow) arrow.style.transform = '';
    if (icon)  { icon.textContent = '📌'; icon.style.background = 'rgba(255,214,10,.15)'; icon.style.borderColor = 'rgba(255,214,10,.3)'; }
    if (btn)   btn.setAttribute('aria-expanded', 'false');
  }
}

export function toggleFijosPanel() {
  const body  = document.getElementById('fijos-panel-body');
  const arrow = document.getElementById('fijos-panel-arrow');
  const btn   = document.querySelector('.fijos-panel-header');
  if (!body || !arrow) return;
  const isOpen = body.style.display !== 'none';
  body.style.display  = isOpen ? 'none' : '';
  arrow.style.transform = isOpen ? 'rotate(-90deg)' : '';
  if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
}

// ─── DISTRIBUCIÓN DE QUINCENA ─────────────────────────────────────────────────
export function calcDist() {
  const total = (S.saldos.efectivo || 0) + (S.cuentas || []).reduce((s, c) => s + c.saldo, 0);
  const dispEl = document.getElementById('q-total-disp');
  if (dispEl) dispEl.textContent = f(total);

  if (!total || total <= 0) {
    const prev = document.getElementById('q-prev');
    if (prev) prev.innerHTML = '<div class="emp" style="padding:10px;"><span class="emp-icon">💸</span>Agrega fondos en el Dashboard para ver la distribución</div>';
    return;
  }

  const p    = _getPct();
  const html = `
    <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap; margin-bottom:10px;">
      <div style="flex-shrink:0;">
        <div style="font-family:var(--fm);font-weight:800;font-size:32px;color:var(--a1);letter-spacing:-1px;">${f(total)}</div>
        <div class="tm">Presupuesto a distribuir</div>
      </div>
      <div style="display:flex; gap:10px; flex:1; flex-wrap:wrap;">
        <div style="flex:1; min-width:110px; background:rgba(59,158,255,.05); border:1px solid rgba(59,158,255,.2); padding:12px; border-radius:8px;">
          <div style="font-size:10px; font-weight:700; color:var(--a4); margin-bottom:4px; text-transform:uppercase;">🏠 Necesidades (${p.n}%)</div>
          <div style="font-family:var(--fm); font-weight:700; font-size:16px;">${f(total * p.n / 100)}</div>
        </div>
        <div style="flex:1; min-width:110px; background:rgba(255,214,10,.05); border:1px solid rgba(255,214,10,.2); padding:12px; border-radius:8px;">
          <div style="font-size:10px; font-weight:700; color:var(--a2); margin-bottom:4px; text-transform:uppercase;">🎉 Deseos (${p.d}%)</div>
          <div style="font-family:var(--fm); font-weight:700; font-size:16px;">${f(total * p.d / 100)}</div>
        </div>
        <div style="flex:1; min-width:110px; background:rgba(0,220,130,.05); border:1px solid rgba(0,220,130,.2); padding:12px; border-radius:8px;">
          <div style="font-size:10px; font-weight:700; color:var(--a1); margin-bottom:4px; text-transform:uppercase;">💰 Ahorro (${p.a}%)</div>
          <div style="font-family:var(--fm); font-weight:700; font-size:16px;">${f(total * p.a / 100)}</div>
        </div>
      </div>
    </div>`;

  const prev = document.getElementById('q-prev');
  if (prev) prev.innerHTML = html;
}

export function onMetCh() {
  const cus = document.getElementById('cus-pct');
  if (cus) cus.style.display = document.getElementById('q-met')?.value === 'custom' ? 'block' : 'none';
  calcDist();
}

export function selM(el, m) {
  document.querySelectorAll('.mcd').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  const metEl = document.getElementById('q-met');
  if (metEl) metEl.value = m;
  onMetCh();
}

// ─── HELPER INTERNO ──────────────────────────────────────────────────────────
function _getPct() {
  const m   = document.getElementById('q-met')?.value || '50-30-20';
  const MAP = { '50-30-20': { n:50, d:30, a:20 }, '50-20-30': { n:50, d:20, a:30 }, '70-20-10': { n:70, d:20, a:10 } };
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

// ─── GUARDAR QUINCENA ─────────────────────────────────────────────────────────
export async function guardarQ() {
  const total = (S.saldos.efectivo || 0) + (S.cuentas || []).reduce((s, c) => s + c.saldo, 0);
  if (total <= 0) {
    const ok = await window.showConfirm?.('Tienes $0 disponibles en este momento.\n¿Quieres arrancar la quincena así de todas formas?', 'Saldo en cero');
    if (!ok) return;
  }
  const p = _getPct();
  if (p.a === 0) {
    const ok = await window.showConfirm?.('🛑 ¡Espera!\n\nEstás arrancando sin guardar ni un peso.\n\n¿Seguro que quieres continuar sin ahorrar nada?', 'Antes de seguir');
    if (!ok) return;
  }
  // Si el usuario ingresó su sueldo real, úsalo. Si no, usamos el saldo total
  // para mantener compatibilidad con quienes no quieren hacer esa distinción.
  const ingresoManual = +(document.getElementById('q-ing')?.value || 0);
  S.ingreso = ingresoManual > 0 ? ingresoManual : total;
  S.metodo  = document.getElementById('q-met')?.value || '50-30-20';
  window.save?.();
  window.renderAll?.();
  window.go?.('dash');
  window.sr?.('Quincena configurada');
  await window.showAlert?.('¡Presupuesto fijado! 🚀\n\nLas barras del Dashboard ahora medirán tus gastos en base a este dinero.', 'Todo listo');
}

export async function resetTodo() {
  const ok = await window.showPromptConfirm?.(
    'Esta acción va a borrar TODOS tus datos. No se puede deshacer, ¿seguro seguro?',
    'BORRAR',
    '🗑️ Borrar todo lo registrado'
  );
  if (!ok) return;
  localStorage.removeItem('fco_v4');
  resetAppState();                       // ✅ única fuente de verdad
  window.renderAll?.();
  window.go?.('dash');
  await window.showAlert?.('✅ Listo, empezás de cero. Buen arranque.', 'Todo limpio');
}

export async function resetQuincena() {
  const ok = await window.showConfirm?.('Esto elimina los gastos del período actual. Tus objetivos y deudas NO se verán afectados.', '↺ Resetear período');
  if (!ok) return;
  const mes = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  S.gastos.filter(g => g.tipo !== 'ahorro').forEach(g => {
    if (g.fondo === 'efectivo') S.saldos.efectivo = Math.max(0, S.saldos.efectivo + (g.montoTotal || g.monto));
    else if (g.fondo?.startsWith('cuenta_')) { const c = S.cuentas.find(x => x.id === +g.fondo.split('_')[1]); if (c) c.saldo += (g.montoTotal || g.monto); S.saldos.banco = S.cuentas.reduce((s,c)=>s+c.saldo,0); }
    else S.saldos.banco += (g.montoTotal || g.monto);
  });
  S.gastosFijos.forEach(g => { g.pagadoEn = (g.pagadoEn || []).filter(m => m !== mes); });
  S.gastos  = [];
  S.ingreso = 0;
  window.save?.();
  window.renderAll?.();
  window.go?.('dash');
}

// ─── TEMA ────────────────────────────────────────────────────────────────────
export function getPreferredTheme() {
  return localStorage.getItem('finko_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(theme) {
  // CSS usa 'body.light-theme' → clase en body. También marcamos data-theme en html
  // para lectores de pantalla y cualquier regla futura.
  document.body.classList.toggle('light-theme', theme === 'light');
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('finko_theme', theme);
  _syncThemeIcons(theme);
}

/** Sincroniza todos los iconos de tema con el estado real del body */
function _syncThemeIcons(theme) {
  const isDark = theme === 'dark';
  document.querySelectorAll(
    '#btn-theme .ni, #btn-theme-bar .ni, #btn-theme-mobile .ni'
  ).forEach(el => { el.textContent = isDark ? '🌙' : '☀️'; });
}

export function toggleTheme() {
  // Leer estado real del DOM, no de localStorage, para evitar desincronías
  const current = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/** initTheme: debe llamarse lo antes posible (antes del primer paint)
 *  para evitar el flash del tema incorrecto. Se llama desde _initUI en events.js. */
export function initTheme() {
  applyTheme(getPreferredTheme());
}

// ─── CERRAR AL CLICK FUERA ───────────────────────────────────────────────────
let _clickOutsideInstalled = false;
export function initClickOutside() {
  if (_clickOutsideInstalled) return;
  _clickOutsideInstalled = true;
  document.addEventListener('click', e => {
    // Fund select
    if (!e.target.closest('.fund-select')) {
      document.querySelectorAll('.fund-sel-opts.open').forEach(el => {
        el.classList.remove('open');
        el.closest('.fund-select')?.querySelector('.fund-sel-trigger')?.classList.remove('open');
        el.style.cssText = '';
      });
    }
    // Day picker
    if (!e.target.closest('.day-picker')) {
      document.querySelectorAll('.day-pick-grid.open').forEach(el => {
        el.classList.remove('open');
        el.style.cssText = '';
        el.closest('.day-picker')?.querySelector('.day-pick-trigger')?.classList.remove('open');
      });
    }
    // Modal overlay
    if (e.target.classList.contains('modal-ov') && e.target.id !== 'cdlg-ov') {
      window.closeM?.(e.target.id);
    }
  });
}

// ─── ACORDEONES DEL DASHBOARD — ui_02 ────────────────────────────────────────
/**
 * Abre o cierra una card colapsable del Dashboard.
 * Reemplaza los tres bloques `onclick="(function(b){...})"` hardcodeados
 * en index.html por una sola función reutilizable.
 *
 * Convención de IDs en index.html:
 *   Botón:  id="btn-dash-{key}"   con aria-expanded y aria-controls
 *   Cuerpo: id="dash-{key}-body"  con clase .dash-card-body
 *   Flecha: id="dash-{key}-arrow" con clase .ui-acc-arrow (opcional)
 *
 * La transición visual la maneja CSS (.dash-card-body / .dash-card-body.open)
 * usando max-height — sin manipulación de display ni style inline.
 *
 * @param {string} key - Clave del acordeón (ej: 'resumen', 'movimientos', 'patrimonio')
 */
export function toggleDashCard(key) {
  const body  = document.getElementById(`dash-${key}-body`);
  const btn   = document.getElementById(`btn-dash-${key}`);
  const arrow = document.getElementById(`dash-${key}-arrow`);
  if (!body) return;

  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);

  if (btn)   btn.setAttribute('aria-expanded', String(!isOpen));
  if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.toggleDayPicker   = toggleDayPicker;
window.selectDay         = selectDay;
window.setDayPicker      = setDayPicker;
window.updCustomFundButton = updCustomFundButton;
window.toggleFormGasto   = toggleFormGasto;
window.toggleFijoInline  = toggleFijoInline;
window.toggleFijosPanel  = toggleFijosPanel;
window.calcDist          = calcDist;
window.onMetCh           = onMetCh;
window.selM              = selM;
window.guardarQ          = guardarQ;
window.resetTodo         = resetTodo;
window.resetQuincena     = resetQuincena;
window.toggleTheme       = toggleTheme;
window.applyTheme        = applyTheme;
window.getPreferredTheme = getPreferredTheme;
window.initTheme         = initTheme;
window.updateBadge       = updateBadge;
window.toggleDashCard    = toggleDashCard;