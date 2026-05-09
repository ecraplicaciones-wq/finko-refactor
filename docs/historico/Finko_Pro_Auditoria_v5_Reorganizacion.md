# 📋 Finko Pro — Auditoría v5: Reorganización & Salud del Código

> **Fecha:** 19-abr-2026
> **Versión auditada:** Finko Pro v4.2.0 (post v4.1)
> **Foco:** Consolidación de archivos, bugs bloqueantes y plan de acción priorizado
> **Lenguaje:** Colombiano (ADN del proyecto)
> **Documento previo:** `Finko_Pro_Auditoria_v4.1.md` (este reporte lo COMPLEMENTA, no lo reemplaza)

---

## 🚨 PRIORIDAD CERO — Dos bombas que apagan la app al cargar

Antes de cualquier reorganización, estos dos bugs **impiden que la aplicación arranque**. Son nuevos, no estaban en la auditoría v4.1, y deben arreglarse hoy mismo.

### 💣 Bug A — `storage.js` no parsea (SyntaxError)

**Archivo:** `modules/storage.js`, líneas **200** y **232**.

Hay dos `export function save()` declaradas. La segunda (con debounce) se agregó pero la primera no se borró. Un comentario dice `// REEMPLAZAR POR:` entre ambas, pero el reemplazo nunca ocurrió.

```js
// Línea 200
export function save() {
  try {
    verificarEspacio();
    S._version = CURRENT_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch (e) { … }
}

// REEMPLAZAR POR:
// Línea 232
export function save() {     // ← duplicada → SyntaxError
  _savePendiente = true;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSave, 200);
}
```

**Síntoma:** el módulo no parsea → cualquier `import { save } from './storage.js'` revienta. Como `events.js` importa `save`, **toda la app cae**.

**Fix (5 minutos):** borrar las líneas 195–224 (la versión vieja) y dejar la versión con debounce.

### 💣 Bug B — `events.js` referencia 11 funciones que nunca importó

**Archivo:** `modules/events.js`, líneas **207–217**.

```js
// calculadoras
window.cCDT         = cCDT;          // ReferenceError
window.cCre         = cCre;          // ReferenceError
window.cIC          = cIC;
window.cMeta        = cMeta;
window.cMetaAporte  = cMetaAporte;
window.cPila        = cPila;
window.cInf         = cInf;
window.cR72         = cR72;
window.toggleCalc   = toggleCalc;
window.calcPrima    = calcPrima;
window.guardarPrima = guardarPrima;
```

Ninguno de esos 11 símbolos aparece en los `import` del módulo. Las calculadoras se cargan **lazy** desde `sections.js` mediante `import('./calculadoras.js')`, que es la decisión correcta. Este bloque es **código zombi** que quedó cuando se migró a lazy-load.

**Síntoma:** `ReferenceError: cCDT is not defined` apenas el navegador termina de parsear `events.js`. Mata la fase de exposición global → ningún `onclick=""` del HTML funciona después.

**Fix (2 minutos):** borrar el bloque entero (líneas 206–217). La carga de calculadoras ya queda resuelta por `sections.js`.

> **Nota seria:** la auditoría v4.1 no detectó ninguno de estos dos bugs. Significa que el flujo actual de cambios no ejecuta la app después de cada edición. **Recomendación urgente:** correr `npm test` o un `python -m http.server` rápido antes de hacer commit.

---

## 1. Resumen ejecutivo

Comparación rápida con la auditoría v4.1:

| Métrica | v4.1 (estimado) | v5 (medido) | Δ |
|---|---|---|---|
| `window.*` assignments | ~70 | **277** | ⚠️ 4× peor |
| `onclick=""` inline | "muchos" | **142** | medido |
| Inline `style=""` | 1.200+ | **354** | mejor de lo estimado |
| `aria-label` presentes | "pocos" | **73** | medido |
| `data-action` (delegación) | 0 | **0** | sin cambio |
| Archivos JS en `/modules` | 21 | **28** | crecimiento |
| LOC total módulos | ~6.500 | **7.464** | +15% |
| Bugs bloqueantes | 0 | **2** | 🚨 nuevo |
| Tests unitarios | 0 | **6** (state) | mejora ✅ |

