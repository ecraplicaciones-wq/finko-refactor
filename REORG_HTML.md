# Reorganización del HTML — `index.html`

> **Estado:** propuesta. NO ejecutada todavía.
> **Pre‑requisito:** Fase 0 del `ROADMAP.md` (red de seguridad: tests verdes, métricas baseline).
> **Bloqueante de:** Fase 5 (UX moderna).

---

## 1 · Objetivo

Dejar `index.html` **legible, mantenible y consistente** con el sistema de diseño, sin perder ninguna funcionalidad y sin romper la accesibilidad existente.

Concretamente:

1. Bajar **341 → < 60** atributos `style="…"` inline.
2. Mantener **0** `onclick`. Migrar progresivamente HTML dinámico a `data-action` también.
3. Mantener o mejorar los 182 atributos ARIA existentes.
4. Validar W3C HTML5 sin errores.

---

## 2 · Alcance

- `index.html` (1.942 LOC).
- Plantillas de HTML dinámico generadas con `innerHTML` desde los dominios JS (sólo la parte HTML, **sin tocar la lógica JS**).
- No se tocan los estilos en `style.css` desde este documento (eso es alcance de `REORG_CSS.md`).

---

## 3 · Estado actual

### 3.1 · Métricas

| Métrica | Hoy | Objetivo |
|---|---:|---:|
| LOC `index.html` | 1.942 | 1.700–1.900 |
| `onclick=""` estáticos | 0 ✅ | 0 ✅ |
| `data-action=""` | 156 | 156+ |
| `style="..."` inline | **341** ⚠️ | **< 60** |
| ARIA attrs | 182 ✅ | 182+ |
| Skip‑link | ✅ presente | ✅ |
| `aria-live` region | ✅ presente | ✅ |
| Validación W3C | desconocida | sin errores |

### 3.2 · Estructura macro

`index.html` tiene 5 bloques claros:

1. **Head** (≈80 LOC): meta tags PWA, viewport, theme‑color, preconnect Fonts, modulepreload de 7 módulos core, manifest.
2. **Sidebar** (lateral, expandible) — navegación principal entre las 9 secciones.
3. **Navbar inferior** (mobile) — atajos.
4. **Secciones** (`#sec-*`): 9 secciones con sus contenedores y formularios. Solo una visible a la vez.
5. **Modales** (al final del body): 20 modales con patrón uniforme (`<div class="modal-ov" role="dialog" aria-modal="true">`).

### 3.3 · Patrones repetidos identificados

- **Modal estándar** (20 instancias): mismo wrapper, mismo header con botón de cerrar, mismo footer con acciones.
- **Card de lista** (≈60 instancias): `.fijo-card`, `.hist-card`, `.inv-card`, `.pago-card` — comparten estructura base.
- **Form‑row** (≈40 instancias): label + input + helper text en patrón de fila.
- **Day picker** (≈10 instancias): mismo widget reutilizado en gastos, fijos, agenda, objetivos.

### 3.4 · Distribución de los 341 inline styles

Análisis preliminar (basado en grep semántico):

| Propósito | Conteo aprox. | Migrable a clase | Inline justificado |
|---|---:|:---:|:---:|
| Colores con `var(--…)` (`color`, `background`) | 110 | ✅ Sí | ❌ |
| Margin / padding fijos (`margin-bottom: 4px`) | 80 | ✅ Sí | ❌ |
| Tamaños fijos (`width: 76px`, `height: 100px`) | 45 | ⚠️ Parcial | ⚠️ Algunos |
| Borders personalizados (`border: 2px dashed rgba(…)`) | 30 | ✅ Sí | ❌ |
| Gradientes locales | 20 | ✅ Sí | ❌ |
| `display`/`flex` overrides | 25 | ✅ Sí | ❌ |
| Cálculos dinámicos legítimos (barras de progreso `width: ${pct}%`) | 25 | ❌ | ✅ |
| `transform: rotate()` para arrows | 6 | ✅ (data‑state) | ⚠️ |
| Total | 341 | ~310 migrables | ~30 inevitables |

**Conclusión:** se pueden eliminar ~280 inline styles reusando clases existentes (`ui-row`, `ui-label`, `ui-val`, `ui-chip`, etc.) o creando 5–8 nuevas. Quedan ~60 cuyo valor depende de cálculo dinámico (porcentajes, contadores, semáforos).

### 3.5 · Modales (20)

Lista identificada:

1. `m-bolsillo-nuevo`
2. `m-bolsillo-mov`
3. `m-fondo`
4. `m-cuenta-nueva`
5. `m-gasto-edit`
6. `m-objetivo-nuevo`
7. `m-objetivo-accion`
8. `m-deuda-nueva`
9. `m-deuda-edit`
10. `m-deuda-pagar`
11. `m-pago-nuevo`
12. `m-pago-detalle`
13. `m-fijo-nuevo`
14. `m-fijo-detalle`
15. `m-inv-nueva`
16. `m-inv-rendimiento`
17. `m-prima`
18. `m-confirm` (genérico)
19. `m-prompt` (genérico)
20. `m-importar`

Todos siguen el mismo molde. El único que rompe el patrón es `m-confirm` y `m-prompt`, que son genéricos invocables desde `utils.js::showConfirm/showPrompt`.

---

## 4 · Problemas detectados

### 4.1 · Críticos

| # | Problema | Impacto |
|---|---|---|
| **H‑C1** | 341 inline styles bloquean dark/light theme consistente y dificultan modificación visual | Cualquier cambio de paleta requiere editar HTML, no solo CSS |
| **H‑C2** | HTML dinámico (innerHTML desde JS) **aún usa funciones `window.*`** en handlers | Acoplamiento con `events.js`; cambios de firma rompen silenciosamente |

### 4.2 · Altos

| # | Problema |
|---|---|
| **H‑A1** | 20 modales con estructura repetida (no hay template / partial) — duplicación de markup |
| **H‑A2** | Algunos `aria-label` están en español pero hay 3 instancias en inglés (mezcla) |
| **H‑A3** | Día picker repetido 10 veces inline (no es un componente) |
| **H‑A4** | `<button>` vs `<div role="button">` mezclado en algunos lugares |
| **H‑A5** | Falta `lang="es-CO"` o solo está como `lang="es"` (debe verificarse) |

### 4.3 · Medios

| # | Problema |
|---|---|
| **H‑M1** | Comentarios HTML dispersos sin convención |
| **H‑M2** | Algunos IDs muy cortos (`g-mo`, `q-ing`) — buenos para code golf, malos para grep |
| **H‑M3** | Modales declarados al final del body sin agrupación visual / comentario separador |
| **H‑M4** | Falta `<noscript>` para usuarios con JS deshabilitado (mensaje amigable) |

---

## 5 · Propuesta

### 5.1 · Principios

1. **Cada inline style debe poderse explicar.** Si la respuesta es "porque sí", se va a clase.
2. **HTML legible para personas, no para diff de git.** Bloques separados con comentarios `<!-- ─── … ─── -->`.
3. **Componentes virtuales por convención.** Aunque no hay framework, podemos definir patrones de markup que se respeten siempre.
4. **Accesibilidad primero.** Cualquier refactor que reduzca ARIA o foco se rechaza automáticamente.

### 5.2 · Tabla de mapeo inline → clase

> Esta tabla es el corazón del refactor. Se construye con conteo real durante la ejecución.

| Inline observado | Clase de reemplazo | Notas |
|---|---|---|
| `style="color: var(--a1)"` | `.t-a1` (nueva, alineada con token `--a1`) | Repetido 25+ veces |
| `style="color: var(--a2)"` | `.t-a2` | Repetido 15+ |
| `style="color: var(--ok)"` | `.t-ok` | |
| `style="color: var(--war)"` | `.t-warn` | |
| `style="color: var(--dan)"` | `.t-danger` | |
| `style="background: rgba(0,0,0,.2)"` | `.bg-overlay-soft` | |
| `style="margin-bottom: 4px"` | `.mb-1` | Token spacing 4px |
| `style="margin-bottom: 8px"` | `.mb-2` | 8px |
| `style="margin-bottom: 16px"` | `.mb-4` | 16px |
| `style="display: flex; gap: 8px"` | `.row-gap8` (existe) | Reusar |
| `style="border: 2px dashed rgba(59,158,255,.4)"` | `.card-dashed-info` | |
| `style="transform: rotate(180deg)"` | `[data-state="open"]` + CSS | Migrar a estado |
| `style="width: ${pct}%"` (barra) | INLINE LEGÍTIMO | Mantener |
| `style="--g-color: ${color}"` (custom prop) | INLINE LEGÍTIMO | CSS variable dinámica |

### 5.3 · Componentes virtuales propuestos

Aunque no hay framework, definimos contratos de markup que cualquier dominio que genere HTML dinámico debe respetar:

