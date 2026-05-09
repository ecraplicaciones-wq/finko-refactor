# 02 · UX/UI Modernización — Plano de Ejecución

> **Lead:** Senior Product Designer
> **Fecha:** 2026-05-06
> **Estética objetivo:** "Banca minimalista 2026" — Bento Grid en desktop, scroll fluido en mobile, accesibilidad AA, microcopy con calor humano.
> **Nudge filosófico:** la pantalla es un coach, no un panel de control.

---

## 0 · TL;DR — Decisiones tomadas

| Eje | Decisión |
|---|---|
| **Tipografía cuerpo** | **Inter** (ya usada) — mantener |
| **Tipografía números** | **DM Mono** (ya usada) — mantener |
| **Tipografía display (nueva)** | **Geist** o **Geist Sans** para títulos del Dashboard (mejor "feel" 2026) |
| **Paleta principal** | Mantener `--a1` verde lima (`#00dc82`) — es el ADN; sólo retocar los grises (`--bg`, `--s1`, `--s2`) |
| **Tema preferente** | **Dark first**, Light "premium" (no estridente) |
| **Layout desktop** | **Bento Grid 12-col fluido** con cells `1×1`, `1×2`, `2×1`, `2×2` |
| **Layout mobile** | **Stack vertical con scroll snap suave** (rítmica de cards) |
| **Microinteracciones** | `prefers-reduced-motion` respetado, transiciones ≤ 250 ms, easing `cubic-bezier(.4,0,.2,1)` |
| **Accesibilidad target** | **WCAG 2.1 AA** (no AAA — costo/beneficio justo) |
| **Behavioral nudges** | Sistema ya existente (v17-v37) refinado con jerarquía visual de severidad |

---

## 1 · Por qué la app necesita una capa UX nueva (sin reescribir)

### 1.1 Diagnóstico visual actual

Lo que tiene:

✅ **Fundamentos sólidos**: tokens CSS (`--a1..a7`), `@layer` cascada predecible, modo claro/oscuro, swipe táctil, `:focus-visible`, `prefers-reduced-motion`.
✅ **Microcopy con personalidad colombiana** ("Plato libre", "Bolsillos", "Lo que tenés", "Cómo va mi plata").
✅ **115 atributos ARIA** ya presentes.
✅ **30+ nudges defensivos** (detectores v17→v37) implementados como `aria-live` regions.

Lo que **no termina de cuajar**:

⚠️ **341 inline `style="..."`** en `index.html` → la consistencia visual depende de copiar-pegar.
⚠️ **Jerarquía tipográfica plana**: 5 tamaños mezclados sin escala armónica.
⚠️ **Bento Grid declarado pero no aprovechado**: `.g2`, `.g3`, `.g4` son grids regulares, no asimétricos.
⚠️ **Mobile: scroll vertical sin "ritmo"** — todas las cards tienen el mismo peso visual.
⚠️ **Empty states genéricos** (`emp-icon ◯ Sin objetivos creados`) — pierden la oportunidad de motivar.
⚠️ **20+ nudges en el dashboard pueden saturar** sin un sistema de prioridad visual.

> El proyecto NO necesita un rediseño desde cero. Necesita **una pasada de "design system estricto"** sobre el sistema visual que ya tiene, con énfasis en jerarquía y microcopy.

---

## 2 · Tipografía — la decisión de mayor impacto

### 2.1 Stack actual (mantener)

```css
--ff: 'Inter', system-ui, -apple-system, sans-serif;     /* Cuerpo */
--fm: 'DM Mono', monospace;                               /* Números */
```

**Por qué Inter sigue siendo correcta:**
- Ergonomía visual probada (diseñada para pantallas pequeñas)
- Soporta números tabulares (`font-feature-settings: 'tnum'`) — clave para alinear pesos colombianos
- Render impecable en Android e iOS
- Cargada eficientemente vía Google Fonts con `preconnect`

**Por qué DM Mono mantiene su lugar:**
- Para `$1.500.000` un monoespaciado evita que las cifras "bailen" en transiciones
- Diferencia visual instantánea: lo que es plata vs. lo que es texto

### 2.2 Adición propuesta — un display más "2026"

Inter está bien para el cuerpo, pero los **títulos grandes del Dashboard** ("Tu plata disponible hoy", "Cómo va mi plata") podrían ganar carácter con una display más expresiva. Tres candidatas, en orden de preferencia:

| Tipografía | Pro | Contra | Veredicto |
|---|---|---|---|
| **Geist** (Vercel, libre) | Idéntica espacial a Inter, más "moderna" en pesos altos | Carga +30 kB | ⭐ **Recomendada** |
| **Inter Display** (variante de Inter) | Cero carga adicional si se incluye | Diferencia sutil | 🥈 Segunda opción |
| **Manrope** | Curvas más suaves, sensación "premium" | Cambia el carácter actual | 🥉 Solo si se quiere dar un giro de personalidad |

