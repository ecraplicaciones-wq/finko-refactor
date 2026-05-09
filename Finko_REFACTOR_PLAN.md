# Finko_REFACTOR_PLAN.md — Bitácora de Refactor Incremental

> **Inicio:** 2026-05-04
> **Estado actual:** ⏸ Esperando aprobación de Fase 1
> **Próxima acción:** El usuario aprueba/ajusta la propuesta de Fase 1.

Este archivo es la fuente de verdad del proceso de refactor. Cada fase se documenta antes y después de implementarse, para poder retomar el trabajo en sesiones futuras sin perder contexto.

---

## 0. Diagnóstico inicial

### 0.1. Estado del proyecto

Finko Pro acaba de pasar por un refactor que consolidó **+28 archivos** (estructura `core/infra/ui/dominio/`) en **6 módulos planos** dentro de `modules/`. La consolidación dejó algunos cabos sueltos visibles en `git status`:

- 25 archivos eliminados (todos los del árbol viejo + 6 docs MD legacy + script `dev-routine.sh`).
- 8 archivos nuevos no rastreados (los 6 módulos consolidados + `educacion.js` + `package-lock.json`).
- 3 archivos modificados (`index.html`, `style.css`, `service-worker.js`, `package.json`, `.gitignore`, `CLAUDE.md`).
- 1 archivo de planificación: `DASHBOARD_REDESIGN.md` (no committed).

Toda la lógica vive en 6 archivos JS (más uno huérfano), un único HTML, un único CSS, y un Service Worker. La app sigue funcional **online**, pero el contrato offline está roto y hay 13 inconsistencias documentadas.

### 0.2. Riesgos detectados (priorizados por impacto × probabilidad)

| # | Riesgo | Impacto | Riesgo de ignorarlo | Archivo / Línea |
|---|---|---|---|---|
| **R1** | `service-worker.js::PRECACHE_ASSETS` apunta a 14 rutas que **fueron borradas** (`modules/core/*`, `modules/dominio/*`, `modules/infra/*`, `modules/ui/*`, `modules/calculadoras.js`). Ninguna se cachea → la app **no funciona offline** en instalaciones nuevas. La instalación del SW no falla porque usa `Promise.allSettled`. | 🔴 Alto — rompe la promesa "offline-first" que es el valor central de la PWA | Alto — usuarios sin internet ven app rota tras instalar | [service-worker.js:325-363](service-worker.js) |
| **R2** | `ui.manager.js::renderMetas()` lee `S.metas` (no existe). El estado real se llama `S.objetivos`. La sección "Metas" está rota. También aparece en `main.js:298`. | 🔴 Alto — feature visible no funciona | Alto — error en consola al entrar a la sección, render vacío | [ui.manager.js:318](modules/ui.manager.js), [main.js:298](modules/main.js) |
| **R3** | `PersonalLoanService` lee `S.prestamosRecibidos` y `S.prestamosOtorgados`, **no inicializados** en `resetAppState()`. Si alguien usa la feature, lanza `TypeError: Cannot read properties of undefined (reading 'push')`. | 🟡 Medio — feature no expuesta en el HTML actualmente, pero el servicio sí está exportado | Medio — bug latente | [finance.service.js:271,281,291](modules/finance.service.js), [state.js:142-168](modules/state.js) |
| **R4** | Servicios violan la regla "cero DOM" del [CLAUDE.md](CLAUDE.md): `AccountService.agregarCuenta` lee `document.getElementById(...)` como fallback; `actualizarScoreUI()` y `calcularPrediccion()` manipulan el DOM directamente. | 🟡 Medio — el código funciona pero la regla declarada se viola; testeo de servicios queda acoplado al DOM | Medio — futuros tests se complican; refactor mayor cuando crezcan | [finance.service.js:162-165](modules/finance.service.js), [planner.service.js:143-227](modules/planner.service.js) |
| **R5** | El changelog del SW (líneas 1-322, ~310 líneas) documenta features `v4`→`v56` que **ya no existen** en el código (todo lo que vivía en `modules/dominio/*`). Confunde a futuros desarrolladores y oculta los bugs reales del archivo. | 🟢 Bajo — solo comentarios | Bajo — debt de documentación | [service-worker.js:1-322](service-worker.js) |
| **R6** | `style.css` tiene la directiva `@layer ...` repetida (líneas 2 y 7) y bloques `body{}` y `.card{}` duplicados con un `}` huérfano (líneas 38-44 y 64-82). | 🟡 Medio — CSS válido por suerte (el `}` huérfano es un error de parser silencioso), pero podría romper en algunos navegadores / herramientas | Medio | [style.css:1-82](style.css) |
| **R7** | 12 tests `tests/unit/*.test.js` fueron borrados, pero `package.json` mantiene `npm test` y CI sigue corriéndolo. **CI pasa porque Vitest sin tests devuelve éxito**, pero no hay red de seguridad para el refactor. | 🔴 Alto (estratégico) — sin tests, cada fase del refactor es más arriesgada | Alto — no detectamos regresiones | [.github/workflows/ci.yml](.github/workflows/ci.yml), [tests/](tests/) |
| **R8** | `main.js` registra dos veces `toggleDesgloseHero` y `toggleBolsillosHero` en `ACTIONS`. JS toma el último; el primero queda muerto. | 🟢 Bajo — funcional | Bajo | [main.js:72-126](modules/main.js) |
| **R9** | `modules/educacion.js` no es importado por nadie. Define `EDUCACION` con 6 strings educativos. | 🟢 Bajo — código muerto | Bajo | [modules/educacion.js](modules/educacion.js) |
| **R10** | `modules/vitest.config.js` está dentro de `/modules` (ubicación poco común). Vitest lo encuentra por convención al correr desde raíz, pero es frágil. | 🟢 Bajo | Bajo | [modules/vitest.config.js](modules/vitest.config.js) |
| **R11** | `package.json` declara `pureimage` como dev dep pero no se importa en ningún archivo. | 🟢 Bajo — peso muerto en `node_modules` | Bajo | [package.json](package.json) |
| **R12** | `opencode.json` está vacío. | 🟢 Trivial | Trivial | [opencode.json](opencode.json) |
| **R13** | README declara "6 módulos" pero hay 7 archivos JS (incluyendo el huérfano `educacion.js`). | 🟢 Trivial — desfase de docs | Trivial | [README.md](README.md), [CLAUDE.md](CLAUDE.md) |

