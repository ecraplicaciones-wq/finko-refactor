# Reorganización del CSS — `style.css`

> **Estado:** propuesta. NO ejecutada todavía.
> **Pre‑requisito:** `AUDIT.md` aprobado, baseline visual capturado.
> **Coordinación:** se ejecuta antes/durante `REORG_HTML.md` porque crea las clases que el HTML va a usar.
> **Bloqueante de:** Fase 5 (UX moderna — Bento Grid).

---

## 1 · Objetivo

Convertir `style.css` (1.241 LOC) en un **sistema de diseño explícito y mantenible**, manteniendo la estética actual (verde neón + glassmorphism suave) y preparando el terreno para:

- Bento Grid en desktop.
- Migración de inline styles a clases.
- Modo oscuro / claro 100% consistente.
- Tipografía y paleta documentadas en `DESIGN_SYSTEM.md`.

---

## 2 · Alcance

- `style.css` (1.241 LOC).
- No se tocan los inline styles en HTML desde aquí (ese es alcance de `REORG_HTML.md`), pero **sí se crean** las clases que ese refactor necesita.
- No se modifica el comportamiento JS.
- La estética actual (paleta, tipografía, glassmorphism) se **conserva**. La modernización visual (Bento Grid, microcopy) se hace en Fase 5 y se documenta en `DESIGN_SYSTEM.md`.

---

## 3 · Estado actual

### 3.1 · Estructura

```css
@layer reset       → normalizaciones
@layer base        → tokens (custom properties), tipografía base
@layer layout      → grid, flex helpers, contenedores
@layer components  → .btn, .card, .ui-row, etc.
@layer modals      → modal, overlay, focus trap
@layer theme       → modo oscuro + light-theme override
@layer responsive  → media queries
@layer utils       → utilities (mt-*, sr-only, etc.)
```

Orden correcto. La cascada está controlada.

### 3.2 · Tokens vivos (~70 custom properties)

**Surfaces / borders / texto:**
- `--bg`, `--s1`, `--s2`, `--s3` — superficies
- `--b1`, `--b2`, `--b3` — bordes
- `--t1`, `--t2`, `--t3` — texto

**Acentos:**
- `--a1: #00dc82` (verde primario)
- `--a2: #ffd60a` (amarillo)
- `--a3: #ff6b35` (naranja)
- `--a4: #3b9eff` (azul)
- `--a5: #9d73eb` (púrpura)
- `--a6: #ff4eb8` (rosa)
- `--a7: #00e5cc` (turquesa)

**Semánticos:**
- `--ok` (verde)
- `--war` (amarillo / warning)
- `--dan` (rojo)
- `--inf` (azul)
- `--stat-*` (estados específicos)

**Geometría:**
- `--r1: 8px`, `--r2: 12px`, `--r3: 16px`, `--r4: 22px`
- `--shadow: 0 4px 24px rgba(0,0,0,.35)`
- `--ga1` … `--ga4` (gradientes con `color-mix`)

**Tipografía:**
- `--ff: 'Inter', system-ui` (UI)
- `--fm: 'DM Mono', ui-monospace` (valores numéricos)

**No tokenizado (oportunidad):**
- Spacing (margin/padding) — se usa hardcoded `4/8/12/16/20/24` en muchos lugares.
- Tipo scale — se manejan tamaños puntuales (`14px`, `20px`, `24px`) sin escala formal.
- Z-index — pocas referencias, suficiente.

### 3.3 · Componentes existentes

| Componente | Variantes | Uso |
|---|---|---|
| `.btn` | `.bp` (primario), `.bg` (gris), `.bd` (danger), `.bbl`, `.byw`, `.bor`, `.bpu` | Botones |
| `.btn` modificadores | `.bsm` (small), `.bfw` (full‑width) | Tamaño |
| `.card` | `.accent-green/blue/yellow/purple/red` | Cards genéricas |
| `.hist-card`, `.fijo-card`, `.inv-card`, `.pago-card` | — | Cards específicas (similares) |
| `.ui-label`, `.ui-label-sm`, `.ui-label-mb` | — | Labels |
| `.ui-val`, `.ui-val-lg`, `.ui-val-md`, `.ui-val-sm`, `.ui-val-green/red` | — | Valores numéricos |
| `.ui-row`, `.ui-row-sb`, `.ui-row-gap8/10` | — | Filas flex |
| `.ui-chip` | + colores | Badges |
| `.ui-acc-btn`, `.ui-acc-arrow` | — | Acordeones |
| `.gast-tab`, `.qtab` | — | Tabs |
| `.gc` | — | Generic card |

