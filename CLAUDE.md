# CLAUDE.md

> **Última revisión:** 2026‑05‑07. Documento alineado con la nueva colección de planos en raíz (`README.md`, `AUDIT.md`, `ARCHITECTURE.md`, `REORG_HTML.md`, `REORG_CSS.md`, `REORG_JS.md`, `DESIGN_SYSTEM.md`, `FINANCIAL_LOGIC_CO.md`, `ROADMAP.md`).

This file provides guidance to Claude Code (claude.ai/code), Cursor, Copilot y otros asistentes IA al trabajar con este repositorio.

**Antes de tocar código, leé en este orden:**

1. `README.md` (3 min) — qué hace la app y cómo se corre.
2. `ARCHITECTURE.md` (10 min) — capas, flujo de datos, reglas innegociables.
3. `AUDIT.md` (10 min) — estado real, deuda técnica, métricas baseline.
4. `ROADMAP.md` (5 min) — fases ordenadas y dependencias.
5. El `REORG_*.md` o `DESIGN_SYSTEM.md` o `FINANCIAL_LOGIC_CO.md` específico de la fase activa.

## Project Overview

**Finko Pro** es una PWA offline‑first para gestión financiera personal en Colombia. Vanilla JavaScript ES6 modules, **sin framework, sin build step, sin dependencias en runtime**. La app corre directamente en el navegador; `localStorage` (clave `fco_v4`, schema v5) es la única capa de persistencia.

## Comandos

```bash
# Tests (Vitest + happy-dom)
npm test
npm run test:watch
npm run coverage

# Servir la app localmente
python -m http.server 8080
```

Tests viven en `tests/unit/`. Configuración en `modules/vitest.config.js`. Setup en `tests/setup.js`.

## Arquitectura (resumen — detalle en `ARCHITECTURE.md`)

### Estado

Singleton mutable `S` exportado por `modules/core/state.js`. Sin reactivity. Toda mutación de `S` debe ir seguida manualmente por `save()` (debounced 200 ms) y un `renderX()` o `updSaldo()`.

```
mutación de S → save() → renderX() / updSaldo()
```

`modules/core/storage.js` posee la persistencia y aplica 5 migraciones idempotentes en `loadData()`.

### Entry point

`index.html` es el shell (toda la estructura HTML, modales y formularios). Los módulos ES6 se precarguan con `<link rel="modulepreload">`. `modules/ui/events.js` es el bootstrap: importa todos los dominios y registra acciones para el sistema delegado `data-action`.

**Métricas baseline (2026‑05‑07):**

- 0 `onclick=""` (✅ migración completa).
- 156 `data-action=""`.
- 208 atributos ARIA.
- 341 `style="..."` inline (target v5: < 60).
- 74 asignaciones `window.X = …` en `events.js`; 210 en todo `modules/` (target v5: ≤ 16 y < 30).

### Navegación

Hash routing (`#dash`, `#gast`, `#compromisos`, …). `modules/ui/shell.js` maneja `go(section)`, actualiza la sidebar activa y lazy‑loadea `modules/calculadoras.js` en la primera visita.

### Render

Sin virtual DOM. Cada dominio genera su HTML con `innerHTML`. `modules/infra/render.js` provee:

- `renderSmart(fn, key)` — evita re‑render si la sección no es visible.
- `updSaldo()` — recalcula saldo total y actualiza los displays.
- `updateBadge()` — contador de deudas en navbar.
- `renderAll()` — orquestador.

### Módulos por capa

| Capa | Archivos |
|---|---|
| `modules/core/` | `state.js`, `storage.js`, `constants.js` |
| `modules/infra/` | `utils.js`, `render.js`, `a11y.js` |
| `modules/ui/` | `events.js` (bootstrap), `shell.js` (navegación, tema), `actions.js` (delegador `data-action`) |
| `modules/dominio/` | `ingresos.js`, `compromisos.js`, `tesoreria.js`, `metas.js`, `analisis.js`, `exports.js`, `personales.js` |
| `modules/calculadoras.js` | Lazy: CDT, crédito, interés compuesto, regla 72, prima |

> **v5 Plan:** los 4 dominios > 1.500 LOC (`analisis`, `compromisos`, `ingresos`, `tesoreria`) se particionan en sub‑carpetas. Detalle en `REORG_JS.md`.

### PWA / Service Worker

`service-worker.js` implementa cache‑first. Precachea todos los JS, CSS, íconos y manifest. **Bumpear la constante `CACHE_NAME` cada vez que cambien assets** o el SW servirá la versión vieja.

## Reglas innegociables (ADN del proyecto)

1. **Vanilla JS sin build step.** Nada de TypeScript, bundlers, frameworks.
2. **Offline‑first.** El SW garantiza que la app funcione sin red.
3. **Sin servidor.** No hay backend, cuentas ni sync. Privacidad absoluta.
4. **Singleton `S` mutable.** No agregar reactivity.
5. **`save()` debounced.** No hacer escrituras inmediatas a `localStorage`.
6. **Migraciones idempotentes.** Cada bump de schema sube datos sin romper backward‑compat.
7. **`data-action` delegado.** En HTML estático, **0 `onclick`**. Dinámico: en migración a `data-action`.
8. **Lenguaje del usuario.** "Tu plata" antes que "Saldo disponible".
9. **Constantes legales vivas.** Tasa de usura trimestral; revisión obligatoria. Detalle en `FINANCIAL_LOGIC_CO.md`.

Tocar cualquiera de estas reglas exige discusión explícita con el dueño del repo.

## Estado actual y siguiente paso

- Versión vigente: v4.x estable (1.311 tests verdes).
- Siguiente hito: v5.0 — reorganización + UX moderna + lógica financiera avanzada.
- Plan completo: `ROADMAP.md`.
- Tag baseline: `v4.x-baseline` (capturado el 2026‑05‑07).
- Métricas baseline en: `docs/baseline/`.

## Convenciones

- **Naming:** dominios en español neutro (`ingresos`, `compromisos`, …); infra/ui en inglés (`state`, `storage`, `events`, `actions`).
- **Imports:** siempre con extensión `.js`; rutas relativas con `../`; sin path mapping.
- **Commits:** `tipo(área): descripción corta`. Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`.
- **Tests:** verdes obligatorios antes de commitear.
- **Para agentes IA:** preguntar antes de hacer cambios destructivos (eliminar archivos, force push, reescribir historial).
