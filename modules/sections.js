import { S } from './state.js';
import { sr } from './utils.js';

// ─── LAZY LOAD DE CALCULADORAS ────────────────────────────────────────────────
// calculadoras.js solo se usa en la sección "Plan" (quin).
// Se carga una sola vez al primer acceso — las visitas siguientes usan el caché.
let _calcModulo = null;

async function _cargarCalculadoras() {
  if (_calcModulo) {
    // Ya cargado — solo re-inicializar los valores de los inputs
    _calcModulo.cCDT();
    return;
  }
  try {
    _calcModulo = await import('./calculadoras.js');
    // Exponer al window para los onclick del HTML
    window.cCDT         = _calcModulo.cCDT;
    window.cCre         = _calcModulo.cCre;
    window.cIC          = _calcModulo.cIC;
    window.cMeta        = _calcModulo.cMeta;
    window.cMetaAporte  = _calcModulo.cMetaAporte;
    window.cPila        = _calcModulo.cPila;
    window.cInf         = _calcModulo.cInf;
    window.cR72         = _calcModulo.cR72;
    window.toggleCalc   = _calcModulo.toggleCalc;
    window.calcPrima    = _calcModulo.calcPrima;
    window.guardarPrima = _calcModulo.guardarPrima;
    // Inicializar aria y valores por defecto
    _calcModulo._initAriaCalc?.();
    _calcModulo.cCDT();
    _calcModulo.cCre();
    _calcModulo.cIC();
    _calcModulo.cMeta();
    _calcModulo.cPila();
  } catch (e) {
    console.error('[Finko] Error cargando calculadoras:', e);
  }
}
import { NAVS } from './constants.js';

// ─── ETIQUETAS LEGIBLES PARA LECTORES DE PANTALLA ─────────────────────────────
const SEC_LABELS = {
  dash:         'Inicio — resumen de mi plata',
  gast:         'Gasté — lo que he gastado',
  compromisos:  'Mis compromisos — deudas y pagos agendados',
  alcancias:    'Mis alcancías — metas y plata apartada',
  inve:         'Crecer — invertir mi plata',
  stat:         'Balance — cómo me está yendo',
  quin:         'Plan — cómo repartir la quincena',
};

// Secciones que activan el botón ⋯ en móvil
const MAS_SECTIONS = ['quin', 'inve', 'stat'];

// ─── SWIPE HORIZONTAL — NAVEGACIÓN TÁCTIL ────────────────────────────────────
/**
 * Permite deslizar el contenido principal izquierda/derecha para cambiar de
 * sección en móvil. Solo activa en viewports ≤ 768px para no interferir con
 * el mouse en desktop.
 *
 * Umbrales:
 *   - distancia mínima horizontal: 60px  (evita swipes accidentales)
 *   - máximo desvío vertical:      35px  (permite scroll vertical normal)
 *   - velocidad mínima:            0.3px/ms (diferencia intención de scroll)
 *
 * El gesto NO cancela el scroll vertical — si el usuario va más vertical que
 * horizontal, se ignora. Esto es crítico para listas largas.
 *
 * WCAG: No reemplaza los controles de teclado/nav — es una mejora adicional.
 */
let _swipeInit = false;

