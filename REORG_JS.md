# Reorganización del JavaScript — `modules/`

> **Estado:** propuesta. NO ejecutada todavía.
> **Pre‑requisito:** `AUDIT.md` aprobado, `REORG_HTML.md` y `REORG_CSS.md` planeados.
> **Bloqueante de:** Fase 6 (lógica financiera avanzada — los nuevos features se construyen sobre la nueva estructura).

---

## 1 · Objetivo

Llevar `modules/` de **14 archivos con 4 monolitos > 1.500 LOC** a **un árbol de carpetas por subdominio con archivos < 500 LOC cada uno**, sin romper:

- Ningún test (1.311 verdes).
- Ningún handler de UI.
- Ningún flujo de persistencia.
- La filosofía vanilla JS sin build step.

Con eso el repo gana:

- Onboarding más rápido (un dev nuevo entiende un subdominio en 15 minutos).
- Cobertura de tests más fácil de alcanzar y mantener.
- Refactors localizados (un cambio en "agenda" no obliga a abrir "deudas").
- Posibilidad de lazy‑load por subdominio.

---

## 2 · Alcance

- 14 archivos JS en `modules/`.
- Tests en `tests/unit/` (espejarán la nueva estructura).
- `events.js` (orquestador) — su rol no cambia, solo se reduce.
- `service-worker.js` — necesita actualizar lista de assets precacheados.

No se modifica:

- `state.js`, `storage.js`, `constants.js`, `utils.js`, `render.js`, `a11y.js`, `actions.js` — ya están en buen tamaño.
- Lógica de negocio. Solo se mueve.

---

## 3 · Estado actual

### 3.1 · Inventario

| Archivo | LOC | Subdominios fusionados |
|---|---:|---|
| `modules/dominio/analisis.js` | 2.849 | rachas, logros, alertas, salud, predicciones, patrones |
| `modules/dominio/compromisos.js` | 1.992 | fijos, agenda, deudas |
| `modules/dominio/ingresos.js` | 1.623 | gastos, dashboard, resumen, historial |
| `modules/dominio/tesoreria.js` | 1.602 | cuentas, fondo emergencia, bolsillos |
| `modules/dominio/metas.js` | 979 | objetivos, inversiones |
| `modules/dominio/exports.js` | 425 | json, csv, html |
| `modules/dominio/personales.js` | 396 | préstamos personales |
| `modules/calculadoras.js` | 593 | CDT, crédito, compuesto, regla 72, prima |
| `modules/ui/shell.js` | 797 | navegación + tema + sidebar + lazy |
| `modules/ui/events.js` | 363 | bootstrap + window.* + delegación |
| `modules/core/storage.js` | 1.003 | save + load + migraciones + undo |

### 3.2 · Acoplamientos identificados

- `ingresos.js` importa de `analisis.js` (`validarTipoPeriodo`, `detectarAlertasFinancieras`, `calcularChecklistSalud`).
- `events.js` expone ~50 funciones a `window.*` para HTML dinámico.
- `shell.js` llama `window.renderDeudas?.()`, `window.renderGastos?.()` etc. (acoplamiento implícito a globals).
- Múltiples dominios escriben `innerHTML` directamente (renders mezclados con lógica).

### 3.3 · Boilerplate repetido

CRUD del mismo patrón aparece 6‑8 veces:

```js
// Pseudocódigo del patrón guardarItem
function guardarX() {
  const valor = +document.getElementById('x-input').value || 0;
  if (valor <= 0) { showAlert('inválido'); return; }
  S.X.push({ id: crypto.randomUUID(), ... });
  save();
  closeM('m-x');
  renderX();
}

// Pseudocódigo del patrón delItem
function delX(id) {
  showConfirm('¿Eliminar?', () => {
    S.X = S.X.filter(x => x.id !== id);
    save();
    renderX();
  });
}
```

---

## 4 · Problemas detectados

### 4.1 · Críticos

