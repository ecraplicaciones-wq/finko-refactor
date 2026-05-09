# PROJECT_CONTEXT.md — Finko Pro (Refactor Lean v6)

> Documento maestro de contexto generado para minimizar el consumo de tokens en sesiones LLM.
> Idioma: español. Identificadores, rutas y comandos en su forma original.
> Última auditoría: 2026-05-04.

---

## 1. Resumen general

**Propósito.** Finko Pro es una **PWA offline-first** de finanzas personales orientada al contexto **colombiano** (SMMLV, UVT, GMF/4×1000, tasa de usura, PILA independientes). Permite registrar gastos/ingresos, gestionar cuentas y bolsillos, planificar metas y compromisos, calcular instrumentos (CDT, crédito en sistema francés, interés compuesto, Regla 72) y obtener un score de salud financiera.

**Stack.**
- **Vanilla JS (ES Modules)** — sin framework, sin bundler, sin build step.
- **HTML estático** — `index.html` único de 2125 líneas con todas las secciones y modales.
- **CSS vanilla** con `@layer` (CSS Cascade Layers).
- **PWA**: `service-worker.js` + `manifest.json` (icons en `icons/`).
- **Persistencia**: `localStorage` (clave `fco_v4`) + 3 snapshots rotativos + 1 snapshot de undo.
- **Tests**: Vitest + happy-dom (configurado, pero **los tests fueron borrados** en este refactor — ver Sección 6).
- **Despliegue**: Vercel como sitio estático (`vercel.json`: `"framework": null, "buildCommand": null, "outputDirectory": "."`).

**Arquitectura.** "Lean v6": 6 archivos core dentro de `modules/`, con separación estricta de responsabilidades: estado/persistencia, lógica de dinero, lógica de planificación, fórmulas matemáticas y capa UI. La regla declarada (CLAUDE.md) es **cero manipulación del DOM en servicios**.

**Versión declarada vs realidad.** `package.json` declara `"version": "4.2.0"`. README habla de "v6 lean architecture". `service-worker.js` cachea con `CACHE_NAME = 'finko-pro-v56'`. El changelog del SW documenta historia v4→v56 que ya no aplica al estado actual del código (ver Sección 6).

---

## 2. Estructura del proyecto

```
Finko-Refactor/
├── .claude/                         # Config local de Claude Code (ignorada en Vercel)
│   ├── launch.json
│   └── settings.local.json          # Permisos de bash autoaprobados
├── .github/
│   └── workflows/
│       ├── ci.yml                   # CI: tests Vitest + lint en Node 18.x/20.x
│       └── test.yml
├── .gitignore                       # node_modules/, coverage/, .env, dist/, build/
├── .vercelignore                    # Excluye node_modules, tests, *.md y CLAUDE.md
├── CLAUDE.md                        # Guía para LLMs (arquitectura + reglas de oro)
├── DASHBOARD_REDESIGN.md            # Plan UX/UI futuro de 10 fases (1429 líneas, NO ejecutado)
├── PROJECT_CONTEXT.md               # ← ESTE archivo
├── PROJECT_CONTEXT_LITE.md          # Versión ultra-comprimida para modelos pequeños
├── README.md                        # Descripción humana del proyecto
├── icons/                           # PNGs del manifest PWA (72→512, maskable, screenshot)
├── index.html                       # Único HTML de la app (2125 líneas)
├── manifest.json                    # PWA manifest (lang es-CO, theme #00dc82)
├── modules/                         # ★ TODO el JavaScript de la app
│   ├── educacion.js                 # ⚠ módulo huérfano (no importado por nadie)
│   ├── finance.service.js           # Gastos, Cuentas, Bolsillos, Deudas, Préstamos
│   ├── main.js                      # Bootstrap + registry de ACTIONS + event delegation
│   ├── planner.service.js           # Metas, Compromisos, Tendencias, Score, Logros
│   ├── state.js                     # Estado S (Proxy) + persistencia + constantes CO
│   ├── tools.service.js             # Calculadoras puras (CDT, crédito, interés, etc.)
│   ├── ui.manager.js                # Render, modales, navegación, tema
│   └── vitest.config.js             # ⚠ Vitest config dentro de /modules (ubicación rara)
├── node_modules/                    # Dependencias (Vitest, happy-dom, pureimage)
├── opencode.json                    # ⚠ archivo vacío
├── package.json                     # name "finko-pro", v4.2.0, type "module"
├── package-lock.json
├── service-worker.js                # SW v56 — ⚠ PRECACHE_ASSETS apunta a rutas obsoletas
├── style.css                        # 2238 líneas, sistema de @layer CSS
├── tests/
│   └── setup.js                     # Polyfills happy-dom para Vitest
└── vercel.json                      # framework null, sin build
```

