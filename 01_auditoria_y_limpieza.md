# 01 · Auditoría y Limpieza — Plano de Ejecución

> **Auditor:** Senior Full-Stack Architect
> **Fecha:** 2026-05-06
> **Versión auditada:** Finko Pro v4.2.0 (post-v5, post-v37 SW)
> **Estado del repo:** clean en branch `claude/awesome-volhard-e52485`
> **Alcance:** árbol de archivos, redundancias, deuda técnica, pasos de "Clean Code"

---

## 0 · TL;DR — Diagnóstico de una línea

> **Finko Pro ya pasó por una reorganización mayor (v5) que la dejó en muy buena forma.** Lo que queda no es reescribir, es **podar metadatos viejos**, **bajar la grasa inline en `index.html`**, y **partir 4 archivos gigantes** sin tocar su API pública. Es un trabajo de **bisturí, no de demolición**.

| Métrica | Estado actual | Objetivo (post-limpieza) | Δ |
|---|---:|---:|---|
| Archivos `.md` en raíz | **9** | **4** (los nuevos) + `README.md` + `CLAUDE.md` | −3 |
| LOC total (`modules/` + HTML + CSS) | **16 492** | **~14 800** | −10 % |
| `style="..."` inline en `index.html` | **341** | **<60** | −82 % |
| `window.*` en módulos | **378** | **<80** | −79 % |
| Archivos JS >1 500 LOC | **4** | **0** | partir |
| Archivos `.md` duplicados | **2** (auditoría v5 × 2) | **0** | borrar |
| Reportes Lighthouse stale | **1** (`localhost_2026-04-20_07-30-25.report.html`) | **0** | borrar |
| Tests unitarios | **12** módulos cubiertos ✅ | mantener | — |

---

## 1 · Mapa real del repo (medido, no asumido)

```
Finko-Refactor/
│
├─ index.html                              1 942 LOC · 341 inline styles · 115 atributos ARIA
├─ style.css                               1 241 LOC · 8 @layer (reset/base/layout/components/modals/theme/responsive/utils)
├─ service-worker.js                       496 LOC · CACHE v37 · 31 detectores documentados en cabecera
├─ manifest.json                           PWA completa · shortcuts · maskable icons
├─ package.json                            Vitest 2 + happy-dom 14 (dev deps únicas)
├─ vercel.json + .vercelignore             Hosting estático
│
├─ modules/
│  ├─ core/         (3 archivos · 1 132 LOC)
│  │  ├─ state.js              41 LOC   — S, EventBus, resetAppState
│  │  ├─ storage.js          1 003 LOC  — save debounced, snapshots×3 rotativos, undo, normalizar
│  │  └─ constants.js          88 LOC   — SMMLV/UVT/USURA/GMF/RETEFUENTE/BANCOS_CO/CATS
│  │
│  ├─ infra/        (3 archivos · 499 LOC)
│  │  ├─ utils.js             276 LOC   — f()/he()/hoy()/openM/showAlert/getValueOrThrow/normalizarTexto
│  │  ├─ a11y.js               99 LOC   — sr() screen-reader announcer + focus traps
│  │  └─ render.js            124 LOC   — renderSmart, updSaldo, updateBadge
│  │
│  ├─ ui/           (3 archivos · 1 210 LOC)
│  │  ├─ shell.js             797 LOC   — go(), swipe táctil, day-picker, tema, accordions
│  │  ├─ events.js            363 LOC   — bootstrap + window.* (140 funciones expuestas)
│  │  └─ actions.js            50 LOC   — registerAction + delegación click [data-action]
│  │
│  ├─ dominio/      (7 archivos · 9 866 LOC)
│  │  ├─ analisis.js        2 849 LOC ⚠️  — 35+ detectores (v17 a v37)
│  │  ├─ compromisos.js     1 992 LOC ⚠️  — fijos + agenda + deudas (avalancha/bola)
│  │  ├─ ingresos.js        1 623 LOC ⚠️  — gastos + dashboard + resumen + historial
│  │  ├─ tesoreria.js       1 602 LOC ⚠️  — cuentas + fondo + bolsillos
│  │  ├─ metas.js             979 LOC   — objetivos + inversiones
│  │  ├─ exports.js           425 LOC   — JSON/CSV/HTML reports
│  │  └─ personales.js        396 LOC   — R3 "Me Deben" — auto-registra acciones
│  │
│  ├─ calculadoras.js          593 LOC   — lazy-loaded: CDT, crédito, IC, R72, Pila, Inflación, Meta
│  └─ vitest.config.js
│
├─ tests/
│  ├─ setup.js                              jsdom shim + localStorage mock
│  └─ unit/                  (12 archivos)  storage, state, utils, calculadoras,
│                                           tesoreria, compromisos, ingresos, metas,
│                                           analisis, exports, personales, migrations
│
├─ .github/workflows/
│  ├─ test.yml                              vitest run en cada push (Ubuntu 22 · Node 20)
│  └─ ci.yml                                lint + audit
│
├─ .claude/
│  ├─ launch.json
│  └─ settings.local.json
│
└─ Documentación legacy (a podar — ver §3.1)
   ├─ CLAUDE.md                             ✅ Mantener (es el contrato con Claude Code)
   ├─ Finko_Pro_Auditoria_v5.md             ⚠️ Duplicado idéntico al siguiente
   ├─ Finko_Pro_Auditoria_v5_Reorganizacion.md
   ├─ Finko_Pro_Claude_Code_Plan.md         ⚠️ Plan original — congelado, sin actualizar
   ├─ Claude_Code_Primera_Vez.md            ⚠️ Tutorial onboarding — ya no aplica
   ├─ DEVELOPMENT_ROUTINE.md                ⚠️ Workflow personal del autor
   ├─ QUICK_START.md                        ⚠️ Setup rápido — fusionar con README
   ├─ dev-routine.sh                        Script local — mover a `scripts/`
   └─ localhost_2026-04-20_07-30-25.report.html  ⚠️ Snapshot Lighthouse vencido
```