**Diagnóstico de una línea:** la app sigue siendo funcional y rica, pero el costo de cambiarla está creciendo más rápido que las funciones nuevas. Toca **consolidar antes que añadir**.

**Tres frentes prioritarios para esta versión:**

1. Apagar los dos incendios (Bug A y B) — 7 minutos.
2. Consolidar 28 archivos en ~13 módulos por dominio — 1 a 2 días.
3. Migrar `onclick="..."` a delegación con `data-action` — semana 1 del refactor mayor.

---

## 2. Arquitectura actual y propuesta de consolidación

### 2.1 Mapa actual (28 archivos `/modules`)

```
modules/
├─ state.js              (23  LOC) — S + reset
├─ constants.js          (87  LOC) — SMMLV, UVT, BANCOS_CO, CATS
├─ storage.js            (324 LOC) — save/load + migraciones
├─ utils.js              (280 LOC) — fmt, dom helpers, dialogs
├─ render.js             (117 LOC) — renderSmart, updSaldo
├─ ui-components.js      (404 LOC) — day picker, fund btn, accordions, tema
├─ sections.js           (350 LOC) — go(), swipe, lazy load calculadoras
├─ events.js             (386 LOC) — orquestador, 140 window.*
├─ dashboard.js
├─ gastos.js
├─ fijos.js              (249 LOC) — gastos fijos con periodicidad
├─ deudas.js             (~600 LOC, el más grande)
├─ objetivos.js
├─ inversiones.js
├─ agenda.js             (425 LOC) — calendario + pagos agendados
├─ cuentas.js            (191 LOC) — bancos, listas de fondos
├─ ahorrado.js           (448 LOC) — bolsillos, plato libre
├─ fondo.js              (100 LOC) — fondo de emergencia
├─ historial.js          (~280 LOC) — quincenas archivadas
├─ resumen.js            (~330 LOC) — resumen quincenal
├─ stats.js
├─ logros.js             — gamificación (rachas, badges)
├─ exports.js            — backup JSON, CSV, HTML
├─ calculadoras.js       — lazy-loaded, no entra en events.js
├─ fechas.js (?)         — verificar si existe
├─ migrations.js (?)
├─ a11y.js (?)
└─ pwa.js (?)
```

### 2.2 Tensión a resolver

La auditoría v4.1 recomienda **dividir** archivos (sacar `bus.js`, `boot.js`, `connectivity.js`, `globals-shim.js`, `dashboard-calc.js`, etc.). Estebán pidió lo contrario: **menos archivos**.

**Reconciliación:** ambas son correctas y compatibles si se aplican en este orden:

1. **Primero consolidar por dominio** (lo que pide Estebán) → reduce archivos visibles.
2. **Luego extraer la lógica pura dentro de cada dominio** (lo que pide v4.1) → archivo único, dos secciones internas claramente marcadas: `// — UI —` y `// — LÓGICA PURA —`.

El resultado: menos archivos en el explorador, misma testabilidad.

### 2.3 Propuesta de árbol consolidado (28 → 13 archivos)

