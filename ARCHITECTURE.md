# Arquitectura — Finko Pro

> **Última revisión:** 2026‑05‑07
> **Versión:** v4.x (estable, pre‑refactor v5.0)

Documento de referencia para entender **cómo está hecha la app por dentro**: qué archivo hace qué, cómo se conectan, qué reglas hay que respetar al modificar.

Si necesitás ejecutar cambios concretos sobre HTML / CSS / JS, leé también `REORG_HTML.md`, `REORG_CSS.md` y `REORG_JS.md`.

---

## 1 · Objetivo

Que cualquier desarrollador con experiencia razonable pueda:

1. Leer este documento en < 15 minutos.
2. Identificar dónde vive cada feature.
3. Saber qué archivos puede tocar con confianza y cuáles requieren extra cuidado.
4. Entender el flujo de datos completo (mutación → persistencia → render).
5. Saber qué decisiones son innegociables (vanilla JS, no build, offline‑first).

---

## 2 · Alcance

Cubre arquitectura **vigente**. No describe la arquitectura objetivo de v5 (eso está en los `REORG_*.md` y `ROADMAP.md`).

---

## 3 · Vista 30.000 pies

```
                        ┌───────────────────────────┐
                        │   index.html (1.942 LOC)  │
                        │   — todo el shell + DOM   │
                        └────────────┬──────────────┘
                                     │ <link rel="modulepreload">
                                     │ <script type="module" src="modules/ui/events.js">
                                     ▼
                        ┌────────────────────────────┐
                        │   modules/ui/events.js     │
                        │   — bootstrap + window.*   │
                        └────────────┬───────────────┘
                                     │ imports
        ┌────────────────────────────┼────────────────────────────────┐
        ▼                            ▼                                ▼
 ┌──────────────┐           ┌──────────────────┐          ┌────────────────────┐
 │  CIMIENTOS   │           │      INFRA       │          │       UI SHELL     │
 │  core/       │           │      infra/      │          │       ui/          │
 │              │           │                  │          │                    │
 │ state.js     │◄──────────┤ utils.js         │◄─────────┤ shell.js           │
 │ storage.js   │           │ render.js        │          │ actions.js         │
 │ constants.js │           │ a11y.js          │          │                    │
 └──────┬───────┘           └────────┬─────────┘          └──────────┬─────────┘
        │                            │                               │
        ▼                            ▼                               ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                            DOMINIO                                     │
 │  ingresos.js  compromisos.js  tesoreria.js  metas.js                   │
 │  analisis.js  exports.js      personales.js                            │
 │                                                                        │
 │  + calculadoras.js  ← lazy‑loaded al entrar a la sección               │
 └────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                       ┌──────────────────────────────┐
                       │   localStorage 'fco_v4'      │
                       │   schema v5, debounce 200 ms │
                       └──────────────────────────────┘
```

---

## 4 · Pilares innegociables (ADN del proyecto)

1. **Vanilla JS ES6 modules.** Sin frameworks, sin bundler, sin TypeScript. El navegador entiende `import` directamente.
2. **Offline‑first.** PWA real. El Service Worker cachea todo. La app funciona sin internet desde el primer load.
3. **Sin servidor.** No hay backend, no hay cuentas, no hay sync. La privacidad es absoluta.
4. **Estado mutable singleton.** El objeto `S` exportado por `state.js` es la única fuente de verdad.
5. **Persistencia debounced.** `save()` espera 200 ms antes de escribir a `localStorage` para coalescer mutaciones rápidas.
6. **Migraciones idempotentes.** Cada bump de schema sube datos sin perder nada y sin romper backward‑compat.
7. **Eventos delegados.** HTML estático usa solo `data-action="…"`. Cero `onclick`. Esto preserva CSP, accesibilidad y mantenibilidad.
8. **Lenguaje del usuario, no del banquero.** En microcopy: "te queda $X", no "saldo disponible neto".