**Decisión:** **Geist** para `class="display"` (títulos H1 de cada sección, números héroe del Dashboard). Inter para todo lo demás.

### 2.3 Escala tipográfica armónica (8pt base, ratio 1.25)

Hoy el código tiene tamaños sueltos. Propuesta:

```css
/* Modular type scale — 8/10/12/14/16/20/24/32/40/48 px */
--text-2xs: 0.625rem;   /* 10 px — labels chiquitos */
--text-xs:  0.75rem;    /* 12 px — copy secundario */
--text-sm:  0.875rem;   /* 14 px — copy default */
--text-md:  1rem;       /* 16 px — copy importante */
--text-lg:  1.25rem;    /* 20 px — subtítulos sección */
--text-xl:  1.5rem;     /* 24 px — títulos sección */
--text-2xl: 2rem;       /* 32 px — números héroe */
--text-3xl: 2.5rem;     /* 40 px — número del Dashboard "Tu plata" */
--text-4xl: 3rem;       /* 48 px — onboarding/celebración */

/* Pesos (aprovechando Inter Variable) */
--w-regular: 400;
--w-medium:  500;
--w-bold:    700;
--w-black:   800;
--w-heavy:   900;   /* solo display */

/* Line-heights */
--lh-tight:   1.1;   /* títulos display */
--lh-snug:    1.25;  /* títulos */
--lh-normal:  1.5;   /* copy */
--lh-relaxed: 1.7;   /* paragraphs largos (consejos) */
```

**Resultado práctico:** `index.html` deja de tener `font-size:36px` random y todo queda en `font-size: var(--text-3xl)` predecible.

### 2.4 Números tabulares — fix de detalle

```css
/* style.css: añadir */
.mono, .ui-val, .ui-val-* {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
```

Hace que `$1.234.567 → $9.876.543` no produzca shift horizontal en transiciones.

---

## 3 · Paleta de colores — refinamiento, no rediseño

### 3.1 Tokens actuales (auditoría)

```css
--a1: #00dc82;   /* Verde — ingresos, éxito */     ✅ ADN del proyecto
--a2: #ffd60a;   /* Amarillo — alertas, quincena */ ✅ Mantener
--a3: #ff6b35;   /* Naranja — gastos */             ⚠️ Demasiado alarmante para "gastos cotidianos"
--a4: #3b9eff;   /* Azul — bancos */                ✅ Mantener
--a5: #9d73eb;   /* Morado — metas */               ✅ Mantener
--a6: #ff4eb8;   /* Rosa */                         🟡 Poco usado — aceptable
--a7: #00e5cc;   /* Turquesa */                     ✅ Mantener
--dan: #ff6060;  /* Rojo crítico */                 ✅ Mantener
```

### 3.2 Cambios mínimos sugeridos