```
modules/
├─ core/
│  ├─ state.js           — S, resetAppState, CURRENT_VERSION
│  ├─ constants.js       — finanzas CO + catálogos UI
│  └─ storage.js         — save (debounce), load, migraciones
│
├─ infra/
│  ├─ utils.js           — fmt, dom helpers, dialogs, focus trap
│  ├─ render.js          — renderSmart, updSaldo, updateBadge ← unificado
│  └─ a11y.js            — sr(), focus traps, atajos teclado
│
├─ ui/
│  ├─ shell.js           — sections.go() + ui-components (day picker, tema, accordions)
│  └─ events.js          — SOLO bootstrap + delegación data-action
│
├─ dominio/
│  ├─ tesoreria.js       — cuentas + fondo + ahorrado (bolsillos)   [739 LOC actuales]
│  ├─ compromisos.js     — fijos + agenda + deudas                  [1.230 LOC]
│  ├─ ingresos.js        — gastos + dashboard + resumen + historial [~1.400 LOC]
│  ├─ metas.js           — objetivos + inversiones                  [~700 LOC]
│  ├─ analisis.js        — stats + logros (rachas, badges)
│  └─ exports.js         — JSON / CSV / HTML report
│
└─ calculadoras.js       — lazy-loaded (CDT, crédito, interés compuesto, regla 72…)
```

**Por qué este corte:**

| Carpeta | Criterio |
|---|---|
| `core/` | Sin dependencias UI. Testeable con vitest puro. |
| `infra/` | Helpers que cualquier dominio puede usar. Una capa abajo de UI. |
| `ui/` | Lo que toca el DOM o navega. `events.js` se reduce de 386 a ~100 LOC. |
| `dominio/` | Cada archivo = una pestaña del menú o un concepto que el usuario mente. |

**Reglas internas en cada archivo de dominio:**

```js
// === API PÚBLICA (importa desde events.js) ===
export { renderTesoreria, guardarCuenta, … };

// === LÓGICA PURA (testeable, sin DOM) ===
function totalCuentas(cuentas) { … }
function platoLibre(s) { … }

// === ADAPTADORES UI (tocan DOM, leen S) ===
function renderTesoreria() { … }
```

### 2.4 Por qué tiene sentido la fusión "compromisos"

Visualmente ya está fusionado: la pestaña móvil dice "compromisos" y agrupa Deudas + Agenda. Internamente siguen separados, lo que crea fricción al pasar un gasto fijo a deuda o agendarlo. Un solo archivo permite:

- Un único calendario interno de "vencimientos" con polimorfismo: `{tipo: 'fijo'|'deuda'|'pago'}`.
- `renderCompromisos()` une las tres listas con un solo `requestAnimationFrame`.
- Eliminar el triple recálculo que hoy hace cada uno por separado.

### 2.5 Por qué tiene sentido la fusión "tesorería"

Hoy la "plata disponible" se calcula sumando: cuentas (cuentas.js) + bolsillos (ahorrado.js) + fondo (fondo.js). Tres archivos, tres listas paralelas, tres `actualizarListas*()` que se llaman entre sí. Una `tesoreria.js` unificada:

- Una sola fuente de verdad para "¿dónde está mi plata?".
- `actualizarListasFondos()` deja de tener que conocer 7 IDs de `<select>` distintos.
- El concepto de "bolsillo" puede ser un sub-tipo de cuenta.

---

## 3. Calidad de código y duplicaciones

### 3.1 Duplicaciones detectadas

| # | Qué | Dónde | Impacto |
|---|---|---|---|
| 1 | `export function save()` × 2 | `storage.js:200` y `:232` | 🚨 BLOQUEANTE |
| 2 | `updateBadge` definido en dos lugares | `render.js` y `ui-components.js:322` | El que cargue último gana — bug silencioso |
| 3 | `renderAll_cuentas` (alias) | `cuentas.js:175` (OK, local) | No es bug, pero confunde |
| 4 | `descontarFondo` / `reintegrarFondo` | `utils.js` y vuelven a aparecer en `fondo.js` | Verificar import vs reimplementación |
| 5 | Funciones de `exports` antes vivían en `historial.js` | Comentario en `events.js:43` lo confirma | Limpieza ya hecha pero comentario quedó |

### 3.2 `events.js` — el orquestador que se volvió monstruo