| # | Problema |
|---|---|
| **JS‑C1** | 4 archivos > 1.500 LOC concentran 9.000 LOC = 70% del código de dominio |
| **JS‑C2** | Render mezclado con lógica → cambios visuales requieren tocar dominios |
| **JS‑C3** | CRUD duplicado 6–8 veces sin helper común |

### 4.2 · Altos

| # | Problema |
|---|---|
| **JS‑A1** | `window.*` con ~50 funciones, muchas solo para HTML dinámico |
| **JS‑A2** | `analisis.js` carga eager aunque la sección "Estadísticas" no se haya visitado |
| **JS‑A3** | `ingresos.js → analisis.js` import directo (cross‑dominio) |
| **JS‑A4** | Naming inconsistente (`compromisos`, `events`, `actions`, `shell`) — mezcla EN/ES |
| **JS‑A5** | Falta `.eslintrc` / `prettier` config (sin enforcement automático) |

### 4.3 · Medios

| # | Problema |
|---|---|
| **JS‑M1** | Comentarios JSDoc parciales — algunos sí, la mayoría no |
| **JS‑M2** | `service-worker.js` con lista de assets hardcoded debe actualizarse al partir archivos |
| **JS‑M3** | Tests siguen estructura plana en `tests/unit/`; no espejan dominios fusionados |

---

## 5 · Propuesta

### 5.1 · Árbol objetivo

```
modules/
├─ core/
│  ├─ state.js                     [ya está bien — no tocar]
│  ├─ storage.js                   [se mantiene, considerar partir si supera 1k LOC]
│  └─ constants.js                 [no tocar]
│
├─ infra/
│  ├─ utils.js                     [no tocar]
│  ├─ render.js                    [no tocar]
│  ├─ a11y.js                      [no tocar]
│  └─ crud.js                      ⭐ NUEVO — guardarItem / delItem / editItem genérico
│
├─ ui/
│  ├─ events.js                    [se reduce — menos window.*]
│  ├─ shell.js                     [se mantiene; considerar partir tema/sidebar/swipe]
│  └─ actions.js                   [no tocar]
│
├─ dominio/
│  ├─ ingresos/
│  │  ├─ index.js                  [re-export para compatibilidad]
│  │  ├─ gastos.js                 [< 500 LOC]
│  │  ├─ dashboard.js              [< 500 LOC]
│  │  ├─ resumen.js                [< 400 LOC]
│  │  └─ historial.js              [< 400 LOC]
│  │
│  ├─ compromisos/
│  │  ├─ index.js
│  │  ├─ fijos.js                  [< 500 LOC]
│  │  ├─ agenda.js                 [< 500 LOC]
│  │  └─ deudas.js                 [< 800 LOC — más complejo, OK]
│  │
│  ├─ tesoreria/
│  │  ├─ index.js
│  │  ├─ cuentas.js                [< 500 LOC]
│  │  ├─ fondo-emergencia.js       [< 400 LOC]
│  │  └─ bolsillos.js              [< 400 LOC]
│  │
│  ├─ analisis/
│  │  ├─ index.js
│  │  ├─ rachas.js                 [< 400 LOC]
│  │  ├─ logros.js                 [< 500 LOC]
│  │  ├─ alertas.js                [< 500 LOC]
│  │  ├─ salud.js                  [< 400 LOC]
│  │  ├─ predicciones.js           [< 400 LOC]
│  │  └─ patrones.js               [< 400 LOC]
│  │
│  ├─ metas.js                     [979 LOC: aceptable; partir solo si crece]
│  ├─ exports.js                   [425 LOC: aceptable]
│  └─ personales.js                [396 LOC: aceptable]
│
└─ calculadoras/
   ├─ index.js                     [re-export + lazy registration]
   ├─ cdt.js
   ├─ credito.js
   ├─ compuesto.js
   ├─ regla72.js
   └─ prima.js
```

Resultado: **22 archivos** vs 14, pero **ningún archivo > 800 LOC**, mediana ~400 LOC.

### 5.2 · Patrón `index.js` por subdominio