Tocar cualquiera de estos requiere ADR (Architectural Decision Record) explícito.

---

## 5 · Capas y responsabilidades

### 5.1 · `modules/core/` — cimientos

| Archivo | LOC | Responsabilidad | Exporta |
|---|---:|---|---|
| `state.js` | 41 | Singleton `S` con todos los datos del usuario; `EventBus` para desacoplar emisores y consumidores; `resetAppState()`. | `S`, `resetAppState`, `EventBus` |
| `storage.js` | 1.003 | `save()` (debounced), `loadData()` (con migraciones), undo (Ctrl+Z), snapshots, banner de localStorage no disponible. | `save`, `loadData`, `initUndoShortcut` |
| `constants.js` | 88 | Constantes legales colombianas: SMMLV, UVT, GMF, tasa de usura, retenciones, catálogo de bancos, emojis por categoría. | `SMMLV_2026`, `UVT_2026`, `GMF_TASA`, `USURA_EA`, `BANCOS`, `inyectarConstantes`, `verificarVigenciaConstantes` |

**Reglas:**

- `state.js` no importa nada del dominio. Solo declara la forma del estado.
- `storage.js` solo importa de `state.js` y `utils.js`.
- `constants.js` no importa nada (zero deps).

### 5.2 · `modules/infra/` — infraestructura cross‑cutting

| Archivo | LOC | Responsabilidad |
|---|---:|---|
| `utils.js` | 276 | Formateo (`f`, `hoy`, `mesStr`, `he`), DOM helpers (`setEl`, `setHtml`), modales y diálogos (`openM`, `closeM`, `showAlert`, `showConfirm`, `showPrompt`, `showPromptConfirm`). |
| `render.js` | 124 | Render orchestration: `renderSmart(fn, key)` que evita re-render si la sección no es visible; `updSaldo()` recalcula y propaga el saldo total; `updateBadge()` actualiza contador de deudas; `renderAll()` orquesta todos los renders. |
| `a11y.js` | 99 | `sr(message)` envía anuncios al `aria-live` de la app para lectores de pantalla. |

**Reglas:**

- Infra **no debe importar dominio**. Si lo hace, hay un bug arquitectónico.
- `render.js` puede leer `S` pero no muta nada.

### 5.3 · `modules/ui/` — orquestación + navegación

| Archivo | LOC | Responsabilidad |
|---|---:|---|
| `events.js` | 363 | Bootstrap. Importa todos los dominios, expone funciones a `window.*` para HTML dinámico, registra acciones (`registerAction`), arranca `initApp()`, configura Service Worker, banner offline. |
| `shell.js` | 797 | Navegación (hash routing), tema (oscuro/claro), sidebar, swipe handlers, lazy‑load de calculadoras, tabs internas (resumen, gastos), día picker. |
| `actions.js` | 50 | Sistema de delegación: registra handlers `data-action="X"` y los dispara desde un único listener global. |

**Reglas:**

- `events.js` es el **único** archivo que toca `window.*`. Todos los demás módulos deben importar lo que necesiten.
- `shell.js` no debe importar dominios directamente. Usa el `EventBus` o expone hooks.
- `actions.js` es la API pública para que cualquier módulo registre acciones de UI.

### 5.4 · `modules/dominio/` — lógica de negocio

| Archivo | LOC | Sub‑dominios fusionados |
|---|---:|---|
| `ingresos.js` | 1.623 | Gastos (CRUD), dashboard, semáforo, hormigas, resumen quincena, historial, prima |
| `compromisos.js` | 1.992 | Pagos fijos (CRUD + ejecutar), agenda (calendario + pagos programados), deudas (CRUD + avalancha + bola de nieve + mora + cuota sugerida) |
| `tesoreria.js` | 1.602 | Cuentas (CRUD), fondo de emergencia, bolsillos / alcancías |
| `metas.js` | 979 | Objetivos (CRUD + acción), inversiones (CRUD + rendimientos) |
| `analisis.js` | 2.849 | Rachas (sin hormiga, ahorro), logros, alertas, salud financiera, predicciones, patrones |
| `exports.js` | 425 | JSON, CSV, reporte HTML, importación |
| `personales.js` | 396 | Préstamos a familia (R3): "me deben" |

