// ─── SISTEMA DE DELEGACIÓN data-action ─────────────────────────────────────
// Extraído de ui/events.js para romper la dependencia circular:
//   dominio/X.js → ui/events.js → dominio/X.js
//
// Ahora los módulos de dominio importan `registerAction` desde aquí (un módulo
// hoja sin imports de dominio), y events.js sigue siendo el orquestador que
// conecta todo. Sin ciclos.
//
// El listener `document.addEventListener('click', …)` se instala una sola vez
// al cargar este módulo; los `registerAction(name, fn)` de cada dominio
// alimentan el Map al evaluar sus respectivos módulos.

const ACTIONS = new Map();

export function registerAction(name, fn) {
  ACTIONS.set(name, fn);
}

// Delegación global de clicks — sólo si hay DOM (tests/SSR caen al else).
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-action]');
    if (!el) return;

    const action = el.dataset.action;
    const fn = ACTIONS.get(action);

    if (!fn) {
      console.warn('Acción no registrada:', action);
      return;
    }

    // Extraer argumentos de data-arg-*
    const args = {};
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('data-arg-')) {
        const key = attr.name.replace('data-arg-', '');
        args[key] = attr.value;
      }
    });

    fn(args, el, e);
  });
}

// Hook reservado para futuras inicializaciones de acciones desde módulos.
export function initActions() {
  // Los módulos llaman registerAction() en su top-level — nada que hacer aquí.
}