```js
// modules/dominio/ingresos/index.js
export * from './gastos.js';
export * from './dashboard.js';
export * from './resumen.js';
export * from './historial.js';
```

Ventaja: el resto del código sigue importando `from '../dominio/ingresos.js'` y no nota el cambio. Cuando se quiera modernizar imports, el resto puede pasar a `from '../dominio/ingresos/dashboard.js'` para granularidad.

### 5.3 · Helper CRUD genérico

```js
// modules/infra/crud.js
import { S } from '../core/state.js';
import { save } from '../core/storage.js';
import { showConfirm } from './utils.js';

/**
 * Agrega un item a un array de S y dispara save() + render.
 * @param {keyof typeof S} arrayKey  e.g. 'gastos', 'fijos'
 * @param {object} item              Debe incluir id (UUID)
 * @param {() => void} onSave        Render a llamar después
 */
export function pushItem(arrayKey, item, onSave) {
  if (!Array.isArray(S[arrayKey])) S[arrayKey] = [];
  S[arrayKey].push(item);
  save();
  onSave?.();
}

export function removeItem(arrayKey, id, { confirmText, onSave } = {}) {
  const exec = () => {
    S[arrayKey] = S[arrayKey].filter(x => x.id !== id);
    save();
    onSave?.();
  };
  if (confirmText) showConfirm(confirmText, exec);
  else exec();
}

export function updateItem(arrayKey, id, patch, onSave) {
  const idx = S[arrayKey].findIndex(x => x.id === id);
  if (idx === -1) return false;
  S[arrayKey][idx] = { ...S[arrayKey][idx], ...patch };
  save();
  onSave?.();
  return true;
}
```

Reusar en: `gastos.js`, `fijos.js`, `deudas.js`, `cuentas.js`, `objetivos.js`, `inversiones.js`, `personales.js` → ahorro estimado **~500 LOC** de boilerplate.

### 5.4 · Desacoplamiento `ingresos → analisis` vía EventBus

Hoy:

```js
// ingresos.js
import { detectarAlertasFinancieras } from './analisis.js';
function updateDash() {
  const alertas = detectarAlertasFinancieras(S);
  // ...
}
```

Plan:

```js
// ingresos.js
import { EventBus } from '../core/state.js';
function updateDash() {
  const alertas = EventBus.request('analisis:alertas', { S }) ?? [];
  // ...
}

// analisis/alertas.js
EventBus.respond('analisis:alertas', ({ S }) => detectarAlertasFinancieras(S));
```

(Si no se quiere extender el EventBus al patrón request/response, se puede mantener el import directo y simplemente moverlo a un archivo más pequeño.)

### 5.5 · Lazy‑load de `analisis/`

`analisis/` no se necesita hasta que el usuario entra a la sección "Estadísticas" o se calcula la salud financiera del dashboard.

```js
// shell.js, dentro del switch de secciones:
case 'stat': {
  const mod = await import('../dominio/analisis/index.js');
  mod.renderStats();
  mod.renderLogros();
  mod.renderRachaWidget();
  break;
}
```

`ingresos/dashboard.js::updateDash` necesita salud + alertas → puede importar `analisis/salud.js` y `analisis/alertas.js` directamente (módulos pequeños), evitando cargar `rachas`, `logros`, `predicciones` hasta que se necesiten.

Ahorro estimado en bundle inicial: **~3 KB minified** (de un módulo de 2.849 LOC).

### 5.6 · Reducción de `window.*`

Hoy (medido): **74** asignaciones `window.X = …` en `events.js`; **210** en todo `modules/`.

Plan post‑refactor:

| Categoría (en `events.js`) | Hoy | Objetivo |
|---|---:|---:|
| Utils (`f`, `he`, `mesStr`, dialogs) | ~11 | 11 ✅ (necesarias para HTML estático) |
| Render globales (`updSaldo`, `renderAll`) | ~5 | 0 (vía EventBus) |
| Handlers de HTML dinámico | ~40 | 5 (resto migrado a `data-action`) |
| Funciones llamadas desde otros módulos vía window | ~18 | 0 (imports directos) |
| **Total `events.js`** | **74** | **≤ 16** |
| **Total `modules/`** | **210** | **< 30** |