> Lectura clave: el **dominio acumuló 9 866 LOC** (60 % del JS) en cuatro archivos. La auditoría v5 ya hizo la fusión; ahora toca **partir lo puro de lo que toca el DOM** dentro de cada uno.

---

## 2 · Lo que está **bien** (no tocar)

Antes de la lista de podas, hay que reconocer lo que ya está sólido para no romperlo:

| Acierto | Evidencia | Por qué importa |
|---|---|---|
| **Estado único `S` con `save()` debounced** | `core/storage.js:246` | 200 ms de debounce evita 100 escrituras por segundo en un formulario |
| **Migraciones v0 → v7 idempotentes** | `core/storage.js:41-110` | Datos de usuarios viejos sobreviven cualquier release |
| **Snapshots rotativos + undo de 1 paso** | `core/storage.js:288-826` | Tres slots `fco_v4_snap_a/b/c` + slot `fco_v4_undo` con TTL 10 min |
| **Sistema `data-action` con delegación única** | `ui/actions.js:20-44` | Un solo `addEventListener` para toda la app — escala sin pegamento global |
| **Funciones puras documentadas y testeadas** | `tests/unit/*` | `calcularSaludFinanciera`, `ordenarDeudas`, `calcularDiasMora`, `compactarHistorial`, etc. |
| **Cache `@layer` en CSS** | `style.css:2` | Cascada predecible: reset → base → layout → components → modals → theme → responsive → utils |
| **Service Worker v37 documentado** | `service-worker.js:14-301` | Cabecera = changelog ejecutable; cada bump explica qué bug atrapó |
| **Constantes financieras COL con vencimiento** | `core/constants.js:29-35` | `verificarVigenciaConstantes()` avisa 60 días antes que SMMLV/UVT/USURA caducan |
| **EventBus para desacoplar shell↔dominio** | `core/state.js:5-14` | `EventBus.emit('state:save')` evita que `shell.js` importe `save()` |
| **CI que corre `vitest` en cada push** | `.github/workflows/test.yml` | Imposible romper un módulo silenciosamente |