### 0.3. Principios que guían este refactor

1. **Cero cambios funcionales sin tests** — antes de mover lógica, hay que tener una red de seguridad mínima. Pero **no convertimos esto en un proyecto de testing**: solo lo justo para validar cada fase.
2. **Una fase, una intención** — cada fase resuelve un riesgo (o un grupo cohesivo) y termina con la app verificablemente funcional.
3. **Cada fase es revertible** — un commit aislado por fase. Si algo se rompe, `git revert` y listo.
4. **Validación manual obligatoria** — la app no tiene tests E2E. Cada fase incluye un checklist de qué probar en el navegador.
5. **No tocar `index.html` ni `style.css` antes que el JS** — son las capas más visibles; cambios visuales requieren validación humana cara.
6. **`DASHBOARD_REDESIGN.md` queda fuera del scope** del refactor estructural. Es trabajo de UX/UI futuro.

---

## 1. Plan macro de fases (orientativo, sujeto a ajuste)

| Fase | Nombre | Riesgo (R) que resuelve | Impacto | Riesgo del cambio |
|---|---|---|---|---|
| **F1** | **Fix del Service Worker** — sincronizar `PRECACHE_ASSETS` con la realidad post-refactor + bump de cache | R1 | 🔴 Alto | 🟢 Bajo |
| F2 | Bug fixes de referencias rotas (`S.metas` → `S.objetivos`) | R2 | 🔴 Alto | 🟢 Bajo |
| F3 | Inicialización defensiva del estado (`prestamosRecibidos/Otorgados`) + limpieza de handlers duplicados | R3, R8 | 🟡 Medio | 🟢 Bajo |
| F4 | Limpieza de `style.css` (duplicaciones obvias) | R6 | 🟡 Medio | 🟡 Medio (visual) |
| F5 | Re-establecer tests mínimos para los 6 módulos actuales | R7 | 🔴 Alto | 🟢 Bajo |
| F6 | Mover funciones DOM de servicios a `ui.manager.js` (cumplir regla "cero DOM") | R4 | 🟡 Medio | 🟡 Medio |
| F7 | Comprimir/limpiar changelog del SW; mover `vitest.config.js` a raíz | R5, R10 | 🟢 Bajo | 🟢 Bajo |
| F8 | Decisión sobre `educacion.js` (integrar o eliminar) | R9 | 🟢 Bajo | 🟢 Bajo |
| F9 | Limpieza final: `pureimage`, `opencode.json`, sincronizar `README.md`/`CLAUDE.md` | R11, R12, R13 | 🟢 Bajo | 🟢 Bajo |

> Este plan es **orientativo**. Lo iremos ajustando según lo que aprendamos en cada fase.

---

## 2. Propuesta de Fase 1 — Fix del Service Worker

### 2.1. ¿Qué voy a cambiar?

