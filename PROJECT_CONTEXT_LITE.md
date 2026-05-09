# PROJECT_CONTEXT_LITE.md — Finko Pro

> Contexto ultra-comprimido para modelos pequeños. Para detalle, ver `PROJECT_CONTEXT.md`.

## Qué es
PWA offline-first de finanzas personales para **Colombia** (SMMLV, UVT, GMF, usura, PILA). Vanilla JS + ES Modules, **sin build**, sin framework. Despliegue Vercel estático. Persiste en `localStorage` con 3 snapshots rotativos.

## Stack
HTML + CSS (`@layer`) + JS ES Modules nativos · Service Worker · `localStorage` · Vitest + happy-dom (configurado, tests borrados) · Vercel estático.

## Arquitectura "Lean v6" — 6 módulos
```
modules/
  state.js              ← Estado S (Proxy) + save() + loadData() + constantes CO + EventBus
  main.js               ← Bootstrap + registry ACTIONS + delegación [data-action]
  finance.service.js    ← ExpenseService, AccountService, DebtService, PersonalLoanService, FinanceCalc
  planner.service.js    ← Compromisos, Objetivos, Tendencias, Score salud, Logros
  tools.service.js      ← FinanceTools puras (CDT, crédito francés, interés compuesto, Fisher, Regla 72, PILA)
  ui.manager.js         ← renderAll, openM/closeM, go(), toggleTheme, renderCDT/Credito
  educacion.js          ← ⚠ huérfano (nadie lo importa)
```

## Flujo
```
HTML[data-action] → main.js (delegate) → ACTIONS[name](args)
   → service muta S → save() (debounce 200ms → localStorage + snapshot)
   → renderAll() en ui.manager.js
```

## Estado S (campos)
`tipoPeriodo, quincena, ingreso, metodo, saldos:{efectivo,banco}, cuentas[], gastos[], objetivos[], deudas[], modoDeuda, historial[], gastosFijos[], agenda[], pagosAgendados[], inversiones[], fondoEmergencia:{objetivoMeses,actual}, bolsillos[], meDeben[], lastBackupAt, logros:{desbloqueados,vistos,rachas}`

Persistencia: `STORAGE_KEY = 'fco_v4'`, `CURRENT_VERSION = 7`, snapshots `fco_v4_snap_a/b/c`, undo `fco_v4_undo` (TTL 10min). Migraciones v0→v7 en `_migrar()`.

## Constantes Colombia 2026 (state.js)
`SMMLV_2026 = 1_750_905` · `UVT_2026 = 52_374` · `TASA_USURA_EA = 24.36` · `GMF_TASA = 0.004` · `GMF_EXENTO_UVT = 350` · `RETEFUENTE_CDT = 0.04` · `RETEFUENTE_AHORRO = 0.07` · `SALUD_INDEPEND = 0.125` · `PENSION_INDEPEND = 0.16` · `TOPE_DIAN_UVT = 1400`.

## Reglas de oro (CLAUDE.md)
1. **Cero DOM en servicios** (.service.js no usa `document.getElementById`/`innerHTML`).
2. **Mutar `S` directamente** + llamar `save()` después.
3. **UI solo desde `ui.manager.js`**.
4. **Acciones nuevas:** registrar en `main.js::ACTIONS` + agregar `data-action` en HTML.
5. **No crear archivos nuevos** salvo necesidad estricta.

## Qué abrir según tarea
| Tarea | Archivos |
|---|---|
| UI / vista | `index.html` → `ui.manager.js` → `style.css` |
| Botón nuevo | `main.js` (ACTIONS) + `index.html` (`data-action`) + servicio |
| Gastos/Cuentas/Bolsillos/Deudas | `finance.service.js` → `state.js` |
| Metas/Compromisos/Score | `planner.service.js` → `state.js` |
| Calculadoras (CDT, crédito…) | `tools.service.js` (puro) → `ui.manager.js` |
| Persistencia/migración | `state.js` |
| Offline/PWA | `service-worker.js` ⚠ |
| Constantes CO | `state.js` líneas 9-31 |
| Tema/estilos | `style.css` + `toggleTheme/applyTheme` |
| Onboarding | `index.html#m-onboarding` + `main.js` (`window.nextOnboardingStep`) |