**Carpetas eliminadas en este refactor (visibles en `git status`):**
- `modules/core/`, `modules/dominio/`, `modules/infra/`, `modules/ui/` → consolidadas en los 6 archivos planos.
- `modules/calculadoras.js` → mergeado en `tools.service.js`.
- `tests/unit/*.test.js` → 12 tests borrados (analisis, calculadoras, compromisos, exports, ingresos, metas, migrations, personales, state, storage, tesoreria, utils).
- Archivos MD legacy: `Claude_Code_Primera_Vez.md`, `DEVELOPMENT_ROUTINE.md`, `Finko_Pro_Auditoria_v5.md`, `Finko_Pro_Auditoria_v5_Reorganizacion.md`, `Finko_Pro_Claude_Code_Plan.md`, `QUICK_START.md`, `dev-routine.sh`.

---

## 3. Archivos clave

### 3.1. `modules/state.js` — Estado, persistencia y constantes CO 🔴 Alta

- **Líneas:** 409.
- **Exporta:**
  - **Constantes Colombia 2026:** `SMMLV_2026 = 1_750_905`, `UVT_2026 = 52_374`, `TOPE_DIAN_UVT = 1400`, `TOPE_DIAN`, `TASA_USURA_EA = 24.36`, `GMF_TASA = 0.004`, `GMF_EXENTO_UVT = 350`, `GMF_EXENTO_MONTO`, `SALUD_INDEPEND = 0.125`, `PENSION_INDEPEND = 0.16`, `RETEFUENTE_CDT = 0.04`, `RETEFUENTE_AHORRO = 0.07`.
  - **Mapas:** `CONST_MAP` (para `data-const` en HTML), `CATS` (categorías de gasto con emoji), `PCATS` (categorías de viaje), `CCOLORS`, `NAVS`, `LOGROS` (13 achievements), `BANCOS_CO` (17 bancos colombianos con icono y color).
  - **Estado reactivo:** `S` — Proxy mutable que emite eventos `state:changed` por `EventBus` vía microtask. `EventBus.on/emit` (CustomEvent en `document`).
  - **Persistencia:** `STORAGE_KEY = 'fco_v4'`, `CURRENT_VERSION = 7`, `SNAPSHOT_KEYS` (3 slots `fco_v4_snap_a/b/c`), `UNDO_KEY`, `UNDO_TTL_MS = 10*60*1000`.
  - **Funciones:** `save()` (debounce 200ms), `loadData()` (con fallback a snapshots), `resetAppState()`, `medirUso()`, `archivarHistorialAntiguo()`, `verificarEspacio()`, `_migrar()` (migraciones v0→v7), `seleccionarMejorSnapshot()`, `guardarUndoSnapshot()`, `restaurarUndo()`, `inyectarConstantes()` (rellena `[data-const]` en DOM), `verificarVigenciaConstantes()`.
- **Forma de S (campos clave):** `tipoPeriodo`, `quincena`, `ingreso`, `metodo`, `saldos: { efectivo, banco }`, `cuentas[]`, `gastos[]`, `objetivos[]`, `deudas[]`, `modoDeuda`, `historial[]`, `gastosFijos[]`, `agenda[]`, `pagosAgendados[]`, `inversiones[]`, `fondoEmergencia: { objetivoMeses, actual }`, `bolsillos[]`, `meDeben[]`, `lastBackupAt`, `logros: { desbloqueados, vistos, rachas }`.
- **Auto-flush:** `visibilitychange` (hidden) y `beforeunload` fuerzan `_flushSave()`.

### 3.2. `modules/main.js` — Orquestador 🔴 Alta