### 5.7 · Naming

Mantener nombres en **español neutro** para dominios (ya consistente: `ingresos`, `compromisos`, `tesoreria`, `metas`, `analisis`).

Mantener nombres en **inglés** solo para infra/ui (ya consistente: `state`, `storage`, `utils`, `render`, `events`, `actions`, `shell`).

Excepción aceptable: `personales.js` (préstamos personales) — claro en español.

### 5.8 · Linter (opcional, recomendado)

Agregar `.eslintrc.json` con reglas mínimas: no `console.log` en producción, no `var`, prefer‑const, no‑unused‑vars. **No** introducir un sistema de build, solo un linter standalone.

---

## 6 · Fases de ejecución

### Fase JS‑1 — Helper `crud.js` + tests (½ día)

1. Crear `modules/infra/crud.js`.
2. Crear `tests/unit/crud.test.js` (cobertura completa).
3. Refactorizar 1 dominio piloto (ej. `personales.js`) para usar el helper.
4. Verificar tests verdes.

**Verificación:** dominio piloto reducido en ~30 LOC, tests intactos.

### Fase JS‑2 — Partir `analisis.js` en `analisis/` (1.5 días)

1. Crear `modules/dominio/analisis/` con 6 sub‑archivos.
2. Mover funciones por subdominio.
3. Crear `index.js` con re‑exports.
4. Mover `tests/unit/analisis.test.js` → `tests/unit/analisis/{rachas,logros,...}.test.js` o mantener flat con etiqueta.
5. Verificar tests verdes.
6. Actualizar `service-worker.js` con nuevas rutas.

**Verificación:** ningún archivo > 600 LOC; tests verdes; bundle inicial igual o menor.

### Fase JS‑3 — Partir `compromisos.js` en `compromisos/` (1 día)

Idéntico a fase 2 pero con 3 sub‑archivos.

**Verificación:** `fijos.js`, `agenda.js`, `deudas.js` cada uno < 800 LOC.

### Fase JS‑4 — Partir `ingresos.js` en `ingresos/` (1 día)

4 sub‑archivos. Atención al import cross‑dominio con `analisis/`.

**Verificación:** `gastos.js`, `dashboard.js`, `resumen.js`, `historial.js` cada uno < 500 LOC.

### Fase JS‑5 — Partir `tesoreria.js` en `tesoreria/` (½ día)

3 sub‑archivos.

**Verificación:** cada uno < 500 LOC.

### Fase JS‑6 — Partir `calculadoras.js` en `calculadoras/` (½ día)

5 sub‑archivos. Mantener lazy‑load.

**Verificación:** primera visita a sección de calculadoras carga solo lo necesario.

### Fase JS‑7 — Reducir `window.*` (1 día)

1. Auditar uso real con grep.
2. Migrar handlers de HTML dinámico a `data-action` en coordinación con `REORG_HTML.md`.
3. Reemplazar llamadas `window.renderX()` por `EventBus.emit('domain:X:changed')` + listener en `shell.js` o `events.js`.

**Verificación:** count `window.*` ≤ 16.

### Fase JS‑8 — EventBus expandido (½ día)

1. Agregar eventos: `domain:gastos:changed`, `domain:fijos:changed`, etc.
2. `shell.js` y `events.js` se suscriben.
3. Documentar lista de eventos en `ARCHITECTURE.md`.

**Verificación:** zero llamadas `window.renderX?.()` en `shell.js`.

### Fase JS‑9 — Linter (¼ día)

1. Agregar `.eslintrc.json` con reglas básicas.
2. Correr `npx eslint modules/` y arreglar warnings.
3. Documentar comando en `README.md`.

**Verificación:** `eslint` corre sin errores.

---

## 7 · Pasos detallados (ejemplo: Fase JS‑2)