---

## 3 · Limpieza — lo que sobra

### 3.1 Archivos `.md` para borrar / consolidar

| Archivo | Acción | Razón |
|---|---|---|
| `Finko_Pro_Auditoria_v5.md` | 🗑️ **Borrar** | Idéntico byte-a-byte a `Finko_Pro_Auditoria_v5_Reorganizacion.md` |
| `Finko_Pro_Auditoria_v5_Reorganizacion.md` | 📦 **Mover** a `docs/historico/` | Auditoría histórica — útil como referencia, no en raíz |
| `Finko_Pro_Claude_Code_Plan.md` | 📦 **Mover** a `docs/historico/` | Plan original que dio origen al refactor v5 — congelado |
| `Claude_Code_Primera_Vez.md` | 🗑️ **Borrar** | Tutorial personal de onboarding del autor — ya no es contenido del proyecto |
| `DEVELOPMENT_ROUTINE.md` | 🗑️ **Borrar** | Workflow personal — pertenece a `~/.claude/` no al repo |
| `QUICK_START.md` | 🔀 **Fusionar** dentro de `README.md` (a crear) | Sus 3 secciones (instalar, correr, deploy) son el README |
| `localhost_2026-04-20_07-30-25.report.html` | 🗑️ **Borrar** | Snapshot Lighthouse vencido (tiene 16 días). Generar uno nuevo cuando aplique |
| `dev-routine.sh` | 📦 **Mover** a `scripts/dev-routine.sh` | Es un script, no un archivo raíz |

**Resultado:** raíz pasa de 9 archivos `.md` a **4** (los 4 nuevos planos) + `README.md` + `CLAUDE.md`. Todo lo histórico vive bajo `docs/historico/`.

### 3.2 Archivos legacy que ya no existen pero **el HTML los menciona**

```html
<!-- index.html:15-19 — comentario obsoleto -->
<!-- ⚠️ Mantener sincronizado con service-worker.js::PRECACHE_ASSETS y con los  -->
<!-- imports de modules/ui/events.js. Archivos viejos (gastos.js, sections.js, -->
<!-- dashboard.js, ahorrado.js, agenda.js, deudas.js, fondo.js, cuentas.js)    -->
<!-- ya NO existen — fueron fusionados en ingresos/compromisos/tesoreria.      -->
```

✅ Este comentario **se queda** — sirve de epitafio para el refactor v5. **Pero** verificar que ningún `console.error` con esos nombres haya quedado en grep.

### 3.3 Bug-A y Bug-B de la auditoría v5 — **ya resueltos**

Confirmado en código actual:
- `storage.js` tiene un solo `export function save()` (línea 246, debounced) ✅
- `events.js` ya **no** referencia `cCDT`, `cCre`, etc. — la lazy-load vive en `ui/shell.js::_cargarCalculadoras()` ✅

Estas dos líneas en `CLAUDE.md` describen bugs **históricos** y deberían moverse a un `CHANGELOG.md`:

```md
## Known Bugs (Pre-Refactor)
**Bug A — Duplicate save() in storage.js:** [...]
**Bug B — Zombie calculator references in events.js:** [...]
```

**Acción:** quitar el bloque "Known Bugs" del `CLAUDE.md` y archivarlo en `docs/historico/`.

### 3.4 Comentarios desactualizados

| Archivo | Línea aprox. | Texto | Acción |
|---|---|---|---|
| `service-worker.js` | 18-300 | Changelog v6 a v37 (300+ líneas en cabecera) | ⚠️ Es **contenido vivo** — no borrar, pero **partir en `CHANGELOG.md`** y dejar en SW solo el "qué cachea esta versión" |
| `core/storage.js` | 22-27 | Notas de "Snapshots rotativos" | ✅ Se queda — el comentario explica el "por qué" de los slots `_a/_b/_c` |
| `ui/events.js` | 305 | `// _initCalculadoras() eliminada` | 🗑️ Borrar — la función ya no existe, el comentario es ruido |