**Reglas:**

- Cada dominio expone funciones que mutan `S`, llaman a `save()` y disparan el render correspondiente.
- Los dominios pueden importar de `core/` y `infra/`.
- Los dominios **no deberían** importar de otros dominios. Hoy hay una excepción (`ingresos.js` → `analisis.js`) que en v5 se desacopla vía `EventBus`.

### 5.5 · `modules/calculadoras.js` — lazy

- 593 LOC.
- Carga **bajo demanda** la primera vez que el usuario entra a la sección de calculadoras.
- Implementa: CDT, crédito (sistema francés), interés compuesto, regla del 72, prima.
- Sus funciones se exponen a `window.*` (`cCDT`, `cCre`, `cComp`, `cR72`, `cPrima`) porque los handlers viven en HTML dinámico.

---

## 6 · Flujo de datos

### 6.1 · Mutación típica

```
  Usuario hace clic ─► HTML dispara data-action="agregarGasto"
        │
        ▼
  actions.js delegator captura el click y llama al handler registrado
        │
        ▼
  dominio/ingresos.js::agregarGasto() valida + muta S.gastos.push(...)
        │
        ▼
  save()                     ◄─── debounced 200 ms a localStorage 'fco_v4'
        │
        ▼
  renderGastos()             (UI update local)
  updSaldo()                 (saldo global)
  EventBus.emit('ui:renderAll')
```

### 6.2 · Carga inicial

```
  index.html dispara <script type="module" src="modules/ui/events.js">
        │
        ▼
  events.js::initApp()
    ├─ EventBus.on('state:save', save)
    ├─ EventBus.on('ui:renderAll', renderAll)
    ├─ _initDatos()       → loadData() (aplica migraciones), updSaldo()
    ├─ _initUI()          → initTheme(), inyectarConstantes(), updateBadge(),
    │                       hidratar campos de formulario, initClickOutside(),
    │                       initUndoShortcut()
    ├─ populateSelectObjetivos()
    ├─ renderAll()
    ├─ calcScore()
    └─ verificarVigenciaConstantes()  → warning si SMMLV/UVT/usura están vencidos
        │
        ▼
  Service Worker se registra (cache-first, scope './')
```

### 6.3 · Persistencia y migraciones

- Clave: `fco_v4` en `localStorage`.
- Schema actual: **v5**.
- Cada migración (v0→v1, …, v4→v5) es **idempotente** y **conservadora**: no destruye datos, solo agrega/transforma campos.
- `loadData()` detecta el `_v` guardado y aplica las migraciones faltantes en orden.

---

## 7 · Sistema de UI delegada (`data-action`)

### 7.1 · Cómo funciona

1. HTML estático declara: `<button data-action="go" data-arg-sec="dash">…</button>`.
2. `ui/actions.js` registra un listener global en `document` que escucha clicks.
3. Cuando hay click, parsea `data-action` y los `data-arg-*`, y dispara el handler registrado.
4. Cualquier módulo puede registrar handlers con `registerAction('go', ({ sec }) => go(sec))`.

### 7.2 · Ventajas

- Un único listener global → mejor performance.
- Cero `onclick=""` → CSP friendly + auditable.
- Acción y argumentos viven en HTML → fácil de leer.
- Migración v4→v5: este sistema se mantiene tal cual.

### 7.3 · Limitaciones actuales

- HTML **dinámico** (generado por `innerHTML` desde JS) aún usa funciones `window.*` para handlers.
- Migrar HTML dinámico a `data-action` es objetivo de v5 (ver `REORG_HTML.md`).

---

## 8 · Window globals