- **Líneas:** 536.
- **Patrón:** Registry de acciones `ACTIONS = { 'nombre': handler }`. Un único listener delegado en `document.addEventListener('click', ...)` lee `[data-action]` y `[data-arg-*]` del HTML y dispatcha.
- **Acciones registradas (~40):** `go`, `openM`, `closeM`, `toggleTheme`, `toggleSidebar`, `toggleMas`, `closeMas`, `toggleDashCard`, `toggleDesgloseHero`, `toggleBolsillosHero`, `toggleFijoInline`, `editEfectivoDash`, `agregarGasto`, `agregarGastoRapido`, `agregarIngresoRapido`, `delGasto`, `editarGasto`, `limpiarGastos`, `aplicar4k`, `setFiltroGasto`, `guardarFijo`, `agregarCuenta`, `eliminarCuenta`, `editCuenta`, `guardarEditCuenta`, `deleteCuenta`, `fillMonto`, `agregarBolsillo`, `abonarBolsillo`, `calcCDT`, `calcCre`, `agregarDeuda`, `pagarDeuda`, `agregarMeta`, `abonarMeta`, `openNuevoObjetivo`, `agregarFijo`, `pagarFijo`, `setPer`, `selM`, `guardarQ`, `registrarAbonoFondo`, `guardarMetaFondo`, `toggleThemeAndClose`.
- **`bootstrap()`** (async): `loadData()` → `inyectarConstantes()` → `verificarVigenciaConstantes()` → `initTheme()` → `initCloseSidebarOnClickOutside()` → expone funciones globales en `window.*` (compatibilidad con `onclick=""` del HTML, ej. `window.guardarGasto`, `window.guardarCuenta`, `window.guardarFijo`, `window.guardarDeuda`, `window.confPagarCuota`, `window.guardarObjetivo`, `window.cCDT`, `window.cCre`, `window.cInf`, `window.cR72`) → registra delegación global → `go('dash')` → muestra onboarding si no hay flag `finko_onboarded`.
- **Onboarding:** funciones globales `window.nextOnboardingStep(step)` y `window.finishOnboarding()` con 3 pasos (efectivo+banco → ingreso → resumen+acciones).
- **⚠ Inconsistencia:** se referencia `S.metas` en algunos handlers, pero el state usa `S.objetivos`. Hay handlers duplicados (`toggleDesgloseHero`, `toggleBolsillosHero` aparecen 2 veces).

### 3.3. `modules/finance.service.js` — Motor de dinero 🔴 Alta

- **Líneas:** 372.
- **Importa:** `S, save, GMF_TASA, SMMLV_2026` desde `./state.js`.
- **Helpers exportados:** `descontarFondo(fondoId, monto)`, `reintegrarFondo(fondoId, monto)` — operan sobre `S.bolsillos`.
- **`ExpenseService`:** `agregar(data)`, `eliminar(id)`, `editar(id, data)`, `limpiarPeriodo()`, `calcularTopHormigas(mesISO, limit)`, `detectarDuplicado(candidato)` (ventana 5 min), `detectarAtipico(candidato)` (≥4× promedio cat 30d, mín 3 muestras).
- **`AccountService`:** `agregarCuenta(data)`, `eliminarCuenta(id)`, `actualizarCuenta(id, data)`, `agregarBolsillo(data)`, `abonarBolsillo(id, monto)`, `retirarBolsillo(id, monto)`. **⚠ Viola la regla "cero DOM" en `agregarCuenta` (líneas 162-165): `document.getElementById(...)` como fallback.**
- **`DebtService`:** `agregarDeuda(data)`, `pagarCuota(id, monto)`, `eliminarDeuda(id)`.
- **`PersonalLoanService`:** `agregarRecibido(data)`, `agregarOtorgado(data)`, `abonarPrestamo(id, monto, tipo)`. **⚠ Lee `S.prestamosRecibidos` y `S.prestamosOtorgados` que NO están inicializados en `resetAppState()` — fallaría con `undefined` si se llama sin estado previo.**
- **`FinanceCalc`:** `getSaldoTotal()`, `getResumenMes(mesISO)` (calcula tG, tA, tH, tN, tD, balance, pcts, topCats), `generarConsejo(r)` (mensajes contextuales por % hormiga/gasto), `getFinancialScore()` (0-100, niveles excelente/aceptable/malo/critico).

### 3.4. `modules/planner.service.js` — Planificación y salud 🔴 Alta

- **Líneas:** 316.
- **Importa:** `S, save, LOGROS` desde `./state.js`.
- **Funciones puras y de estado:**
  - **Compromisos (frecuencia mensual/quincenal/semanal):** `proximoPago(c)`, `agregarCompromiso(c)` (genera id con `crypto.randomUUID()`), `eliminarCompromiso(id)`, `getCompromiso(id)`, `getCompromisosActivos()`, `getProximosPagos(dias=7)`, `getCompromisosVencidos()`.
  - **Objetivos/Metas:** `agregarObjetivo(obj)`, `eliminarObjetivo(id)`, `getObjetivo(id)`, `progressObjetivo(id)`.
  - **Tendencias:** `getTendencias(meses=3)` (devuelve array por mes con ingreso/gasto/balance/tendencia).
  - **Salud financiera:** `calcularGastosFijosMes()`, `actualizarScoreUI()` (6 componentes: atrasos 25 + ahorro 25 + fondo 15 + deudas 15 + backup 10 + hormiga 5), `calcularPrediccion()` (proyección 30/60/90 días), `calcularSaludFinanciera(hoyISO)`.
  - **Logros:** `verificarLogros()` (chequea contra LOGROS y agrega a `S.logros.desbloqueados`).