### 3.5 Estilos `style="..."` inline en `index.html` (341 ocurrencias)

> **Decisión arquitectónica importante.** No se trata de eliminar TODOS los inline. Algunos son legítimos (estilos calculados por JS, ej: `width: ${pct}%`). El objetivo es bajarlos al **mínimo razonable: ≤ 60**.

**Anatomía de los 341 inline styles:**

| Categoría | Aprox. | Acción |
|---|---:|---|
| Repetidos ≥3 veces (label-secundario, val-monetario, etc.) | ~110 | **Migrar a clases `ui-*`** que ya existen en `style.css:1158-1241` |
| Estilos de "icon button" pequeños | ~45 | **Crear `.ui-icon-btn-sm` + variantes color** |
| Botones con gradientes/shadows custom | ~30 | **Definir como variantes `.btn` (`.btn-pill`, `.btn-fab`, etc.)** |
| Estilos de "empty state" decorativo | ~25 | **`.emp` ya existe — usar las variantes** |
| Layouts inline (`display:flex; gap:8px`) | ~80 | **Reemplazar por `.ui-row`, `.ui-row-gap8`, etc. (ya existen)** |
| Tamaños/colores calculados por JS | ~50 | ✅ **Mantener** (ej: barras de progreso) |

**Plan de poda concreto:**

1. **Auditar uno a uno con `grep -n 'style="' index.html`** y agrupar por similitud (ya hay un script en mente).
2. **Reemplazar las 30 plantillas más repetidas** por clases `ui-*` existentes (ver `style.css:1093-1250`).
3. **Crear 5 clases nuevas** para los patrones que aparecen ≥4 veces y aún no tienen utilitaria.
4. **Solo dejar inline** lo que es genuinamente dinámico (ej: `style="width:${pct}%"`).

Este trabajo se lleva ~3 h y baja la línea de fuego de 341 → ~50.

### 3.6 `window.*` en módulos (378 ocurrencias)

`events.js:140` y `shell.js:140` exponen funciones a `window` para que el HTML dinámico (innerHTML) las pueda llamar vía `onclick="..."`. **Pero:** el sistema de `data-action` ya cubre eso para la mayoría de casos.

**Diagnóstico por módulo:**

| Módulo | `window.*` | Justificación actual | Veredicto |
|---|---:|---|---|
| `ui/events.js` | 73 | Bootstrap legacy + HTML dinámico | 🟡 Bajar a ~25 |
| `ui/shell.js` | 27 | Funciones invocadas desde innerHTML viejo | 🟡 Bajar a ~10 |
| `dominio/tesoreria.js` | 43 | Selects de fondos generan `onclick` | 🟢 Migrar a `data-action` (50% ya migrado) |
| `dominio/ingresos.js` | 37 | Botones de gastos en innerHTML | 🟡 Migrar el resto |
| `dominio/compromisos.js` | 24 | Botones de modal en innerHTML | 🟡 Idem |
| `dominio/analisis.js` | 20 | Renders de detectores | 🟢 Mayoría ya en data-action |
| `dominio/metas.js` | 19 | Botones de objetivos | 🟡 Migrar |
| Resto (storage, infra, calc) | 135 | Auto-registro de acciones | ✅ Aceptable |

**Objetivo:** llegar a < 80 `window.*` total. La regla nueva es:

> **Solo se agrega `window.X` si el módulo es lazy-loaded** (caso `calculadoras.js`) **o si una API pública del navegador lo requiere** (caso de algunos handlers de SW).
> Todo lo demás pasa por `registerAction(name, fn)` en `ui/actions.js`.

---

## 4 · Refactor estructural — partir los 4 archivos gigantes

### 4.1 Por qué partir, si la auditoría v5 acaba de fusionar