function _initSwipe() {
  if (_swipeInit) return;
  _swipeInit = true;

  const main = document.getElementById('main');
  if (!main) return;

  let t0 = 0, x0 = 0, y0 = 0;
  let _cancelado = false;

  main.addEventListener('touchstart', e => {
    if (window.innerWidth > 768) return;
    const t = e.touches[0];
    x0 = t.clientX;
    y0 = t.clientY;
    t0 = Date.now();
    _cancelado = false;
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    if (window.innerWidth > 768 || _cancelado) return;
    const t = e.touches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    // Si el movimiento es mayoritariamente vertical, ignorar el swipe
    if (Math.abs(dy) > Math.abs(dx) * 1.1) _cancelado = true;
  }, { passive: true });

  main.addEventListener('touchend', e => {
    if (window.innerWidth > 768 || _cancelado) return;

    const t  = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    const dt = Date.now() - t0;

    // Rechazar si es más vertical que horizontal
    if (Math.abs(dy) > 35) return;
    // Rechazar si no alcanzó la distancia mínima
    if (Math.abs(dx) < 60) return;
    // Rechazar si fue muy lento (scroll accidental)
    if (Math.abs(dx) / dt < 0.3) return;

    // Obtener la sección activa actual
    const secActual = NAVS.find(n => {
      const el = document.getElementById('sec-' + n);
      return el?.classList.contains('active');
    });
    if (!secActual) return;

    const idx = NAVS.indexOf(secActual);
    if (idx === -1) return;

    // Swipe izquierda (→ sección siguiente) | derecha (→ sección anterior)
    const dir     = dx < 0 ? 1 : -1;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= NAVS.length) return;

    const destino = NAVS[nextIdx];

    // Animación sutil de salida antes de cambiar
    const secEl = document.getElementById('sec-' + secActual);
    if (secEl) {
      secEl.style.transition = 'opacity .12s ease, transform .12s ease';
      secEl.style.opacity    = '0';
      secEl.style.transform  = `translateX(${dx < 0 ? '-16px' : '16px'})`;
      setTimeout(() => {
        secEl.style.opacity   = '';
        secEl.style.transform = '';
        secEl.style.transition = '';
      }, 130);
    }

    go(destino);
  }, { passive: true });
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────

