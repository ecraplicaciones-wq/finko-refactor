// tests/setup.js
// Polyfills para que los módulos de Finko Pro funcionen en el entorno de test.
// utils.js usa `window` en el nivel raíz — happy-dom lo provee, pero necesita
// estar disponible como global de Node antes de que se importen los módulos.

import { vi } from 'vitest';

// happy-dom expone window pero a veces Node lo necesita como global explícito
if (typeof global.window === 'undefined') {
  global.window = globalThis;
}

if (typeof global.document === 'undefined') {
  global.document = globalThis.document ?? {
    getElementById: () => null,
    createElement:  () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
    body:           { appendChild: () => {} },
    activeElement:  null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
}

// navigator.onLine existe en happy-dom pero lo aseguramos
if (typeof global.navigator === 'undefined') {
  global.navigator = { onLine: true };
}