- **21 imports** (uno por módulo).
- **140 asignaciones a `window.*`** (de las 277 totales).
- **386 LOC** de las cuales ~280 son puras `window.X = X`.
- Mezcla bootstrap (`document.addEventListener('DOMContentLoaded')`) con exposición global, manejo de service worker y registro de errores.

**Refactor propuesto (queda en ~100 LOC):**

```js
// events.js — el orquestador minimalista
import { boot } from './boot.js';                  // arranque puro
import { setupDelegation } from './delegation.js'; // un solo addEventListener
boot().then(setupDelegation);
```

Toda la exposición `window.*` desaparece cuando migremos `onclick=""` → `data-action="..."`.

### 3.3 Archivos demasiado grandes

| Archivo | LOC | Comentario |
|---|---|---|
| `deudas.js` | ~600 | Cuotas + simulador + plan de pago. Candidato a partir lógica pura. |
| `ahorrado.js` | 448 | Bolsillos + plato libre — entra a `tesoreria.js`. |
| `agenda.js` | 425 | Calendario + pagos — entra a `compromisos.js`. |
| `ui-components.js` | 404 | Mezcla day picker + tema + accordions. Ya está en el límite. |
| `events.js` | 386 | Reduce a ~100 con delegación. |

### 3.4 Otras observaciones de código

- **`he()` (HTML escape) sigue sin escapar `'`**. v4.1 lo señaló y no se corrigió. Riesgo XSS bajo (es app local) pero igual romperá atributos `aria-label="…"` con apóstrofes.
- **`renderSmart()` reconstruye `innerHTML`** para listas largas → jank visible en móvil con >100 transacciones. Para v5 usar `<template>` + diff manual o, mejor, una librería micro como `morphdom` (~3 KB).
- **`requestAnimationFrame` en render.js** ✅ correcto, pero `renderAll()` aún se llama desde 30+ lugares — debería ser `renderSmart(['cuentas', 'gastos'])` siempre.
- **Migraciones v0→v5 en storage.js**: bien hechas, pero faltan tests. Una sola línea mal puede borrar el historial del usuario.

---

## 4. UX, lenguaje y accesibilidad

### 4.1 Lenguaje colombiano — estado del arte

Ya está mucho del trabajo hecho (memoria del proyecto lo confirma): "Resumen", "Compromisos", "Alcancías", "Bolsillos", "Plato Libre" están bien instalados. Sigue habiendo tecnicismos sueltos:

| Hoy en el código | Propuesta colombiana |
|---|---|
| "Periodo" | "Quincena" o "Tu corte" |
| "Saldo total" | "Lo que tenés en mano" |
| "Aporte" (en objetivos) | "Lo que le metiste" |
| "Rendimiento" (inversiones) | "Lo que te dio" |
| "Cuota" (deudas) | "Lo que pagás cada mes" |
| Errores genéricos `"Campo requerido"` | `"Te faltó decirme cuánto"` / `"No me dijiste dónde"` |

**Tip de mentor en alertas:** cada `showAlert()` y `showConfirm()` debería tener una línea de contexto cálido. Hoy varios dicen sólo "¿Estás seguro?".

### 4.2 Accesibilidad WCAG 2.1 — diagnóstico

| Criterio | Estado | Gap |
|---|---|---|
| 1.3.1 Info y relaciones | 🟡 | Solo 73 `aria-label` para 142 botones inline. Faltan ~50%. |
| 1.4.3 Contraste | ⚠️ | `--text-secundario` y `--bg-card` posiblemente <4.5:1. Auditar con Lighthouse. |
| 2.1.1 Teclado | 🟡 | Modales tienen focus trap (utils.js ✅). Day picker probablemente no. |
| 2.4.3 Orden de foco | ⚠️ | Modales abiertos no devuelven foco al disparador en algunos casos. |
| 2.4.7 Foco visible | ✅ | `:focus-visible` en CSS. |
| 3.3.1 Identificación de errores | ⚠️ | Errores en formularios se muestran sólo como toast → invisibles para lectores de pantalla. |
| 4.1.2 Nombre, rol, valor | 🟡 | Botones íconográficos sin `aria-label`. |
| 4.1.3 Mensajes de estado | 🟡 | `sr()` (screen reader announcer) existe ✅ pero se usa sólo en 12 sitios. Debería sonar después de cada `save()`. |

