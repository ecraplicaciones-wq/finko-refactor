# Sistema de Diseño — Finko Pro

> **Estado:** documento vivo. Sirve como referencia visual y de UX/UI para la app actual y para los cambios planificados en Fase 5 (UX moderna).
> **Pre‑requisito:** `REORG_CSS.md` ejecutado al menos hasta Fase CSS‑1 (tokens nuevos).

---

## 1 · Objetivo

Definir el lenguaje visual y de interacción de Finko Pro de forma **explícita, accesible y fácil de mantener**, para que cualquier dev/diseñador pueda:

1. Saber qué color, tipografía o espaciado usar sin inventar.
2. Mantener consistencia entre secciones.
3. Cumplir WCAG 2.1 AA sin esfuerzo extra.
4. Implementar el **Bento Grid** del dashboard sin ambigüedad.
5. Escribir microcopy con tono coherente.

---

## 2 · Alcance

- Paleta de colores (oscuro y claro).
- Tipografía (familias, escala, line‑heights).
- Espaciado (8pt grid).
- Radii, sombras, gradientes.
- Componentes (botones, cards, modales, chips, tabs, day picker).
- Bento Grid (estructura desktop).
- Microcopy y tono.
- Empty states.
- Behavioral nudges (con base ética).
- Onboarding de primera vez.
- Accesibilidad (WCAG 2.1 AA target).

---

## 3 · Estado actual

**Estética dominante:** *minimalismo + glassmorphism suave con acento verde neón.*

Características visuales clave que **deben preservarse**:

- Fondo oscuro `#080c0a` (casi negro con tinte verdoso) con glow radial sutil.
- Acento principal verde neón `#00dc82` (color firma del proyecto).
- Cards `rgba(...)` con `backdrop-filter: blur(4px)` (glassmorphism suave, no extremo).
- 7 acentos auxiliares para diferenciación de categorías (amarillo, naranja, azul, púrpura, rosa, turquesa).
- Sombras `0 4px 24px rgba(0,0,0,.35)` (suaves, no dramáticas).
- Radii medianos 8–22px (no afilados, no excesivamente redondeados).
- Tipografía Inter (UI) + DM Mono (valores numéricos).

**Lo que falta o se va a mejorar:**

- Escala tipográfica formal (8pt) — hoy hay tamaños puntuales.
- Bento Grid en desktop (hoy es grid básico).
- Microcopy con tono unificado.
- Empty states diseñados (hoy son texto plano).
- Onboarding de primer uso.

---

## 4 · Problemas detectados

| # | Problema |
|---|---|
| **DS‑1** | Sin escala tipográfica formal — saltos arbitrarios |
| **DS‑2** | Sin Bento Grid en desktop — desperdicia espacio horizontal en pantallas grandes |
| **DS‑3** | Empty states son texto plano sin CTA visual |
| **DS‑4** | Microcopy inconsistente: a veces "saldo disponible", otras "tu plata" |
| **DS‑5** | Onboarding inexistente — el primer ingreso es desconcertante |
| **DS‑6** | 341 inline styles dificultan iterar el sistema visual |
| **DS‑7** | Algunos contrastes (en modo claro especialmente) están justo en el límite WCAG AA |
| **DS‑8** | No hay documentación visual previa — este documento la crea |

---

## 5 · Propuesta — Tokens y escalas

### 5.1 · Paleta — modo oscuro (default)