- **Aliases para compatibilidad con main.js:** `GoalService`, `AgendaService`, `FixedExpenseService`, `AnalysisService`.
- **⚠ Viola la regla "cero DOM":** `actualizarScoreUI()` y `calcularPrediccion()` manipulan `document.getElementById('score-num'/'score-label'/'score-arco'/'score-tip-text'/'prediccion-texto')`. Conceptualmente deberían vivir en `ui.manager.js`.

### 3.5. `modules/tools.service.js` — Calculadoras puras 🟢 Media

- **Líneas:** 90.
- **Importa:** `RETEFUENTE_CDT, SMMLV_2026, SALUD_INDEPEND, PENSION_INDEPEND` desde `./state.js`.
- **`FinanceTools` (objeto único exportado):**
  - `calcCDT(capital, tasaEA, dias, retencion)` — `C × ((1+tasaEA)^(dias/365) − 1)` con neto post-retefuente y rendimiento mensual.
  - `calcCredito(monto, tasaMensualPct, n)` — sistema francés `M = P · i(1+i)^n / ((1+i)^n − 1)`, retorna {cuota, totalPagado, totalInteres, taEA}.
  - `calcInteresCompuesto(capital, aporte, tasaEA, meses)` — anualidad VF.
  - `calcRentabilidadReal(capital, tasaPct, inflacionPct)` — Fisher.
  - `calcRegla72(tasaPct)` — aproximación 72/i + cálculo exacto log(2)/log(1+r).
  - `calcPILA(ingreso, arl=0.00522)` — IBC = max(40% ing, 1 SMMLV); salud + pensión + ARL.
- ✅ **100% pura, sin DOM ni estado.** Este es el módulo modelo.

### 3.6. `modules/ui.manager.js` — Capa de presentación 🔴 Alta

- **Líneas:** 500.
- **Importa:** `S, EventBus, TASA_USURA_EA, RETEFUENTE_CDT` (state); `FinanceCalc` (finance); `FinanceTools` (tools); `actualizarScoreUI, calcularPrediccion, getProximosPagos` (planner).
- **Utilidades de formato:** `f(val)` (Intl COP), `he(txt)` (escape HTML), `getIconoBanco(banco)` con mapa `ICONOS_BANCO` (17 bancos), `hoy()`, `mesStr()`, `setEl(id, val)`, `setHtml(id, html)`, `sr(msg)` (screen reader announcer).
- **Modales:** `openM(id)` (cierra todos los `.modal-ov` y abre el solicitado; pobla `m-fondo-emergencia/meta` si corresponde), `closeM(id)`, `showAlert(msg, title)` (Promise), `showConfirm(msg, title)` (Promise).
- **Renders:** `renderAll()` → `renderDashboard, renderGastos, renderCuentas, renderMetas, renderDeudas, renderAgenda`. Sub-renders: `renderFondoEmergenciaDash`, `renderProximos`. Calculadoras: `renderCDT`, `renderCredito` (incluye alerta de **tasa de usura**).
- **Navegación:** `go(sec)` cambia `.active` entre `<section id="sec-...">` y botones `[data-section]`. `initCloseSidebarOnClickOutside()`.
- **Tema:** `toggleTheme`, `applyTheme`, `initTheme` con persistencia en `localStorage('finko_theme')` — alterna `body.dark-theme`/`body.light-theme` y emojis ☀️/🌙.
- **⚠ Bugs detectados:** `renderMetas()` lee `S.metas` (no existe; debería ser `S.objetivos`). `renderAgenda()` muestra placeholder ("Calendario en construcción").

### 3.7. `modules/educacion.js` — Strings educativos 🟢 Baja (módulo huérfano)

- **Líneas:** 49.
- **Exporta:** `EDUCACION` con 6 entradas (`fondoEmergencia`, `gastosHormiga`, `metodo5030`, `cuatroXMil`, `tasaUsura`, `bolsillo`) — cada una con `titulo`, `descripcion`, `ejemplo`, opcional `tip`, `fuentes`.
- **⚠ NADIE LO IMPORTA.** No aparece en main.js, ui.manager.js, ni en CLAUDE.md/README. Candidato a integrar (tooltips/modales educativos) o eliminar.

### 3.8. `index.html` — Único HTML 🔴 Alta

- **Líneas:** 2125. Contiene **todas** las secciones (`<section id="sec-dash|gast|agenda|deudas|meDeben|alcancias|inve|stat|quin">`) y **todos los modales** (`<div class="modal-ov" id="m-...">`).
- **Patrones:**
  - **`data-action="..."` + `data-arg-*="..."`** (~173 ocurrencias) → delegado por main.js.
  - **`data-section="..."`** (14) → highlight del nav.
  - **`onclick="..."`** → quedan algunos en onboarding/tema (compatibilidad legacy con `window.*`).
  - **`[data-const="..."]`** → relleno automático con valores de `CONST_MAP`.
  - **`aria-live`, `aria-label`, `role`** ampliamente usados (a11y trabajada).