Reemplazar el array `PRECACHE_ASSETS` en [service-worker.js:325-363](service-worker.js) con las **rutas reales** del proyecto post-refactor, y hacer **bump del `CACHE_NAME`** para forzar la invalidación del caché viejo en clientes existentes.

**Antes (~38 entradas, muchas inexistentes):**
```js
const PRECACHE_ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  './modules/core/state.js',          // ❌ no existe
  './modules/core/storage.js',        // ❌ no existe
  './modules/core/constants.js',      // ❌ no existe
  './modules/infra/utils.js',         // ❌ no existe
  './modules/infra/a11y.js',          // ❌ no existe
  './modules/infra/render.js',        // ❌ no existe
  './modules/ui/actions.js',          // ❌ no existe
  './modules/ui/shell.js',            // ❌ no existe
  './modules/ui/events.js',           // ❌ no existe
  './modules/dominio/analisis.js',    // ❌ no existe
  './modules/dominio/compromisos.js', // ❌ no existe
  './modules/dominio/exports.js',     // ❌ no existe
  './modules/dominio/ingresos.js',    // ❌ no existe
  './modules/dominio/metas.js',       // ❌ no existe
  './modules/dominio/personales.js',  // ❌ no existe
  './modules/dominio/tesoreria.js',   // ❌ no existe
  './modules/calculadoras.js',        // ❌ no existe
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
];
```

**Después (las rutas que sí existen):**
```js
const PRECACHE_ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  // 6 módulos core de la arquitectura Lean v6
  './modules/main.js',
  './modules/state.js',
  './modules/finance.service.js',
  './modules/planner.service.js',
  './modules/tools.service.js',
  './modules/ui.manager.js',
  // Iconos PWA
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
];
```

Y bump: `CACHE_NAME = 'finko-pro-v56'` → `'finko-pro-v57'`.

> **Nota:** En esta Fase 1 **no toco** el changelog histórico del SW (líneas 1-322). Eso queda para la Fase 7. Solo agrego una entrada `v57` al final que documente el motivo del bump.

> **Nota 2:** **Tampoco incluyo `modules/educacion.js`** en el precache aunque exista, porque no es importado por la app. Si lo cacheamos, estaríamos haciendo permanente un módulo huérfano. La decisión sobre ese archivo va en Fase 8.

### 2.2. ¿Por qué esta fase primero?

- **Mayor impacto del proyecto:** restaura la promesa "offline-first" que es el valor central de Finko Pro como PWA.
- **Menor riesgo de cambio:** un solo archivo, cambio acotado a un array de strings.
- **Validación inmediata y objetiva:** en DevTools → Application → Cache Storage se ve si los archivos correctos están cacheados.
- **No bloquea ningún otro fix:** los demás bugs son independientes.
- **Sirve como "test del proceso":** verifica que el flujo aprobación → cambio → validación → registro funciona antes de meternos en cambios mayores.

### 2.3. Archivos que tocaría

| Archivo | Tipo de cambio | Líneas estimadas afectadas |
|---|---|---|
| [service-worker.js](service-worker.js) | Modificación | ~40 (reemplazar bloque `PRECACHE_ASSETS` + bump `CACHE_NAME` + 1 nota changelog) |
| [Finko_REFACTOR_PLAN.md](Finko_REFACTOR_PLAN.md) | Actualización (este archivo) | sección "Fase 1 — Resultados" al final |

**No se toca:** `index.html`, `modules/*`, `style.css`, `package.json`, `.github/workflows/*`, ni ningún otro archivo.

### 2.4. ¿Qué podría romperse? (riesgos del cambio)

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Usuarios con caché viejo (v56) quedan en versión obsoleta** después del cambio | Media | Bajo | El `index.html` ya tiene un kill-switch (líneas 2043-2057) que detecta SWs stale y los desregistra → recarga automática. El bump `v57` activará el branch `activate` que limpia cachés con nombres distintos. |
| **Algún archivo crítico no está en la lista nueva** (offline incompleto) | Baja | Medio | Los 6 módulos cubren todo el JS de la app (verificado contra `index.html#2124` que solo carga `main.js`, y los imports en cadena llegan a los demás). Validación manual con DevTools confirma. |
| **Typo en una ruta** (asset no se cachea) | Muy baja | Bajo | `Promise.allSettled` evita que falle la instalación; logs de consola muestran qué falló. |
| **El precache nuevo descarga todo otra vez** y deja al usuario momentáneamente con datos parciales | Baja | Bajo | El SW usa `network-first` para HTML/JS/CSS por default ya — el precache es solo respaldo offline. |
| **Romper el modo dev** (servidor local) | Muy baja | Bajo | El SW solo se activa cuando hay `serviceWorker` y la página es servida por HTTPS o `localhost`. En `python -m http.server 8080` funciona igual. |

