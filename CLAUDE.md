# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Finko Pro** is an offline-first PWA for personal finance management targeted at Colombian users. It is written in **vanilla JavaScript ES6 modules with no framework, no build step, and no external runtime dependencies**. The app runs directly in the browser; LocalStorage is the only persistence layer.

## Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run coverage

# Serve the app locally (no build required)
python -m http.server 8080
```

Tests live in `modules/tests/` and are configured in `modules/vitest.config.js` (environment: happy-dom, global utils enabled, setup file: `tests/setup.js`).

## Architecture

### State Management

All app state lives in a single mutable object `S` exported from `modules/state.js`. There is no reactivity layer — every mutation to `S` must be followed manually by a `save()` call (debounced 200 ms write to `localStorage` key `fco_v4`) and then re-render of the affected section.

```
mutation to S → save() → renderX() / updSaldo()
```

`storage.js` owns persistence: `loadData()` loads state on startup and applies up to 5 idempotent schema migrations. The storage key is `fco_v4`, current schema version is 5.

### Entry Point & Bootstrap

`index.html` is the app shell (all HTML structure lives here, including modals and forms). ES6 modules are preloaded via `<link rel="modulepreload">`. `modules/events.js` is the bootstrap orchestrator — it imports all domain modules and exposes ~140 functions to `window.*` so that `onclick=""` inline handlers in the HTML can call them.

### Navigation

Hash-based routing (`#dash`, `#gast`, `#compromisos`, etc.). `sections.js` handles `go(section)` calls, updates the active sidebar item, and lazy-loads `calculadoras.js` on first visit to that section.

### Rendering

No virtual DOM. Each domain module owns its own rendering via `innerHTML` string concatenation. `render.js` provides:
- `renderSmart(fn, key)` — skips re-render if section is not currently visible
- `updSaldo()` — recalculates and updates all balance displays
- `updateBadge()` — debt count badge in the navbar

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `state.js` | Singleton `S`, `resetAppState()` |
| `storage.js` | `save()`, `loadData()`, migrations |
| `constants.js` | Colombian constants: SMMLV 2026, UVT, usury rate, bank catalog, category emojis |
| `utils.js` | `f()` (currency format), `hoy()` (today's date), DOM helpers, modal dialogs, `he()` (HTML escape) |
| `render.js` | `renderSmart()`, `updSaldo()`, badge updates |
| `sections.js` | Hash routing, swipe handling, lazy-load for calculators |
| `events.js` | Bootstrap, global `window.*` bindings, service worker registration |
| `gastos.js` | Expense CRUD, budget semaphore (`actualizarSemaforo()`), "hormiga" impact calculator |
| `deudas.js` | Debt CRUD, avalanche/snowball payoff strategies |
| `ahorrado.js` | Savings pockets (bolsillos), "plato libre" free balance |
| `agenda.js` | Calendar UI, scheduled payments |
| `calculadoras.js` | Lazy-loaded: CDT, credit, compound interest, rule of 72 |
| `exports.js` | JSON/CSV/HTML backup and reporting |

### PWA / Service Worker

`service-worker.js` implements a cache-first strategy. It precaches all JS modules, CSS, icons, and the manifest. Changes to cached assets require bumping the cache version constant in the service worker.

## Known Bugs (Pre-Refactor)

**Bug A — Duplicate `save()` in `storage.js`:** Two function declarations exist (lines ~200 and ~232). This causes a `SyntaxError` on module load, breaking the app entirely. The old synchronous version (lines ~195–224) must be deleted; only the debounced version should remain.

**Bug B — Zombie calculator references in `events.js` (lines ~206–217):** References 11 functions (`cCDT`, `cCre`, etc.) that are never imported in `events.js`. These are correctly lazy-loaded in `sections.js`. These lines cause `ReferenceError` at runtime and must be deleted.

## Refactoring Roadmap (v5 Audit)

The current 28-module flat structure is being reorganized into a domain-driven layout:

```
modules/
├── core/       (state, constants, storage)
├── infra/      (utils, render, a11y)
├── ui/         (sections, events/bootstrap)
├── dominio/    (tesoreria, compromisos, ingresos, metas, analisis)
└── calculadoras.js  (lazy-loaded)
```

The migration from inline `onclick=""` handlers to `data-action=""` delegated events is planned for Phase 2, which will eliminate the need to expose functions on `window.*`.
