# Tabla de migración HTML — `index.html`

> **Fase:** HTML‑1 (mapeo, sin tocar código).
> **Fecha:** 2026‑05‑07.
> **Insumo de:** Fase HTML‑2 (crear clases nuevas) y Fase HTML‑3 (migrar por sección).
> **Pre‑requisito completado:** CSS‑1 (utilities `.t-a1..a7`, `.mt/.mb/.gap-{0..10}`, `.bg-overlay-soft` ya existen).

---

## 1 · Método

1. **Extracción precisa** con AWK (no `grep -c "style="` que cuenta líneas, no atributos):

   ```awk
   /style="/ { ln=NR; line=$0;
     while (match(line, /style="[^"]*"/)) {
       val = substr(line, RSTART, RLENGTH);
       gsub(/^style="|"$/, "", val);
       print ln "\t" val;
       line = substr(line, RSTART+RLENGTH);
     } }
   ```

   Resultado: **347 ocurrencias** (vs 341 que daba el conteo por línea, porque algunas líneas tienen 2+ atributos `style=""`).

2. **Agrupación por valor exacto** → 230 valores únicos.

3. **Clasificación por patrón** según los criterios del prompt:
   - **MIGRABLE‑A‑CLASE:** la utility ya existe en `style.css` (CSS‑1 o `.tm`/`.ui-*`).
   - **MIGRABLE‑A‑CLASE‑NEW:** patrón claro que merece utility nueva (Fase HTML‑2).
   - **INLINE‑LEGITIMO:** runtime — JS muta `style.width`/`style.transform`/CSS vars o transition específica de SVG ring.
   - **REVISAR_MANUAL:** combos complejos, valores fuera del 8pt grid, casos ambiguos.

4. **Detección runtime** confirmada con grep en JS:
   ```
   $ grep -E "style\.width|style\.transform|style\.display" modules/**/*.js | wc -l
   107
   ```

---

## 2 · Resumen ejecutivo

### 2.1 · Conteos por clasificación

| Clasificación | Ocurrencias | % | Acción Fase HTML‑3 |
|---|---:|---:|---|
| **REVISAR_MANUAL** | 295 | 85.0 % | Decidir caso por caso (consolidar a clases compuestas o aceptar) |
| **MIGRABLE‑A‑CLASE‑NEW** | 26 | 7.5 % | Crear utility en HTML‑2; migrar en HTML‑3 |
| **MIGRABLE‑A‑CLASE** | 20 | 5.8 % | Migrar directamente en HTML‑3 (utility ya existe) |
| **INLINE‑LEGITIMO** | 6 | 1.7 % | Mantener (runtime) |
| **Total** | **347** | 100 % | |

> **Lectura:** la Fase HTML‑3 reduce la cantidad de inline styles principalmente por **consolidación de combos repetidos** en clases compuestas (ej. tabs, cards de alerta), no por migración 1‑a‑1. Los 46 casos directamente migrables (MIGRABLE + MIGRABLE‑NEW) son la fruta baja.

### 2.2 · Conteos por categoría

| Categoría | Ocurrencias | Notas |
|---|---:|---|
| `combo` (3+ declaraciones) | 146 | combos multi‑propiedad, candidatos a consolidación |
| `misc` (1‑2 decls aislados) | 78 | patrones únicos, evaluar por contexto |
| `dynamic` | 33 | incluye los 6 INLINE‑LEGITIMO + 27 `display:none` toggleados por JS |
| `spacing` | 33 | margin / padding / gap |
| `typo` | 26 | font‑size, line‑height, font‑weight aislados |
| `color+typo` | 10 | combos de color y tipo |
| `layout` | 8 | flex‑1, text‑align, display:block |
| `color` | 7 | color de texto puros |
| `border+bg` | 5 | border + background combos |
| `gradient` | 1 | linear‑gradient único |

### 2.3 · Distribución por número de declaraciones

| # decls | Ocurrencias | Migración típica |
|---:|---:|---|
| 1 | 113 (32 %) | Migrable directo (utility) |
| 2 | 69 (20 %) | Mayoría migrable; revisar combos `color+spacing` |
| 3 | 51 (15 %) | REVISAR_MANUAL (clase compuesta vs múltiples utilities) |
| 4 | 48 (14 %) | REVISAR_MANUAL — clase compuesta casi siempre |
| 5+ | 66 (19 %) | REVISAR_MANUAL — componente, no utility |

---

## 3 · INLINE‑LEGITIMO confirmados (6 ocurrencias)

> **No tocar en Fase HTML‑3.** Documentar con comentario `<!-- inline runtime: JS muta style.X -->` opcional al pasar.

| Línea | Inline literal | Razón |
|---:|---|---|
| 252 | `transition:stroke-dasharray .6s cubic-bezier(.4,0,.2,1);` | SVG ring del score; JS muta `stroke-dasharray` |
| 258 | `transition:stroke-dasharray .6s cubic-bezier(.4,0,.2,1),stroke-dashoffset .6s cubic-bezier(.4,0,.2,1);` | SVG ring del score (segundo arco) |
| 432 | `height:100%;border-radius:999px;background:#a1887f;width:0%;transition:width .6s cubic-bezier(.4,0,.2,1);` | Barra de hormigas (`#d-hor-barra`); `style.width` actualizado por `ingresos.js:751` |
| 465 | `width:0%;background:var(--a1);` | Barra fondo emergencia (`#fe-barra-progreso`); actualizada por `tesoreria.js:301` |
| 1142 | `height:100%;border-radius:999px;background:var(--a1);transition:width .4s ease;width:0%;` | Barra resumen mensual (`#md-res-barra`) |
| 1701 | `height:100%;border-radius:999px;background:var(--a1);transition:width .4s ease;` | Barra próximo gasto (`#pgc-barra`); `style.width` actualizado por `compromisos.js:1703` |