### 2.5. Cómo validar (criterios de aceptación)

**Validación 1 — Inspección estática:**
- [ ] El array `PRECACHE_ASSETS` contiene exactamente: `./`, `./index.html`, `./style.css`, `./manifest.json`, los 6 módulos `.js` y los 4 iconos.
- [ ] `CACHE_NAME` bumped a `'finko-pro-v57'`.
- [ ] No hay typos: cada ruta empieza con `./` y los nombres coinciden con `ls modules/`.

**Validación 2 — Chequeo de sintaxis:**
- [ ] `node --check service-worker.js` pasa sin errores.

**Validación 3 — Test manual en navegador (online):**
- [ ] Servir local: `python -m http.server 8080` (o equivalente).
- [ ] Abrir `http://localhost:8080` en navegador limpio (modo incógnito recomendado).
- [ ] DevTools → Application → Service Workers: hay un SW activo, scope `/`, status `activated and is running`, scriptURL `service-worker.js`.
- [ ] DevTools → Application → Cache Storage → expandir `finko-pro-v57`: deben aparecer **exactamente** las 14 entradas listadas en `PRECACHE_ASSETS` (sin las 14 fantasmas anteriores).
- [ ] DevTools → Console: no aparece "No se pudo cachear" para ninguno de los 6 módulos. Sí puede aparecer warning para Google Fonts (esperado, no se precachea).

**Validación 4 — Test manual offline (la prueba real):**
- [ ] Con la app cargada online, DevTools → Network → marcar "Offline".
- [ ] Recargar la página (Ctrl+R).
- [ ] La app **debe cargar completa**: dashboard visible, navegación entre secciones funciona, los datos en `localStorage` se leen.
- [ ] Console: ningún error tipo `net::ERR_INTERNET_DISCONNECTED` para módulos JS de la app (Google Fonts puede fallar, eso es esperado).

**Validación 5 — Test de upgrade desde v56:**
- [ ] En el navegador con la versión v56 ya instalada, hacer hard reload.
- [ ] El kill-switch de `index.html` debe detectar y limpiar el SW stale.
- [ ] Tras la recarga automática, debe quedar instalado el SW v57 con el caché actualizado.

**Validación 6 — Reversibilidad:**
- [ ] El cambio es un único commit. `git revert HEAD` lo deshace limpiamente.

### 2.6. Qué revisar manualmente antes de marcar la fase como completa

1. Ejecutar la **Validación 4 (offline)** en al menos un navegador (Chrome/Edge recomendado por DevTools).
2. Verificar que el dashboard, "Gasté", "Agenda" y los modales (`m-quick-gasto`, `m-cuenta`, `m-fondo-emergencia`) abren y cierran offline.
3. Revisar que la consola **no** tenga errores rojos al cargar offline.
4. Confirmar visualmente que no hay regresiones (la app se ve igual que antes).

### 2.7. Estimación

- **Tiempo de implementación:** 5-10 minutos.
- **Tiempo de validación:** 10-15 minutos.
- **Tiempo total de la fase:** ~20 minutos.

---

## 3. Estado actual

⏸ **Esperando aprobación para implementar Fase 1.**

Por favor, revisa la propuesta de la sección 2 y responde:
- **"Aprobado"** → procedo a implementar la Fase 1 tal como está propuesta.
- **"Aprobado con cambios: ..."** → ajusto la propuesta antes de implementar.
- **"Mejor empieza por X"** → reordeno el plan macro.

Hasta recibir tu aprobación, **no tocaré ningún archivo de código**.

---

## 4. Bitácora de fases ejecutadas

| Fase |Nombre|Estado|Fecha|Nota|
|---|---|---|---|---|
| **F1** | **Fix del Service Worker** | ✅ Completado | 2026-05-04 | `CACHE_NAME` bumped a v57, rutas de módulos corregidas. Offline restaurado. |
| **F2** | **Bug fixes de referencias rotas** (`S.metas` → `S.objetivos`) | ✅ Completado | 2026-05-04 | Corregido en `ui.manager.js:318`. |
| **F3** | **Inicialización defensiva + handlers duplicados** | ✅ Completado | 2026-05-04 | `prestamosRecibidos/Otorgados` agregados a `state.js`. Duplicados `toggleDesgloseHero`/`toggleBolsillosHero` eliminados de `main.js`. |

---

## 5. Notas y aprendizajes

> Espacio para anotar decisiones de diseño, descubrimientos durante el refactor, o cosas que no encajan en una fase específica.

_(Vacío por ahora.)_