- **Carga del JS:** un único `<script type="module" src="./modules/main.js">` al final del body. ES Modules nativos, sin bundler.
- **Service Worker:** auto-registro en `<script>` previo, con limpieza de SW stale y mensaje `SKIP_WAITING`.

### 3.9. `service-worker.js` — PWA cache 🟡 Media (con problemas)

- **Líneas:** 557. **⚠ La cabecera tiene un changelog v4→v56** (~310 líneas de comentarios) que documenta features que ya **no existen** en el código actual (todos los detectores de v12-v37 vivían en `modules/dominio/*` que fue borrado).
- **Estrategia:** `network-first` para `.html/.js/.css/manifest.json` (con fallback a caché y a `index.html` para navegación), `stale-while-revalidate` para todo lo demás. Filtra Google Fonts.
- **`CACHE_NAME = 'finko-pro-v56'`**.
- **🔴 BUG GRAVE:** `PRECACHE_ASSETS` (líneas 325-363) lista **rutas que NO EXISTEN** post-refactor:
  - `./modules/core/state.js`, `./modules/core/storage.js`, `./modules/core/constants.js`
  - `./modules/infra/utils.js`, `./modules/infra/a11y.js`, `./modules/infra/render.js`
  - `./modules/ui/actions.js`, `./modules/ui/shell.js`, `./modules/ui/events.js`
  - `./modules/dominio/*` (analisis, compromisos, exports, ingresos, metas, personales, tesoreria)
  - `./modules/calculadoras.js`
  
  La instalación del SW no falla porque usa `Promise.allSettled`, pero **no precachea ningún módulo JS real** → el modo offline queda roto en cualquier instalación nueva. **Debe actualizarse a las 6 rutas reales: `modules/{state,main,finance.service,planner.service,tools.service,ui.manager}.js`**.

### 3.10. `style.css` — Estilos 🟡 Media

- **Líneas:** 2238. Usa **CSS Cascade Layers** (`@layer reset, base, layout, components, modals, theme, responsive, utils`).
- **⚠ Detectadas duplicaciones:** la directiva `@layer ...` aparece dos veces (líneas 2 y 7). Bloques `body {...}` y `.card {...}` aparecen duplicados con `}` extra (líneas 38-44 y 64-82). Probable resultado de merge/refactor sin limpieza.

### 3.11. Otros

- `tests/setup.js` — polyfills `window`/`document`/`navigator` para Vitest+happy-dom.
- `modules/vitest.config.js` — `environment: 'happy-dom'`, `setupFiles: ['./tests/setup.js']`, `include: ['tests/**/*.test.js']`. **⚠ Ubicado dentro de `modules/`**, lo más común sería en raíz.
- `manifest.json` — PWA estándar. `lang: es-CO`, `theme_color: #00dc82`, 10 iconos, 2 shortcuts (Registrar gasto, Ver compromisos), 1 screenshot.
- `vercel.json` — deploy estático. Sin build.
- `package.json` — dev deps: `vitest@^2.0.0`, `@vitest/coverage-v8`, `happy-dom`, `pureimage`. Scripts: `test`, `test:watch`, `coverage`. **⚠ `pureimage` no se usa en el código actual.**
- `.github/workflows/ci.yml` — CI con Node 18.x/20.x ejecutando `npm ci` + `npm test` + `npm run coverage`.

---

## 4. Flujo de la aplicación

```
┌──────────────────────────────────────────────────────────────────┐
│  index.html  ←  carga única, ES module                            │
│       │                                                            │
│       └──→ <script type="module" src="./modules/main.js">          │
│                              │                                     │
│                              ▼                                     │
│  modules/main.js  →  bootstrap()                                  │
│       │                                                            │
│       ├─ loadData()              ← state.js (lee localStorage,    │
│       │                            migra _version, fallback a     │
│       │                            snapshots a/b/c)                │
│       ├─ inyectarConstantes()    ← rellena [data-const] del HTML   │
│       ├─ initTheme()             ← ui.manager.js (light/dark)      │
│       ├─ window.* = handlers     ← compatibilidad onclick legacy   │
│       ├─ document.addEventListener('click', delegate)              │
│       └─ go('dash') + onboarding si !finko_onboarded               │
└──────────────────────────────────────────────────────────────────┘

FLUJO DE UNA INTERACCIÓN (golden path)

  Usuario click en <button data-action="agregarGasto" data-arg-...>
        │
        ▼
  Listener delegado en main.js
        │
        ├─ extrae args desde data-arg-*
        │
        ▼
  ACTIONS['agregarGasto'](args)
        │
        ▼
  ExpenseService.agregar(data)         ← finance.service.js
        │
        ├─ muta S.gastos (Proxy emite 'state:changed')
        ├─ descontarFondo() si aplica
        └─ save() → debounce 200ms → localStorage + snapshot rotativo
        │
        ▼
  renderAll()                          ← ui.manager.js
        │
        ├─ renderDashboard, renderGastos, renderCuentas,
        │  renderMetas, renderDeudas, renderAgenda
        ├─ actualizarScoreUI()         ← planner.service.js
        └─ calcularPrediccion()        ← planner.service.js

PERSISTENCIA (capas de defensa)

  S (Proxy)  →  save() debounced 200ms  →  localStorage['fco_v4']
                                       │
                                       └→  3 snapshots rotativos
                                           (fco_v4_snap_a/b/c) +
                                           timestamp _at

  loadData()  →  intenta primary  →  si falla, escoge mejor snapshot
                                  →  si no hay, resetAppState()
                                  →  _migrar(parsed, _version) v0→v7

OFFLINE (PWA)

  service-worker.js  →  network-first para HTML/JS/CSS
                     →  stale-while-revalidate para el resto
                     →  fallback: index.html (nav) o 503 con mensaje
```