```html
<!-- COMPONENTE: card-list-item -->
<article class="card list-item" data-id="{id}">
  <header class="list-item__header">
    <h3 class="list-item__title">{title}</h3>
    <span class="ui-chip ui-chip--{color}">{badge}</span>
  </header>
  <div class="list-item__body">
    <div class="ui-row ui-row-sb">
      <span class="ui-label">{label}</span>
      <span class="ui-val">{value}</span>
    </div>
  </div>
  <footer class="list-item__actions">
    <button class="btn btn-sm bg" data-action="edit{Item}" data-arg-id="{id}">Editar</button>
    <button class="btn btn-sm bd" data-action="del{Item}" data-arg-id="{id}">Eliminar</button>
  </footer>
</article>
```

```html
<!-- COMPONENTE: modal -->
<div class="modal-ov" id="m-{name}" role="dialog" aria-modal="true" aria-labelledby="m-{name}-title">
  <div class="modal">
    <header class="modal__header">
      <h2 id="m-{name}-title">{title}</h2>
      <button class="modal__close" aria-label="Cerrar" data-action="closeM" data-arg-id="m-{name}">×</button>
    </header>
    <div class="modal__body">{content}</div>
    <footer class="modal__footer">
      <button class="btn bg" data-action="closeM" data-arg-id="m-{name}">Cancelar</button>
      <button class="btn bp" data-action="{actionPrimary}">{ctaPrimary}</button>
    </footer>
  </div>
</div>
```

```html
<!-- COMPONENTE: day-picker -->
<div class="day-picker" data-day-picker-id="{id}">
  <button class="day-picker__btn" data-action="toggleDayPicker" data-arg-id="{id}" aria-expanded="false">
    <span class="day-picker__icon">📅</span>
    <span class="day-picker__label">{label}</span>
  </button>
  <div class="day-picker__panel" hidden>
    <!-- Botones día 1..31 generados con data-action="selectDay" -->
  </div>
</div>
```

Estos contratos quedan documentados en `DESIGN_SYSTEM.md` con su CSS asociado.

### 5.4 · Migración HTML dinámico a `data-action`

HTML dinámico hoy genera handlers con `window.delGasto(id)`, `window.abrirEditarGasto(id)`, etc.

Migrar a:

```js
// HOY
gastos.map(g => `<button onclick="delGasto(${g.id})">×</button>`).join('');

// OBJETIVO
gastos.map(g => `<button data-action="delGasto" data-arg-id="${g.id}">×</button>`).join('');
```

Y registrar la acción una sola vez en `events.js`:

```js
registerAction('delGasto', ({ id }) => delGasto(+id));
```

Beneficio: se puede eliminar de `window.*` (hoy hay ~30 funciones que solo existen para HTML dinámico).

---

## 6 · Fases de ejecución

### Fase HTML‑1 — Mapeo y baseline (½ día)

1. Generar conteo verificado de inline styles por tipo (script de auditoría one‑off).
2. Inventariar todas las clases CSS existentes y mapear cuáles cubren cada inline.
3. Listar clases nuevas a crear (estimado: 5–8 utilities + 3–5 componentes).
4. Snapshot de Lighthouse, validador W3C, axe‑core para tener baseline.

**Verificación:** documento `migration-table-html.md` con todas las filas listadas.

### Fase HTML‑2 — Crear clases nuevas en CSS (½ día)

> Esta sub‑fase **sí toca CSS** porque es prerequisito.

1. Agregar utilities (`.t-a{1..7}`, `.bg-overlay-soft`, `.mb-{1..6}`). **Naming definitivo `.t-a*`** alineado con tokens `--a1..a7` (decisión registrada en `REORG_CSS.md §5.4`).
2. Agregar componentes (`.list-item`, `.modal__header`, `.day-picker__*`).
3. Tests de no regresión visual (capturas antes/después de Lighthouse).

**Verificación:** `npm test` verde + Lighthouse igual o mejor.

### Fase HTML‑3 — Migrar inline styles por sección (1–2 días)

1. Sección por sección, en este orden (de más simple a más compleja):
   - Sidebar + navbar
   - `#sec-dash`
   - `#sec-quin`
   - `#sec-gast`
   - `#sec-alcancias`
   - `#sec-inve`
   - `#sec-agenda`
   - `#sec-deudas`
   - `#sec-meDeben`
   - `#sec-stat`
2. Cada sección = 1 commit.
3. Verificar manual + Lighthouse después de cada commit.