| Token | Hoy | Propuesta | Razón |
|---|---|---|---|
| `--bg` | `#080c0a` | `#06090a` | 2 puntos más oscuro = más contraste con cards |
| `--s1` | `#0d1410` | `#0e1512` | sutil ajuste para que el verde lime no "vibre" |
| `--a3` | `#ff6b35` | `#ff8a5c` | Naranja un toque menos saturado — gastos no son emergencias |
| `--t1` | `#eef4f0` | `#e9f3ec` | Reduce el tinte verde del texto (era casi #fff con verde lavado) |
| **NUEVO** `--cool-text` | — | `#9aa6a3` | Para timestamps, metadata muy secundaria |
| **NUEVO** `--success-soft` | — | `#1f3a2a` | Background de "logro pequeño" sin chillar |

**Light theme — gap actual:** No hay tokens declarados aún. Light hoy es solo el toggle. Hay que cerrar la paleta:

```css
body.light-theme {
  --bg: #f8faf9;
  --s1: #ffffff;
  --s2: #f1f5f3;
  --s3: #e6ede9;
  --b1: #d8e2dc;
  --b2: #c7d4cd;
  --b3: #b6c5bd;
  --t1: #0a1410;     /* texto principal — casi negro */
  --t2: #475a52;
  --t3: #6b7e76;
  /* Acentos: bajar luminosidad ~20% para que pasen contraste 4.5:1 sobre fondo blanco */
  --a1: #00a763;     /* verde más oscuro */
  --a2: #c69900;     /* amarillo más oscuro */
  --a3: #e35a1f;
  --a4: #1976d2;
  --a5: #6e4eb8;
  --a7: #00a78f;
  --shadow: 0 2px 12px rgba(20,30,25,.08);
  --body-glow-opacity: .15;   /* el ambient glow se baja, no se va */
}
```

### 3.3 Verificación de contraste (WCAG AA)

| Combinación | Contraste actual (dark) | Estatus | Acción |
|---|---:|:---:|---|
| `--t1` sobre `--bg` | 14.2:1 | ✅ AAA | mantener |
| `--t2` sobre `--s1` | 7.8:1 | ✅ AA | mantener |
| `--t3` sobre `--s2` | 4.6:1 | ✅ AA | borderline — testear con Lighthouse |
| `--a1` sobre `--bg` | 11.3:1 | ✅ AAA | mantener |
| `--a3` (`#ff6b35`) sobre `--bg` | 5.9:1 | ✅ AA | propuesta `#ff8a5c` → 6.7:1 ✅ |
| `--a5` (`#9d73eb`) sobre `--s1` | 5.4:1 | ✅ AA | mantener |
| `--dan` sobre `--bg` | 6.2:1 | ✅ AA | mantener |

**Acción crítica light theme:** correr **axe-core** y/o **Lighthouse** después de aplicar los tokens propuestos en §3.2; ajustar `--a2` y `--a3` si no pasan 4.5:1.

### 3.4 Daltonismo — verde-rojo (8 % de hombres)

El uso actual de verde (`--a1`) para "bien" y rojo (`--dan`) para "mal" es el patrón clásico **antagonista** para daltonismo. **Mitigación ya parcialmente implementada:** los iconos (`✅`, `🚨`, `⚠️`) refuerzan la información del color — eso es correcto y se debe reforzar.

**Regla nueva:** **ningún estado crítico se comunica solo con color**. Siempre debe haber:
- Un emoji semántico (`🚨`, `⚠️`, `✅`)
- Un cambio de **peso** o **borde**
- Un texto explícito ("Atrasada 12 días")

---

## 4 · Bento Grid en desktop — implementación técnica

### 4.1 Qué es y por qué tiene sentido para Finko

**Bento Grid** = layout asimétrico inspirado en cajas bento japonesas: cells de tamaños distintos en una grilla maestra, donde **cada elemento tiene el espacio que su importancia merece**.

Para Finko:
- "Tu plata disponible" = la cell más grande (2×2 en grid 12-col)
- "Lo que viene" + "Cómo va el período" = cells medianas (2×1)
- KPIs sueltos = cells pequeñas (1×1)
- Detectores activos = chips angostas (1×1)

### 4.2 Layout objetivo (desktop ≥1024px)

```
┌─────────────────────────────────┬─────────────┬─────────────┐
│                                 │             │             │
│       💵 TU PLATA HOY           │   🛡️ Fondo  │  📅 Lo que  │
│                                 │ Emergencia  │   viene     │
│       $4.235.890                 │    65%      │  (próx.)    │
│   [donut + desglose]            │             │             │
│                                 │             │             │
├─────────────────────────────────┼─────────────┴─────────────┤
│                                 │                           │
│   📊 Cómo va el período         │   🎯 Objetivos activos   │
│   [ingreso/gastado/ahorrado]    │   [progreso 3 metas]     │
│                                 │                           │
├──────────────┬──────────────────┴───────────────────────────┤
│              │                                              │
│ 🐜 Hormigas  │   🚨 Nudges activos (alerts urgentes)        │
│  $123.000    │   • Fijo "Arriendo" sin pagar                │
│   8% ingreso │   • Bolsillo "Viaje" sin aporte 21 d         │
│              │   • Saldo banco difiere de Σ cuentas         │
├──────────────┴──────────────────────────────────────────────┤
│                                                              │
│   🕐 Últimos movimientos (lista) · Ver todos →              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Tokens y CSS

```css
/* style.css — nueva sección "bento" */
@layer layout {
  .bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-auto-rows: minmax(120px, auto);
    gap: 16px;
  }

  /* Cells por importancia */
  .bento-hero      { grid-column: span 8; grid-row: span 2; }   /* Tu plata */
  .bento-kpi-tall  { grid-column: span 4; grid-row: span 2; }   /* Fondo emergencia */
  .bento-kpi-wide  { grid-column: span 8; grid-row: span 1; }   /* Resumen período */
  .bento-kpi       { grid-column: span 4; grid-row: span 1; }   /* Objetivos */
  .bento-pill      { grid-column: span 3; grid-row: span 1; }   /* Hormigas, métricas */
  .bento-list      { grid-column: span 12; grid-row: span 2; }  /* Movimientos */

  /* Tablet (768-1023px): grid de 8 columnas */
  @media (max-width: 1023px) and (min-width: 769px) {
    .bento { grid-template-columns: repeat(8, 1fr); }
    .bento-hero, .bento-kpi-wide, .bento-list { grid-column: span 8; }
    .bento-kpi-tall, .bento-kpi { grid-column: span 4; }
    .bento-pill { grid-column: span 4; }
  }

  /* Mobile (≤768px): stack vertical */
  @media (max-width: 768px) {
    .bento { grid-template-columns: 1fr; gap: 12px; }
    .bento > * { grid-column: span 1 !important; grid-row: auto !important; }
  }
}
```

### 4.4 Migración del HTML actual

El `<section id="sec-dash">` actual usa `<div class="card mb">` apilados. La migración es **incremental**:

```html
<!-- ANTES (simplificado) -->
<section id="sec-dash">
  <header class="sh">…</header>
  <div class="mb">
    <div class="card mb">…tu plata…</div>
  </div>
  <div class="card mb">…lo que viene…</div>
  <div class="card mb">…resumen…</div>
  <!-- ... -->