**Notas:**
- El **Proxy `S`** intercepta `set/deleteProperty` y emite `EventBus.emit('state:changed', ...)` en microtask. Hoy no hay listeners registrados (el render es push manual desde `ACTIONS`), pero el plumbing está listo para reactividad.
- `renderAll()` se invoca también automáticamente al final de cada acción del registry (línea 455 de main.js).

---

## 5. Convenciones y patrones

### Naming
- **Funciones públicas:** camelCase español (`agregarGasto`, `calcularPrediccion`).
- **Servicios:** PascalCase con sufijo `Service` (`ExpenseService`, `AccountService`).
- **Constantes:** UPPER_SNAKE_CASE (`SMMLV_2026`, `STORAGE_KEY`).
- **IDs DOM:** kebab-case con prefijo de sección (`d-tot`, `g-de`, `cu-banco`, `cc-cap`, `m-fondo-emergencia`).
- **Clases CSS:** kebab abreviado (`fb mb`, `tm`, `nb`, `bp bsm`, `ct`, `ss`).

### Patrón de acciones (HTML ↔ JS)
- HTML declara `data-action="nombreAccion"` + opcionalmente `data-arg-NAME="valor"`.
- main.js registra `ACTIONS['nombreAccion'] = ({ NAME }) => ...`.
- Un único `addEventListener('click')` delegado en `document` resuelve todo.
- ✅ Ventaja: agregar un botón nuevo solo requiere registrar la acción + tocar el HTML.

### Manejo de estado
- **Single source of truth:** `S` exportado desde `state.js`.
- **Mutación directa permitida** (es Proxy). Después siempre `save()`.
- **Migraciones por versión** en `_migrar()` (v0→v7), garantizan retrocompatibilidad de datos viejos.

### CSS
- `@layer` para evitar wars de especificidad: reset → base → layout → components → modals → theme → responsive → utils.
- Variables `--a1`, `--t1..t3`, `--s1..s3`, `--b1..b3`, `--ff`, `--fm`, `--dan`, etc. (definidas en :root).
- Tema oscuro/claro alternado por clase en `<body>`.

### Accesibilidad
- `aria-live="polite"` en `#sr-announcer` (helper `sr(msg)`).
- `aria-label`, `aria-expanded`, `role="dialog"`, `aria-modal="true"` en modales.
- Skip-link al inicio del body.

### Lo que el código declara y NO se cumple
1. **CLAUDE.md dice "Cero DOM en Servicios"**, pero:
   - `finance.service.js::AccountService.agregarCuenta` lee `document.getElementById(...)` como fallback.
   - `planner.service.js::actualizarScoreUI` y `calcularPrediccion` manipulan el DOM directamente.
2. **README dice "6 módulos core"** pero existen 7 archivos `.js` en `modules/` (más `vitest.config.js`). El 7º es `educacion.js`, huérfano.

---

## 6. Auditoría de archivos .md

| Archivo | Líneas | Estado | Recomendación |
|---|---|---|---|
| `README.md` | 28 | ✅ Vigente, conciso, alineado con la arquitectura | **Mantener.** Es la cara pública del repo. |
| `CLAUDE.md` | 26 | ✅ Vigente. Las "reglas de oro" están bien definidas, aunque el código las viola en 2 lugares (ver §5) | **Mantener y mejorar:** agregar nota explícita de las violaciones conocidas + el módulo huérfano `educacion.js` + la inconsistencia de rutas en `service-worker.js`. |
| `DASHBOARD_REDESIGN.md` | 1429 | ⚠ Plan futuro NO ejecutado. Documenta 10 fases de rediseño UX/UI con tareas detalladas (tipografía, WCAG, score visible, predicción, bolsillos, microcopy, a11y, responsive, onboarding). El onboarding (Fase 10) sí se implementó parcialmente | **Conservar como documento de planificación**, pero idealmente moverlo a `docs/` (cuando se cree esa carpeta) y marcar el estado de cada fase. Excluido por `.vercelignore`. |
| `PROJECT_CONTEXT.md` | — | 🆕 Este documento | Mantener actualizado. |
| `PROJECT_CONTEXT_LITE.md` | — | 🆕 Versión comprimida | Mantener actualizado. |