`events.js` realiza **74 asignaciones `window.X = …`** (medidas con `grep -cE '^\s*window\.[a-zA-Z_]+\s*=' modules/ui/events.js`); en todo `modules/` el total sube a **210**. Sirven para que el HTML dinámico (innerHTML desde JS) pueda llamarlas. Están agrupadas por dominio y comentadas en el archivo.

**Categorías:**

- **Utils:** `f`, `hoy`, `mesStr`, `he`, `showAlert`, `showConfirm`, `showPrompt` — usadas en templates.
- **Render:** `updSaldo`, `updateBadge`, `renderAll`, `renderSmart` — llamadas desde dominios para refrescar otra sección.
- **Dominio:** `delGasto`, `abrirEditarGasto`, `delFijo`, `delDeu`, `abrirPagarCuota`, etc. — handlers de botones × y editar en listas dinámicas.

**Plan v5:** reducir de 74 (en `events.js`) y 210 (total en `modules/`) a ≤ 16 y < 30 respectivamente, migrando HTML dinámico a `data-action` y reemplazando llamadas cross‑módulo `window.X?.()` por `EventBus.emit()`. Ver `REORG_JS.md` §5.6.

---

## 9 · Eventos y `EventBus`

`state.js` exporta un `EventBus` minimalista (`on`, `off`, `emit`).

**Eventos vivos hoy:**

- `state:save` → handler en `events.js` llama `save()`.
- `ui:renderAll` → handler en `events.js` llama `renderAll()`.

**Plan v5:** ampliar para reemplazar las llamadas directas `window.renderX?.()` que aún hace `shell.js`:

- `domain:gastos:changed` → `renderGastos()`
- `domain:deudas:changed` → `renderDeudas()`
- `domain:cuentas:changed` → `renderCuentas()`
- `nav:section:enter` → triggera renders perezosos de la sección activada

---

## 10 · Service Worker

- Archivo: `service-worker.js` (495 LOC).
- Estrategia: **cache‑first**.
- Precachea: `index.html`, `style.css`, `manifest.json`, todos los íconos, todos los módulos JS críticos, fuentes (vía Google Fonts).
- Constante a bumpear cuando cambien assets: `CACHE_NAME` (actual `finko-pro-v37` aprox).
- Notificación de offline: el SW envía mensaje `FINKO_OFFLINE` a la app cuando una request falla por red, lo que dispara el banner.
- Skip waiting controlado: solo solicita activación cuando ya hay un controller previo, para no interrumpir la sesión actual.

---

## 11 · Tests

- Framework: **Vitest** + happy‑dom.
- Configuración: `modules/vitest.config.js`.
- Setup: `tests/setup.js`.
- 1.311 tests, 100% passing.
- Cobertura estimada de lógica financiera crítica: **~85%**.

**Espejo del árbol:**

```
tests/unit/
├─ analisis.test.js          (410)
├─ compromisos.test.js       (129)
├─ ingresos.test.js          (159)
├─ tesoreria.test.js         (171)
├─ metas.test.js             (105)
├─ storage.test.js           (207)
├─ migrations.test.js        (18)
├─ exports.test.js           (20)
├─ personales.test.js        (29)
├─ calculadoras.test.js      (35)
├─ utils.test.js             (21)
└─ state.test.js             (7)
```

**Reglas:**

- Funciones puras (sin DOM, sin `S` mutado a través de window) son siempre testeables y deben tener cobertura ≥ 90%.
- Funciones con DOM se testean indirectamente a través de la función pura que llaman.
- Migraciones tienen test dedicado (`migrations.test.js`) que valida v0 → v5 con fixtures.

---

## 12 · Convenciones del repo

### 12.1 · Naming