> Verificación cruzada: `compromisos.js:1703`, `ingresos.js:751`, `personales.js:370`, `tesoreria.js:301` mutan `style.width = ${pct}%`. Coincide con los IDs anteriores.

---

## 4 · MIGRABLE‑A‑CLASE — utilities ya existentes (20 ocurrencias)

> **Migrar en Fase HTML‑3.** Cero clases nuevas requeridas.

| Inline literal | Ocur. | Líneas | Clase destino |
|---|---:|---|---|
| `color:var(--a1);` | 2 | 872, 1494 | `.t-a1` |
| `color:var(--a2);` | 2 | 868, 943 | `.t-a2` |
| `font-size:11px;color:var(--t3);` | 5 | 1540, 1600, 1684, 1808, 1816 | `.tm` *(existente, capa utils)* |
| `margin-top:4px;` | 2 | 277, 615 | `.mt-1` |
| `margin-top:12px;` | 1 | 1217 | `.mt-3` |
| `margin-top:16px;` | 1 | 612 | `.mt-4` |
| `margin-bottom:4px;` | 2 | 284, 292 | `.mb-1` |
| `margin-bottom:8px;` | 1 | 424 | `.mb-2` |
| `margin-bottom:16px;` | 2 | 849, 860 | `.mb-4` |
| `margin-bottom:20px;` | 2 | 1543, 1603 | `.mb-5` |

**Subtotal:** 20 ocurrencias en 10 patrones.

---

## 5 · MIGRABLE‑A‑CLASE‑NEW — requiere clase nueva (26 ocurrencias)

> **Crear en Fase HTML‑2; migrar en HTML‑3.**

| Inline | Ocur. | Clase nueva propuesta | Definición CSS |
|---|---:|---|---|
| `margin:0;` / `margin:0` | 7 | `.m-0` | `margin: 0;` |
| `text-align:right;` | 3 | `.text-right` | `text-align: right;` |
| `text-align:center;` | 1 | `.text-center` | `text-align: center;` |
| `flex:1;` | 3 | `.flex-1` | `flex: 1;` |
| `display:block;` | 1 | `.d-block` | `display: block;` |
| `color:var(--t1);` | 2 | `.t-1` | `color: var(--t1);` |
| `color:var(--t2);` | 1 | `.t-2` | `color: var(--t2);` |
| `color:var(--t3);` | — | `.t-muted` | `color: var(--t3);` (futuro; ahora siempre va combinado) |
| `font-size:12px;` | 2 | `.fs-xs` | `font-size: var(--fs-xs);` (token CSS‑1; falta exposición utility) |
| `font-size:16px;` | 2 | `.fs-base` | `font-size: var(--fs-base);` |
| `font-size:18px;` | 2 | `.fs-md` | `font-size: var(--fs-md);` |
| `line-height:1.5;` | 2 | `.lh-normal` | `line-height: var(--lh-normal);` |

**Subtotal:** 26 ocurrencias en 11 patrones nuevos.

---

## 6 · Clases nuevas a crear en Fase HTML‑2

> **Resumen consolidado** — alimenta `REORG_HTML.md §6 / Fase HTML‑2`.

### 6.1 · Spacing reset

```css
.m-0  { margin: 0; }
.p-0  { padding: 0; }   /* preventivo, hay 5+ patrones con padding:0 dentro de combos */
```

### 6.2 · Layout helpers

```css
.flex-1    { flex: 1; }
.d-block   { display: block; }
.d-none    { display: none; }   /* preventivo — alternativa explícita al toggle JS */
.text-left   { text-align: left; }
.text-center { text-align: center; }
.text-right  { text-align: right; }
```

### 6.3 · Tipografía (utilities sobre tokens CSS‑1)

```css
/* font-size */
.fs-xs   { font-size: var(--fs-xs); }     /* 12px */
.fs-sm   { font-size: var(--fs-sm); }     /* 14px */
.fs-base { font-size: var(--fs-base); }   /* 16px */
.fs-md   { font-size: var(--fs-md); }     /* 18px */
.fs-lg   { font-size: var(--fs-lg); }     /* 22px */
.fs-xl   { font-size: var(--fs-xl); }     /* 28px */
.fs-2xl  { font-size: var(--fs-2xl); }    /* 36px */

/* line-height */
.lh-tight  { line-height: var(--lh-tight); }
.lh-snug   { line-height: var(--lh-snug); }
.lh-normal { line-height: var(--lh-normal); }
.lh-loose  { line-height: var(--lh-loose); }

/* font-weight (preventivo, varios combos los usan) */
.fw-300 { font-weight: 300; }
.fw-400 { font-weight: 400; }
.fw-500 { font-weight: 500; }
.fw-600 { font-weight: 600; }
.fw-700 { font-weight: 700; }
.fw-800 { font-weight: 800; }
```

### 6.4 · Color de texto semánticos

```css
.t-1     { color: var(--t1); }
.t-2     { color: var(--t2); }
.t-muted { color: var(--t3); }
.t-ok    { color: var(--ok); }
.t-warn  { color: var(--war); }
.t-danger{ color: var(--dan); }
.t-info  { color: var(--inf); }
```

> Nota: `.t-a1..a7` ya existen (CSS‑1). Estos son los semánticos complementarios.

### 6.5 · Volumen estimado en `style.css`

≈ **30 líneas adicionales** en `@layer utils` (todas additive, cero conflicto con clases existentes — verificado: `.tm`, `.mt`, `.mb`, `.gap` sin sufijo siguen siendo distintos).

---

## 7 · REVISAR_MANUAL — desglose por subgrupo (295 ocurrencias)

> **No migrar en HTML‑3 sin decisión humana.** Esta sección lista los grupos para que el revisor pueda agrupar la decisión.

### 7.1 · `display:none` y combos con display:none (38 ocurrencias)