**Archivos MD eliminados (limpieza correcta):** `Claude_Code_Primera_Vez.md`, `DEVELOPMENT_ROUTINE.md`, `Finko_Pro_Auditoria_v5.md`, `Finko_Pro_Auditoria_v5_Reorganizacion.md`, `Finko_Pro_Claude_Code_Plan.md`, `QUICK_START.md`. Eran documentación legacy del refactor pre-v6.

### Estructura documental propuesta (sin redundancia)

```
README.md                  ← humano: qué es, cómo correrlo
CLAUDE.md                  ← LLM: arquitectura + reglas + violaciones conocidas
PROJECT_CONTEXT.md         ← LLM avanzado: contexto completo y denso (este doc)
PROJECT_CONTEXT_LITE.md    ← LLM mini: ultra-comprimido para modelos pequeños
docs/
  └── DASHBOARD_REDESIGN.md  ← plan UX futuro (mover aquí)
```

### Issues estructurales detectados (deuda técnica)

| # | Issue | Severidad | Archivo |
|---|---|---|---|
| 1 | `service-worker.js` precachea rutas inexistentes (modules/core, infra, ui, dominio) → offline roto en instalaciones nuevas | 🔴 Alta | service-worker.js:325-363 |
| 2 | Changelog del SW (v4→v56, ~310 líneas) desactualizado: documenta features ya inexistentes en el código | 🟡 Media | service-worker.js:1-322 |
| 3 | `finance.service.js::AccountService.agregarCuenta` lee del DOM (viola "cero DOM") | 🟡 Media | finance.service.js:162-165 |
| 4 | `planner.service.js::actualizarScoreUI/calcularPrediccion` manipulan el DOM | 🟡 Media | planner.service.js:143-227 |
| 5 | `S.metas` referenciado en main.js:298 y ui.manager.js:318 — el campo se llama `S.objetivos` | 🔴 Alta | main.js:298, ui.manager.js:318 |
| 6 | `PersonalLoanService` lee `S.prestamosRecibidos`/`S.prestamosOtorgados` no inicializados en `resetAppState()` | 🟡 Media | finance.service.js:271-298 |
| 7 | `modules/educacion.js` huérfano: nadie lo importa | 🟢 Baja | modules/educacion.js |
| 8 | Tests borrados (`tests/unit/*.test.js`) pero `package.json` mantiene `npm test` y CI corre tests | 🟡 Media | package.json, .github/workflows/ci.yml |
| 9 | Handlers duplicados en main.js: `toggleDesgloseHero`, `toggleBolsillosHero` registrados dos veces | 🟢 Baja | main.js:72-126 |
| 10 | `style.css`: directiva `@layer` y bloques `body{}/.card{}` duplicados con `}` huérfano | 🟡 Media | style.css:1-82 |
| 11 | `package.json` declara `pureimage` pero no se usa | 🟢 Baja | package.json |
| 12 | `opencode.json` vacío | 🟢 Baja | opencode.json |
| 13 | `vitest.config.js` dentro de `modules/` (debería ir en raíz) | 🟢 Baja | modules/vitest.config.js |

---

## 7. Guía para modelos pequeños (qué abrir según la tarea)