</section>

<!-- DESPUÉS -->
<section id="sec-dash">
  <header class="sh">…</header>
  <div class="bento">
    <div class="card bento-hero">…tu plata…</div>
    <div class="card bento-kpi-tall">…fondo emergencia…</div>
    <div class="card bento-kpi-wide">…lo que viene…</div>
    <div class="card bento-kpi-wide">…resumen período…</div>
    <div class="card bento-kpi">…objetivos…</div>
    <div class="card bento-pill">…hormigas…</div>
    <div class="card bento-pill">…vs quincena pasada…</div>
    <div class="card bento-list">…últimos movimientos…</div>
  </div>
</section>
```

**Costo:** 30 min editar `<div class="card mb">` por `<div class="card bento-X">` y envolver en `<div class="bento">`.

### 4.5 Reglas de uso del Bento (manual del autor)

1. **Máximo 8 cells visibles** en el primer scroll. Más de eso es ruido.
2. **El hero (1 cell `bento-hero`) siempre presente** — es el ancla emocional.
3. **Al menos 2 colores de acento** distintos en cells contiguas (evita monotonía verde-verde-verde).
4. **`prefers-reduced-motion`**: sin transición en el `grid` (evita re-layouts perceptibles).

---

## 5 · Mobile — scroll fluido con ritmo

### 5.1 Realidad actual

El mobile actual ya es **mobile-first y bien resuelto**:

✅ Sidebar colapsa a bottom-bar.
✅ Cards `padding: 16px` y `margin-bottom: 14px`.
✅ Touch targets 44 × 44 px (cumple WCAG 2.5.5).
✅ Modal como bottom-sheet.
✅ `safe-area-inset-bottom` para iPhone notch.
✅ Swipe izquierda/derecha entre secciones.

### 5.2 Lo que falta — ritmo

Las 12+ cards del Dashboard se sienten **planas** en mobile: todas miden lo mismo, todas tienen el mismo peso. La intuición se diluye.

**Propuesta — jerarquía por escala:**

```css
@media (max-width: 768px) {
  /* Hero: card más grande, padding más generoso */
  .bento-hero {
    padding: 24px 20px 28px;
    border-radius: 22px;       /* 2 px más redonda que el resto */
    min-height: 240px;
  }

  /* KPIs: card mediana */
  .bento-kpi-wide, .bento-kpi-tall {
    padding: 20px 18px;
    min-height: 140px;
  }

  /* Pills: card chiquita, alineadas en par */
  .bento-pill {
    padding: 16px 14px;
    min-height: 100px;
  }

  /* Layout: pares de pills lado a lado */
  .bento-pill {
    grid-column: span 1;
  }
  .bento {
    grid-template-columns: 1fr 1fr;
  }
  .bento-hero, .bento-kpi-wide, .bento-list { grid-column: span 2; }
}
```

### 5.3 Scroll snap (opcional, A/B testeable)

```css
@media (max-width: 768px) {
  #sec-dash {
    scroll-snap-type: y proximity;
    scroll-padding-top: 16px;
  }
  .bento > .card {
    scroll-snap-align: start;
  }
}
```

`proximity` (no `mandatory`) → al usuario le ayuda al scroll pero no lo "atrapa" en una card. Si hay quejas, se quita.

### 5.4 Animación de entrada — sin marear

```css
@layer layout {
  /* Aparición suave en cascada — solo si NO hay reduced motion */
  @media (prefers-reduced-motion: no-preference) {
    .sec.active .bento > .card {
      animation: bentoIn .4s cubic-bezier(.2,.8,.2,1) backwards;
    }
    .sec.active .bento > .card:nth-child(1) { animation-delay: 0ms; }
    .sec.active .bento > .card:nth-child(2) { animation-delay: 40ms; }
    .sec.active .bento > .card:nth-child(3) { animation-delay: 80ms; }
    /* ... hasta :nth-child(8): 280 ms */
  }
  @keyframes bentoIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}