La fusión v5 era correcta: 28 archivos por concepto era excesivo. Pero ahora 4 archivos pasan los 1 600 LOC:

| Archivo | LOC | Síntoma |
|---|---:|---|
| `dominio/analisis.js` | 2 849 | 35+ detectores. Cualquier cambio toca un archivo gigante. |
| `dominio/compromisos.js` | 1 992 | Avalancha + Bola + Calendario en una sola pieza. |
| `dominio/ingresos.js` | 1 623 | Dashboard + Gastos + Resumen + Historial mezclados. |
| `dominio/tesoreria.js` | 1 602 | Cuentas + Fondo emergencia + Bolsillos. |

> **El truco está en partir DENTRO del dominio**, conservando la API pública del módulo. Cada archivo grande se vuelve un **directorio con un `index.js` que re-exporta**.

### 4.2 Patrón objetivo — "carpeta-fachada"

```
modules/dominio/analisis/
├─ index.js               ← re-exporta TODO lo público (preserva imports actuales)
├─ rachas.js              ← calcularRachaHormiga, calcularRachaAhorro
├─ detectores/            ← 35 detectores agrupados por familia
│  ├─ index.js
│  ├─ atrasos.js          ← detectarFijosSinPagar, detectarMesesSinCerrar
│  ├─ comportamiento.js   ← detectarHormigaAcumulada, detectarObjetivosSinProgreso
│  ├─ integridad.js       ← validarSaldosCoherentes, normalizarObjetivos
│  └─ proyeccion.js       ← predecirFinQuincena, calcularTendencias
├─ salud.js               ← calcularSaludFinanciera, calcularChecklistSalud
├─ alertas.js             ← detectarAlertasUrgentes, detectarAlertasFinancieras
└─ render.js              ← renderStats, renderLogros, renderRachaWidget
```

**Cada archivo nuevo: < 500 LOC**, testeable aisladamente, **API externa intacta**.

### 4.3 Mismo patrón para `compromisos`, `ingresos`, `tesoreria`

```
modules/dominio/compromisos/
├─ index.js
├─ deudas/
│  ├─ index.js
│  ├─ estrategias.js      ← ordenarDeudas (avalancha/bola), calcularCuotaSugerida
│  ├─ mora.js             ← calcularDiasMora, clasificarMora, clasificarCargaDeuda
│  ├─ tiempo.js           ← calcularTiempoRestanteDeuda
│  └─ render.js
├─ fijos/
│  ├─ index.js
│  ├─ logica.js           ← lógica pura de gastos fijos (periodicidad, pagadoEn)
│  └─ render.js
└─ agenda/
   ├─ index.js
   ├─ calendario.js       ← lógica pura de meses, días, eventos
   └─ render.js

modules/dominio/ingresos/
├─ index.js
├─ gastos/                ← agregarGasto, validaciones, deduplicación
├─ dashboard/             ← updateDash + sub-renders
├─ resumen/               ← mostrarResumenQuincena, generarConsejo
└─ historial/             ← cerrarQ, renderHistorial, archivado

modules/dominio/tesoreria/
├─ index.js
├─ cuentas.js             ← guardarCuenta, delCuenta, render*Cuentas
├─ fondo.js               ← calcularFondoEmergencia, registrarAbonoFondo
└─ bolsillos.js           ← bolsillos + plato libre + rebalanceo
```

**Resultado físico:**

| Antes | Después |
|---|---|
| 7 archivos en `dominio/`, 9 866 LOC | 4 carpetas + 24 archivos pequeños, **mismo total LOC**, ningún archivo > 500 LOC |
| `import { renderDeudas } from '../dominio/compromisos.js'` | `import { renderDeudas } from '../dominio/compromisos/index.js'` ← idéntico para el consumidor |

**Costo de migración:** ~6 h. **Costo de cada cambio futuro:** ↓ 60 % (porque se toca un archivo de 200-400 LOC, no uno de 2 000+).