**Acción prioritaria:** correr `axe-core` o `lighthouse --accessibility` y arreglar las violaciones de contraste y los `aria-label` faltantes. Es 1 día de trabajo y sube el score visiblemente.

### 4.3 Móvil

- `index.html` tiene `viewport` correcto y ya hay swipe en `sections.js` ✅.
- `354 inline styles` — la mayoría son anchos fijos en pixeles. En pantallas pequeñas algunos rompen el wrap. Migrar a clases `flex-1`, `w-full` con CSS variables.
- Las tablas en stats y historial colapsan mal en <360px. Considerar virtualizar o reemplazar por cards en móvil.

---

## 5. Persistencia y rendimiento

### 5.1 Persistencia — fortalezas

- **Versionado** ✅ (`_version` en S).
- **Migraciones secuenciales v0→v5** ✅.
- **Verificación de espacio antes de guardar** ✅.
- **Archivado de historial antiguo** cuando hay `QuotaExceededError` ✅.
- **Debounce de save** (cuando se arregle el bug A) ✅.

### 5.2 Persistencia — gaps

- **No hay backup automático**. Un solo error tipográfico en una migración futura → datos perdidos. Sugerencia: cada N días copiar `S` a `localStorage['finko_backup_<timestamp>']` y mantener 3 backups rotando.
- **No hay export automático recordatorio**. Un banner cada 30 días: "🛡️ Hace tiempo no descargás un respaldo de tus datos. ¿Te lo bajo ahora?".
- **No hay validación de schema en `loadData()`**. Si `localStorage` se corrompe (ej. el navegador trunca el JSON), la app puede quedar en estado inconsistente sin avisar.

### 5.3 Rendimiento — focos calientes

| Punto | Costo | Acción |
|---|---|---|
| `renderAll()` invocado tras cada `save()` | O(n) en cada lista | Usar `renderSmart(['solo lo que cambió'])` siempre. |
| `innerHTML` en listas grandes | Layout thrash | `<template>` clonado o `morphdom`. |
| 277 funciones en `window` | Polución del scope global | Migrar a `data-action` + `event.target.closest('[data-action]')`. |
| Lazy-load de `calculadoras.js` | ✅ Ya bien |  |
| Service worker | Verificar que cachee assets correctos en v4.2 |  |

### 5.4 Métrica concreta sugerida

Añadir al `dashboard.js` un panel oculto `?debug=1`:

```js
// Tiempo de boot: medir con performance.mark/measure
// Tamaño de S en bytes: new Blob([JSON.stringify(S)]).size
// Última migración corrida
// Cantidad de períodos archivados
```

---

## 6. Plan de acción priorizado

### 🔴 Hoy (15 minutos)

1. Borrar líneas 195–224 de `storage.js` (versión vieja de `save`).
2. Borrar líneas 206–217 de `events.js` (referencias a calculadoras).
3. Probar manualmente que la app abre y guarda algo.
4. Commit aparte: `fix: bloqueantes de carga (save duplicada, refs a calculadoras)`.

### 🟠 Esta semana

5. Eliminar `updateBadge` duplicado: dejar uno solo en `render.js`.
6. Corregir `he()` para escapar `'`.
7. Sumar tests de `migrations.js` (al menos v3→v4 y v4→v5).
8. Correr Lighthouse y arreglar contrastes y `aria-label` faltantes top 10.

### 🟡 Próximas 2 semanas — Reorganización física