**Verificación final de fase:** inline styles ≤ 60 (de 341).

### Fase HTML‑4 — Migrar modales a contrato uniforme (1 día)

1. Aplicar componente `modal` a los 20 modales (archivos `m-*`).
2. Verificar que `aria-labelledby` apunta a un `<h2>` real.
3. Verificar focus trap funciona en todos.

**Verificación:** test manual con teclado + axe‑core sin errores.

### Fase HTML‑5 — Migrar HTML dinámico a `data-action` (2 días)

1. Identificar todas las plantillas con `onclick="windowFn(...)"`.
2. Migrar una plantilla por commit (≈ 6–8 plantillas):
   - `gastos.js::renderGastos`
   - `compromisos.js::renderFijos`
   - `compromisos.js::renderDeudas`
   - `compromisos.js::renderPagos`
   - `tesoreria.js::renderCuentas`
   - `metas.js::renderObjetivos`
   - `metas.js::renderInversiones`
   - `personales.js::renderPersonales`
3. Quitar de `events.js::window.*` cada función que ya no se llama.

**Verificación:** `grep -r "window\." modules/` ≤ 20 referencias (de ~50).

### Fase HTML‑6 — Pulido final (½ día)

1. Agregar `<noscript>` con mensaje amigable.
2. Verificar `lang="es-CO"`.
3. Comentarios `<!-- ─── Sección X ─── -->` separadores.
4. Validar W3C HTML5 sin errores.

**Verificación:** validador online sin errores.

---

## 7 · Pasos detallados (ejemplo de Fase HTML‑3, sección `#sec-dash`)

1. Abrir `index.html` en el rango de líneas de `#sec-dash`.
2. Por cada `style="..."`, decidir según tabla §5.2:
   - Si está en tabla → reemplazar por clase.
   - Si es cálculo dinámico → mantener inline (anotar en JS comment).
3. Si la clase no existe en `style.css`, creárla en la capa correcta:
   - Utilities → `@layer utils`
   - Componentes → `@layer components`
4. Testear visualmente la sección en oscuro y claro.
5. Correr `npm test`.
6. Commit: `refactor(html): #sec-dash sin inline styles`.

---

## 8 · Criterios de verificación

- [ ] `style="..."` inline ≤ 60.
- [ ] `onclick=""` se mantiene en 0.
- [ ] `data-action=""` ≥ 156.
- [ ] ARIA attrs ≥ 182.
- [ ] Lighthouse Accessibility ≥ 95 (era ~85).
- [ ] axe‑core: 0 issues críticos.
- [ ] Validador W3C HTML5: 0 errores.
- [ ] `npm test` verde.
- [ ] `window.*` exposiciones reducidas en ≥ 50%.

---

## 9 · Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Cambio visual no detectado por tests | Media | Medio | Capturas antes/después por sección + revisión humana |
| Perder un `aria-*` durante migración | Baja | Alto | Lint con axe‑core en CI antes de merge |
| Romper handler dinámico al migrar a `data-action` | Media | Medio | Commit por plantilla; rollback rápido si falla |
| Service Worker sirve cache vieja | Alta | Medio | Bumpear `CACHE_NAME` al final de cada fase |
| Inline justificado se elimina por error | Baja | Bajo | Tabla §5.2 marca explícitamente los "INLINE LEGÍTIMO" |

---

## 10 · Dependencias

- **Bloqueado por:** Fase 0 del `ROADMAP.md` (red de seguridad).
- **Coordinación con:** `REORG_CSS.md` (clases nuevas se crean ahí), `DESIGN_SYSTEM.md` (contratos de componentes).
- **Bloqueante de:** Fase 5 (UX moderna — Bento Grid, microcopy).

---

## 11 · Checklist final

- [ ] Tabla de mapeo inline → clase generada y aprobada.
- [ ] Clases nuevas (utilities + componentes) creadas en `style.css`.
- [ ] 9 secciones migradas (≤ 60 inline styles totales).
- [ ] 20 modales con contrato uniforme.
- [ ] HTML dinámico migrado a `data-action` en ≥ 6 plantillas.
- [ ] `<noscript>` agregado.
- [ ] `lang="es-CO"` verificado.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] axe‑core sin críticos.
- [ ] Validador W3C limpio.
- [ ] Service Worker `CACHE_NAME` bumpeado.

---

*Próximo documento: [`REORG_CSS.md`](./REORG_CSS.md).*