- Módulos: kebab‑case si son archivos compuestos (`fondo-emergencia.js`), camelCase para conceptos simples (`metas.js`).
- Funciones: `camelCase`, verbo primero (`agregarGasto`, `renderDeudas`).
- Constantes: `SCREAMING_SNAKE_CASE` (`SMMLV_2026`, `USURA_EA`).
- IDs DOM: `kebab-case` (`g-mo`, `desglose-hero-body`).
- Clases CSS: `.kebab-case` con prefijos por capa (`.ui-row`, `.modal-ov`, `.fijo-card`).

### 12.2 · Imports

- Siempre con extensión `.js` (necesario para módulos en navegador).
- Rutas relativas con `../` (no path mapping, no aliases).
- Agrupados por capa: core → infra → ui → dominio.

### 12.3 · Comentarios

- Español neutro.
- ✅ FIX, ⚠️ NOTA, 🔴 CRÍTICO como prefijos de comentarios importantes.
- JSDoc opcional pero bienvenido en funciones puras de dominio.

### 12.4 · Commits

- `tipo(área): descripción corta` — ej. `fix(deudas): clamp día de pago en febrero`.
- Tipos comunes: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`.
- Cuerpo opcional para el "porqué" de la decisión.

---

## 13 · Riesgos arquitectónicos vivos

| # | Riesgo | Mitigación actual | Plan v5 |
|---|---|---|---|
| R‑1 | Archivos de dominio > 1.500 LOC | Comentarios y secciones dentro del archivo | Partir en sub‑carpetas (`REORG_JS.md`) |
| R‑2 | `window.*` con ~50 funciones | Sección comentada en `events.js` | Reducir vía `EventBus` y migración HTML dinámico → `data-action` |
| R‑3 | Tasa de usura hardcoded trimestral | `verificarVigenciaConstantes()` + warning | Auto‑update con fallback (`FINANCIAL_LOGIC_CO.md`) |
| R‑4 | `analisis.js` (2.849 LOC) carga eager | Ya existe `renderSmart` para evitar render innecesario | Lazy‑load del módulo entero por sección |
| R‑5 | Acoplamiento `ingresos.js` → `analisis.js` | Imports directos | Reemplazar por `EventBus` |
| R‑6 | 341 inline styles dispersan tema | Tokens CSS bien definidos | Migración a `ui-*` (`REORG_HTML.md`) |
| R‑7 | Service Worker sirve cache vieja en updates | Mensaje SKIP_WAITING + reload | Bumpear `CACHE_NAME` con cada release |

---

## 14 · Dependencias externas

- **Runtime:** ninguna. `package.json` solo tiene devDependencies de testing.
- **Test:** `vitest`, `happy-dom`.
- **Build:** ninguno.
- **CDN:** Google Fonts (Inter + DM Mono) con preconnect.
- **Hosting:** Vercel (configuración mínima en `vercel.json`).

---

## 15 · Cómo orientarse en 10 minutos

Si llegás nuevo, leé en este orden:

1. `README.md` (3 min).
2. `ARCHITECTURE.md` (este archivo, 10 min).
3. `modules/core/state.js` (1 min — estructura de `S`).
4. `modules/ui/events.js` (5 min — bootstrap y mapping).
5. Un dominio cualquiera, idealmente `metas.js` por su tamaño moderado (10 min).
6. `tests/unit/<el dominio que leíste>.test.js` (5 min — qué se espera del módulo).

Total: ~35 minutos para tener un mapa funcional de la app.

---

## 16 · Checklist final

- [x] Capas explicadas con responsabilidades claras.
- [x] Pilares innegociables documentados.
- [x] Flujo de datos (mutación, carga inicial, persistencia) descrito.
- [x] Sistema `data-action` documentado.
- [x] `window.*` y `EventBus` explicados con plan de evolución.
- [x] Service Worker descrito con regla de cache bumping.
- [x] Tests inventariados con cobertura estimada.
- [x] Convenciones de naming, imports, commits.
- [x] Riesgos arquitectónicos con mitigación y plan v5.
- [x] Onboarding express en 6 pasos.

---

*Próximo documento: [`REORG_HTML.md`](./REORG_HTML.md).*
