// ─── ACCESIBILIDAD (WCAG 2.1) ────────────────────────────────────────────────
// Primitivas compartidas:
//  • sr()          → anuncios por región aria-live.
//  • FOCUSABLE_SEL → selector canónico de elementos enfocables.
//  • getFocusable  → lista visible de enfocables dentro de un contenedor.
//  • installTrap   → trampa de foco (Tab/Shift+Tab/Escape) sobre un modal.
//  • removeTrap    → libera la trampa activa y restaura la previa del stack.
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

// ✅ I5 (auditoría v5): Antes había una sola variable _activeTrapFn — abrir un
// showConfirm desde un modal hacía removeTrap() del modal padre y al cerrar el
// diálogo el modal quedaba sin trap. Ahora es un stack: installTrap apila y
// pausa el listener anterior; removeTrap desapila y reactiva el de abajo.
const _trapStack = [];

/**
 * Construye el handler keydown para un container concreto.
 * Extraído para no recrear la lógica al apilar/destapar.
 */
function _buildTrapHandler(container, onEscape) {
  return function handler(e) {
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
    // Si el foco escapó del container (p.ej. click en overlay), lo reencuadramos
    if (!container.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
}

/**
 * Instala una trampa de foco sobre `container`. Si ya hay una activa, la
 * actual se pausa (no se borra) y se restaurará automáticamente al hacer
 * removeTrap(), permitiendo modales/diálogos anidados sin perder el trap.
 * @param {HTMLElement} container - El elemento modal activo.
 * @param {Function}    [onEscape] - Callback para la tecla Escape.
 *   Obligatorio si el consumidor no llama a closeM() él mismo.
 */
export function installTrap(container, onEscape) {
  // Pausar el handler anterior sin sacarlo del stack.
  if (_trapStack.length > 0) {
    document.removeEventListener('keydown', _trapStack[_trapStack.length - 1].fn);
  }
  const fn = _buildTrapHandler(container, onEscape);
  _trapStack.push({ fn, container });
  document.addEventListener('keydown', fn);
}

export function removeTrap() {
  if (_trapStack.length === 0) return;
  const top = _trapStack.pop();
  document.removeEventListener('keydown', top.fn);
  // Si quedaba un trap "abajo", reactivarlo y devolverle el foco a su
  // container — sino el siguiente Tab dispararía el reencuadre del handler
  // pero hasta entonces el usuario perdería visualmente el contexto.
  if (_trapStack.length > 0) {
    const prev = _trapStack[_trapStack.length - 1];
    document.addEventListener('keydown', prev.fn);
    if (!prev.container.contains(document.activeElement)) {
      const els = getFocusable(prev.container);
      if (els[0]) els[0].focus();
    }
  }
}
