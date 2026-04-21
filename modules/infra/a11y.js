// ─── ACCESIBILIDAD (WCAG 2.1) ────────────────────────────────────────────────
// Primitivas compartidas:
//  • sr()          → anuncios por región aria-live.
//  • FOCUSABLE_SEL → selector canónico de elementos enfocables.
//  • getFocusable  → lista visible de enfocables dentro de un contenedor.
//  • installTrap   → trampa de foco (Tab/Shift+Tab/Escape) sobre un modal.
//  • removeTrap    → libera la trampa activa.
//
// Los diálogos y modales viven en utils.js y consumen estas primitivas.

// ─── SCREEN READER ANUNCIADOR ────────────────────────────────────────────────
export function sr(msg) {
  const el = document.getElementById('sr-announcer');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}

// ─── FOCUS TRAP (criterio 2.1.2: Sin trampa del teclado) ─────────────────────
export const FOCUSABLE_SEL = [
  'button:not([disabled])', '[href]', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function getFocusable(container) {
  // offsetWidth/Height filtran elementos con display:none o visibility:hidden
  return Array.from(container.querySelectorAll(FOCUSABLE_SEL))
    .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.hidden);
}

let _activeTrapFn = null;

/**
 * Instala la trampa de foco sobre `container`.
 * @param {HTMLElement} container - El elemento modal activo.
 * @param {Function}    [onEscape] - Callback para la tecla Escape.
 *   Obligatorio si el consumidor no llama a closeM() él mismo.
 */
export function installTrap(container, onEscape) {
  removeTrap();
  _activeTrapFn = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onEscape) onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    const els = getFocusable(container);
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0];
    const last  = els[els.length - 1];
    const active = document.activeElement;
    // Si el foco escapó del modal (p.ej. click en overlay), lo reencuadramos
    if (!container.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', _activeTrapFn);
}

export function removeTrap() {
  if (_activeTrapFn) {
    document.removeEventListener('keydown', _activeTrapFn);
    _activeTrapFn = null;
  }
}