```

Total ≤ 280 ms entrada — el usuario ve el dashboard "respirar" sin sentirse demorado.

---

## 6 · Sistema de nudges — jerarquía visual con calor humano

### 6.1 Inventario actual (35 nudges)

El proyecto ya tiene 35+ detectores (v17→v37). Hoy todos se renderizan como `<div class="al alX">` con casi el mismo peso. El usuario nuevo se asusta.

**Clasificación propuesta por urgencia:**

| Nivel | Criterio | Tratamiento visual |
|---|---|---|
| 🔴 **Crítico** | Datos malos invalidan los demás indicadores | Banner rojo top, 1 pixel de border destacado, no auto-dismiss |
| 🟠 **Alto** | Atrasos, recargos inminentes, deudas en mora | Card naranja, primero en orden |
| 🟡 **Medio** | Bolsillo olvidado, hormigas acumuladas, prediccion | Card amarillo suave, agrupable |
| 🔵 **Info** | Comparativas, tendencias, retrospectiva | Card azul, expandible (acordeón) |
| 🟢 **Logro** | Salud financiera ≥70, racha ahorro 3+ quincenas | Card verde, celebrable, sin acción |

### 6.2 Mapeo concreto

| Detector (función pura) | Nivel |
|---|:---:|
| `validarSaldosCoherentes` (drift banco) | 🔴 |
| `calcularRebalanceoBolsillos` (Σ bolsillos > saldo) | 🔴 |
| `detectarFijosSinPagar` (>0 días atraso) | 🟠 |
| `detectarMesesSinCerrar` (gastos huérfanos) | 🟠 |
| `detectarDeudasDurmiendo` (≥2m sin pago) | 🟠 |
| `detectarAlertasUrgentes` (saldo neg, evento excedido) | 🟠 |
| `detectarHormigaAcumulada` (≥15% ingreso) | 🟡 |
| `predecirFinQuincena` (saldo proyectado <0) | 🟡 |
| `detectarObjetivosSinProgreso` | 🟡 |
| `detectarBolsillosEnFuga` | 🟡 |
| `detectarBolsillosOlvidados` | 🟡 |
| `detectarBackupNudge` (>30 días sin export) | 🟡 |
| `calcularComparacionCategorias` (vs período pasado) | 🔵 |
| `detectarPatronGastoSemanal` | 🔵 |
| `calcularTendencias` | 🔵 |
| `detectarInversionesSinActualizar` | 🔵 |
| `calcularSaludFinanciera` (score ≥70) | 🟢 |

### 6.3 Componente reutilizable `<nudge-card>`

```css
/* style.css — añadir */
.nudge {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: start;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid;
  margin-bottom: 10px;
  font-family: var(--ff);
}
.nudge-icon { font-size: 22px; line-height: 1; }
.nudge-body { font-size: var(--text-sm); line-height: var(--lh-normal); }
.nudge-title { font-weight: var(--w-bold); margin-bottom: 2px; }
.nudge-desc  { color: var(--t2); }
.nudge-cta {
  align-self: center;
  white-space: nowrap;
  font-size: var(--text-xs);
  padding: 6px 12px;
  border-radius: 10px;
  font-weight: var(--w-bold);
}

.nudge-critical {
  background: color-mix(in srgb, var(--dan) 8%, transparent);
  border-color: color-mix(in srgb, var(--dan) 30%, transparent);
  border-left: 3px solid var(--dan);
}
.nudge-high     { background: color-mix(in srgb, var(--a3) 6%, transparent);
                   border-color: color-mix(in srgb, var(--a3) 25%, transparent); }
.nudge-medium   { background: color-mix(in srgb, var(--a2) 5%, transparent);
                   border-color: color-mix(in srgb, var(--a2) 22%, transparent); }
.nudge-info     { background: color-mix(in srgb, var(--a4) 5%, transparent);
                   border-color: color-mix(in srgb, var(--a4) 22%, transparent); }
.nudge-success  { background: color-mix(in srgb, var(--a1) 7%, transparent);
                   border-color: color-mix(in srgb, var(--a1) 30%, transparent); }