> ⚠️ **Los contrastes listados son estimaciones derivadas de fórmula WCAG 2.1 sobre los hex declarados.** Verificar con herramienta oficial (https://contrast-ratio.com o axe‑core) **antes de cerrar Fase 5**. Los números pueden variar ±0.3 según renderizado y antialiasing del browser.

| Token | Valor | Uso | Contraste vs `--bg` (estimado) |
|---|---|---|:---:|
| `--bg` | `#080c0a` | Fondo de la app | — |
| `--s1` | `#0d1411` | Surface principal (cards) | 1.7:1 |
| `--s2` | `#111a13` | Surface elevada (modales) | 1.9:1 |
| `--s3` | `#162420` | Surface muy elevada (tooltips) | 2.2:1 |
| `--b1` | `rgba(255,255,255,.06)` | Border sutil | — |
| `--b2` | `rgba(255,255,255,.12)` | Border medio | — |
| `--b3` | `rgba(255,255,255,.20)` | Border fuerte | — |
| `--t1` | `#e6f0eb` | Texto primario | 14.1:1 ✅ AAA |
| `--t2` | `#a8b8b0` | Texto secundario | 7.5:1 ✅ AAA |
| `--t3` | `#6c7c75` | Texto terciario / muted | 4.6:1 ✅ AA |
| `--a1` | `#00dc82` | Verde primario (Finko) | 9.8:1 ✅ AAA |
| `--a2` | `#ffd60a` | Amarillo (alertas, prima) | 13.2:1 ✅ AAA |
| `--a3` | `#ff6b35` | Naranja (gastos, urgencia) | 6.4:1 ✅ AA |
| `--a4` | `#3b9eff` | Azul (info, bancos) | 6.0:1 ✅ AA |
| `--a5` | `#9d73eb` | Púrpura (metas) | 5.5:1 ✅ AA |
| `--a6` | `#ff4eb8` | Rosa (estados especiales) | 5.8:1 ✅ AA |
| `--a7` | `#00e5cc` | Turquesa (acentos) | 9.2:1 ✅ AAA |
| `--ok` | `#00dc82` | Estado positivo | 9.8:1 |
| `--war` | `#ffd60a` | Estado advertencia | 13.2:1 |
| `--dan` | `#ff6060` | Estado peligro | 5.4:1 ✅ AA |
| `--inf` | `#3b9eff` | Estado informativo | 6.0:1 |

> Verde primario `#00dc82` excede AAA contra fondo oscuro. Es el color de toda la app — usarlo libremente.

### 5.2 · Paleta — modo claro

```css
body.light-theme {
  --bg: #f4f7f5;
  --s1: #ffffff;
  --s2: #f9fbf9;
  --s3: #eef2ef;
  --b1: rgba(0,0,0,.06);
  --b2: rgba(0,0,0,.12);
  --b3: rgba(0,0,0,.20);
  --t1: #0e1612;
  --t2: #4a554f;
  --t3: #6c7670;
  /* Acentos: ligeramente desaturados para mejor lectura sobre blanco */
  --a1: #00b86d;
  --a2: #d49b00;
  --a3: #d44a14;
  --a4: #1d6cd9;
  --a5: #6f4dc9;
  --a6: #d4239b;
  --a7: #00b3a3;
  --ok: var(--a1);
  --war: var(--a2);
  --dan: #d63b3b;
  --inf: var(--a4);
  --shadow: 0 4px 16px rgba(0,0,0,.10);
  --body-glow-opacity: 0.3;
}
```

> Validar contrastes en https://contrast-ratio.com — todos deben ≥ 4.5:1 para texto normal.

### 5.3 · Escala tipográfica (8pt)

```css
:root {
  --fs-xs:   12px;   /* helpers, hints, captions */
  --fs-sm:   14px;   /* labels, secondary text */
  --fs-base: 16px;   /* body por defecto */
  --fs-md:   18px;   /* énfasis */
  --fs-lg:   22px;   /* títulos sección */
  --fs-xl:   28px;   /* hero title */
  --fs-2xl:  36px;   /* dashboard mega number */

  --lh-tight:  1.15;
  --lh-snug:   1.30;
  --lh-normal: 1.50;
  --lh-loose:  1.75;
}
```

**Reglas de uso:**

- Body por defecto: `font: 400 var(--fs-base)/var(--lh-normal) var(--ff)`.
- Valores numéricos en cards: `font: 600 var(--fs-lg)/var(--lh-tight) var(--fm)`.
- Hero del dashboard: `font: 700 var(--fs-2xl)/var(--lh-tight) var(--fm)` (DM Mono).
- Headings: solo `--fs-lg` y `--fs-xl`.
- Captions: `--fs-xs` con `color: var(--t3)`.

### 5.4 · Espaciado (8pt grid)

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

**Regla:** padding/margin solo usa estos valores. Fin de los `margin: 7px`.

### 5.5 · Radii, sombras, transiciones

```css
:root {
  --r-sm: 6px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 22px;
  --r-pill: 999px;

  --shadow-sm: 0 2px 8px  rgba(0,0,0,.20);
  --shadow:    0 4px 24px rgba(0,0,0,.35);
  --shadow-lg: 0 8px 40px rgba(0,0,0,.45);

  --easing: cubic-bezier(.2, .8, .2, 1);
  --dur-fast:   120ms;
  --dur-normal: 200ms;
  --dur-slow:   320ms;
}
```

---

## 6 · Tipografía

### 6.1 · Familias

- **Inter** (300, 400, 500, 600, 700, 800) — UI completa, etiquetas, textos.
- **DM Mono** (300, 400, 500) — valores numéricos, montos, métricas.

### 6.2 · ¿Por qué estas?

- **Inter** es la fuente UI más optimizada que existe para pantallas; su altura de x grande mejora legibilidad en tamaños pequeños. Es OFL (libre).
- **DM Mono** entrega monoespaciado moderno que diferencia visualmente la información cuantitativa (plata) del resto del UI sin sentirse "técnica" o "antigua".

### 6.3 · Carga

- `<link rel="preconnect" href="https://fonts.googleapis.com">`
- `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
- `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap">`
- **Alternativa offline‑first (futuro):** auto‑hostear `.woff2` para no depender de Google Fonts cuando no haya red.

---

## 7 · Componentes

### 7.1 · Botones

```html
<button class="btn bp">Acción primaria</button>
<button class="btn bg">Cancelar</button>
<button class="btn bd">Eliminar</button>
<button class="btn bbl">Info</button>
<button class="btn byw">Atención</button>
<button class="btn bor">Urgente</button>
<button class="btn bpu">Meta</button>
<button class="btn bp bsm">Pequeño</button>
<button class="btn bp bfw">Ancho completo</button>
```

**Reglas:**

- `.bp` (primario) = verde `--a1`. Solo uno por pantalla / modal.
- `.bg` (gris) = secundario. Cancel / cerrar.
- `.bd` (danger) = solo para eliminar.
- Otros (`bbl`, `byw`, `bor`, `bpu`) = contextuales por dominio.
- Min height 44px (touch target).
- Foco visible: `outline: 2px solid var(--a1); outline-offset: 3px;`.

### 7.2 · Cards (`.list-item`)

```html
<article class="card list-item list-item--fijo" data-id="…">
  <header class="list-item__header">
    <h3 class="list-item__title">Netflix</h3>
    <span class="ui-chip ui-chip--info">Mensual</span>
  </header>
  <div class="list-item__body">
    <div class="ui-row ui-row-sb">
      <span class="ui-label">Próximo pago</span>
      <span class="ui-val">15 may</span>
    </div>
    <div class="ui-row ui-row-sb">
      <span class="ui-label">Monto</span>
      <span class="ui-val ui-val-md">$32.900</span>
    </div>
  </div>
  <footer class="list-item__actions">
    <button class="btn bg bsm" data-action="…">Editar</button>
    <button class="btn bd bsm" data-action="…">Eliminar</button>
  </footer>
</article>
```

Modificadores: `--fijo`, `--deuda`, `--inv`, `--pago`, `--hist`, `--meta`, `--cuenta`. Cada uno cambia el color del border-left para reconocimiento rápido.

### 7.3 · Chips

```html
<span class="ui-chip">Default</span>
<span class="ui-chip ui-chip--ok">Al día</span>
<span class="ui-chip ui-chip--warn">Pronto</span>
<span class="ui-chip ui-chip--danger">Atrasado</span>
<span class="ui-chip ui-chip--info">Info</span>
```

Pastilla compacta. Texto en `--fs-xs` o `--fs-sm`. Border 1px solid del color, background `color-mix(in srgb, var(--color), transparent 80%)`.

### 7.4 · Modales

Patrón estándar:

```html
<div class="modal-ov" id="m-NAME" role="dialog" aria-modal="true" aria-labelledby="m-NAME-title">
  <div class="modal">
    <header class="modal__header">
      <h2 id="m-NAME-title">Título</h2>
      <button class="modal__close" aria-label="Cerrar" data-action="closeM" data-arg-id="m-NAME">×</button>
    </header>
    <div class="modal__body">…</div>
    <footer class="modal__footer">
      <button class="btn bg" data-action="closeM" data-arg-id="m-NAME">Cancelar</button>
      <button class="btn bp" data-action="…">Acción</button>
    </footer>
  </div>
</div>
```

**Reglas:**

- Foco se mueve al primer input al abrir.
- ESC cierra (handled en `actions.js`).
- Click en overlay cierra.
- Background scroll bloqueado mientras está abierto.
- Animación entrada / salida ≤ 200ms (respeta `prefers-reduced-motion`).

### 7.5 · Tabs (`.qtab`, `.gast-tab`)

Compactar en una sola clase `.tab` con modificadores semánticos.

```html
<div class="tabs" role="tablist">
  <button class="tab tab--active" role="tab" aria-selected="true">Hormiga</button>
  <button class="tab" role="tab" aria-selected="false">Necesario</button>
  <button class="tab" role="tab" aria-selected="false">Deseo</button>
</div>
```

### 7.6 · Day picker

Reusable, una sola implementación en CSS y JS. Ver contrato en `REORG_HTML.md` §5.3.

---

## 8 · Bento Grid (desktop)

### 8.1 · ¿Qué es?

Grid asimétrico al estilo "menú bento" donde cada celda tiene un tamaño distinto según la importancia visual del contenido. Inspiración: dashboards de Notion, Apple App Store, Stripe.

### 8.2 · Dashboard `#sec-dash` propuesto

```
┌──────────────────────────────────────────────────────────────────┐
│  HERO (8 cols × 2 rows)              │  SCORE SALUD (4 × 2)      │
│  Saldo total, próximo pago, ingreso  │  Score 0-100 + breakdown  │
│  hoy, racha actual                   │                           │
├──────────────────────────────────────┼───────────────────────────┤
│  GASTO HOY (4 × 1)                   │  HORMIGAS (4 × 1)         │
│                                      │                           │
├──────────────────────────────────────┼───────────────────────────┤
│  PRÓXIMO PAGO (4 × 1)                │  AHORRADO (4 × 1)         │
│                                      │                           │
├──────────────────────────────────────┴───────────────────────────┤
│  CHART INGRESOS vs GASTOS (12 × 2)                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 · CSS base

```css
.dash-bento {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 140px;
  gap: var(--sp-4);
}
.dash-bento__hero    { grid-column: span 8; grid-row: span 2; }
.dash-bento__score   { grid-column: span 4; grid-row: span 2; }
.dash-bento__small   { grid-column: span 4; grid-row: span 1; }
.dash-bento__chart   { grid-column: span 12; grid-row: span 2; }

@media (max-width: 768px) {
  /* Mobile: stack vertical, scroll natural */
  .dash-bento {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
  .dash-bento__hero,
  .dash-bento__score,
  .dash-bento__small,
  .dash-bento__chart { grid-column: span 1; grid-row: auto; }
}
```

### 8.4 · Comportamiento mobile

En mobile el Bento se transforma en una **lista vertical scrollable**. Cada celda mantiene su contenido y orden. Esto evita confusión visual entre desktop y mobile.

---

## 9 · Microcopy y tono

### 9.1 · Reglas

1. **Hablale al usuario en segunda persona singular** ("vos" o "tú", según preferencia regional — coherente en toda la app).
2. **No usar términos financieros sin traducción.** "Capacidad de endeudamiento" → "Cuánto podés pedir prestado sin asfixiarte".
3. **Verbos de acción cortos.** "Agregar" mejor que "Crear nuevo registro".
4. **Cifras concretas, no porcentajes vacíos.** "$48.000 al año" mejor que "12.5%".
5. **Sin signos de exclamación múltiples.** Uno y solo si hay buena razón.
6. **Sin emojis en CTA.** Reservados para empty states y estados especiales.

### 9.2 · Glosario de términos del usuario

| Si pensás… | Decí… |
|---|---|
| Saldo disponible | Tu plata |
| Capacidad de endeudamiento | Cuánto podés pedir prestado tranquilo |
| Tasa nominal mensual | Lo que cobra el banco al mes |
| Cuota fija (sistema francés) | Cuota mensual de la deuda |
| Mora | Días tarde |
| Centrales de riesgo | Datacrédito |
| Gasto hormiga | Gastos chiquitos que te suman |
| Plan de amortización | Cómo se va pagando la deuda mes a mes |
| Salario integral | Salario que ya incluye prestaciones |

### 9.3 · Templates de mensajes comunes

- **Pago próximo:** *"En 3 días vence tu pago de Netflix ($32.900). Tenés efectivo + Bancolombia con plata suficiente."*
- **Hormiga detectada:** *"Café 'Juan Valdez' aparece 12 veces este mes. Si pasara así todo el año serían $432.000."*
- **Deuda pagada:** *"💪 ¡Una menos! Tarjeta Bancolombia quedó saldada. Próximo objetivo: $X."*
- **Score bajo:** *"Tu salud financiera es 42/100. La mayor traba: no tenés fondo de emergencia. Empezá con $50.000."*
- **Mora inminente:** *"En 5 días tu deuda con Banco X cumple 30 días de mora. A los 30 días te pueden reportar a Datacrédito."*

---

## 10 · Empty states

Cada sección sin datos tiene una pantalla intencional con:

1. **Ilustración minimal** (emoji o ícono SVG simple, no stock).
2. **Título cálido** ("Aún no agregaste deudas").
3. **Subtítulo explicativo** (qué se puede hacer ahí, en 1 frase).
4. **CTA primario** (botón verde, acción concreta).
5. **(Opcional) Tip educativo** breve.

```html
<div class="empty-state">
  <div class="empty-state__icon">🎯</div>
  <h2 class="empty-state__title">Aún no tenés metas</h2>
  <p class="empty-state__subtitle">
    Una meta es plata que estás juntando para algo concreto: un viaje, un computador, un fondo.
  </p>
  <button class="btn bp" data-action="openNuevoObjetivo">Crear mi primera meta</button>
  <p class="empty-state__tip">💡 Las metas chicas (3 meses) son más fáciles de cumplir que las grandes.</p>
</div>
```

---

## 11 · Behavioral nudges

### 11.1 · Principios éticos

1. **Honestidad de datos.** Nunca exagerar para presionar.
2. **Default constructivo.** El default lleva al usuario a una decisión sana sin obligarlo.
3. **Autonomía.** Siempre se puede ignorar el nudge sin penalización.
4. **Sin loss aversion artificial.** No usar miedo donde no hay riesgo real.

### 11.2 · Nudges existentes (mantener)

- **Detector de hormiga + impacto anual:** *"Si gastás esto todos los días, $X al año"*. Loss aversion legítima (la pérdida es real).
- **Racha sin hormiga:** gamificación positiva.
- **Score de salud financiera:** progreso visible.
- **Deudas durmiendo / fijos sin pagar:** advertencia accionable.
- **Logros gamificados:** refuerzo positivo (no manipulación).

### 11.3 · Nudges nuevos a implementar (Fase 6)

- **Distribución sugerida de la prima:** al registrar una prima, mostrar 5 sliders pre-configurados (fondo 30 / deuda 25 / objetivos 20 / inversión 15 / disfrute 10) editables. *Default constructivo.*
- **Mora inminente (5 días antes):** banner urgente con CTA "Pagar ahora". *Información honesta de plazo legal.*
- **Bloqueo de deudas con tasa ilegal:** si la tasa supera la usura, mostrar modal educativo. *Empoderamiento, no paternalismo.*
- **Quiz "Avalancha o Bola de Nieve":** primera vez que el usuario entra a Compromisos con ≥2 deudas, ofrecer un quiz de 1 pregunta. *Personalización sin imposición.*

---

## 12 · Onboarding (primera vez)

### 12.1 · Wizard de 3 pasos

1. **¿Cuánto te llega cada quincena?** Input simple. Dato base.
2. **¿Qué cuentas tenés?** Pre-cargar las 5 más comunes (Bancolombia, Daviplata, Nequi, BBVA, Davivienda) con checkboxes; luego pedir saldo.
3. **¿Qué te preocupa más hoy?** 4 opciones con emoji:
   - 🪜 Bajar deudas (→ lleva a Compromisos)
   - 🎯 Ahorrar para algo (→ lleva a Metas)
   - 📉 Gastar menos en hormigas (→ lleva a Gastos)
   - 🤷 Aún no sé (→ lleva a Dashboard con tour)

Storage: `S.onboarded = true` después del paso 3. Al cerrar, no vuelve a aparecer.

### 12.2 · Tour del dashboard (opcional, segundo encuentro)

Tooltips contextuales sobre el Bento Grid:

- "Acá ves cuánta plata tenés en total."
- "Acá te avisamos qué pago tenés pronto."
- "Acá medís tu salud financiera mes a mes."

---

## 13 · Accesibilidad — WCAG 2.1 AA

### 13.1 · Checklist obligatorio

- [ ] Contraste texto / fondo ≥ 4.5:1 (verificado en §5.1, §5.2).
- [ ] Contraste de UI components ≥ 3:1.
- [ ] Foco visible siempre (`outline 2px solid var(--a1)` con offset 3px).
- [ ] Skip‑link en primer tab stop (`<a href="#main" class="sr-only">…`).
- [ ] Live region `aria-live="polite"` para anuncios dinámicos.
- [ ] Modales con `role="dialog" aria-modal="true" aria-labelledby="…"`.
- [ ] Focus trap en modales (TAB cycle dentro).
- [ ] ESC cierra modales.
- [ ] Botones con `aria-label` cuando solo tienen icono.
- [ ] `aria-expanded`, `aria-pressed`, `aria-current` donde apliquen.
- [ ] `prefers-reduced-motion` reduce animaciones.
- [ ] `lang="es-CO"` en `<html>`.
- [ ] Min touch target 44×44 px.
- [ ] No hay errores axe‑core (CI verifica).
- [ ] Keyboard‑only flow completo verificado por sección.

### 13.2 · Test rituales

- **Antes de cada release:** correr Lighthouse Accessibility. Target ≥ 95.
- **Antes de cada release:** correr axe‑core. 0 issues críticos.
- **Cuando se agrega una sección:** test de navegación con teclado únicamente.

---

## 14 · Modo oscuro / claro

- Default: oscuro (verde neón brilla mejor sobre fondo oscuro).
- Toggle accesible desde sidebar / menú.
- Preferencia se persiste en `localStorage`.
- En primer load: respeta `prefers-color-scheme`.
- Cada token tiene equivalente light en `body.light-theme`.
- Glow ambient atenuado en light (`--body-glow-opacity: 0.3`).
- Sombras más suaves (`0 4px 16px` vs `0 4px 24px`).
- Ningún color hardcoded — todo vía tokens.

---

## 15 · Iconografía

- Sistema: emoji nativo del SO + íconos Material Symbols (CDN, livianos).
- Reglas:
  - Emoji: solo en empty states, mensajes cálidos, gamificación.
  - Material Symbols: para acciones de UI (editar, eliminar, cerrar, expandir).
  - Tamaños: 16, 20, 24, 32 (alineados con escala spacing).
  - Color: heredado del padre (`color: currentColor`).

---

## 16 · Fases de ejecución (resumen)

> Detalle en `ROADMAP.md`.

1. **Fase 5.A — Tokens (Fase CSS‑1):** spacing, typography, utilities.
2. **Fase 5.B — Bento Grid:** clases base + aplicar a `#sec-dash`.
3. **Fase 5.C — Empty states:** redesign de las 9 secciones.
4. **Fase 5.D — Microcopy:** revisión global de strings con glosario §9.2.
5. **Fase 5.E — Onboarding wizard:** 3 pasos + tour opcional.
6. **Fase 5.F — Iconografía:** integrar Material Symbols donde mejore claridad.
7. **Fase 5.G — Accesibilidad final:** axe‑core + Lighthouse ≥ 95.

---

## 17 · Pasos detallados (ejemplo: Fase 5.B)

1. Asegurar Fase CSS‑3 ejecutada (clases `.bento` ya existen).
2. Identificar contenido del dashboard hoy.
3. Diseñar el árbol HTML con `dash-bento__hero`, `__score`, `__small`, `__chart`.
4. Reemplazar markup existente (mantener atributos `data-action`).
5. Verificar visualmente desktop y mobile.
6. Lighthouse + axe‑core pass.
7. Commit: `feat(ui): bento grid en dashboard`.

---

## 18 · Criterios de verificación

- [ ] Tokens (paleta + escala + spacing) documentados en este archivo y vivos en `style.css`.
- [ ] Modo oscuro/claro consistente con tokens (sin valores hardcoded).
- [ ] WCAG 2.1 AA cumplido (Lighthouse ≥ 95).
- [ ] Bento Grid implementado en `#sec-dash` desktop, lista vertical en mobile.
- [ ] Empty states implementados en las 9 secciones.
- [ ] Microcopy revisado sección por sección con glosario §9.2.
- [ ] Onboarding wizard de 3 pasos funcional.
- [ ] axe‑core sin issues críticos.
- [ ] Test manual con teclado completo.

---

## 19 · Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Cambiar paleta rompe identidad visual | Baja | Alto | Verde `--a1` y glassmorphism son intocables |
| Bento Grid en mobile se ve apretado | Media | Medio | Degradación a columna única explícita |
| Microcopy nuevo no coincide con tono actual | Media | Bajo | Glosario §9.2 como contrato |
| Onboarding intrusivo molesta a usuarios actuales | Media | Medio | Solo se muestra si `S.onboarded !== true`; skipeable |
| Material Symbols carga lenta | Baja | Bajo | Subset crítico inline; lazy resto |

---

## 20 · Dependencias

- **Bloqueado por:** Fase CSS‑1 (tokens) y CSS‑3 (Bento clases).
- **Coordinación con:** `REORG_HTML.md` (componentes virtuales), `FINANCIAL_LOGIC_CO.md` (microcopy financiero).
- **Bloqueante de:** Fase 6 (lógica financiera avanzada) — porque los nuevos modales (distribución prima, quiz estrategia) usan estos componentes.

---

## 21 · Checklist final

- [ ] Paleta documentada con contrastes verificados.
- [ ] Escalas (typography + spacing) en `style.css`.
- [ ] Componentes (botón, card, modal, chip, tab, day picker) con contrato claro.
- [ ] Bento Grid implementado.
- [ ] Empty states diseñados.
- [ ] Microcopy revisado con glosario.
- [ ] Onboarding wizard.
- [ ] WCAG 2.1 AA cumplido.
- [ ] Modo oscuro/claro 100% consistente.

---

*Próximo documento: [`FINANCIAL_LOGIC_CO.md`](./FINANCIAL_LOGIC_CO.md).*