## Bugs/deuda técnica conocida (no inventar arreglos sin contexto)
1. 🔴 **`service-worker.js::PRECACHE_ASSETS` lista rutas borradas** (`modules/core/*`, `modules/dominio/*`, `modules/infra/*`, `modules/ui/*`, `modules/calculadoras.js`). Offline roto en instalación nueva. Reemplazar por las 6 rutas reales.
2. 🔴 **`S.metas` referenciado** pero el campo es `S.objetivos` (en `main.js:298` y `ui.manager.js:318`).
3. 🟡 **`finance.service.js::AccountService.agregarCuenta` lee del DOM** (viola "cero DOM").
4. 🟡 **`planner.service.js::actualizarScoreUI/calcularPrediccion`** manipulan DOM (deberían vivir en `ui.manager.js`).
5. 🟡 **`PersonalLoanService` lee `S.prestamosRecibidos/Otorgados`** que no existen en `resetAppState()`.
6. 🟡 **Tests `tests/unit/*.test.js` fueron borrados** pero `npm test` y CI siguen activos.
7. 🟡 **Changelog del SW (v4→v56)** documenta 310 líneas de features que ya no existen.
8. 🟡 **`style.css` tiene duplicaciones** (`@layer` y bloques `body`/`.card` con `}` huérfano).
9. 🟢 **`modules/educacion.js` huérfano** (no importado).
10. 🟢 **`modules/vitest.config.js`** debería estar en raíz, no dentro de `/modules`.
11. 🟢 **`pureimage` en `package.json`** no se usa.
12. 🟢 **`opencode.json` vacío**.
13. 🟢 **Handlers duplicados en main.js**: `toggleDesgloseHero`, `toggleBolsillosHero`.

## Mapa de servicios (qué hace qué)

**ExpenseService** (`finance.service.js`):
`agregar, eliminar, editar, limpiarPeriodo, calcularTopHormigas(mes,limit=3), detectarDuplicado(5min), detectarAtipico(≥4× promedio cat 30d, mín 3 muestras)`

**AccountService**: `agregarCuenta, eliminarCuenta, actualizarCuenta, agregarBolsillo, abonarBolsillo, retirarBolsillo`

**DebtService**: `agregarDeuda, pagarCuota, eliminarDeuda`

**PersonalLoanService**: `agregarRecibido, agregarOtorgado, abonarPrestamo`

**FinanceCalc**: `getSaldoTotal, getResumenMes(mesISO), generarConsejo, getFinancialScore` (0-100)

**Planner (planner.service.js)**:
- Compromisos: `proximoPago, agregarCompromiso, eliminarCompromiso, getCompromiso, getCompromisosActivos, getProximosPagos(7d), getCompromisosVencidos`
- Objetivos: `agregarObjetivo, eliminarObjetivo, getObjetivo, progressObjetivo`
- Score: `calcularGastosFijosMes, actualizarScoreUI` (atrasos25 + ahorro25 + fondo15 + deudas15 + backup10 + hormiga5 = 100)
- Otros: `getTendencias(meses=3), calcularPrediccion(30/60/90d), verificarLogros`
- Aliases: `GoalService, AgendaService, FixedExpenseService, AnalysisService`

**FinanceTools (tools.service.js, puro)**:
- `calcCDT(capital, tasaEA, dias, retencion)` — capitalización compuesta por días
- `calcCredito(monto, tasaMensualPct, n)` — sistema francés
- `calcInteresCompuesto(capital, aporte, tasaEA, meses)` — anualidad VF
- `calcRentabilidadReal(capital, tasaPct, inflacionPct)` — Fisher
- `calcRegla72(tasaPct)` — aprox + exacto
- `calcPILA(ingreso, arl=0.00522)` — IBC = max(40%·ing, 1 SMMLV)

## Convenciones
- IDs DOM: kebab-case con prefijo (`d-tot`, `g-de`, `cu-banco`, `m-fondo-emergencia`).
- Acciones: `data-action="nombre" data-arg-X="val"` → handler `({X}) => ...` en `ACTIONS`.
- Servicios: PascalCase + `Service`. Constantes: UPPER_SNAKE_CASE.
- CSS variables: `--a1`, `--t1..t3`, `--s1..s3`, `--b1..b3`, `--ff`, `--fm`, `--dan`.
- Tema: clase `body.dark-theme` / `body.light-theme` + `localStorage('finko_theme')`.
- a11y: `[role]`, `aria-label`, `aria-live="polite"` en `#sr-announcer`, helper `sr(msg)`.

## Comandos
```
npm test           # vitest run (⚠ no hay tests actualmente)
npm run test:watch # vitest
npm run coverage   # vitest run --coverage
```
Servir local sin build: `python -m http.server 8080`.

## Documentos
- `README.md` (28 L) — humano.
- `CLAUDE.md` (26 L) — reglas para LLM.
- `PROJECT_CONTEXT.md` — contexto completo (este es el LITE).
- `DASHBOARD_REDESIGN.md` (1429 L) — plan UX futuro de 10 fases, **no ejecutado**.