```

### 6.4 Microcopy — el calor humano

| Antes (técnico/frío) | Después (cálido/accionable) |
|---|---|
| "Bolsillo sin movimientos" | "Hace 18 días no le metés nada al bolsillo de **Viaje**. ¿Lo dejamos en pausa o le mandamos algo?" |
| "Saldo proyectado negativo" | "Si seguís así, vas a quedar en rojo el día 30. **Aún tenés 6 días para frenar la mano**." |
| "Hormigas: 8% del ingreso" | "Tus 3 mayores hormigas esta quincena: ☕ café $43k, 🚕 Uber $27k, 📱 datos $19k. **Eso es una pizza grande de domingo.**" |
| "Saludo financiera: 78" | "🌱 Vas bien. Score: **78/100**. Lo que más jala: tu disciplina con los fijos." |
| "QuotaExceededError" | "Ya estás cerca del tope de espacio (95%). **Exportá un backup ahora**, así liberamos el guardado viejo sin perder datos." |

**Regla**: cada nudge debe tener **(1) qué pasa**, **(2) por qué importa en plata**, **(3) qué hacer**. Tres líneas máximo.

### 6.5 Behavioral economics — los nudges con base teórica

| Sesgo cognitivo | Cómo lo aprovechamos | Implementado |
|---|---|---|
| **Loss aversion** | Mostrar lo que se pierde con interés vs lo que se gana ahorrando | Sí — calculadora deudas |
| **Present bias** | Convertir "ahorra para el futuro" en "guarda esta semana" | Sí — bolsillos quincenales |
| **Mental accounting** | Bolsillos visualmente separados | ✅ ADN del proyecto |
| **Anchoring** | Mostrar comparativa de quincena pasada | Sí — `calcularComparacionCategorias` |
| **Default effect** | Pre-seleccionar 50/30/20 al planificar | ✅ Ya implementado |
| **Goal gradient** | Barra de progreso del fondo de emergencia | ✅ Ya implementado |
| **Social proof** | "El 70% de usuarios colombianos ahorra <10%. Vos vas en 14% — mejor que el promedio." | ❌ **Implementar** |
| **Streak mechanics** | Racha de quincenas con ahorro positivo | ✅ Ya implementado (`calcularRachaAhorro`) |
| **Loss-streak warning** | "Llevas 2 quincenas seguidas en rojo. Romper la cadena tiene costo emocional, no la dejes crecer." | ❌ **Implementar** |
| **Implementation intention** | Pedir un día concreto para revisar al cerrar quincena: "Te recordamos el viernes 16 a las 9 am" | ❌ Roadmap futuro (push notifications) |

---

## 7 · Accesibilidad — WCAG 2.1 AA · plan concreto

### 7.1 Estado actual (medido)

| Criterio | Estatus | Ubicación |
|---|:---:|---|
| 1.3.1 Info y relaciones | 🟡 | 115 ARIA presentes, faltan ~30 botones inline |
| 1.4.3 Contraste 4.5:1 | 🟡 | Dark pasa, light theme **falta auditar** |
| 1.4.10 Reflow | ✅ | Responsive completo hasta 280px |
| 1.4.11 Contraste no-texto | 🟡 | Bordes 1px (`var(--b1)`) pueden quedar bajos |
| 2.1.1 Teclado | 🟡 | Modales OK, day-picker tab-able |
| 2.1.4 Atajos | ✅ | Ctrl+Z global, sin colisión con inputs |
| 2.4.3 Orden de foco | ✅ | Modales devuelven foco al disparador |
| 2.4.7 Foco visible | ✅ | `:focus-visible` 2px outline |
| 2.5.5 Tamaño táctil | ✅ | 44×44 mínimo |
| 3.3.1 Errores identificados | 🟡 | `getValueOrThrow` mejora pero `showAlert` toast no es `role="alert"` |
| 3.3.3 Sugerencia de error | 🟡 | Algunos errores son genéricos |
| 4.1.2 Nombre/rol/valor | 🟡 | Botones-icono sin `aria-label` ~30 |
| 4.1.3 Mensajes de estado | ✅ | `sr()` + `aria-live` regions |

### 7.2 Acciones priorizadas

| Acción | Esfuerzo | Impacto |
|---|:---:|:---:|
| Auditar `index.html` con `axe-core` y resolver top 10 violaciones | 2 h | Alto |
| Añadir `aria-label` a los ~30 botones-icono sin texto | 1 h | Alto |
| Convertir `showAlert` a `role="alertdialog"` | 1 h | Medio |
| Light theme: medir contraste y ajustar `--a2`, `--a3` | 1 h | Alto |
| Day-picker: `role="grid"` + manejo de teclado (←/→/↑/↓) | 2 h | Medio |
| Añadir `prefers-color-scheme` + `Media-Color-Scheme` matching | 30 min | Bajo |
| `lang` por sección si hay nombres de cuenta en otros idiomas | — | N/A en CO |
| Keyboard shortcuts visibles (`?` para ayuda) | 1 h | Medio |

### 7.3 Lighthouse target

| Métrica | Hoy | Objetivo post-trabajo |
|---|---:|---:|
| Performance | ~85 | **≥90** |
| Accessibility | ~85 | **≥95** |
| Best Practices | ~90 | **≥95** |
| SEO | ~85 | **≥90** |
| PWA | 100 | **100** |

---

## 8 · Microinteracciones — el nivel detalle

### 8.1 Principios

1. **Toda transición ≤ 250 ms** (excepto modal slide-in: 300 ms).
2. **Easing único:** `cubic-bezier(.4, 0, .2, 1)` — emerge del Material 3.
3. **`prefers-reduced-motion`** apaga animaciones cosméticas, **mantiene** las informacionales (ej: barra de progreso del ahorro).
4. **Feedback táctil**: `:active` en botones móviles → `transform: scale(.97)` en 80 ms.

### 8.2 Catálogo de microinteracciones

| Componente | Microinteracción | Cuándo |
|---|---|---|
| Botón principal | Scale 0.97 al press, restaura en 100 ms | Todos los `:active` mobile |
| Card hover | `border-color` cambia + `transform: translateY(-2px)` | Solo desktop (no mobile) |
| Donut del Dashboard | Animación del `stroke-dasharray` 600 ms al cambiar | Cuando saldo cambia |
| Chip de nudge | Slide in desde arriba al aparecer | Solo el primero del scroll |
| Toggle theme | Cross-fade entre paletas 250 ms | Click en tema |
| Accordion (`.dash-card-body`) | `max-height` + `opacity` 350 ms | Click en cabecera |
| Modal | Slide up desde bottom 300 ms (mobile) / fade 200 ms (desktop) | `openM(id)` |
| Tab interno (`.itab`) | Background pill desliza 200 ms al cambiar tab | Click en tab |
| Logro desbloqueado | Confetti 1.2 s + sonido opcional | `evaluarLogros` detecta nuevo |

### 8.3 Implementación de "logro desbloqueado" (nueva)

Hoy `evaluarLogros` actualiza `S.logros.desbloqueados` en silencio. Propuesta:

```js
// modules/dominio/analisis/logros.js (post-refactor R1)
export function celebrarLogro(logro) {
  // Notificación no-bloqueante visible 4s
  const t = document.createElement('div');
  t.className = 'logro-toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `
    <span class="logro-emoji">🎉</span>
    <div>
      <div class="logro-titulo">¡Desbloqueaste un logro!</div>
      <div class="logro-nombre">${he(logro.nombre)}</div>
    </div>
  `;
  document.body.appendChild(t);
  // Confetti suave (sin librería externa: 30 spans con animación CSS)
  _spawnConfetti(t);
  setTimeout(() => t.classList.add('fade'), 3500);
  setTimeout(() => t.remove(), 4000);
  sr(`Logro desbloqueado: ${logro.nombre}`);
}
```

CSS confetti < 2 KB, sin dependencias.

---

## 9 · Empty states — la oportunidad de motivar

### 9.1 Auditoría actual

| Pantalla | Empty state actual | Propuesta |
|---|---|---|
| Cuentas | "+ Toca aquí para registrar tu plata" | ✅ Bueno — mantener |
| Gastos | "Sin movimientos registrados" | ⚠️ Frío — proponer: "Registra tu primer gasto. Cualquiera vale: el tinto, el bus, una recarga." |
| Objetivos | "Sin objetivos creados" | ⚠️ Frío — proponer: "🎯 ¿Qué te emociona ahorrar? **Un viaje, un techo, una bici**. Empezá uno chiquito." |
| Deudas | (no auditado) | Proponer: "🎉 ¡Sin deudas registradas! Si tenés una tarjeta o crédito, agendalo y armamos plan." |
| Inversiones | (no auditado) | Proponer: "📈 ¿Tenés un CDT, una acción, un FIC? Registralo y verás cómo crece — o cuándo retirar." |
| Bolsillos | (no auditado) | Proponer: "🪙 Los bolsillos son para apartar plata sin sacarla del banco. Crea uno: 'Mercado', 'Viaje', 'Emergencias'." |

### 9.2 Patrón visual

```html
<div class="empty-state">
  <div class="empty-emoji">🎯</div>
  <div class="empty-title">¿Qué te emociona ahorrar?</div>
  <div class="empty-desc">Un viaje, un techo, una bici. Empezá uno chiquito y te cuento cómo va cada quincena.</div>
  <button class="btn bp" data-action="openM" data-arg-id="m-objetivo">+ Crear mi primer objetivo</button>
</div>
```

```css
.empty-state {
  text-align: center;
  padding: 36px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.empty-emoji  { font-size: 56px; opacity: .85; line-height: 1; }
.empty-title  { font-size: var(--text-lg); font-weight: var(--w-bold); color: var(--t1); }
.empty-desc   { font-size: var(--text-sm); color: var(--t3); max-width: 320px; line-height: var(--lh-normal); }
.empty-state .btn { margin-top: 8px; }
```

---

## 10 · Onboarding — primera vez

### 10.1 Estado actual

No hay onboarding. Un usuario nuevo abre la app, ve un dashboard vacío y **no sabe qué hacer**. La memoria del proyecto y `CLAUDE.md` confirman que esta es una pieza pendiente.

### 10.2 Propuesta — "wizard suave de 3 pasos"

**Paso 1 — Hola** *(modal opcional, dismissable)*
> "👋 Bienvenida/o a Finko Pro.
> Acá vas a poder ver tu plata, planificar la quincena y dejar de preguntarte 'en qué se me fue'.
> Te toma 2 minutos arrancar — ¿le entramos?"
>
> [Empezar] [Saltar — sé qué hago]

**Paso 2 — Cuánto tenés hoy** *(form simple)*
> "Vamos a registrar lo que tenés ahora — efectivo + bancos.
> Tranqui, todo se queda en este celular: nada se sube a internet."
>
> 💵 Efectivo en mano: [______]
> 🏦 ¿Tenés cuenta? [+ Agregar Nequi/Bancolombia/etc]
>
> [Siguiente]

**Paso 3 — Qué te entra** *(form simple)*
> "¿Cuánto te entra cada quincena?
> Aproximado vale — después lo afinamos."
>
> 💰 Ingreso quincenal: [______]
> 📅 Te entra: [⦿ Mensual] [○ Quincenal]
>
> [Listo, vamos al Dashboard]

**Después del wizard**: el dashboard se popula con el saldo + ingreso. **Aparece el primer logro 🎉 "Empezaste"** + un nudge tipo coach: "Ahora probá registrar el primer gasto — el tinto de la mañana, lo que sea."

### 10.3 Flag de control

```js
// state.js
S.onboardingCompleto = false;   // se setea a true al cerrar el wizard

// events.js _initUI
if (!S.onboardingCompleto) abrirOnboardingWizard();
```

---

## 11 · Iconografía — emojis con propósito

Finko ya usa emojis de forma sistemática. **Mantener** este lenguaje visual — es parte del ADN colombiano (cálido, no frío como un app bancario europeo).

**Reglas de uso (que ya respeta el código):**

| Categoría | Emoji | Uso |
|---|:---:|---|
| Plata visible | 💵 | Efectivo en mano |
| Bancos | 🏦 | Cuenta general |
| Específicos | 📱 (Nequi), 💳 (Daviplata), 🌻 (Bancolombia) | Por banco |
| Bolsillos | 🪙 | Apartado |
| Metas | 🎯 | Objetivos |
| Deudas | 💳 | Compromisos |
| Hormigas | 🐜 | Gastos chicos |
| Inversión | 📈 | Crecer |
| Alertas | 🚨 (crítico), ⚠️ (medio), 💡 (info), ✅ (OK) | Nudges |
| Celebración | 🎉 | Logros |

> **Anti-patrón**: no usar emojis decorativos sin función. Cada uno comunica algo.

---

## 12 · Tabla maestra de acciones — UI/UX

| # | Acción | Esfuerzo | Impacto visual | Riesgo |
|---|---|:---:|:---:|:---:|
| U1 | Añadir Geist como display + escala tipográfica armónica | 1 h | Alto | 🟢 |
| U2 | Refinar tokens de color (`--bg`, `--s1`, `--a3`, `--t1`) | 30 min | Medio | 🟢 |
| U3 | Tokens completos para light theme | 1 h | Alto | 🟢 |
| U4 | Auditoría axe-core + corrección top 10 | 2 h | Alto | 🟡 |
| U5 | Implementar `.bento` grid + clases cell | 2 h | Alto | 🟡 |
| U6 | Migrar dashboard a layout Bento | 1.5 h | Alto | 🟡 |
| U7 | Sistema `.nudge` (5 niveles) + migrar nudges existentes | 3 h | Alto | 🟡 |
| U8 | Microcopy: reescribir 12 mensajes de error y nudges | 2 h | Medio | 🟢 |
| U9 | Empty states nuevos en 6 secciones | 1.5 h | Medio | 🟢 |
| U10 | Onboarding wizard (3 pasos) | 4 h | Alto | 🟡 |
| U11 | Microinteracción "logro desbloqueado" | 2 h | Medio | 🟢 |
| U12 | Light theme: review final con Lighthouse | 1 h | Medio | 🟢 |
| U13 | Day-picker accesible por teclado (`role=grid`) | 2 h | Medio | 🟡 |
| U14 | `font-variant-numeric: tabular-nums` global en `.mono` | 5 min | Bajo | 🟢 |
| U15 | Animación de entrada (cascada bento) respetando reduced-motion | 30 min | Medio | 🟢 |

> Total: **~24 h**. Se puede hacer en paralelo con la limpieza del Plano 01 (no comparten archivos).

---

## 13 · Cierre

La UX/UI nueva **no rompe nada** del trabajo previo. Reusa:

- ✅ Sistema `@layer` ya bien organizado.
- ✅ Tokens de color que son ADN.
- ✅ Patrones de delegación (`data-action`).
- ✅ Detectores y nudges existentes.
- ✅ Tipografías ya cargadas.

Lo que **agrega**:

- 🆕 Bento Grid en desktop (asimetría con propósito).
- 🆕 Escala tipográfica armónica (8pt base).
- 🆕 Sistema `nudge-{nivel}` con microcopy cálido.
- 🆕 Empty states que invitan a actuar.
- 🆕 Onboarding wizard (cierra el gap de "primera vez").
- 🆕 Behavioral nudges con base teórica explícita.

— *Fin del Plano 02 · Próximo: [03_logica_financiera_col.md](03_logica_financiera_col.md)*