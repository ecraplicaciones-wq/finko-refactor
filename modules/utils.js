// ─── FORMATO Y FECHAS ─────────────────────────────────────────────────────────
export function f(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CO');
}

export function hoy() {
  // ⚠️ FIX: toISOString() devuelve UTC — a las 11 PM en Bogotá (UTC-5)
  // registraba el día siguiente. Se usa hora local del dispositivo.
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export function mesStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export function he(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── DOM HELPERS ─────────────────────────────────────────────────────────────
export function setEl(id, v) {
  const e = document.getElementById(id);
  if (e) e.textContent = v;
}

export function setHtml(id, v) {
  const e = document.getElementById(id);
  if (e) e.innerHTML = v;
}

export function sr(msg) {
  const el = document.getElementById('sr-announcer');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}

// ─── FOCUS TRAP (WCAG 2.1 — criterio 2.1.2: Sin trampa del teclado) ─────────
// Garantiza que Tab y Shift+Tab no salgan del modal activo, y que Escape lo
// cierre. Aplica a todos los modales de openM() y a los diálogos asíncronos.

const _FOCUSABLE_SEL = [
  'button:not([disabled])', '[href]', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function _getFocusable(container) {
  // offsetWidth/Height filtran elementos con display:none o visibility:hidden
  return Array.from(container.querySelectorAll(_FOCUSABLE_SEL))
    .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.hidden);
}

let _activeTrapFn = null;

/**
 * Instala la trampa de foco sobre `container`.
 * @param {HTMLElement} container - El elemento modal activo.
 * @param {Function}    [onEscape] - Callback para la tecla Escape.
 *   Si se omite, se llama closeM(container.id).
 */
function _installTrap(container, onEscape) {
  _removeTrap();
  _activeTrapFn = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onEscape) onEscape();
      else closeM(container.id);
      return;
    }
    if (e.key !== 'Tab') return;
    const els = _getFocusable(container);
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

function _removeTrap() {
  if (_activeTrapFn) {
    document.removeEventListener('keydown', _activeTrapFn);
    _activeTrapFn = null;
  }
}

// ─── MODALES ─────────────────────────────────────────────────────────────────
let _lastFocused = null;

export function openM(id) {
  _lastFocused = document.activeElement;
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  requestAnimationFrame(() => {
    const focusable = modal.querySelector(_FOCUSABLE_SEL);
    if (focusable) focusable.focus();
    // Instala el trap DESPUÉS de mover el foco inicial para evitar
    // que el propio focus() dispare el handler prematuramente.
    _installTrap(modal);
  });
}

export function closeM(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  // Libera el trap antes de restaurar el foco para que el evento
  // de foco saliente no sea interceptado por el handler.
  _removeTrap();
  if (_lastFocused && typeof _lastFocused.focus === 'function') {
    _lastFocused.focus();
    _lastFocused = null;
  }
}

// ─── DIÁLOGOS ASÍNCRONOS ─────────────────────────────────────────────────────
let _cdlgResolve = null;
let _cdlgPromptMode = false;
let _cdlgExpected = null;

// Expuesto en window porque el HTML llama a _cdlgRes(true/false) inline
window._cdlgRes = function (ok) {
  if (_cdlgPromptMode && _cdlgExpected && ok) {
    const v = document.getElementById('cdlg-input').value;
    if (v !== _cdlgExpected) {
      document.getElementById('cdlg-input').style.border = '1px solid var(--dan)';
      return;
    }
  }
  document.getElementById('cdlg-ov').classList.remove('open');
  document.getElementById('cdlg-cancel').style.display = '';
  document.getElementById('cdlg-input').style.border = '';
  // Libera el trap de foco al cerrar el diálogo asíncrono
  _removeTrap();
  if (_cdlgPromptMode) {
    const v = document.getElementById('cdlg-input').value;
    if (_cdlgResolve) _cdlgResolve(ok ? v : null);
  } else {
    if (_cdlgResolve) _cdlgResolve(ok);
  }
  _cdlgResolve = null;
};

export function showConfirm(msg, title = 'Confirmar') {
  return new Promise(r => {
    _cdlgResolve = r; _cdlgPromptMode = false;
    setEl('cdlg-title', title); setEl('cdlg-msg', msg);
    document.getElementById('cdlg-input-wrap').style.display = 'none';
    document.getElementById('cdlg-cancel').style.display = '';
    const ov = document.getElementById('cdlg-ov');
    ov.classList.add('open');
    // Escape en Confirmar = cancelar (mismo que presionar "No")
    requestAnimationFrame(() => {
      const first = _getFocusable(ov)[0]; if (first) first.focus();
      _installTrap(ov, () => window._cdlgRes(false));
    });
  });
}

export function showAlert(msg, title = 'Aviso') {
  return new Promise(r => {
    _cdlgResolve = r; _cdlgPromptMode = false;
    setEl('cdlg-title', title); setEl('cdlg-msg', msg);
    document.getElementById('cdlg-input-wrap').style.display = 'none';
    document.getElementById('cdlg-cancel').style.display = 'none';
    const ov = document.getElementById('cdlg-ov');
    ov.classList.add('open');
    // Escape en Aviso = confirmar (no hay botón cancelar, Escape cierra)
    requestAnimationFrame(() => {
      const first = _getFocusable(ov)[0]; if (first) first.focus();
      _installTrap(ov, () => window._cdlgRes(true));
    });
  });
}

export function showPromptConfirm(msg, exp, title = 'Peligro') {
  return new Promise(r => {
    _cdlgResolve = r; _cdlgPromptMode = true; _cdlgExpected = exp;
    setEl('cdlg-title', title); setEl('cdlg-msg', msg);
    document.getElementById('cdlg-input-wrap').style.display = 'block';
    document.getElementById('cdlg-cancel').style.display = '';
    const ov = document.getElementById('cdlg-ov');
    ov.classList.add('open');
    requestAnimationFrame(() => {
      const inp = document.getElementById('cdlg-input'); if (inp) inp.focus();
      _installTrap(ov, () => window._cdlgRes(false));
    });
  });
}

export function showPrompt(msg, title = 'Editar', valorInicial = '') {
  return new Promise(r => {
    _cdlgResolve = r; _cdlgPromptMode = true; _cdlgExpected = null;
    setEl('cdlg-title', title); setEl('cdlg-msg', msg);
    const inp = document.getElementById('cdlg-input');
    inp.value = valorInicial; inp.placeholder = '';
    document.getElementById('cdlg-input-wrap').style.display = 'block';
    document.getElementById('cdlg-cancel').style.display = '';
    const ov = document.getElementById('cdlg-ov');
    ov.classList.add('open');
    // Foco en el input, luego instala el trap
    setTimeout(() => {
      inp.focus();
      _installTrap(ov, () => window._cdlgRes(false));
    }, 80);
  });
}

// ─── EXPOSICIÓN GLOBAL (compatibilidad con onclick en HTML) ──────────────────
window.openM  = openM;
window.closeM = closeM;
window.showConfirm       = showConfirm;
window.showAlert         = showAlert;
window.showPromptConfirm = showPromptConfirm;
window.showPrompt        = showPrompt;

/**
 * Descuenta `mo` del fondo `fo`. Llama a updSaldo() al final.
 * @param {string} fo   - 'efectivo' | 'cuenta_N' | cualquier otro (→ banco genérico)
 * @param {number} mo   - Monto a descontar (positivo)
 */
export function descontarFondo(fo, mo) {
  if (fo === 'efectivo') {
    S.saldos.efectivo = Math.max(0, S.saldos.efectivo - mo);
  } else if (fo?.startsWith('cuenta_')) {
    const c = S.cuentas.find(x => x.id === +fo.split('_')[1]);
    if (c) {
      // Cuenta encontrada: descontar de ella y recalcular total banco
      c.saldo = Math.max(0, c.saldo - mo);
      S.saldos.banco = S.cuentas.reduce((s, c) => s + c.saldo, 0);
    } else {
      // ✅ FIX: cuenta eliminada — fallback a banco genérico en lugar de no hacer nada
      S.saldos.banco = Math.max(0, S.saldos.banco - mo);
    }
  } else {
    S.saldos.banco = Math.max(0, S.saldos.banco - mo);
  }
  window.updSaldo?.();
}

/**
 * Reintegra `mo` al fondo `fo` (reverso de descontarFondo). Llama a updSaldo().
 * @param {string} fo   - 'efectivo' | 'cuenta_N' | cualquier otro (→ banco genérico)
 * @param {number} mo   - Monto a reintegrar (positivo)
 */
export function reintegrarFondo(fo, mo) {
  if (fo === 'efectivo') {
    S.saldos.efectivo += mo;
  } else if (fo?.startsWith('cuenta_')) {
    const c = S.cuentas.find(x => x.id === +fo.split('_')[1]);
    if (c) {
      c.saldo += mo;
      S.saldos.banco = S.cuentas.reduce((s, c) => s + c.saldo, 0);
    } else {
      // ✅ FIX: cuenta eliminada — reintegrar al banco genérico
      S.saldos.banco += mo;
    }
  } else {
    S.saldos.banco += mo;
  }
  window.updSaldo?.();
}

window.descontarFondo  = descontarFondo;
window.reintegrarFondo = reintegrarFondo;