export function go(id) {
  _initSwipe();

  // ── Redirects de IDs anteriores → secciones fusionadas ──────────────────────
  // Los onclick="go('deu')" en el dashboard y otros módulos siguen funcionando.
  if (id === 'fijo')     { go('gast'); return; }
  if (id === 'hist')     { go('stat'); window.setResumenTab?.('historial'); return; }
  if (id === 'deu')      { go('compromisos'); switchSecTab('compromisos','deudas'); return; }
  if (id === 'agen')     { go('compromisos'); switchSecTab('compromisos','agenda'); return; }
  if (id === 'objetivos'){ go('alcancias');   switchSecTab('alcancias','metas');    return; }
  if (id === 'ahorro')   { go('alcancias');   switchSecTab('alcancias','apartado'); return; }

  closeMas();

  NAVS.forEach(n => {
    const s = document.getElementById('sec-' + n);
    if (s) s.classList.toggle('active', n === id);
  });

  document.querySelectorAll('.nb[data-section]').forEach(b => {
    const isActive = b.dataset.section === id;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  const btnMas = document.getElementById('btn-mas');
  if (btnMas) {
    const enMas = MAS_SECTIONS.includes(id);
    btnMas.classList.toggle('active', enMas);
    btnMas.setAttribute('aria-current', enMas ? 'page' : 'false');
  }

  document.querySelectorAll('.mas-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.dataset.section === id);
  });

  // Triggers de render por sección
  if (id === 'stat')         window.setResumenTab?.('analisis');
  if (id === 'gast')         window.updSaldo?.();
  if (id === 'compromisos')  _renderCompromisos();
  if (id === 'alcancias')    _renderAlcancias();
  if (id === 'quin')         _cargarCalculadoras();   // ← lazy-load

  sr(SEC_LABELS[id] || `Sección ${id}`);
}

// ─── RENDER INTERNO DE SECCIONES FUSIONADAS ──────────────────────────────────
function _renderCompromisos() {
  window.renderDeudas?.();
  window.renderFijos?.();
  window.renderPagos?.();
  window.renderCal?.();
}

function _renderAlcancias() {
  window.renderObjetivos?.();
  window.renderBolsillos?.();
}

// ─── SWITCH DE PESTAÑAS INTERNAS ─────────────────────────────────────────────
/**
 * Cambia la pestaña activa dentro de una sección fusionada.
 * @param {string} section  — 'compromisos' | 'alcancias'
 * @param {string} tab      — nombre de la pestaña (ej: 'deudas', 'agenda')
 * @param {HTMLElement} [btnEl] — botón que disparó el cambio (para aria)
 */
export function switchSecTab(section, tab, btnEl) {
  // Paneles
  document.querySelectorAll(`#sec-${section} .itab-panel`).forEach(p => {
    p.classList.toggle('active', p.dataset.tab === tab);
    p.setAttribute('hidden', p.dataset.tab !== tab ? '' : null);
    if (p.dataset.tab === tab) p.removeAttribute('hidden');
  });
  // Botones de tab
  document.querySelectorAll(`#sec-${section} .itab`).forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
    b.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // Render del contenido relevante al cambiar pestaña
  if (section === 'compromisos' && tab === 'deudas') {
    window.renderDeudas?.(); window.renderFijos?.();
  }
  if (section === 'compromisos' && tab === 'agenda') {
    window.renderCal?.(); window.renderPagos?.();
  }
  if (section === 'alcancias' && tab === 'metas')    window.renderObjetivos?.();
  if (section === 'alcancias' && tab === 'apartado') window.renderBolsillos?.();
}

// ─── ESTADO INTERNO: PANEL "MÁS" ─────────────────────────────────────────────
// Necesario para restaurar el foco al botón que abrió el panel (WCAG 2.1)
// y para liberar el listener de Escape al cerrarlo.
let _masLastFocused = null;
let _masEscHandler  = null;

export function toggleMas() {
  const panel   = document.getElementById('mas-panel');
  const overlay = document.getElementById('mas-overlay');
  const btn     = document.getElementById('btn-mas');
  if (!panel || !overlay) return;
  const abierto = panel.classList.contains('open');
  panel.classList.toggle('open', !abierto);
  overlay.classList.toggle('open', !abierto);
  if (btn) btn.setAttribute('aria-expanded', String(!abierto));

  if (!abierto) {
    // ✅ FIX: al abrir el panel, guardar origen del foco y moverlo al
    // primer ítem del menú para que el usuario de teclado pueda navegar.
    _masLastFocused = document.activeElement;
    requestAnimationFrame(() => {
      const first = panel.querySelector('button:not([disabled])');
      if (first) first.focus();
    });
    // Escape cierra el panel y restaura el foco — WCAG 2.1 criterio 2.1.2
    _masEscHandler = e => {
      if (e.key === 'Escape') { e.preventDefault(); closeMas(); }
    };
    document.addEventListener('keydown', _masEscHandler);
  } else {
    _cerrarMasFoco();
  }
}

// Helper interno: limpia listeners y restaura el foco al origen
function _cerrarMasFoco() {
  if (_masEscHandler) {
    document.removeEventListener('keydown', _masEscHandler);
    _masEscHandler = null;
  }
  if (_masLastFocused?.focus) {
    _masLastFocused.focus();
    _masLastFocused = null;
  }
}

export function closeMas() {
  const panel   = document.getElementById('mas-panel');
  const overlay = document.getElementById('mas-overlay');
  const btn     = document.getElementById('btn-mas');
  if (!panel) return;
  panel.classList.remove('open');
  overlay?.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  // ✅ FIX: restaurar foco y limpiar listener de Escape
  _cerrarMasFoco();
}

export function setPer(tipo, el) {
  S.tipoPeriodo = tipo;
  document.querySelectorAll('.qtab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });
  el.classList.add('active');
  el.setAttribute('aria-selected', 'true');
  el.setAttribute('tabindex', '0');
  window.renderDeudas?.();
  window.updateDash?.();
}

export function setResumenTab(tab) {
  const analisis  = document.getElementById('resumen-tab-analisis');
  const historial = document.getElementById('resumen-tab-historial');
  if (!analisis || !historial) return;

  document.querySelectorAll('.resumen-tab').forEach(t => {
    const isActive = t.getAttribute('data-tab') === tab;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  analisis.style.display  = tab === 'analisis'  ? 'block' : 'none';
  historial.style.display = tab === 'historial' ? 'block' : 'none';

  if (tab === 'analisis')  window.renderStats?.();
  if (tab === 'historial') window.renderHistorial?.();
}

export function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ex = sb.classList.toggle('expanded');
  document.body.classList.toggle('sb-expanded', ex);
  localStorage.setItem('sb_expanded', ex);
  const btn = document.getElementById('btn-sidebar-toggle');
  if (btn) btn.setAttribute('aria-expanded', ex);
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.go             = go;
window.toggleMas      = toggleMas;
window.closeMas       = closeMas;
window.setPer         = setPer;
window.setResumenTab  = setResumenTab;
window.toggleSidebar  = toggleSidebar;
window.switchSecTab   = switchSecTab;