### 3.4 · Modo oscuro / claro

- `:root { color-scheme: dark light }`
- Default = oscuro.
- `body.light-theme` sobrescribe los ~70 tokens.
- 5 reglas explícitas adicionales en light (sidebar, btn.bp, sh-icon).
- Sombras más suaves en light (`0 4px 16px` vs `0 4px 24px`).
- Glow ambient atenuado en light (`--body-glow-opacity: 0.3`).

### 3.5 · Responsive

5 breakpoints:

- ≤ 359px (mobile ultra)
- 360–480px (mobile)
- 481–768px (mobile landscape / tablet pequeña)
- 769–1024px (tablet)
- ≥ 1440px (escritorio grande)

Sin container queries. Sin `clamp()` para tipografía fluida.

### 3.6 · Estética actual

**Minimalismo + Glassmorphism suave** con:

- Fondo oscuro `#080c0a` con radial glow verde sutil.
- Cards `rgba(...)` con `backdrop-filter: blur(4px)`.
- Acento verde neón `#00dc82` como pulse visual.
- Acentos auxiliares (naranja, azul, púrpura) para estados/categorías.
- Sombras `0 4px 24px rgba(0,0,0,.35)`.
- Radii medianos (8–22px).
- Tipografía: Inter (300‑800) + DM Mono (300‑500).

**Es buena. Conservar.**

---

## 4 · Problemas detectados

### 4.1 · Críticos

| # | Problema |
|---|---|
| **CSS‑C1** | Spacing no tokenizado: `margin-bottom: 4/8/12/16/20/24px` aparece hardcoded en 80+ lugares |
| **CSS‑C2** | Tipo scale no formal: tamaños `14/16/18/20/24px` sin escala 8pt explícita |
| **CSS‑C3** | Sin clases utilitarias para colores de acento (las HTML usan `style="color: var(--a1)"` 25+ veces) |

### 4.2 · Altos

| # | Problema |
|---|---|
| **CSS‑A1** | `.hist-card`, `.fijo-card`, `.inv-card`, `.pago-card` son ~85% iguales — base + variant podría refactorizarse a `.list-item` + `.list-item--{variant}` |
| **CSS‑A2** | `.gast-tab` y `.qtab` son casi idénticas |
| **CSS‑A3** | Algunos selectores muy específicos (`.dash-grid > .gc:first-child + .gc`) que son frágiles a reorganización del DOM |
| **CSS‑A4** | Modo light sobrescribe 5 reglas adicionales con selectores específicos — algunas se pueden tokenizar mejor |
| **CSS‑A5** | Falta `prefers-reduced-motion` aplicado a animaciones de modal (entradas/salidas) |

### 4.3 · Medios

| # | Problema |
|---|---|
| **CSS‑M1** | 29 reglas con `display: none` — algunas se pueden reemplazar por `[hidden]` en HTML (más semántico) |
| **CSS‑M2** | Sin focus-visible diferenciado para diferentes tipos de elementos (botón vs input vs link) |
| **CSS‑M3** | No hay clases utilitarias para spacing (`mt-1`, `mb-2`, `gap-3`) — todo en componentes |
| **CSS‑M4** | Gradients `--ga1..ga4` definidos pero usados solo en 2-3 lugares |
| **CSS‑M5** | Comments dispersos sin convención (algunos secciones, otros TODO, otros sin etiqueta) |

---

## 5 · Propuesta

### 5.1 · Principios

1. **Tokenizar todo lo repetido ≥ 5 veces.** Si un valor aparece más de 5 veces, se vuelve token.
2. **Utilities para lo atómico, components para lo compuesto.** No mezclar.
3. **Semantic HTML > clases.** Si `<button>` ya tiene foco, no inventes `.focus-ring`.
4. **Modo oscuro y claro en paralelo.** Cada token nuevo declara su valor en ambos modos.
5. **Naming BEM suave para componentes nuevos.** `block__element--modifier` solo donde aclara.
6. **Mantener glassmorphism y verde neón.** Cualquier cambio estético se discute aparte.

### 5.2 · Nueva escala de spacing (8pt grid)

Agregar a `@layer base`:

```css
:root {
  --sp-0: 0;
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-7: 32px;
  --sp-8: 40px;
  --sp-9: 48px;
  --sp-10: 64px;
}
```

Más utilities en `@layer utils`:

```css
.mt-{1..10} { margin-top: var(--sp-{n}); }
.mb-{1..10} { margin-bottom: var(--sp-{n}); }
.mx-{1..10}, .my-{1..10}, .pt-, .pb-, .px-, .py-, .gap-{1..10}
```

### 5.3 · Nueva escala tipográfica

Agregar:

```css
:root {
  --fs-xs:   12px;  /* helpers, hints */
  --fs-sm:   14px;  /* labels, secondary text */
  --fs-base: 16px;  /* body por defecto */
  --fs-md:   18px;  /* énfasis */
  --fs-lg:   22px;  /* títulos sección */
  --fs-xl:   28px;  /* hero */
  --fs-2xl:  36px;  /* dashboard mega */

  --lh-tight:  1.15;
  --lh-snug:   1.3;
  --lh-normal: 1.5;
  --lh-loose:  1.75;
}
```

Utilities:

```css
.fs-xs, .fs-sm, .fs-base, .fs-md, .fs-lg, .fs-xl, .fs-2xl
.fw-300, .fw-400, .fw-500, .fw-600, .fw-700, .fw-800
```

### 5.4 · Utilities de color de acento (cubre 25+ inline styles)

```css
.t-a1 { color: var(--a1); }
.t-a2 { color: var(--a2); }
.t-a3 { color: var(--a3); }
.t-a4 { color: var(--a4); }
.t-a5 { color: var(--a5); }
.t-a6 { color: var(--a6); }
.t-a7 { color: var(--a7); }
.t-ok { color: var(--ok); }
.t-warn { color: var(--war); }
.t-danger { color: var(--dan); }
.t-info { color: var(--inf); }
.t-muted { color: var(--t3); }
```

Y sus equivalentes background:

```css
.bg-a1, .bg-a2, .bg-overlay-soft, .bg-overlay-strong
```

### 5.5 · Refactor de cards genéricas

```css
/* Hoy: .hist-card, .fijo-card, .inv-card, .pago-card duplicadas */
/* Propuesta: */

.list-item {
  /* base shared rules */
  background: var(--s2);
  border-radius: var(--r3);
  padding: var(--sp-4);
  /* ... */
}

.list-item--fijo  { border-left: 3px solid var(--a4); }
.list-item--deuda { border-left: 3px solid var(--a3); }
.list-item--inv   { border-left: 3px solid var(--a5); }
.list-item--pago  { border-left: 3px solid var(--a1); }
.list-item--hist  { background: var(--s3); }
```

Eliminamos ~120 LOC duplicados.

### 5.6 · Bento Grid (preparación)

Aún no se ejecuta el Bento (Fase 5). Pero esta fase deja las clases base:

```css
.bento {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--sp-4);
}
.bento__cell { grid-column: span 12; }
.bento__cell--6   { grid-column: span 6; }
.bento__cell--4   { grid-column: span 4; }
.bento__cell--8   { grid-column: span 8; }
.bento__cell--12  { grid-column: span 12; }

@media (max-width: 768px) {
  /* En mobile todo es columna única scrollable */
  .bento__cell { grid-column: span 12; }
}
```

Detalle del Bento (qué celda contiene qué) está en `DESIGN_SYSTEM.md`.

### 5.7 · `prefers-reduced-motion`

Agregar al final de `@layer base`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 5.8 · Eliminar `display: none` redundantes con `[hidden]`

Cuando un elemento se oculta inicialmente vía CSS pero el DOM podría usar `hidden` attribute, simplificar:

```html
<!-- Hoy -->
<div class="hidden-mobile">…</div>
<!-- En CSS: .hidden-mobile { display: none; } @media (min-width: 768px) { .hidden-mobile { display: block; } } -->

<!-- Propuesta para casos no responsivos: -->
<div hidden>…</div>
<!-- En JS: el.hidden = false -->
```

Solo aplicable a casos donde el JS ya maneja la visibilidad. No tocar reglas responsivas.

---

## 6 · Fases de ejecución

### Fase CSS‑1 — Tokens y utilities (½ día)

1. Agregar escala spacing (`--sp-*`).
2. Agregar escala tipográfica (`--fs-*`, `--lh-*`).
3. Agregar utilities de color de acento (`.t-a*`, `.bg-*`).
4. Agregar utilities de spacing (`.mt-*`, `.mb-*`, `.gap-*`).
5. Validar `npm test`.

**Verificación:** todos los tokens nuevos accesibles en DevTools; ningún test rojo.

### Fase CSS‑2 — Refactor cards genéricas (½ día)