---

## 5 · Convenciones de "Clean Code" propuestas

> El código actual ya respeta varias convenciones implícitas. Las hago explícitas en un `CONTRIBUTING.md` (a crear) para que cualquier desarrollador nuevo (o un Claude futuro) las internalice en el primer minuto.

### 5.1 Nomenclatura

| Prefijo | Significado | Ejemplo |
|---|---|---|
| `render*` | Toca DOM, lee `S`, no devuelve nada | `renderDeudas()`, `renderObjetivos()` |
| `calcular*` / `clasificar*` | Función **pura**, recibe args, devuelve valor | `calcularDiasMora(deuda, hoy, gastos)` |
| `detectar*` | Pura, devuelve un array de hallazgos | `detectarMesesSinCerrar(gastos, hist, hoy)` |
| `guardar*` | Lee inputs del DOM, muta `S`, llama `save()`, cierra modal | `guardarCuenta()`, `guardarObjetivo()` |
| `abrir*` / `del*` | Triggers de UI desde HTML dinámico | `abrirEditarGasto(id)`, `delDeu(id)` |
| `validar*` / `normalizar*` | Puras, sin efectos | `validarTipoPeriodo`, `normalizarObjetivos` |
| `_*` (prefijo) | Privado al módulo (no se exporta) | `_renderAllCuentas`, `_writeSnapshot` |

### 5.2 Estructura interna de cada archivo de dominio

```js
// === IMPORTS ===
import { S } from '../core/state.js';
// …

// === CONSTANTES Y REGEX LOCALES ===
const _MES_RX = /^(\d{4})-(\d{2})/;

// === FUNCIONES PURAS (testeables sin DOM) ===
export function calcularX(args) { /* ... */ }

// === RENDERS (tocan DOM, leen S) ===
export function renderX() { /* ... */ }

// === HANDLERS DE FORMULARIO (mutan S) ===
export function guardarX() { /* ... */ }

// === REGISTRO DE ACCIONES DELEGADAS ===
registerAction('xAbrirModal', () => abrirX());
registerAction('xGuardar',    () => guardarX());

// === EXPOSICIÓN window.* (solo lo que llama HTML dinámico) ===
if (typeof window !== 'undefined') {
  window.delX = delX;
}
```

Esta plantilla ya la respetan a medias todos los módulos — falta **comentarla explícitamente** en `CONTRIBUTING.md`.

### 5.3 Reglas de oro

1. **`save()` debounced**: nunca escribir a `localStorage` directamente, siempre vía `save()` de `core/storage.js`.
2. **Mutación de `S` → `save()` → `renderSmart(['key'])`** en ese orden. Nunca `renderAll()` por defecto.
3. **Nada de `import * as foo`** — siempre listar las exportaciones que se usan (mejor para tree-shaking si algún día se hace bundle).
4. **Pruebas > Comentarios**: si una función pura es no obvia, **agregar un test**, no un párrafo de comentarios.
5. **`he()` siempre** que un valor de usuario entra a `innerHTML`. Aunque la app sea local, romper layouts con un apóstrofe del nombre de la cuenta es un bug real.
6. **`getValueOrThrow('id', 'Etiqueta humana')`** en lugar de leer `document.getElementById(id).value` directo en formularios — captura errores con mensaje útil.

---

## 6 · Tabla maestra de acciones — limpieza