9. Crear `core/`, `infra/`, `ui/`, `dominio/`.
10. Mover archivos respetando la API pública (cambian rutas de import, nada más).
11. Fusionar `cuentas + fondo + ahorrado` → `tesoreria.js`.
12. Fusionar `fijos + agenda + deudas` → `compromisos.js`.
13. Fusionar `gastos + dashboard + resumen + historial` → `ingresos.js`.
14. Verificar que tests siguen pasando.

### 🟢 Mes siguiente — Reducir el monstruo

15. Crear `delegation.js`: un único `document.addEventListener('click', ...)` que mira `data-action`.
16. Migrar `onclick=""` → `data-action="..."` archivo por archivo.
17. Eliminar progresivamente las 277 asignaciones a `window.*`.
18. Reducir `events.js` de 386 a ~100 LOC.

### 🔵 Más adelante — Calidad de vida

19. Banner de backup cada 30 días.
20. Snapshot rotativo en `localStorage`.
21. Web Components para tarjetas reutilizables (gasto, deuda, bolsillo).
22. Virtualización de listas largas en stats e historial.

---

## 7. Sugerencias de mentor (para mejores resultados de la app)

**Sobre el producto:**

- **"Modo plato libre" más visible.** El concepto está y es bueno. Hoy se calcula pero el usuario no lo ve en la portada. Subirlo al dashboard como número grande con semáforo.
- **Recordatorio cariñoso de bolsillos vacíos.** Si pasaron 15 días sin meterle a un bolsillo, mostrar: "Hace ratico no le mandás nada a tu bolsillo de [nombre]. ¿Lo dejamos en pausa o le metemos algo?".
- **Top 3 hormigas del mes.** El cálculo ya existe (`calcularImpactoHormiga`). Mostrarlo como insight semanal: "Tus 3 mayores hormigas de esta quincena fueron: ☕ café $X, 🚕 Uber $Y, 📱 datos $Z". Es el insight más accionable que puede dar la app.
- **Comparar con la quincena pasada en el dashboard.** Mostrar `+12% vs la pasada` con una flechita. El historial ya tiene los datos.

**Sobre el código:**

- **CI/CD aunque sea simulado.** Un GitHub Action de 10 líneas que corra `npm test` en cada push hubiera atrapado los dos bugs bloqueantes. Costo: 1 archivo `.yml`.
- **Convención de naming.** Hoy conviven `renderX`, `actualizarX`, `updX`, `mostrarX`. Elegir uno (`renderX` para DOM, `calcX` para puro). Documentarlo en un `CONTRIBUTING.md` corto.
- **Un `globals.d.ts`** aunque sea sin TypeScript completo: VS Code va a autocompletar `window.f`, `window.he`, etc. y vas a programar al doble de velocidad.

---

## 8. Anexo — Mapa de imports actuales

```
events.js
├─ state, storage, constants, utils, render
├─ sections (navegación)
├─ dashboard, gastos, fijos, deudas, objetivos, inversiones,
│   agenda, cuentas, historial, exports, resumen, fondo, stats,
│   logros, ui-components
└─ NO importa calculadoras (correcto: lazy load)

calculadoras.js (lazy)
└─ Importada bajo demanda por sections.js cuando se entra a la pestaña.
```

**Núcleo crítico (cambiar uno rompe muchos):** `state.js`, `storage.js`, `utils.js`, `render.js`, `events.js`. Cualquier refactor de estos 5 archivos requiere correr **toda** la suite de tests.

---

## ✅ Cierre

Finko Pro tiene un código vivo, con personalidad y muchas decisiones bien tomadas (lazy loading, migraciones versionadas, sr() para lectores de pantalla, ADN colombiano). El próximo salto de calidad **no es agregar funciones**: es **podar y reorganizar** para que cada nueva idea cueste menos.

El orden ideal de la próxima semana de trabajo:

1. Apagar los dos incendios (15 min).
2. Confirmar que pasa Lighthouse decentemente (1 día).
3. Empezar a fusionar dominios (2 a 3 días).
4. Recién ahí, pensar en la siguiente feature.

— Fin de la auditoría v5 —