| Inline | Ocur. | Contexto típico | Decisión sugerida |
|---|---:|---|---|
| `display:none;` | 26 | inicial oculto, JS muta `style.display` | **Mantener.** Migración a `[hidden]` solo si JS pasa a `el.hidden = false`. Riesgo de regresión alto; dejar para Fase posterior. |
| `display:none;margin-top:14px;` | 2 | panel inicial oculto con margen | Mantener; cuando JS lo muestre, sigue funcionando. |
| `display:none;margin-top:10px;` | 2 | idem | idem |
| Otros `display:none;...` (8 únicos) | 8 | varios estados ocultos | Mantener. |

> 27 de los 33 `dynamic` son `display:none*`; los otros 6 son INLINE‑LEGITIMO ya catalogados.

### 7.2 · Spacing fuera de escala 8pt (15 ocurrencias)

| Inline | Ocur. | Decisión recomendada en HTML‑3 |
|---|---:|---|
| `margin-bottom:5px;` | 3 | redondear a `.mb-1` (4px) o `.mb-2` (8px); revisar visual |
| `margin-bottom:6px;` | 3 | redondear a `.mb-2` (8px) |
| `margin-bottom:14px;` | 3 | redondear a `.mb-4` (16px) o `.mb-3` (12px) |
| `margin-bottom:10px;` | 1 | redondear a `.mb-2` (8px) o `.mb-3` (12px) |
| `margin-bottom:2px;` | 4 | redondear a `.mb-1` (4px) o eliminar (visualmente imperceptible) |
| `margin-top:10px;` | 1 | redondear a `.mt-2` o `.mt-3` |

### 7.3 · Tipografía fuera de escala (18 ocurrencias)

| Inline | Ocur. | Decisión |
|---|---:|---|
| `font-size:9px;font-weight:700;color:var(--t3);` | 15 | comparar contra `.ui-label-sm`; si visualmente coincide, migrar a esa clase; si no, mantener inline o crear `.ui-label-sm-plain` |
| `font-size:20px;` | 2 | 20 px no en escala (20 entre lg=22 y md=18); decidir: aceptar o fijar a `.fs-md` (18) o `.fs-lg` (22) |
| `font-size:13px;` | varias | 13 px fuera escala; revisar |
| `line-height:1.6;` | 1 | 1.6 entre `.lh-normal` (1.5) y `.lh-loose` (1.75); elegir |

### 7.4 · Combos color + tipografía (5 ocurrencias)

| Inline | Ocur. | Decisión |
|---|---:|---|
| `color:var(--t3);font-size:18px;` | 5 | combo "muted con tamaño no estándar"; revisar contexto (probablemente íconos o títulos secundarios) |

### 7.5 · Combos border + background (5 ocurrencias)

| Pattern | Ocur. | Decisión |
|---|---:|---|
| `background:rgba(...);border:1px solid rgba(...);` 2‑prop | 5 | probablemente cards de alerta por color (amarillo/azul/rojo); consolidar a `.alert-{warn|info|danger|success}` en HTML‑2 |

### 7.6 · Gradientes (1 ocurrencia)

| Inline | Línea | Decisión |
|---|---:|---|
| `background:linear-gradient(135deg,rgba(255,214,10,.15),rgba(0,220,130,.15));color:var(--a2);` | (varias) | gradiente único; mantener inline o variable CSS local |

### 7.7 · Combos de 3+ propiedades (146 ocurrencias)

> El **gran grupo**. Cada uno requiere análisis. Estrategia recomendada:

1. **Sección por sección en HTML‑3.** Abrir `#sec-X`, leer cada combo y decidir:
   - ¿Es un componente reusable? → consolidar a clase (`.alert-info`, `.tab--inactive`, etc.).
   - ¿Es one‑off? → mantener inline o migrar a múltiples utilities (`flex-1 mb-2 t-a3`).
   - ¿Es resto de un patrón? → buscar similares en otras secciones.
2. **Patrones obvios identificados ya:**
   - `flex:1;padding:10px;border-radius:8px;border:2px solid var(--b2);background:var(--s2);font-size:12px;font-weight:700;color:var(--t3);cursor:pointer;transition:all .2s;` (×2) — variante de `.ui-btn-tipo` no seleccionada.
   - `flex:1;padding:10px;border-radius:8px;border:2px solid var(--a1);background:rgba(0,220,130,.1);font-size:12px;font-weight:700;color:var(--a1);cursor:pointer;transition:all .2s;` (×2) — variante seleccionada.
   - → consolidar ambos a `.btn-tipo-pill` + `.btn-tipo-pill--selected`.
   - `cursor:pointer;padding:5px 12px;font-size:11px;font-weight:600;border:none;opacity:.65;` (×4) — patrón de **tab inactivo**; consolidar a `.tab-pill.tab-pill--inactive`.

### 7.8 · `misc` (78 ocurrencias)

Patrones aislados (1 ocurrencia cada uno o muy específicos). Decisión caso por caso en HTML‑3.

---

## 8 · Recomendación de orden para Fase HTML‑3

> Fruta baja primero, riesgo creciente.

1. **Bloque A (½ día):** los 20 MIGRABLE‑A‑CLASE puros — ya hay utility, búsqueda‑reemplazo seguro.
2. **Bloque B (½ día):** Fase HTML‑2 (crear las 11 clases nuevas listadas en §6) → 26 MIGRABLE‑A‑CLASE‑NEW migrados.
3. **Bloque C (1 día):** consolidar combos repetidos identificados en §7.7 (alerts, tab pills, btn tipos) → recupera ~40 ocurrencias REVISAR_MANUAL.
4. **Bloque D (½‑1 día):** spacing fuera de escala (§7.2) — decisión por sección con captura visual antes/después.
5. **Bloque E (½ día):** typo fuera de escala (§7.3) — idem.
6. **Bloque F:** combos `display:none*` + dinámicos — **NO migrar**, mantener.