1. Crear `.list-item` base.
2. Crear modifiers (`--fijo`, `--deuda`, etc.).
3. Mantener clases viejas como alias por 1 release (deprecation soft).
4. Documentar en `DESIGN_SYSTEM.md`.

**Verificación:** cards visualmente idénticas en oscuro y claro.

### Fase CSS‑3 — Bento base (½ día)

1. Agregar clases `.bento`, `.bento__cell--*`.
2. Agregar responsive degradation (mobile = columna).
3. **No aplicar al dashboard todavía** (Fase 5).

**Verificación:** clases existen pero no afectan render.

### Fase CSS‑4 — `prefers-reduced-motion` + a11y (¼ día)

1. Agregar bloque global de reduced motion.
2. Reforzar focus-visible si hace falta.

**Verificación:** activar setting en sistema operativo y comprobar animaciones se reducen.

### Fase CSS‑5 — Limpieza de display:none (½ día)

1. Identificar las 29 reglas `display: none` y categorizar:
   - Ocultar inicialmente (migrable a `[hidden]`).
   - Responsive (mantener).
   - Estado dinámico controlado por JS (mantener pero documentar).

**Verificación:** count `display: none` reducido; comportamiento idéntico.

### Fase CSS‑6 — Documentación de tokens en `DESIGN_SYSTEM.md` (¼ día)

1. Generar tabla de tokens con valores oscuro/claro y contraste WCAG.
2. Capturar paletas con visualización.

**Verificación:** `DESIGN_SYSTEM.md` actualizado con todos los tokens documentados.

---

## 7 · Pasos detallados (ejemplo: Fase CSS‑1)

1. Abrir `style.css`.
2. Localizar `@layer base` (o `:root` dentro de `@layer base`).
3. Agregar bloque `--sp-*` después de los tokens de surface.
4. Agregar bloque `--fs-*` y `--lh-*` después de los de tipografía.
5. Localizar `@layer utils` (al final).
6. Agregar utilities `.mt-*`, `.mb-*`, etc. con loop razonable o explícito.
7. Agregar utilities `.t-a*`, `.bg-*`.
8. Correr `npm test`.
9. Abrir DevTools, verificar que las custom props se ven.
10. Commit: `feat(css): tokens spacing/type + utilities`.

---

## 8 · Criterios de verificación

- [ ] `--sp-*` y `--fs-*` definidos en `:root`.
- [ ] Utilities `.mt-*`, `.mb-*`, `.gap-*`, `.t-a*` agregadas a `@layer utils`.
- [ ] `.list-item` reemplaza/cubre `.hist-card`, `.fijo-card`, `.inv-card`, `.pago-card`.
- [ ] `.bento` y `.bento__cell--*` existen sin afectar render actual.
- [ ] `prefers-reduced-motion` global aplicado.
- [ ] Modo oscuro y claro siguen visualmente iguales (capturas antes/después).
- [ ] Lighthouse Performance no baja (era ~85).
- [ ] `npm test` verde.

---

## 9 · Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Cambio en cascada rompe estilo de modal | Media | Alto | Mantener orden de `@layer`; diff visual sección por sección |
| Refactor de cards rompe layout responsivo | Baja | Medio | Capturas de Lighthouse + revisión manual mobile |
| Tokens nuevos colisionan con nombres existentes | Baja | Bajo | Naming `--sp-*`, `--fs-*` no choca con `--a*`, `--s*`, `--r*` |
| Eliminar `display: none` rompe interacción | Media | Medio | Solo aplicar a casos JS‑controlled; resto se mantiene |
| Estética cambia sin querer | Baja | Alto | Capturas comparativas obligatorias en commits |

---

## 10 · Dependencias

- **Bloqueado por:** Fase 0 del `ROADMAP.md`.
- **Coordinación con:** `REORG_HTML.md` (las clases nuevas se usan ahí).
- **Coordinación con:** `DESIGN_SYSTEM.md` (documenta tokens y patrones).
- **Bloqueante de:** Fase 5 (UX moderna — Bento Grid).

---

## 11 · Checklist final

- [ ] Tokens spacing y type definidos.
- [ ] Utilities (color, spacing, tipo) creadas.
- [ ] `.list-item` consolida 4 cards específicas.
- [ ] `.bento` listo para Fase 5.
- [ ] `prefers-reduced-motion` global.
- [ ] `display: none` reducidos (donde aplica).
- [ ] Modo claro/oscuro intacto visualmente.
- [ ] Tokens documentados en `DESIGN_SYSTEM.md`.
- [ ] Tests verdes.

---

*Próximo documento: [`REORG_JS.md`](./REORG_JS.md).*
