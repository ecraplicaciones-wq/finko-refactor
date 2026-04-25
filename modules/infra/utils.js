import { FOCUSABLE_SEL, getFocusable, installTrap, removeTrap } from './a11y.js';

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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

// ─── MODALES ─────────────────────────────────────────────────────────────────
// ✅ I5 (auditoría v5): _lastFocused era una sola variable; si se abrían
// modales anidados el disparador del modal externo se perdía al abrir el
// interno. Ahora es un stack paralelo al de installTrap → cada openM apila
// el activeElement y closeM lo desapila al restaurar el foco.
const _focusStack = [];

export function openM(id) {
  _focusStack.push(document.activeElement);
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  requestAnimationFrame(() => {
    const focusable = modal.querySelector(FOCUSABLE_SEL);
    if (focusable) focusable.focus();
    // Instala el trap DESPUÉS de mover el foco inicial para evitar
    // que el propio focus() dispare el handler prematuramente.
    installTrap(modal, () => closeM(modal.id));
  });
}

export function closeM(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  // Libera el trap antes de restaurar el foco para que el evento
  // de foco saliente no sea interceptado por el handler.
  removeTrap();
  const prevFocus = _focusStack.pop();
  if (prevFocus && typeof prevFocus.focus === 'function') {
    prevFocus.focus();
  }
}

// ─── DIÁLOGOS ASÍNCRONOS ─────────────────────────────────────────────────────
let _cdlgResolve = null;
let _cdlgPromptMode = false;
let _cdlgExpected = null;

// Expuesto en window porque el HTML llama a _cdlgRes(true/false) inline
if (typeof window !== 'undefined') {
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
    removeTrap();
    if (_cdlgPromptMode) {
      const v = document.getElementById('cdlg-input').value;
      if (_cdlgResolve) _cdlgResolve(ok ? v : null);
    } else {
      if (_cdlgResolve) _cdlgResolve(ok);
    }
    _cdlgResolve = null;
  };
}

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
      const first = getFocusable(ov)[0]; if (first) first.focus();
      installTrap(ov, () => window._cdlgRes(false));
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
      const first = getFocusable(ov)[0]; if (first) first.focus();
      installTrap(ov, () => window._cdlgRes(true));
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
      installTrap(ov, () => window._cdlgRes(false));
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
      installTrap(ov, () => window._cdlgRes(false));
    }, 80);
  });
}

// ─── EXPOSICIÓN GLOBAL (compatibilidad con onclick en HTML) ──────────────────
if (typeof window !== 'undefined') {
  window.openM  = openM;
  window.closeM = closeM;
  window.showConfirm       = showConfirm;
  window.showAlert         = showAlert;
  window.showPromptConfirm = showPromptConfirm;
  window.showPrompt        = showPrompt;
}

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
  if (typeof window !== 'undefined') window.updSaldo?.();
}

if (typeof window !== 'undefined') {
  window.descontarFondo  = descontarFondo;
  window.reintegrarFondo = reintegrarFondo;
}