1. `mkdir modules/dominio/analisis`.
2. Abrir `analisis.js` y mapear funciones por subdominio.
3. Crear `analisis/rachas.js`. Mover funciones relacionadas (`calcularRachaHormiga`, `calcularRachaAhorro`, `renderRachaWidget`). Mantener exports.
4. Repetir con `logros.js`, `alertas.js`, `salud.js`, `predicciones.js`, `patrones.js`.
5. Crear `analisis/index.js`:

```js
export * from './rachas.js';
export * from './logros.js';
export * from './alertas.js';
export * from './salud.js';
export * from './predicciones.js';
export * from './patrones.js';
```

6. Borrar `analisis.js` original.
7. Verificar imports en `events.js` (siguen apuntando a `'../dominio/analisis.js'` vía Node resolution → falla; cambiar a `'../dominio/analisis/index.js'` o agregar `package.json` con `"main": "index.js"` en la carpeta).

   **Solución elegante:** crear `modules/dominio/analisis.js` como un re‑export delgado:

   ```js
   // modules/dominio/analisis.js
   export * from './analisis/index.js';
   ```

   Esto mantiene los imports antiguos funcionando.

8. Mover/dividir tests.
9. Correr `npm test`.
10. Actualizar `service-worker.js` (`PRECACHE_ASSETS` y `CACHE_NAME`).
11. Commit: `refactor(analisis): partir en subdominios (rachas/logros/alertas/salud/predicciones/patrones)`.

---

## 8 · Criterios de verificación

- [ ] Ningún archivo en `modules/dominio/**` > 800 LOC.
- [ ] Ningún archivo en `modules/dominio/**` > 500 LOC excepto `deudas.js` (justificado).
- [ ] `infra/crud.js` reusado en ≥ 5 dominios.
- [ ] `tests/unit/` espeja la estructura.
- [ ] 1.311 tests siguen verdes.
- [ ] `window.*` reducido a ≤ 16.
- [ ] `analisis/` carga lazy (verificable en Network panel).
- [ ] `service-worker.js` actualizado y funcional.
- [ ] `eslint` sin errores (si se agrega).
- [ ] `ARCHITECTURE.md` actualizado con nuevo árbol.

---

## 9 · Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Romper imports al mover archivos | Alta | Alto | Hacer un dominio por commit; tests verdes obligatorios |
| Service Worker sirve archivos viejos | Alta | Medio | Bumpear `CACHE_NAME` con cada partición |
| Test no detecta regresión de UI | Media | Medio | Smoke test manual al final de cada fase |
| EventBus introduce latencia o bugs sutiles | Baja | Medio | Mantener imports directos como fallback durante transición |
| Refactor cross‑dominio bloqueado por un import circular | Baja | Alto | Usar EventBus o promotear función a `infra/` |
| Linter rechaza patrones legítimos del proyecto | Media | Bajo | Configurar reglas mínimas; permitir overrides explícitos |

---

## 10 · Dependencias

- **Bloqueado por:** Fase 0 (red de seguridad), `REORG_CSS.md` y `REORG_HTML.md` (al menos planeados).
- **Coordinación con:** `REORG_HTML.md` (migración de handlers a `data-action`).
- **Bloqueante de:** Fase 6 (lógica financiera avanzada — los nuevos features se construyen sobre la nueva estructura).

---

## 11 · Checklist final

- [ ] `infra/crud.js` creado con tests.
- [ ] `analisis/` particionado en 6 sub‑archivos.
- [ ] `compromisos/` particionado en 3 sub‑archivos.
- [ ] `ingresos/` particionado en 4 sub‑archivos.
- [ ] `tesoreria/` particionado en 3 sub‑archivos.
- [ ] `calculadoras/` particionado en 5 sub‑archivos (lazy).
- [ ] `window.*` reducido ≥ 60% (de ~50 a ≤ 16).
- [ ] EventBus extendido con eventos de dominio.
- [ ] Tests siguen 100% verdes.
- [ ] `service-worker.js` actualizado.
- [ ] `ARCHITECTURE.md` refleja el nuevo árbol.
- [ ] Linter (opcional) configurado.

---

*Próximo documento: [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).*