**Esperado al final:** de 347 ocurrencias → **≤ 60** restantes (cumple target del ROADMAP), con cero regresiones visuales.

---

## 9 · Anexo — tabla completa (230 valores únicos)

> Ordenada por número de ocurrencias (DESC), luego por valor.
> Columnas: Ocur. \| Categoría \| Clasificación \| Destino \| Inline literal \| Líneas \| Nota.
> Inline truncado a 70 chars en algunos casos por ancho; archivo TSV completo en `/tmp/styles_classified.tsv` durante esta sesión.

| Ocur. | Cat. | Clase | Destino | Inline | Líneas | Nota |
|---:|---|---|---|---|---|---|
| 26 | dynamic | REVISAR_MANUAL | — | `display:none;` | 332,341,356,357,358,359,360… | estado controlado por JS (style.display = block/none); migrar a [hidden] solo si JS usa el atributo correspondientemente — análisis caso por caso |
| 15 | typo | REVISAR_MANUAL | — | `font-size:9px;font-weight:700;color:var(--t3);` | 1546,1547,1548,1549,1550,15… | similar a .ui-label-sm pero sin uppercase/letter-spacing — verificar si el contexto admite usar .ui-label-sm o si es texto distinto |
| 9 | misc | REVISAR_MANUAL | — | `margin-bottom:5px;display:block;` | 1559,1560,1564,1572,1578,16… | patrón aislado |
| 5 | color+typo | REVISAR_MANUAL | — | `color:var(--t3);font-size:18px;` | 917,954,974,997,1017 | combo: color muted + font 18px (no en escala fs) |
| 5 | color+typo | MIGRABLE-A-CLASE | .tm (clase existente) | `font-size:11px;color:var(--t3);` | 1540,1600,1684,1808,1816 |  |
| 5 | spacing | MIGRABLE-A-CLASE-NEW | .m-0 (clase nueva) | `margin:0;` | 396,449,454,474,488 |  |
| 4 | combo | REVISAR_MANUAL | — | `cursor:pointer;padding:5px 12px;font-size:11px;font-weight:600;bord…` | 716,717,719,720 | combo multi-prop (6 decls) |
| 4 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1…` | 1558,1562,1618,1628 | combo multi-prop (4 decls) |
| 4 | spacing | REVISAR_MANUAL | — | `margin-bottom:2px;` | 1540,1600,1684,1807 | 2px fuera de escala 8pt; redondear a .mb-1 (4px) o a 0 |
| 3 | misc | REVISAR_MANUAL | — | `display:flex;gap:8px;` | 1459,1565,1631 | patrón aislado |
| 3 | layout | MIGRABLE-A-CLASE-NEW | .flex-1 (clase nueva) | `flex:1;` | 1097,1098,1646 |  |
| 3 | combo | REVISAR_MANUAL | — | `font-size:10px;color:var(--t3);margin-top:4px;` | 1574,1640,1823 | combo 3 decls |
| 3 | combo | REVISAR_MANUAL | — | `font-size:9px;color:var(--t3);font-weight:700;text-transform:upperc…` | 1129,1133,1137 | combo multi-prop (6 decls) |
| 3 | spacing | REVISAR_MANUAL | — | `margin-bottom:14px;` | 802,1577,1660 | 14px fuera escala; redondear a .mb-4 (16px) o .mb-3 (12px) |
| 3 | spacing | REVISAR_MANUAL | — | `margin-bottom:5px;` | 402,406,411 | 5px fuera escala; .mb-1 (4px) o .mb-2 (8px) según contexto visual |
| 3 | spacing | REVISAR_MANUAL | — | `margin-bottom:6px;` | 742,746,751 | 6px fuera escala; redondear a .mb-2 (8px) |
| 3 | misc | REVISAR_MANUAL | — | `padding:8px 12px;font-size:11px;` | 1152,1153,1154 | patrón aislado |
| 3 | layout | MIGRABLE-A-CLASE-NEW | .text-right (clase nueva) | `text-align:right;` | 426,468,1695 |  |
| 2 | color | MIGRABLE-A-CLASE | .t-a1 | `color:var(--a1);` | 872,1494 |  |
| 2 | color | MIGRABLE-A-CLASE | .t-a2 | `color:var(--a2);` | 868,943 |  |
| 2 | color | MIGRABLE-A-CLASE-NEW | .t-1 (clase nueva) | `color:var(--t1);` | 904,1165 |  |
| 2 | combo | REVISAR_MANUAL | — | `display:flex;flex-direction:column;gap:14px;` | 551,580 | combo 3 decls |
| 2 | combo | REVISAR_MANUAL | — | `display:flex;flex-direction:column;gap:16px;` | 1195,1210 | combo 3 decls |
| 2 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:repeat(4,1fr);gap:8px;` | 1545,1605 | combo 3 decls |
| 2 | misc | REVISAR_MANUAL | — | `display:none;margin-top:10px;` | 312,439 | patrón aislado |
| 2 | misc | REVISAR_MANUAL | — | `display:none;margin-top:14px;` | 605,1377 | patrón aislado |
| 2 | combo | REVISAR_MANUAL | — | `flex:1;padding:10px;border-radius:8px;border:2px solid var(--a1);ba…` | 1566,1632 | combo multi-prop (10 decls) |
| 2 | combo | REVISAR_MANUAL | — | `flex:1;padding:10px;border-radius:8px;border:2px solid var(--b2);ba…` | 1567,1633 | combo multi-prop (10 decls) |
| 2 | misc | REVISAR_MANUAL | — | `font-size:10px;color:var(--t3);` | 428,1705 | patrón aislado |
| 2 | combo | REVISAR_MANUAL | — | `font-size:10px;color:var(--t3);font-weight:600;margin-bottom:3px;` | 1692,1696 | combo multi-prop (4 decls) |
| 2 | typo | MIGRABLE-A-CLASE-NEW | .fs-xs (no expuesta aún) | `font-size:12px;` | 494,1225 |  |
| 2 | misc | REVISAR_MANUAL | — | `font-size:15px;color:var(--t1);` | 646,763 | patrón aislado |
| 2 | typo | MIGRABLE-A-CLASE-NEW | .fs-base (no expuesta aún) | `font-size:16px;` | 288,711 |  |
| 2 | misc | REVISAR_MANUAL | — | `font-size:16px;letter-spacing:-.5px;` | 403,407 | patrón aislado |
| 2 | typo | MIGRABLE-A-CLASE-NEW | .fs-md (no expuesta aún) | `font-size:18px;` | 1163,1645 |  |
| 2 | typo | REVISAR_MANUAL | — | `font-size:20px;` | 743,747 | 20px no en escala fs (xs/sm/base/md=18/lg=22) |
| 2 | combo | REVISAR_MANUAL | — | `height:6px;background:var(--s3);border-radius:999px;overflow:hidden…` | 1141,1700 | combo multi-prop (5 decls) |
| 2 | typo | MIGRABLE-A-CLASE-NEW | .lh-normal (no expuesta aún en utils) | `line-height:1.5;` | 575,1495 |  |
| 2 | misc | REVISAR_MANUAL | — | `margin-bottom:10px;display:block;` | 1544,1604 | patrón aislado |
| 2 | spacing | MIGRABLE-A-CLASE | .mb-4 | `margin-bottom:16px;` | 849,860 |  |
| 2 | spacing | MIGRABLE-A-CLASE | .mb-5 | `margin-bottom:20px;` | 1543,1603 |  |
| 2 | spacing | MIGRABLE-A-CLASE | .mb-1 | `margin-bottom:4px;` | 284,292 |  |
| 2 | spacing | MIGRABLE-A-CLASE | .mt-1 | `margin-top:4px;` | 277,615 |  |
| 2 | combo | REVISAR_MANUAL | — | `margin-top:8px;padding:14px;font-size:14px;` | 1590,1673 | combo 3 decls |
| 2 | spacing | MIGRABLE-A-CLASE-NEW | .m-0 (clase nueva) | `margin:0` | 380,457 |  |
| 2 | misc | REVISAR_MANUAL | — | `max-width:520px;` | 1538,1598 | patrón aislado |
| 2 | misc | REVISAR_MANUAL | — | `padding:14px;text-align:center;` | 741,745 | patrón aislado |
| 2 | misc | REVISAR_MANUAL | — | `padding:24px 24px 0;` | 1370,1682 | patrón aislado |
| 2 | combo | REVISAR_MANUAL | — | `width:100%;background:none;border:none;padding:2px 0;display:flex;j…` | 643,760 | combo multi-prop (10 decls) |
| 1 | misc | REVISAR_MANUAL | — | `align-items:flex-start;` | 1194 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `background:linear-gradient(135deg,rgba(0,220,130,.06),var(--s2));bo…` | 1812 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `background:linear-gradient(135deg,rgba(0,220,130,.06),var(--s2));bo…` | 1687 | combo multi-prop (5 decls) |
| 1 | gradient | REVISAR_MANUAL | — | `background:linear-gradient(135deg,rgba(255,214,10,.15),rgba(0,220,1…` | 1112 | gradiente |
| 1 | combo | REVISAR_MANUAL | — | `background:none;border:none;color:var(--a1);font-size:10px;font-wei…` | 1623 | combo multi-prop (8 decls) |
| 1 | combo | REVISAR_MANUAL | — | `background:rgba(0,220,130,.05);border:1px solid rgba(0,220,130,.15)…` | 462 | combo multi-prop (8 decls) |
| 1 | border+bg | REVISAR_MANUAL | — | `background:rgba(0,220,130,.12);border:1px solid rgba(0,220,130,.2);` | 915 | border+background combo |
| 1 | combo | REVISAR_MANUAL | — | `background:rgba(0,229,204,.05);border:1px solid rgba(0,229,204,.2);…` | 978 | combo multi-prop (8 decls) |
| 1 | border+bg | REVISAR_MANUAL | — | `background:rgba(0,229,204,.12);border:1px solid rgba(0,229,204,.2);` | 972 | border+background combo |
| 1 | combo | REVISAR_MANUAL | — | `background:rgba(180,78,255,.05);border:1px solid rgba(180,78,255,.2…` | 1021 | combo multi-prop (8 decls) |
| 1 | border+bg | REVISAR_MANUAL | — | `background:rgba(180,78,255,.12);border:1px solid rgba(180,78,255,.2);` | 1015 | border+background combo |
| 1 | combo | REVISAR_MANUAL | — | `background:rgba(255,107,53,.05);border:1px solid rgba(255,107,53,.2…` | 958 | combo multi-prop (8 decls) |
| 1 | border+bg | REVISAR_MANUAL | — | `background:rgba(255,107,53,.12);border:1px solid rgba(255,107,53,.2);` | 952 | border+background combo |
| 1 | combo | REVISAR_MANUAL | — | `background:rgba(255,153,68,.05);border:1px solid rgba(255,153,68,.2…` | 1001 | combo multi-prop (8 decls) |
| 1 | border+bg | REVISAR_MANUAL | — | `background:rgba(255,153,68,.12);border:1px solid rgba(255,153,68,.2);` | 995 | border+background combo |
| 1 | combo | REVISAR_MANUAL | — | `background:rgba(255,214,10,.06);border:1px solid rgba(255,214,10,.2…` | 1858 | combo multi-prop (8 decls) |
| 1 | combo | REVISAR_MANUAL | — | `background:rgba(59,158,255,.05);border:1px solid rgba(59,158,255,.2…` | 921 | combo multi-prop (8 decls) |
| 1 | misc | REVISAR_MANUAL | — | `background:var(--s1);` | 1086 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `background:var(--s2);border:1px solid var(--b2);border-radius:12px;…` | 1375 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `background:var(--s2);padding:14px;margin-bottom:18px;border-radius:…` | 1394 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `border-color:rgba(59,158,255,.2)` | 379 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `border-radius:18px;` | 236 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `border-radius:8px;` | 1378 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `border-style:dashed;border-color:var(--b3);` | 599 | patrón aislado |
| 1 | color | MIGRABLE-A-CLASE-NEW | .t-2 (clase nueva) | `color:var(--t2);` | 876 |  |
| 1 | dynamic | REVISAR_MANUAL | — | `color:var(--t3);font-size:18px;transition:transform .25s;display:in…` | 765 | transition para arrow rotate; podría migrarse a [data-state] + CSS |
| 1 | misc | REVISAR_MANUAL | — | `color:var(--t3);font-weight:400;` | 1661 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `cursor:pointer;padding:5px 12px;font-size:11px;font-weight:600;bord…` | 718 | combo multi-prop (9 decls) |
| 1 | combo | REVISAR_MANUAL | — | `cursor:pointer;padding:5px 12px;font-size:11px;font-weight:800;bord…` | 715 | combo multi-prop (5 decls) |
| 1 | layout | MIGRABLE-A-CLASE-NEW | .d-block (clase nueva) | `display:block;` | 244 |  |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;align-items:center;gap:6px;` | 939 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;align-items:center;gap:6px;background:rgba(255,68,68,.…` | 546 | combo multi-prop (8 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;` | 1644 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;flex-direction:column;gap:8px;` | 1213 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;gap:10px;padding:16px 24px 24px;border-top:1px solid v…` | 1382 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;` | 714 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;gap:8px;align-items:flex-start;` | 1162 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;gap:8px;flex-wrap:wrap;` | 544 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;` | 1151 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `display:flex;justify-content:space-between;` | 1703 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;justify-content:space-between;align-items:center;` | 1815 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;justify-content:space-between;align-items:flex-end;mar…` | 1690 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;justify-content:space-between;align-items:flex-start;m…` | 1371 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;justify-content:space-between;align-items:flex-start;m…` | 1683 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:flex;justify-content:space-between;font-size:10px;color:var…` | 1144 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bott…` | 400 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bott…` | 740 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;` | 282 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;` | 1651 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bo…` | 1127 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top…` | 1279 | combo multi-prop (6 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;background:rgba(0,220,130,.06);padding:12px;border-rad…` | 1493 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;border-top:1px solid var(--b1);margin-top:14px;padding…` | 768 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;font-size:12px;margin:10px 0;color:var(--t3);` | 702 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;margin-top:10px;padding-top:10px;border-top:1px dashed…` | 435 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;margin-top:10px;padding:12px;border-radius:8px;font-si…` | 1511 | combo multi-prop (6 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;margin-top:8px;padding:6px 8px;background:var(--s3);bo…` | 471 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;padding:12px;border-radius:8px;background:rgba(121,85,…` | 704 | combo multi-prop (8 decls) |
| 1 | combo | REVISAR_MANUAL | — | `display:none;padding:12px;border-radius:8px;margin:10px 0;font-size…` | 703 | combo multi-prop (5 decls) |
| 1 | misc | REVISAR_MANUAL | — | `flex:1; min-width:0;` | 269 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `flex:1;font-size:12px;color:var(--t2);line-height:1.6;` | 1164 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `flex:1;padding:12px;font-size:13px;font-weight:600;border-radius:10px;` | 1383 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `flex:1;padding:12px;font-size:13px;font-weight:700;border-radius:10px;` | 1384 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm); font-weight:800; font-size:16px; color:var(-…` | 296 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm); font-weight:800; font-size:36px; color:var(-…` | 275 | combo multi-prop (7 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:13px;font-weight:800;color:var(--a1…` | 263 | combo multi-prop (6 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:18px;color:var(--a2);` | 1817 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:18px;color:var(--t2);font-weight:70…` | 1697 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:20px;font-weight:800;color:var(--a1);` | 1134 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:20px;font-weight:800;color:var(--a2);` | 1130 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:20px;font-weight:800;color:var(--t1);` | 1138 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:22px;color:var(--a3);font-weight:700;` | 1396 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-size:30px;color:var(--a1);font-weight:80…` | 1693 | combo multi-prop (6 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-weight:800;font-size:16px;color:#a1887f;` | 427 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-weight:800;font-size:16px;color:var(--a4…` | 412 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-family:var(--fm);font-weight:800;font-size:20px;color:var(--a1);` | 558 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `font-size: 28px; margin-bottom: 8px;` | 383 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `font-size:10px;color:var(--a1);font-weight:700;` | 1704 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-size:10px;color:var(--t3);font-weight:700;text-transform:upper…` | 1813 | combo multi-prop (6 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:10px;color:var(--t3);font-weight:700;text-transform:upper…` | 1688 | combo multi-prop (6 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:10px;color:var(--t3);margin-top:2px;` | 408 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-size:10px;color:var(--t3);margin-top:6px;` | 1671 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-size:10px;font-weight:800;text-transform:uppercase;letter-spac…` | 82 | combo multi-prop (9 decls) |
| 1 | misc | REVISAR_MANUAL | — | `font-size:11px;` | 853 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `font-size:11px;color:var(--a4);background:none;border:none;cursor:p…` | 327 | combo multi-prop (7 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:11px;color:var(--t3);line-height:1.5;` | 1648 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-size:11px;color:var(--t3);margin-top:4px;margin-left:28px;line…` | 941 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:11px;font-weight:700;color:#a1887f;text-transform:upperca…` | 425 | combo multi-prop (5 decls) |
| 1 | misc | REVISAR_MANUAL | — | `font-size:11px;margin-top:10px;` | 1203 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `font-size:12px;color:var(--t3);` | 795 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `font-size:12px;font-weight:600;color:var(--t2);margin-bottom:6px;di…` | 1709 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:12px;font-weight:700;color:var(--t1);margin-bottom:2px;` | 1647 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:13px;color:var(--t2);line-height:1.6;white-space:pre-wrap;` | 1376 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:14px;color:var(--t2);line-height:1.5;` | 1765 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `font-size:18px;margin-bottom:6px;` | 574 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `font-size:20px;color:var(--a2);` | 752 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `font-size:22px;font-weight:700;color:var(--a1);` | 467 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-size:22px;font-weight:700;color:var(--t2);` | 468 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `font-size:24px;` | 417 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `font-size:24px; color:var(--a2); font-weight:800;` | 1089 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-size:24px; color:var(--dan); font-weight:800;` | 1088 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `font-size:24px; font-weight:800;` | 1090 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `font-size:32px;margin-bottom:10px;` | 573 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `font-size:8px;color:var(--t3);margin-top:2px;letter-spacing:.3px;` | 264 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-size:9px;font-weight:700;color:var(--a4);` | 1606 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `font-weight: 600; font-size: 15px; margin-bottom: 4px; color: var(-…` | 384 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `font-weight:700;` | 1395 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `font-weight:800;font-size:16px;color:var(--t1);margin-bottom:10px;` | 1814 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `font-weight:800;font-size:18px;color:var(--t1);margin-bottom:14px;` | 1689 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `gap:10px; margin-top:10px;` | 1096 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `gap:16px; margin-bottom:14px;` | 239 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `grid-column:span 2;` | 1236 | patrón aislado |
| 1 | dynamic | INLINE-LEGITIMO | — | `height:100%;border-radius:999px;background:#a1887f;width:0%;transit…` | 432 | barra de progreso animada por JS (style.width = pct%) |
| 1 | dynamic | INLINE-LEGITIMO | — | `height:100%;border-radius:999px;background:var(--a1);transition:wid…` | 1701 | barra de progreso animada por JS (style.width = pct%) |
| 1 | dynamic | INLINE-LEGITIMO | — | `height:100%;border-radius:999px;background:var(--a1);transition:wid…` | 1142 | barra de progreso animada por JS (style.width = pct%) |
| 1 | misc | REVISAR_MANUAL | — | `height:10px;margin-bottom:14px;` | 465 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `height:6px;background:rgba(121,85,72,.15);border-radius:999px;overf…` | 431 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `letter-spacing:1.2px; margin-bottom:4px;` | 270 | patrón aislado |
| 1 | typo | REVISAR_MANUAL | — | `line-height:1.6;` | 555 | 1.6 fuera de escala (--lh-snug=1.30, --lh-normal=1.50, --lh-loose=1.75) |
| 1 | misc | REVISAR_MANUAL | — | `margin-bottom:0;` | 1708 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `margin-bottom:0;display:flex;align-items:center;` | 697 | combo 3 decls |
| 1 | spacing | REVISAR_MANUAL | — | `margin-bottom:10px;` | 710 | 10px fuera escala; .mb-2 (8px) o .mb-3 (12px) |
| 1 | combo | REVISAR_MANUAL | — | `margin-bottom:14px;padding:14px;border-radius:12px;background:linea…` | 1643 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `margin-bottom:16px;flex-wrap:wrap;gap:8px;` | 1224 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `margin-bottom:16px;padding:18px;border-radius:16px;background:linea…` | 1126 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `margin-bottom:4px;display:block;font-size:11px;` | 1653 | combo 3 decls |
| 1 | combo | REVISAR_MANUAL | — | `margin-bottom:5px;display:flex;align-items:center;justify-content:s…` | 1621 | combo multi-prop (5 decls) |
| 1 | spacing | MIGRABLE-A-CLASE | .mb-2 | `margin-bottom:8px;` | 424 |  |
| 1 | misc | REVISAR_MANUAL | — | `margin-left:12px;flex-shrink:0;` | 1373 | patrón aislado |
| 1 | spacing | REVISAR_MANUAL | — | `margin-top:10px;` | 419 | 10px fuera escala |
| 1 | combo | REVISAR_MANUAL | — | `margin-top:10px;font-size:11px;color:var(--t3);min-height:0;` | 1658 | combo multi-prop (4 decls) |
| 1 | spacing | MIGRABLE-A-CLASE | .mt-3 | `margin-top:12px;` | 1217 |  |
| 1 | combo | REVISAR_MANUAL | — | `margin-top:12px;display:flex;justify-content:space-between;align-it…` | 556 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `margin-top:14px;` | 705 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `margin-top:14px;padding:12px 14px;background:rgba(121,85,72,.06);bo…` | 423 | combo multi-prop (5 decls) |
| 1 | spacing | MIGRABLE-A-CLASE | .mt-4 | `margin-top:16px;` | 612 |  |
| 1 | combo | REVISAR_MANUAL | — | `margin-top:16px;padding:16px;font-size:14px;` | 617 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `margin-top:16px;text-align:right;` | 728 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `margin-top:18px;padding:14px;border-radius:12px;background:var(--s2…` | 1161 | combo multi-prop (5 decls) |
| 1 | misc | REVISAR_MANUAL | — | `margin-top:3px;` | 511 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `margin:0;display:flex;justify-content:center;align-items:center;cur…` | 1232 | combo multi-prop (5 decls) |
| 1 | misc | REVISAR_MANUAL | — | `margin:0;font-size:13px;` | 699 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `margin:0;font-size:13px;cursor:pointer;` | 804 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `margin:0;font-size:14px;` | 510 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `margin:0;font-size:17px;line-height:1.3;` | 1372 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `margin:0;text-transform:capitalize;` | 1054 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `max-width:380px;border-radius:22px;padding:0;overflow:hidden;` | 1369 | combo multi-prop (4 decls) |
| 1 | misc | REVISAR_MANUAL | — | `max-width:420px;` | 1804 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `max-width:420px;border-radius:22px;padding:0;overflow:hidden;` | 1681 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `padding:10px 14px;font-size:12px;font-weight:700;white-space:nowrap;` | 1656 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `padding:10px 18px;font-size:13px;font-weight:700;` | 1119 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `padding:12px;` | 416 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `padding:14px 18px;` | 507 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `padding:14px;font-size:14px;` | 1825 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `padding:14px;font-size:14px;font-weight:700;border-radius:12px;` | 1723 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `padding:14px;text-align:center;border-color:rgba(255,214,10,.2);bac…` | 750 | combo multi-prop (4 decls) |
| 1 | combo | REVISAR_MANUAL | — | `padding:16px 24px 24px;border-top:1px solid var(--b1);margin-top:20px;` | 1722 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `padding:20px;text-align:center;` | 572 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `position: fixed; bottom: 84px; right: 24px; width: 60px; height: 60…` | 520 | combo multi-prop (14 decls) |
| 1 | combo | REVISAR_MANUAL | — | `position:absolute;inset:0;display:flex;flex-direction:column;align-…` | 261 | combo multi-prop (7 decls) |
| 1 | combo | REVISAR_MANUAL | — | `position:absolute;top:10px;right:10px;background:rgba(0,220,130,.12…` | 316 | combo multi-prop (16 decls) |
| 1 | misc | REVISAR_MANUAL | — | `position:relative;` | 314 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `position:relative; width:76px; height:76px; flex-shrink:0;` | 242 | combo multi-prop (4 decls) |
| 1 | layout | MIGRABLE-A-CLASE-NEW | .text-center (clase nueva) | `text-align:center;` | 1196 |  |
| 1 | combo | REVISAR_MANUAL | — | `text-align:center;margin-top:10px;display:none;` | 493 | combo 3 decls |
| 1 | misc | REVISAR_MANUAL | — | `text-align:center;margin-top:8px;` | 325 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `text-align:center;padding:12px 8px;background:rgba(0,220,130,.06);b…` | 401 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `text-align:center;padding:12px 8px;background:rgba(255,107,53,.06);…` | 405 | combo multi-prop (5 decls) |
| 1 | combo | REVISAR_MANUAL | — | `text-align:center;padding:12px 8px;background:rgba(59,158,255,.06);…` | 410 | combo multi-prop (5 decls) |
| 1 | misc | REVISAR_MANUAL | — | `transition:all .5s;` | 1198 | patrón aislado |
| 1 | dynamic | INLINE-LEGITIMO | — | `transition:stroke-dasharray .6s cubic-bezier(.4,0,.2,1),stroke-dash…` | 258 | SVG ring animado (transition para stroke-dasharray/dashoffset) |
| 1 | dynamic | INLINE-LEGITIMO | — | `transition:stroke-dasharray .6s cubic-bezier(.4,0,.2,1);` | 252 | SVG ring animado (transition para stroke-dasharray/dashoffset) |
| 1 | combo | REVISAR_MANUAL | — | `width: 100%; border: 2px dashed rgba(59,158,255,.4); background: tr…` | 382 | combo multi-prop (9 decls) |
| 1 | dynamic | INLINE-LEGITIMO | — | `width:0%;background:var(--a1);` | 465 | barra de progreso animada por JS (style.width = pct%) |
| 1 | misc | REVISAR_MANUAL | — | `width:100%;` | 1654 | patrón aislado |
| 1 | combo | REVISAR_MANUAL | — | `width:30px;height:30px;border-radius:8px;background:rgba(0,220,130,…` | 645 | combo multi-prop (9 decls) |
| 1 | combo | REVISAR_MANUAL | — | `width:30px;height:30px;border-radius:8px;background:rgba(255,214,10…` | 762 | combo multi-prop (9 decls) |
| 1 | misc | REVISAR_MANUAL | — | `width:400px;` | 1312 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `width:min(900px,96vw);` | 1456 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `z-index:250;` | 1455 | patrón aislado |
| 1 | misc | REVISAR_MANUAL | — | `z-index:300;` | 1368 | patrón aislado |


---

## 10 · Cierre

- ✅ 347 ocurrencias inventariadas (vs 341 que reportaba `grep -c`, 6 extras por líneas con 2 atributos `style=""`).
- ✅ 6 INLINE‑LEGITIMO confirmados con líneas exactas y referencia cruzada con código JS que muta `style.X` en runtime.
- ✅ 46 casos directamente migrables (20 con utilities CSS‑1 + 26 con utilities nuevas a crear).
- ✅ 295 REVISAR_MANUAL desglosados en 8 subgrupos para que la decisión humana sea localizada, no global.
- ✅ Lista de 30 líneas CSS a añadir en Fase HTML‑2 (utilities `.fs-*`, `.lh-*`, `.fw-*`, `.t-1/2/muted/ok/warn/danger/info`, `.text-*`, `.flex-1`, `.d-block`, `.m-0`).
- ✅ Plan de bloques A‑F para Fase HTML‑3 con orden de menor a mayor riesgo.

**No tocado:** `index.html`, `style.css`, ningún `.js`, `service-worker.js`, ni ningún módulo en `modules/`.

**Próximo paso:** Fase HTML‑2 — agregar las 11 clases nuevas listadas en §6 a `style.css` (≈ 30 líneas additive). Luego Fase HTML‑3 ejecuta los 6 bloques A‑F sección por sección con tests verdes y capturas visuales antes/después.