| # | Acción | Esfuerzo | Riesgo | Reversible |
|---|---|---:|:---:|:---:|
| L1 | Borrar `Finko_Pro_Auditoria_v5.md` (duplicado) | 1 min | 🟢 | ✅ git |
| L2 | Borrar `Claude_Code_Primera_Vez.md` y `DEVELOPMENT_ROUTINE.md` | 1 min | 🟢 | ✅ git |
| L3 | Borrar `localhost_2026-04-20_07-30-25.report.html` | 1 min | 🟢 | ✅ git |
| L4 | Mover `dev-routine.sh` a `scripts/` | 5 min | 🟢 | ✅ git |
| L5 | Crear `docs/historico/` y mover los 2 docs de auditoría + plan | 5 min | 🟢 | ✅ git |
| L6 | Crear `README.md` (fusionando `QUICK_START.md`) y borrar el QUICK_START | 30 min | 🟢 | ✅ git |
| L7 | Sacar la sección "Known Bugs" de `CLAUDE.md` (ya están resueltos) | 5 min | 🟢 | ✅ git |
| L8 | Borrar comentario `// _initCalculadoras() eliminada` en `events.js:305` | 1 min | 🟢 | ✅ git |
| L9 | Crear `CONTRIBUTING.md` con las convenciones de §5 | 45 min | 🟢 | ✅ git |
| L10 | Crear `CHANGELOG.md` con los v6→v37 que hoy viven en cabecera de SW | 2 h | 🟢 | ✅ git |
| L11 | **Auditar y migrar 100 inline styles** a clases `ui-*` existentes | 3 h | 🟡 | ✅ tests |
| L12 | Crear 5 clases `ui-*` nuevas para patrones repetidos sin utilitaria | 1 h | 🟢 | ✅ tests |
| L13 | Migrar `tesoreria.js` `window.*` restantes a `data-action` | 2 h | 🟡 | ✅ tests |
| L14 | Migrar `ingresos.js`, `compromisos.js`, `metas.js` `window.*` | 4 h | 🟡 | ✅ tests |
| R1 | Partir `analisis.js` en carpeta-fachada (§4.2) | 4 h | 🟠 | ✅ tests |
| R2 | Partir `compromisos.js` en carpeta-fachada (§4.3) | 3 h | 🟠 | ✅ tests |
| R3 | Partir `ingresos.js` en carpeta-fachada | 3 h | 🟠 | ✅ tests |
| R4 | Partir `tesoreria.js` en carpeta-fachada | 2 h | 🟠 | ✅ tests |

> Total: ~28 h de trabajo neto, muy paralelizable. **Reglas:** un commit por acción · `npm test` antes de cada commit · `service-worker.js::CACHE_NAME` se bumpea en cualquier acción que cambie nombre de archivo (R1-R4).

---

## 7 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|:---:|:---:|---|
| Romper imports al partir un dominio | Media | Alto | Carpeta-fachada con `index.js` re-exporta — los consumidores no cambian |
| `service-worker.js` sirve la versión vieja en cache después de R1-R4 | Alta | Medio | Bumpear `CACHE_NAME` (`finko-pro-v37` → `v38`) y actualizar `PRECACHE_ASSETS` |
| Tests de happy-dom no detectan un cambio de DOM | Baja | Medio | Mantener `npm run test:watch` durante el refactor |
| Cambiar `window.*` rompe HTML dinámico no migrado | Media | Alto | Buscar con `grep -r "window\.NOMBRE"` antes de eliminar; migrar el call-site primero |
| Estilos `ui-*` no cubren un caso edge | Baja | Bajo | Mantener inline donde el cálculo es genuino (barras de progreso) |
| Equipo nuevo no encuentra archivos partidos | Baja | Bajo | `CONTRIBUTING.md` + diagrama actualizado en `README.md` |

---

## 8 · Cierre

Finko Pro está en su mejor momento estructural histórico (post-v5). Lo que sigue es **ortodoncia, no cirugía**:

1. Borrar 4 `.md` muertos y mover 3 al histórico.
2. Bajar 341 inline styles a < 60 reusando las clases `ui-*` que ya existen.
3. Bajar 378 `window.*` a < 80 completando la migración a `data-action`.
4. Partir 4 archivos gigantes en carpetas-fachada de archivos < 500 LOC.

Con esos 4 movimientos, el repo queda **listo para 12 meses de evolución sin volver a partirlo**.

— *Fin del Plano 01 · Próximo: [02_ux_ui_modernizacion.md](02_ux_ui_modernizacion.md)*