| Tarea | Archivos prioritarios (en orden) |
|---|---|
| **Agregar/modificar UI o vista** | 1. [index.html](index.html) (sección correspondiente) → 2. [modules/ui.manager.js](modules/ui.manager.js) → 3. [style.css](style.css) |
| **Agregar una nueva acción de usuario (botón)** | 1. [modules/main.js](modules/main.js) (registry `ACTIONS`) → 2. [index.html](index.html) (`data-action="..."` + `data-arg-*`) → 3. servicio relevante |
| **Lógica de gastos / cuentas / bolsillos / deudas** | 1. [modules/finance.service.js](modules/finance.service.js) → 2. [modules/state.js](modules/state.js) (forma de S) |
| **Metas / compromisos / score / tendencias** | 1. [modules/planner.service.js](modules/planner.service.js) → 2. [modules/state.js](modules/state.js) |
| **Calculadoras (CDT, crédito, interés, PILA, regla 72)** | 1. [modules/tools.service.js](modules/tools.service.js) (puro) → 2. [modules/ui.manager.js](modules/ui.manager.js) (`renderCDT`, `renderCredito`) |
| **Bug de persistencia / migración / corrupción** | 1. [modules/state.js](modules/state.js) (`save`, `loadData`, `_migrar`, snapshots) |
| **Bug offline / PWA** | 1. [service-worker.js](service-worker.js) (⚠ revisar primero `PRECACHE_ASSETS`) → 2. [manifest.json](manifest.json) |
| **Constantes financieras Colombia (SMMLV, UVT, GMF, usura)** | 1. [modules/state.js](modules/state.js) (líneas 9-31) |
| **Estilos / tema claro-oscuro** | 1. [style.css](style.css) → 2. `toggleTheme/applyTheme` en [modules/ui.manager.js](modules/ui.manager.js) |
| **Tests** | 1. [modules/vitest.config.js](modules/vitest.config.js) → 2. [tests/setup.js](tests/setup.js) (⚠ los tests fueron borrados, reescribir desde la nueva estructura) |
| **Onboarding** | 1. [index.html](index.html#L2061) (modal `m-onboarding`) → 2. [modules/main.js](modules/main.js#L476) (`window.nextOnboardingStep`, `finishOnboarding`) |
| **Refactor / debugging arquitectónico** | 1. [CLAUDE.md](CLAUDE.md) → 2. [modules/main.js](modules/main.js) (orquestador) → 3. siguiente capa según síntoma |

### Reglas para futuros agentes
1. **No crear archivos nuevos** salvo necesidad estricta (regla CLAUDE.md).
2. **Servicios = lógica pura** (idealmente). Si encuentras DOM en un servicio, considera moverlo a `ui.manager.js` salvo que sea correcto en contexto.
3. **Mutar `S` directamente** y llamar `save()` después.
4. **Re-renderizar** llamando funciones de `ui.manager.js`.
5. **No usar `npm install <paquete>` salvo justificación** — la app no tiene bundler, debe quedarse en JS estándar del navegador.
6. **Antes de ejecutar tareas offline**, verifica que `service-worker.js::PRECACHE_ASSETS` está actualizado a las 6 rutas reales.

---

## 8. Resumen ultra comprimido

| Archivo | Una línea |
|---|---|
| [index.html](index.html) | Único HTML (2125 L) con todas las secciones y modales; carga `modules/main.js` como ES module. |
| [modules/main.js](modules/main.js) | Bootstrap + registry `ACTIONS` + delegación de eventos `[data-action]` + expone `window.*` para compat. |
| [modules/state.js](modules/state.js) | Estado `S` (Proxy) + `save()`/`loadData()` con snapshots + constantes Colombia 2026 + `EventBus`. |
| [modules/finance.service.js](modules/finance.service.js) | `ExpenseService`, `AccountService`, `DebtService`, `PersonalLoanService`, `FinanceCalc`. |
| [modules/planner.service.js](modules/planner.service.js) | Compromisos, Objetivos, Tendencias, Score de salud financiera, Logros + aliases. |
| [modules/tools.service.js](modules/tools.service.js) | `FinanceTools` puras: CDT, crédito francés, interés compuesto, Fisher real, Regla 72, PILA. |
| [modules/ui.manager.js](modules/ui.manager.js) | Renders, modales (`openM/closeM`), navegación `go()`, tema, calculadoras visuales. |
| [modules/educacion.js](modules/educacion.js) | ⚠ Strings educativos. **Huérfano: nadie lo importa.** |
| [service-worker.js](service-worker.js) | PWA cache v56. ⚠ `PRECACHE_ASSETS` apunta a rutas borradas (modules/core/dominio/...). |
| [style.css](style.css) | 2238 L con `@layer`. ⚠ duplicaciones en cabecera. |
| [manifest.json](manifest.json) | PWA `lang=es-CO`, `theme=#00dc82`, 10 iconos, 2 shortcuts. |
| [vercel.json](vercel.json) | Deploy estático sin build. |
| [package.json](package.json) | v4.2.0, dev deps Vitest+happy-dom; `pureimage` no usado. |
| [tests/setup.js](tests/setup.js) | Polyfills happy-dom para Vitest (los tests `unit/` fueron borrados). |
| [CLAUDE.md](CLAUDE.md) | Reglas para LLM: 6 módulos, cero DOM en servicios, mutar `S` y `save()`. |
| [README.md](README.md) | Mismo mensaje en formato humano + tabla de archivos. |
| [DASHBOARD_REDESIGN.md](DASHBOARD_REDESIGN.md) | Plan UX/UI futuro de 10 fases (1429 L), no ejecutado. |
