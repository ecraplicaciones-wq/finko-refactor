# 🎨 Dashboard Redesign — Plan de Trabajo

> **Versión**: 1.0
> **Fecha de creación**: 2026-05-04
> **Estado**: 📋 Planificado
> **Autor del análisis**: Auditoría experta UX/UI (30+ años de experiencia)

---

## 📑 Índice

- [Resumen ejecutivo](#-resumen-ejecutivo)
- [Veredicto del dashboard actual](#-veredicto-del-dashboard-actual)
- [Decisión sobre Bolsillos](#-decisión-sobre-bolsillos)
- [Roadmap visual](#-roadmap-visual)
- [FASE 1 — Tipografía y escala modular](#fase-1--tipografía-y-escala-modular)
- [FASE 2 — Sistema de colores WCAG (claro + oscuro)](#fase-2--sistema-de-colores-wcag-claro--oscuro)
- [FASE 3 — Score de Salud Financiera visible](#fase-3--score-de-salud-financiera-visible)
- [FASE 4 — Predicción inteligente de fin de mes](#fase-4--predicción-inteligente-de-fin-de-mes)
- [FASE 5 — Restaurar Bolsillos con onboarding](#fase-5--restaurar-bolsillos-con-onboarding)
- [FASE 6 — Acciones rápidas (3 botones)](#fase-6--acciones-rápidas-3-botones)
- [FASE 7 — Educación financiera integrada](#fase-7--educación-financiera-integrada)
- [FASE 8 — Accesibilidad completa WCAG 2.1 AA](#fase-8--accesibilidad-completa-wcag-21-aa)
- [FASE 9 — Responsive avanzado](#fase-9--responsive-avanzado)
- [FASE 10 — Onboarding wizard (3 pasos)](#fase-10--onboarding-wizard-3-pasos)
- [Métricas de éxito globales](#-métricas-de-éxito-globales)
- [Referencias y bibliografía](#-referencias-y-bibliografía)

---

## 📊 Resumen ejecutivo

### Calificación actual: **6.5 / 10**

Tu dashboard tiene **buenos huesos pero piel inconsistente**. La estructura conceptual es sólida (hero + alertas + listas), pero los detalles de ejecución están dispersos.

### 9 problemas graves detectados

| # | Problema | Severidad | Fase que lo resuelve |
|---|----------|-----------|----------------------|
| 1 | Tipografía caótica (11 tamaños distintos) | 🔴 Alta | Fase 1 |
| 2 | Estilos inline rompen dark mode | 🔴 Alta | Fase 2 |
| 3 | Alerta de hormigas oculta hasta que hay daño | 🟡 Media | Fase 3 |
| 4 | Cards colapsables ocultan info crítica | 🟡 Media | Fase 3 |
| 5 | Score de Salud Financiera no se muestra | 🔴 Alta | Fase 3 |
| 6 | No hay previsión de fin de mes | 🟡 Media | Fase 4 |
| 7 | "Crear plan" en header confunde a novatos | 🟢 Baja | Fase 6 |
| 8 | No hay onboarding visible | 🔴 Alta | Fase 10 |
| 9 | "Resultado del mes" ocupa espacio sin valor | 🟢 Baja | Fase 6 |

### Tiempo total estimado: **20-25 horas** (divididas en 10 fases independientes)

---

## 🏆 Veredicto del dashboard actual

### ✅ Lo que está bien (NO tocar)

| Elemento | Por qué funciona |
|----------|------------------|
| Hero "Tu plata disponible" | Número grande con foco único (principio BLUF) |
| Donut SVG libre vs bolsillos | Reconocimiento visual > recordar números |
| Empty states con CTA | Botones invitando a primer uso |
| Alertas hormiga (2 niveles) | Diferencia urgente vs informativo |
| FAB 💸 fijo | Acción frecuente accesible siempre |
| ARIA labels | Base de accesibilidad sólida |
| Cards colapsables | Reducen carga cognitiva |

### ❌ Lo que se debe arreglar

Lista detallada arriba (9 problemas). Cada problema mapeado a una fase específica.

---

## 🪣 Decisión sobre Bolsillos

> **Veredicto: ELIMINARLOS FUE UN ERROR ESTRATÉGICO. RESTAURAR EN FASE 5.**

### Argumentos para restaurarlos

**1. Estrategia validada por expertos mundiales:**
- 📚 Dave Ramsey — "Envelope method" (sobres físicos)
- 📚 Ramit Sethi — "Multiple buckets system" (*I Will Teach You To Be Rich*)
- 📚 Robert Kiyosaki — "Pay yourself first"
- 📚 Elizabeth Warren — Creadora del 50/30/20

**2. Adaptación cultural colombiana perfecta:**
- Nequi tiene "Bolsillos" — el usuario YA conoce el término
- Daviplata tiene "Daviplata Cuentas"
- Bancolombia tiene "Mis Ahorros con Propósito"

**3. La razón por la que confundía no era la feature, sino el onboarding:**

| Lo que mostrabas | Lo que deberías mostrar |
|------------------|--------------------------|
| "Bolsillos: $0 — Crear bolsillo" | 🪣 **Bolsillos**<br>*Aparta plata para metas específicas sin mezclarla con tus gastos del día a día.*<br><br>💡 **Ejemplos típicos:**<br>- 🏖️ "Vacaciones diciembre"<br>- 🚨 "Emergencia médica"<br>- 🎂 "Cumpleaños mamá"<br><br>*[+ Crear mi primer bolsillo]* |

---

## 🗺️ Roadmap visual

```
SEMANA 1 — Fundamentos visuales (no rompe nada)
├── ✅ FASE 1 — Tipografía (1-2h)
├── ✅ FASE 2 — Colores WCAG (2-3h)
└── ✅ FASE 3 — Score de Salud visible (1-2h)

SEMANA 2 — Inteligencia y educación
├── ✅ FASE 4 — Predicción fin de mes (1h)
├── ✅ FASE 5 — Bolsillos restaurados (2-3h)
└── ✅ FASE 6 — Acciones rápidas (1h)

SEMANA 3 — Pulido y accesibilidad
├── ✅ FASE 7 — Microcopy educativo (2-3h)
├── ✅ FASE 8 — Accesibilidad WCAG (2-3h)
└── ✅ FASE 9 — Responsive avanzado (2-3h)

SEMANA 4 — Experiencia completa
└── ✅ FASE 10 — Onboarding wizard (3-4h)
```

**Recomendación**: Hacer las fases en orden (cada una depende de la anterior conceptualmente, aunque técnicamente sean independientes).

---

# FASE 1 — Tipografía y escala modular

> 🎯 **Objetivo**: Reducir de 11 tamaños inconsistentes a 6 tamaños sistemáticos
> ⏱️ **Tiempo**: 1-2 horas
> 🚦 **Riesgo**: Bajo (cambios visuales, sin lógica)
> 📦 **Pre-requisitos**: Ninguno

## Problema actual

En el dashboard se cuentan **11 tamaños de letra distintos**: 36, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 8 px. Esto fatiga la vista y rompe la jerarquía visual.

## Solución: Escala modular Major Third (1.25x)

```css
/* En style.css, sección :root */
:root {
  /* Escala tipográfica — Major Third (1.25x) */
  --text-xs:   12px;  /* Captions, metadata */
  --text-sm:   14px;  /* Body, mínimo legible */
  --text-base: 16px;  /* DEFAULT (recomendado WCAG) */
  --text-lg:   20px;  /* Subtítulos */
  --text-xl:   28px;  /* Títulos sección */
  --text-2xl:  40px;  /* Hero / números protagonistas */

  /* Pesos */
  --weight-regular: 400;
  --weight-medium:  500;
  --weight-bold:    700;
  --weight-black:   800;  /* Solo para hero */

  /* Line-height */
  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-loose:  1.75;
}
```

## Tareas

- [ ] **1.1** — Agregar variables CSS de tipografía en `style.css` (sección `:root`)
- [ ] **1.2** — Agregar fuentes del sistema y mono (sin descarga externa)
  ```css
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', Monaco, Consolas, 'Liberation Mono', monospace;
  ```
- [ ] **1.3** — Crear clases utility para cada tamaño:
  ```css
  .ts-xs { font-size: var(--text-xs); }
  .ts-sm { font-size: var(--text-sm); }
  /* ... etc */
  ```
- [ ] **1.4** — Auditar `index.html` y reemplazar `style="font-size:Xpx"` inline por las clases utility (estimado: ~80 ocurrencias)
- [ ] **1.5** — Verificar que el hero "Tu plata disponible" use `--text-2xl` (40px)
- [ ] **1.6** — Verificar que body por defecto use `--text-base` (16px)

## Criterios de aceptación

- ✅ Solo se usan 6 tamaños de letra en todo el dashboard
- ✅ El hero del saldo usa el tamaño más grande (`--text-2xl`)
- ✅ Ningún `font-size:Xpx` queda inline en `index.html`
- ✅ Texto base mínimo es 16px (cumple WCAG 2.1)
- ✅ Los números financieros usan `font-family: var(--font-mono)` para alineación vertical

## Cómo verificar

```bash
# 1. Buscar font-size inline restantes
grep -c "font-size:" index.html
# Debe dar 0 o muy bajo

# 2. Servir local y revisar
python -m http.server 8080
# Abrir devtools, inspector, verificar que solo aparecen 6 tamaños
```

## Referencias
- [WCAG 2.1 Text Spacing](https://www.w3.org/WAI/WCAG21/Understanding/text-spacing.html)
- [Material Design Type System](https://m3.material.io/styles/typography/type-scale-tokens)
- [Apple HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography)

---

# FASE 2 — Sistema de colores WCAG (claro + oscuro)

> 🎯 **Objetivo**: Eliminar `rgba()` hardcoded y crear paletas accesibles para ambos temas
> ⏱️ **Tiempo**: 2-3 horas
> 🚦 **Riesgo**: Medio (toca toda la app)
> 📦 **Pre-requisitos**: Ninguno

## Problema actual

Hay decenas de `rgba(0,0,0,.15)`, `rgba(255,68,68,.08)` etc. inline. Esto:
- Rompe el dark mode (negros fijos)
- Causa fatiga visual (cada elemento tiene su identidad)
- Imposibilita ajustes globales

## Solución: Tokens semánticos con variables CSS

### Paleta tema claro (validada WCAG 2.1 AA, contraste mínimo 4.5:1)

```css
:root {
  /* Backgrounds */
  --bg-primary:    #FAFBFC;     /* Fondo general (no blanco puro — menos cansa) */
  --bg-card:       #FFFFFF;
  --bg-subtle:     #F1F3F5;
  --bg-overlay:    rgba(0, 0, 0, 0.4);  /* Solo para modal overlay */

  /* Text */
  --text-primary:   #1A1D21;    /* Casi negro (Apple HIG: menos agresivo que #000) */
  --text-secondary: #4A5057;
  --text-muted:     #868E96;
  --text-on-color:  #FFFFFF;    /* Sobre botones de color */

  /* Borders */
  --border-subtle:  #E9ECEF;
  --border-default: #DEE2E6;
  --border-strong:  #ADB5BD;

  /* Semantic colors */
  --success:        #00A86B;    /* Verde — 4.5:1 sobre blanco */
  --success-bg:     #E6F7F0;    /* Fondo suave */
  --warning:        #F59E0B;    /* Ámbar (más amigable que amarillo) */
  --warning-bg:     #FEF3C7;
  --danger:         #DC2626;    /* Rojo no demasiado saturado */
  --danger-bg:      #FEE2E2;
  --info:           #2563EB;    /* Azul */
  --info-bg:        #DBEAFE;
  --brand:          #00B894;    /* Verde menta Finko */
  --brand-bg:       #E6F8F4;
}
```

### Paleta tema oscuro

```css
[data-theme="dark"] {
  /* Backgrounds */
  --bg-primary:    #0F1419;     /* No #000 puro — mejor para ojos */
  --bg-card:       #1A1F25;
  --bg-subtle:     #242B33;
  --bg-overlay:    rgba(0, 0, 0, 0.7);

  /* Text */
  --text-primary:   #E8EAED;    /* No #FFF puro — menos brillo */
  --text-secondary: #9AA0A6;
  --text-muted:     #5F6368;
  --text-on-color:  #FFFFFF;

  /* Borders */
  --border-subtle:  #2A3038;
  --border-default: #3A4049;
  --border-strong:  #5A6068;

  /* Semantic colors (ajustados para fondo oscuro) */
  --success:        #34D399;    /* Verde más luminoso */
  --success-bg:     rgba(52, 211, 153, 0.12);
  --warning:        #FBBF24;
  --warning-bg:     rgba(251, 191, 36, 0.12);
  --danger:         #F87171;    /* Rojo desaturado para no agredir */
  --danger-bg:      rgba(248, 113, 113, 0.12);
  --info:           #60A5FA;
  --info-bg:        rgba(96, 165, 250, 0.12);
  --brand:          #2DD4BF;
  --brand-bg:       rgba(45, 212, 191, 0.12);
}
```

## Tareas

- [ ] **2.1** — Reemplazar variables `--a1`, `--a2`, etc. con nombres semánticos (`--success`, `--warning`...)
- [ ] **2.2** — Cambiar mecanismo `body.dark-theme` por `[data-theme="dark"]` (más estándar)
- [ ] **2.3** — Auditar todos los `rgba()` inline en `index.html` y reemplazar por variables
- [ ] **2.4** — Auditar `style.css` y reemplazar colores literales (`#fff`, `#000`, etc.) por variables
- [ ] **2.5** — Detectar tema del sistema operativo automáticamente:
  ```js
  // En main.js bootstrap
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme',
    localStorage.getItem('finko_theme') ?? (prefersDark ? 'dark' : 'light'));
  ```
- [ ] **2.6** — Verificar contrastes con herramienta automática

## Criterios de aceptación

- ✅ Cero `rgba()` o `#XXX` hardcoded en `index.html`
- ✅ Tema oscuro funciona perfectamente (sin negros fijos rompiendo)
- ✅ Tema sigue preferencia del sistema operativo en primera visita
- ✅ Todos los textos cumplen contraste mínimo 4.5:1 (WCAG AA)
- ✅ Botones grandes cumplen contraste 3:1 (WCAG AA componentes)

## Cómo verificar

```bash
# 1. Buscar rgba() restantes
grep -c "rgba(" index.html
# Idealmente 0

# 2. Probar contraste
# Usar https://webaim.org/resources/contrastchecker/
# O extensión Chrome "WAVE" / "axe DevTools"
```

## Referencias
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.1 Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Material Design Color System](https://m3.material.io/styles/color/system/overview)

---

# FASE 3 — Score de Salud Financiera visible

> 🎯 **Objetivo**: Mostrar el score (que YA está calculado) en posición prioritaria del dashboard
> ⏱️ **Tiempo**: 1-2 horas
> 🚦 **Riesgo**: Bajo
> 📦 **Pre-requisitos**: Ninguna fase previa, pero idealmente Fase 1 + 2

## Problema actual

Tu código ya tiene `AnalysisService.calcularSaludFinanciera()` que retorna:
```js
{ score: 78, etiqueta: 'buena' }
```

Pero **no se muestra en ninguna parte del dashboard**. Esto es ORO desperdiciado.

## Solución: Tarjeta hero del Score

Agregar AL INICIO del dashboard (antes del hero de saldo):

```html
<div class="card mb score-card" role="region" aria-label="Tu salud financiera">
  <div class="score-header">
    <span class="ts-sm ui-label">🎯 Tu salud financiera</span>
    <button data-action="openM" data-arg-id="m-score-help" aria-label="¿Cómo se calcula?">ⓘ</button>
  </div>

  <div class="score-body">
    <!-- Donut circular grande -->
    <div class="score-donut">
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="50" stroke="var(--bg-subtle)" stroke-width="10" fill="none"/>
        <circle id="score-arco" cx="60" cy="60" r="50"
                stroke="var(--success)" stroke-width="10" fill="none"
                stroke-linecap="round"
                stroke-dasharray="0 314" transform="rotate(-90 60 60)"/>
      </svg>
      <div class="score-center">
        <span id="score-num" class="ts-2xl mono">--</span>
        <span id="score-label" class="ts-xs">cargando...</span>
      </div>
    </div>

    <!-- Tip del día -->
    <div class="score-tip">
      <span class="ts-xs ui-label">💡 Tip del día</span>
      <p id="score-tip-text" class="ts-sm">Calculando...</p>
      <button class="btn bsm" data-action="verDetalleScore">Ver cómo mejorar →</button>
    </div>
  </div>
</div>
```

### Lógica del color y etiqueta

```js
function actualizarScoreUI() {
  const { score, etiqueta } = AnalysisService.calcularSaludFinanciera(hoy());

  document.getElementById('score-num').textContent = score;
  document.getElementById('score-label').textContent = etiqueta;

  const arco = document.getElementById('score-arco');
  const dasharray = (score / 100) * 314;  // 2π × 50
  arco.setAttribute('stroke-dasharray', `${dasharray} 314`);

  // Color según rango
  const color = score >= 80 ? 'var(--success)'
              : score >= 60 ? 'var(--info)'
              : score >= 40 ? 'var(--warning)'
              : 'var(--danger)';
  arco.setAttribute('stroke', color);

  // Tip contextual
  document.getElementById('score-tip-text').textContent = generarTip(score);
}

function generarTip(score) {
  if (score < 40) return 'Tu fondo de emergencia es bajo. Empieza apartando $50,000/quincena.';
  if (score < 60) return 'Vas mejorando. Reduce gastos hormiga este mes para subir 10 puntos.';
  if (score < 80) return 'Buena salud. Considera invertir parte de tus ahorros en CDT (4-6% E.A.).';
  return '¡Excelente! Eres ejemplo de finanzas sanas. Comparte tu logro 🏆';
}
```

## Tareas

- [ ] **3.1** — Agregar HTML del score card al inicio de `<section id="sec-dash">`
- [ ] **3.2** — Agregar CSS para `.score-card`, `.score-donut`, `.score-tip`
- [ ] **3.3** — Implementar `actualizarScoreUI()` en `ui.manager.js` y llamarla desde `renderDashboard()`
- [ ] **3.4** — Implementar `generarTip(score)` con 4 niveles de mensajes
- [ ] **3.5** — Crear modal `m-score-help` explicando los 6 componentes del cálculo:
  - Atrasos en pagos (25 pts)
  - Tasa de ahorro (25 pts)
  - Fondo emergencia (20 pts)
  - Endeudamiento (15 pts)
  - Backup reciente (10 pts)
  - Gastos hormiga (5 pts)
- [ ] **3.6** — Animar el arco al cargar (de 0 al valor actual, duración 800ms)
- [ ] **3.7** — Decisión: abrir cards "Resumen" y "Patrimonio" por DEFAULT en mobile (no colapsadas)

## Criterios de aceptación

- ✅ Score visible apenas se abre el dashboard
- ✅ Color del arco refleja el rango (rojo/amarillo/azul/verde)
- ✅ Tip del día cambia según score
- ✅ Botón "ⓘ" abre modal explicativo
- ✅ Funciona con score 0 (usuario nuevo) sin romperse

## Cómo verificar

```bash
# 1. Servir local
python -m http.server 8080

# 2. En consola del navegador, simular escenarios:
S.gastos.push({ tipo: 'ahorro', monto: 500000, fecha: '2026-05-04' });
renderDashboard();
# El score debe subir
```

## Referencias
- Lógica ya implementada en `modules/planner.service.js` línea 307+
- [Material Design — Progress indicators](https://m3.material.io/components/progress-indicators)

---

# FASE 4 — Predicción inteligente de fin de mes

> 🎯 **Objetivo**: Mostrar proyección "Si sigues así, llegarás a fin de mes con $X"
> ⏱️ **Tiempo**: 1 hora
> 🚦 **Riesgo**: Bajo
> 📦 **Pre-requisitos**: Ninguna

## Problema actual

El dashboard muestra "Tu plata disponible: $1,450,000" pero no proyecta. El usuario no sabe si esa plata le alcanza para el mes.

## Solución: Proyección lineal simple

Agregar debajo del hero del saldo:

```html
<div class="hero-prediccion ts-sm">
  <span aria-hidden="true">📅</span>
  <span id="prediccion-texto">Calculando...</span>
</div>
```

### Algoritmo

```js
function calcularPrediccion() {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasRestantes = ultimoDia - diaActual;

  if (diaActual < 3) return 'Recién empieza el mes. Vuelve en unos días para ver predicciones.';

  const mesActual = hoy.toISOString().slice(0, 7);
  const gastadoHasta = S.gastos
    .filter(g => g.fecha?.startsWith(mesActual) && g.tipo !== 'ahorro')
    .reduce((s, g) => s + (g.montoTotal || g.monto || 0), 0);

  const promedioPorDia = gastadoHasta / diaActual;
  const proyeccionRestante = promedioPorDia * diasRestantes;
  const saldoActual = FinanceCalc.getSaldoTotal();
  const saldoFinal = saldoActual - proyeccionRestante;

  const ingreso = S.ingreso || 0;

  if (saldoFinal < 0) {
    return `⚠️ Si sigues a este ritmo, te faltarán ${f(Math.abs(saldoFinal))} antes de fin de mes.`;
  }
  if (saldoFinal < ingreso * 0.05) {
    return `🟡 Llegarás a fin de mes con apenas ${f(saldoFinal)}. Cuidado con gastos extra.`;
  }
  return `🟢 Si sigues así, llegarás al ${ultimoDia} con ${f(saldoFinal)} disponibles.`;
}
```

## Tareas

- [ ] **4.1** — Agregar el `<div class="hero-prediccion">` debajo del número grande del hero
- [ ] **4.2** — Implementar `calcularPrediccion()` en `ui.manager.js`
- [ ] **4.3** — Llamarla desde `renderDashboard()` y actualizar el texto
- [ ] **4.4** — Estilo CSS: caja sutil con fondo `--bg-subtle`, padding 12px, border-radius 8px
- [ ] **4.5** — Manejar caso "primer día del mes" (datos insuficientes)
- [ ] **4.6** — Manejar caso "sin gastos registrados" (mostrar mensaje motivador)

## Criterios de aceptación

- ✅ Texto cambia según escenario (positivo / neutro / negativo)
- ✅ Funciona desde el día 3 del mes (mínimo de datos)
- ✅ El cálculo es transparente — el usuario entiende de dónde sale
- ✅ Color/icono refleja el sentido del mensaje

## Cómo verificar

```js
// En consola, simular varios escenarios
S.gastos = [];
calcularPrediccion();  // Debe decir "primer día"

S.gastos.push({ monto: 500000, fecha: '2026-05-01', tipo: 'necesidad' });
calcularPrediccion();  // Debe proyectar
```

## Referencias
- Algoritmo similar a "burn rate" en finanzas startup
- [You Need a Budget — Age your dollars](https://www.youneedabudget.com/)

---

# FASE 5 — Restaurar Bolsillos con onboarding

> 🎯 **Objetivo**: Devolver la feature de Bolsillos con educación visible
> ⏱️ **Tiempo**: 2-3 horas
> 🚦 **Riesgo**: Medio (toca state, UI, y storage)
> 📦 **Pre-requisitos**: Ninguna

## Por qué restaurar

(Ver sección [Decisión sobre Bolsillos](#-decisión-sobre-bolsillos) arriba)

## Solución: Bolsillos + onboarding pedagógico

### Vista cuando NO hay bolsillos (educativa)

```html
<div class="card mb bolsillos-empty">
  <div class="ts-lg" style="font-weight: var(--weight-bold);">🪣 Bolsillos</div>
  <p class="ts-sm">
    Aparta plata para metas específicas sin mezclarla con tus gastos diarios.
    Como sobres físicos, pero en tu app.
  </p>

  <div class="bolsillos-ejemplos">
    <div class="ejemplo-item">
      <span aria-hidden="true">🏖️</span>
      <strong>Vacaciones diciembre</strong>
      <span class="ts-xs">Reservar plata mes a mes</span>
    </div>
    <div class="ejemplo-item">
      <span aria-hidden="true">🚨</span>
      <strong>Fondo de emergencia</strong>
      <span class="ts-xs">Apartar para imprevistos</span>
    </div>
    <div class="ejemplo-item">
      <span aria-hidden="true">🎂</span>
      <strong>Cumpleaños mamá</strong>
      <span class="ts-xs">Plata aparte para regalos</span>
    </div>
  </div>

  <div class="ts-xs muted" style="margin-top: 12px;">
    💡 Esta estrategia se llama <strong>Método de los Sobres</strong>,
    popularizada por Dave Ramsey. La usan apps como Nequi y Daviplata.
  </div>

  <button class="btn bp" data-action="openM" data-arg-id="m-bolsillo">
    + Crear mi primer bolsillo
  </button>
</div>
```

### Vista cuando SÍ hay bolsillos

```html
<div class="card mb">
  <div class="fb">
    <span class="ts-lg">🪣 Bolsillos</span>
    <button class="btn bsm" data-action="openM" data-arg-id="m-bolsillo">+ Nuevo</button>
  </div>

  <div id="bolsillos-lista">
    <!-- Cada bolsillo es una mini-card con barra de progreso -->
  </div>

  <div class="ts-xs muted">Total apartado: <strong id="bolsillos-total">$0</strong></div>
</div>
```

## Tareas

- [x] **5.1** — Verificar que el state ya tiene `S.bolsillos` (sí, está en `state.js` línea 144)
- [x] **5.2** — Restaurar `AccountService.agregarBolsillo()`, `abonar()`, `retirar()` (ya están en `finance.service.js` línea 187+)
- [x] **5.3** — Agregar HTML de la sección Bolsillos al dashboard
- [x] **5.4** — Crear modal `m-bolsillo` para crear/editar
- [x] **5.5** — Implementar `renderBolsillos()` en `ui.manager.js` con dos estados (vacío/lleno)
- [x] **5.6** — Cada bolsillo muestra: nombre, monto actual, monto objetivo, % progreso, botón abonar
- [x] **5.7** — Botón "Abonar" abre prompt rápido para sumar al bolsillo
- [ ] **5.8** — Actualizar el donut del hero para mostrar % en bolsillos vs libre (pendiente, requiere lógica adicional)
- [x] **5.9** — Agregar tooltip educativo en cada bolsillo: "💡 Esta plata está apartada y NO cuenta como disponible"

## Criterios de aceptación

- ✅ Estado vacío muestra 3 ejemplos típicos colombianos
- ✅ Estado vacío cita la fuente educativa (Dave Ramsey)
- ✅ Crear bolsillo es de máximo 3 campos (nombre, monto inicial opcional, meta opcional)
- ✅ Cada bolsillo tiene barra de progreso visual
- ✅ El donut del hero refleja la proporción libre/bolsillos
- ✅ Eliminar un bolsillo pide confirmación

## Cómo verificar

1. Abrir dashboard sin bolsillos — debe verse el onboarding educativo
2. Crear bolsillo "Viaje Cartagena" con $50,000 inicial y meta $2,000,000
3. Verificar que aparece en la lista con barra al 2.5%
4. Abonar $100,000 más → barra al 7.5%
5. El donut superior debe reflejar el cambio

## Referencias
- [Dave Ramsey — Envelope Method](https://www.ramseysolutions.com/budgeting/envelope-system-explained)
- Implementación previa en backup: `modules/dominio/tesoreria.js`

---

# FASE 6 — Acciones rápidas (3 botones)

> 🎯 **Objetivo**: Reemplazar el FAB único con 3 acciones rápidas más visibles para nuevos usuarios
> ⏱️ **Tiempo**: 1 hora
> 🚦 **Riesgo**: Bajo
> 📦 **Pre-requisitos**: Fase 5 (Bolsillos restaurados)

## Problema actual

El FAB 💸 solo permite "registrar gasto". Pero hay 3 acciones igualmente frecuentes:
- 💸 Registrar gasto
- 💰 Registrar ingreso (cobro, pago)
- 🪣 Apartar plata en bolsillo

Un FAB único oculta esto. Y "Crear plan" en el header confunde.

## Solución: Fila de 3 acciones rápidas

Reemplazar el header secundario por:

```html
<div class="quick-actions" role="group" aria-label="Acciones rápidas">
  <button class="qa-btn qa-gasto" data-action="openM" data-arg-id="m-quick-gasto">
    <span aria-hidden="true">💸</span>
    <span class="qa-label">Gasté algo</span>
  </button>
  <button class="qa-btn qa-ingreso" data-action="openM" data-arg-id="m-quick-ingreso">
    <span aria-hidden="true">💰</span>
    <span class="qa-label">Cobré</span>
  </button>
  <button class="qa-btn qa-bolsillo" data-action="openM" data-arg-id="m-bolsillo">
    <span aria-hidden="true">🪣</span>
    <span class="qa-label">Aparté plata</span>
  </button>
</div>
```

### CSS sugerido

```css
.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.qa-btn {
  min-height: 64px;  /* Fácil de tocar (>44px WCAG) */
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s;
}

.qa-btn:active {
  transform: scale(0.95);
}

.qa-btn:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

.qa-btn span[aria-hidden] {
  font-size: 24px;
}
```

## Tareas

- [ ] **6.1** — Eliminar el FAB 💸 (ya no necesario)
- [ ] **6.2** — Agregar HTML de `.quick-actions` justo después del hero
- [ ] **6.3** — Agregar CSS de `.quick-actions` y `.qa-btn`
- [ ] **6.4** — Crear modal `m-quick-ingreso` (similar al de gasto pero para ingresos)
- [ ] **6.5** — Lógica: registrar ingreso suma a `S.ingreso` y al saldo de la cuenta seleccionada
- [ ] **6.6** — Cambiar texto "📋 + Crear plan" → "📋 Distribuir mi sueldo"
- [ ] **6.7** — Eliminar la card "📆 Resultado del mes" (es redundante con el botón "Ver en Balance" del resumen)

## Criterios de aceptación

- ✅ 3 botones visibles, mínimo 64px de alto cada uno
- ✅ Iconos grandes y legibles
- ✅ Texto en lenguaje natural ("Gasté algo" no "Registrar gasto")
- ✅ Cumplen tamaño táctil mínimo WCAG (44x44px)
- ✅ Animación al tocar (scale 0.95)
- ✅ Focus visible para teclado

## Referencias
- [Apple HIG — Touch Targets](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [WCAG 2.1 Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)

---

# FASE 7 — Educación financiera integrada

> 🎯 **Objetivo**: Agregar microcopy educativo con citas a expertos en cada métrica del dashboard
> ⏱️ **Tiempo**: 2-3 horas
> 🚦 **Riesgo**: Bajo (solo texto, no lógica)
> 📦 **Pre-requisitos**: Fases 1-6 (cada elemento debe existir antes de educar sobre él)

## Problema actual

El dashboard muestra números pero no enseña. Un usuario sin conocimientos financieros no sabe:
- Qué es un fondo de emergencia y cuánto debe tener
- Qué significa "gastos hormiga"
- Por qué el método 50/30/20 funciona
- Qué es el 4×1000 y cómo evitarlo
- Qué es la tasa de usura

## Solución: Tooltips + microcopy contextual + modal "¿Por qué?"

### Patrón general

Cada métrica importante debe tener:
1. **El número** (lo que ya tienes)
2. **Una explicación corta** (1 línea)
3. **Un botón ⓘ** que abre modal con explicación profunda + cita

### Ejemplos de microcopy

#### En el donut del hero

```html
<div class="explainer">
  <p class="ts-sm">
    El <strong>70%</strong> es plata libre que puedes usar hoy.
    El <strong>30%</strong> está apartado en bolsillos para metas específicas.
  </p>
</div>
```

#### Junto al fondo de emergencia

```html
<div class="card-explainer">
  💡 <strong>¿Para qué sirve?</strong>
  Es plata reservada solo para imprevistos (enfermedad, pérdida de empleo).
  <br>
  <strong>Lo recomendado</strong>: tener entre 3 y 6 meses de tus gastos fijos.
  <br>
  <em>Tú tienes 2.3 meses → vas en buen camino.</em>

  <details>
    <summary class="ts-xs">📚 Ver fuentes</summary>
    <ul class="ts-xs">
      <li>Dave Ramsey — <em>The Total Money Makeover</em></li>
      <li>Ramit Sethi — <em>I Will Teach You To Be Rich</em></li>
    </ul>
  </details>
</div>
```

#### En métodos 50/30/20

```html
<div class="metodo-info">
  📚 <strong>Método 50/30/20 — Elizabeth Warren</strong>
  <span class="ts-xs">Senadora EEUU, profesora Harvard</span>
  <p class="ts-sm">
    Es la regla más usada en el mundo. Funciona porque deja espacio para vivir hoy
    SIN sacrificar tu futuro.
  </p>
  <ul class="ts-xs">
    <li>✅ Ideal si: ganas un sueldo regular y quieres equilibrio.</li>
    <li>❌ Evítalo si: tienes deudas con tasa &gt;20% E.A. (mejor "avalancha").</li>
  </ul>
</div>
```

#### En cualquier mención de 4×1000

```html
<details class="explicacion-4k1">
  <summary>⚖️ ¿Qué es el 4×1000?</summary>
  <div class="ts-sm">
    <p>
      Es un impuesto colombiano: por cada $1,000,000 que mueves del banco, pagas $4,000.
    </p>
    <p>
      💡 <strong>Tip legal</strong>: tienes derecho a marcar UNA cuenta como exenta
      hasta 350 UVT/mes (~$18,330,900 en 2026).
    </p>
    <a href="#" data-action="openM" data-arg-id="m-4k1-exento">
      ¿Cómo activar la exención? →
    </a>
  </div>
</details>
```

#### Cuando se calcula crédito sobre tasa usura

```html
<div class="alerta-usura">
  ⚖️ <strong>Tope legal en Colombia</strong>: 24.36% E.A. (vigente Q2 2026)
  <p class="ts-xs">
    Fuente: Superfinanciera de Colombia — actualizado trimestralmente.
    Por encima de eso es ILEGAL. Reportar a Superfinanciera o Defensoría del Consumidor.
  </p>
</div>
```

## Tareas

- [x] **7.1** — Crear archivo `modules/educacion.js` con strings educativos centralizados
- [x] **7.2** — Estructura sugerida:
  ```js
  export const EDUCACION = {
    fondoEmergencia: { titulo, descripcion, ejemplo, fuentes },
    metodo_50_30_20: { titulo, descripcion, ideal, evitar, fuentes },
    metodo_70_20_10: { ... },
    gastosHormiga: { ... },
    cuatroXMil: { ... },
    tasaUsura: { ... },
    bolsillos: { ... },
    rentabilidadReal: { ... },
    interesCompuesto: { ... }
  };
  ```
- [x] **7.3** — Agregar componente `<EducacionTooltip>` reutilizable (botón ⓘ + modal)
- [x] **7.4** — Insertar tooltips en: hero, score, fondo emergencia, métodos, deudas, calculadoras
- [x] **7.5** — Crear modal genérico `m-educacion` que se rellena dinámicamente
- [ ] **7.6** — Agregar sección "📚 Aprende" en el sidebar con índice de todos los temas

## Criterios de aceptación

- ✅ Cada métrica importante tiene su botón ⓘ
- ✅ Las explicaciones citan SIEMPRE una fuente verificable
- ✅ El lenguaje es coloquial colombiano, no académico
- ✅ Cada tema tiene un ejemplo aplicado al usuario actual ("tú tienes X meses cubiertos")
- ✅ Las explicaciones son cortas: máximo 80 palabras

## Referencias
- [Plain Language — gov.uk](https://www.gov.uk/guidance/style-guide/a-to-z-of-gov-uk-style)
- [Hemingway Editor](https://hemingwayapp.com/) — para verificar legibilidad

---

# FASE 8 — Accesibilidad completa WCAG 2.1 AA

> 🎯 **Objetivo**: Cumplir WCAG 2.1 nivel AA en su totalidad
> ⏱️ **Tiempo**: 2-3 horas
> 🚦 **Riesgo**: Medio
> 📦 **Pre-requisitos**: Fases 1, 2 (tipografía y colores)

## Problema actual

La app tiene base ARIA pero falta:
- Tamaños táctiles mínimos (algunos botones son 26x26px)
- Contraste en alertas (#d32f2f sobre fondo claro = 4.2:1 ❌)
- Soporte `prefers-reduced-motion`
- `aria-describedby` para errores de formulario
- `:focus-visible` con outline claro
- Uso de `rem` en vez de `px` para respetar zoom del navegador
- Modo alto contraste de Windows

## Solución: Auditoría completa + correcciones sistemáticas

### 1. Tamaños táctiles

```css
/* Mínimo para todo elemento clickeable */
button, a, [role="button"], [role="tab"], input[type="checkbox"] + label {
  min-width: 44px;
  min-height: 44px;
}

/* Excepción: solo si está dentro de un grupo denso justificado */
.btn-icon-small {
  min-width: 32px;
  min-height: 32px;
  /* Y agregar ::before invisible que extienda el área táctil */
}
.btn-icon-small::before {
  content: "";
  position: absolute;
  inset: -6px;  /* Extiende 6px en todas direcciones */
}
```

### 2. Focus visible para teclado

```css
/* Solo cuando navegan con teclado */
*:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Quitar outline en click de mouse */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### 3. Reduced motion

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

### 4. High contrast (Windows)

```css
@media (prefers-contrast: more) {
  :root {
    --border-default: var(--text-primary);
    --bg-subtle: var(--bg-card);
  }

  button {
    border-width: 2px;
  }
}
```

### 5. Texto escalable con rem

```css
html {
  font-size: 100%;  /* 16px por defecto, respeta config navegador */
}

body {
  font-size: 1rem;   /* 16px */
  line-height: 1.5;
}

/* Las variables ahora en rem */
:root {
  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.25rem;   /* 20px */
  --text-xl:   1.75rem;   /* 28px */
  --text-2xl:  2.5rem;    /* 40px */
}
```

## Tareas

- [ ] **8.1** — Auditar con herramienta automática (Lighthouse, axe DevTools, WAVE)
- [x] **8.2** — Listar todos los botones <44x44px y agregar área táctil extendida
- [x] **8.3** — Implementar `:focus-visible` global
- [x] **8.4** — Implementar `@media (prefers-reduced-motion)` global
- [x] **8.5** — Implementar `@media (prefers-contrast: more)` global
- [ ] **8.6** — Convertir todas las variables de tipografía a `rem`
- [ ] **8.7** — Auditar formularios y agregar `aria-describedby` enlazando errores
- [x] **8.8** — Agregar `lang="es-CO"` en `<html>` (ya está, verificar)
- [x] **8.9** — Agregar skip link al inicio del body:
  ```html
  <a href="#main" class="skip-link">Saltar al contenido principal</a>
  ```
- [x] **8.10** — Verificar que TODOS los emojis decorativos tienen `aria-hidden="true"` y los informativos tienen texto alternativo

## Criterios de aceptación

- ✅ Lighthouse Accessibility score ≥ 95
- ✅ axe DevTools 0 violations en dashboard
- ✅ Navegación 100% funcional solo con teclado
- ✅ Funciona con NVDA / VoiceOver / TalkBack
- ✅ Funciona con zoom de navegador hasta 200%
- ✅ Funciona con `prefers-reduced-motion: reduce`
- ✅ Funciona con tema de alto contraste de Windows

## Cómo verificar

```bash
# Lighthouse en Chrome DevTools
# 1. F12 → Lighthouse → Solo "Accessibility" → Generate

# axe DevTools
# Instalar extensión y correr en cada sección

# Manual
# 1. Probar solo con teclado (Tab, Enter, flechas)
# 2. Activar lector de pantalla del SO
# 3. Zoom 200% en Chrome y verificar
```

## Referencias
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM — Accessibility Principles](https://webaim.org/articles/principles/)
- [a11y Project Checklist](https://www.a11yproject.com/checklist/)

---

# FASE 9 — Responsive avanzado

> 🎯 **Objetivo**: Layout óptimo en mobile, tablet, desktop, plegables
> ⏱️ **Tiempo**: 2-3 horas
> 🚦 **Riesgo**: Medio
> 📦 **Pre-requisitos**: Fases 1, 2

## Problema actual

- Funciona en mobile pero falta layout 2 columnas en tablet
- Falta layout 3 columnas en desktop
- Sin manejo de safe areas iOS (notch, home indicator)
- Sin pruebas en plegables (Galaxy Fold)

## Solución: Sistema de breakpoints + container queries

### Breakpoints recomendados

```css
:root {
  --bp-mobile-l:  480px;
  --bp-tablet:    768px;
  --bp-desktop:   1024px;
  --bp-desktop-l: 1440px;
}

/* Mobile first */
@media (min-width: 480px)  { /* Mobile L (iPhone Plus) */ }
@media (min-width: 768px)  { /* Tablet (iPad) */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Desktop XL */ }
```

### Layout adaptable del dashboard

```css
/* MOBILE (default): 1 columna */
#sec-dash {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* TABLET: 2 columnas (hero arriba, resto en grid 2) */
@media (min-width: 768px) {
  #sec-dash {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .score-card { grid-column: 1 / -1; }  /* Ancho completo */
  .hero-saldo { grid-column: 1 / -1; }
  /* Resto en 2 columnas automáticas */
}

/* DESKTOP: 3 columnas asimétricas */
@media (min-width: 1024px) {
  #sec-dash {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 20px;
  }
  .score-card { grid-column: 1; grid-row: 1 / 3; }
  .hero-saldo { grid-column: 2 / -1; grid-row: 1; }
  /* Sidebar de alertas a la derecha */
}
```

### Safe areas iOS

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* FAB y bottom nav respetan home indicator */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 12px);
}
```

### Plegables (Galaxy Fold cerrado, 280px)

```css
@media (max-width: 320px) {
  .quick-actions {
    grid-template-columns: 1fr;  /* 1 columna en pantallas muy estrechas */
  }
  .ts-2xl { font-size: 32px; }   /* Reducir hero */
}
```

## Tareas

- [x] **9.1** — Definir variables de breakpoints en `:root`
- [x] **9.2** — Refactorizar layout del dashboard a CSS Grid
- [x] **9.3** — Agregar media queries para tablet (768px) con 2 columnas
- [x] **9.4** — Agregar media queries para desktop (1024px) con 3 columnas
- [x] **9.5** — Agregar safe areas iOS en `body`
- [ ] **9.6** — Probar en plegables 280px (mínimo soportado)
- [ ] **9.7** — Probar en pantallas grandes 1920px+ (que el contenido no se estire)
- [x] **9.8** — Agregar `max-width: 1440px` al contenedor principal
- [x] **9.9** — Verificar que iconos se mantienen proporcionales en todos los tamaños

## Criterios de aceptación

- ✅ Funciona perfecto en iPhone SE (375px)
- ✅ Funciona perfecto en iPad (768px) con layout 2 columnas
- ✅ Funciona perfecto en Desktop (1024px+) con layout 3 columnas
- ✅ Funciona en Galaxy Fold cerrado (280px) sin scroll horizontal
- ✅ Notch y home indicator respetados en iOS
- ✅ No hay scroll horizontal en NINGÚN tamaño

## Cómo verificar

```bash
# Chrome DevTools
# F12 → Toggle Device Toolbar → Probar:
# - iPhone SE
# - iPhone 14 Pro
# - iPad Mini
# - iPad Pro
# - Galaxy Fold
# - Desktop 1920px

# En real, usar BrowserStack o un dispositivo físico
```

## Referencias
- [Material Design — Responsive layout](https://m3.material.io/foundations/layout/applying-layout/window-size-classes)
- [Apple HIG — Adaptivity](https://developer.apple.com/design/human-interface-guidelines/adaptivity-and-layout)
- [Container Queries (futuro)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries)

---

# FASE 10 — Onboarding wizard (3 pasos)

> 🎯 **Objetivo**: Guía interactiva en la primera visita que prepara al usuario
> ⏱️ **Tiempo**: 3-4 horas
> 🚦 **Riesgo**: Medio
> 📦 **Pre-requisitos**: Idealmente todas las fases anteriores

## Problema actual

Un usuario nuevo abre la app y ve "Aún no tienes cuentas / metas / pagos" — tres empty states sueltos. **No hay guía**.

## Solución: Wizard de 3 pasos al primer ingreso

### Detección "primera vez"

```js
const esNuevo = !localStorage.getItem('finko_onboarded');
if (esNuevo) abrirOnboarding();
```

### Paso 1: Bienvenida + plata actual

```
┌────────────────────────────────────────┐
│   👋 ¡Bienvenido a Finko!              │
│                                        │
│   En 3 minutos, configuramos tu app.   │
│                                        │
│   PASO 1 DE 3 — Tu plata hoy           │
│   ──────────────────────────           │
│                                        │
│   ¿Cuánto tienes en este momento?      │
│                                        │
│   💵 Efectivo:  [_____________]        │
│   🏦 Banco:     [_____________]        │
│                                        │
│   💡 No tienes que ser exacto.         │
│       Después puedes editar.           │
│                                        │
│   [Saltar]              [Siguiente →]  │
└────────────────────────────────────────┘
```

### Paso 2: Ingreso mensual

```
┌────────────────────────────────────────┐
│   PASO 2 DE 3 — Tu sueldo              │
│   ──────────────────────────           │
│                                        │
│   ¿Cuánto recibes al mes en promedio?  │
│                                        │
│   💰 Ingreso mensual: [____________]   │
│                                        │
│   Frecuencia:                          │
│   ( ) Quincenal                        │
│   ( ) Mensual                          │
│                                        │
│   💡 Si varía, pon un promedio.        │
│                                        │
│   [← Atrás]            [Siguiente →]   │
└────────────────────────────────────────┘
```

### Paso 3: Resultado + acciones recomendadas

```
┌────────────────────────────────────────┐
│   ¡Listo! 🎉                           │
│   ──────────────────                   │
│                                        │
│   📊 Tu salud financiera inicial:      │
│                                        │
│         ╭─────╮                        │
│        │  35  │  Mejorable 🟡         │
│         ╰─────╯                        │
│                                        │
│   💡 3 acciones recomendadas:          │
│                                        │
│   ✓ 1. Crea tu fondo de emergencia    │
│        (apartar 3-6 meses gastos)     │
│   ✓ 2. Activa exención del 4×1000     │
│        (350 UVT al mes)                │
│   ✓ 3. Distribuye tu sueldo con       │
│        método 50/30/20                 │
│                                        │
│   [Empezar a usar Finko]               │
└────────────────────────────────────────┘
```

## Tareas

- [x] **10.1** — Crear modal `m-onboarding` con 3 pasos navegables
- [x] **10.2** — CSS de wizard con indicador de progreso (1/3, 2/3, 3/3)
- [x] **10.3** — Lógica de validación: no permitir avanzar sin datos
- [x] **10.4** — Botón "Saltar" para usuarios que no quieren onboarding
- [x] **10.5** — Detección "primera vez" en `main.js` bootstrap
- [x] **10.6** — Cálculo del score inicial al completar paso 3
- [x] **10.7** — Generación dinámica de "3 acciones recomendadas" según el score
- [x] **10.8** — Persistir flag `localStorage.setItem('finko_onboarded', '1')` al completar
- [x] **10.9** — Persistir flag al "Saltar" también (para no repetir)
- [ ] **10.10** — Botón en Ajustes: "Volver a ver onboarding" (resetea el flag)

## Criterios de aceptación

- ✅ Aparece SOLO la primera vez (no después)
- ✅ Cada paso es de máximo 30 segundos
- ✅ Posible saltarlo sin penalización
- ✅ Al completar, dashboard muestra datos reales (no empty states)
- ✅ Las 3 acciones recomendadas son accionables (botones que llevan a la sección correspondiente)
- ✅ Funciona en mobile (no se rompe el layout)

## Cómo verificar

```bash
# Reset estado de onboarding
localStorage.removeItem('finko_onboarded');
location.reload();
# Debe abrir el wizard
```

## Referencias
- [Material Design — Onboarding](https://m3.material.io/styles/motion/transitions/transition-patterns#onboarding)
- [Nielsen Norman Group — Onboarding UX](https://www.nngroup.com/articles/onboarding-ux/)

---

## 📈 Métricas de éxito globales

Al terminar las 10 fases, deberías poder verificar:

| Métrica | Meta | Cómo medir |
|---------|------|------------|
| **Lighthouse Accessibility** | ≥ 95 | DevTools → Lighthouse |
| **Lighthouse Performance** | ≥ 90 | DevTools → Lighthouse |
| **Lighthouse Best Practices** | = 100 | DevTools → Lighthouse |
| **Tamaños de letra distintos** | ≤ 6 | Inspeccionar visualmente |
| **`rgba()` hardcoded** | = 0 | `grep -c "rgba(" index.html` |
| **`font-size:Xpx` inline** | = 0 | `grep -c "font-size:" index.html` |
| **Score de Salud visible** | ✅ | Inspección visual primer scroll |
| **Onboarding al primer uso** | ✅ | Probar en incógnito |
| **Funciona sin mouse** | ✅ | Solo Tab/Enter en navegador |
| **Funciona con `prefers-reduced-motion`** | ✅ | Activar en SO y probar |

---

## 📚 Referencias y bibliografía

### Diseño y UX
- Don Norman — *The Design of Everyday Things*
- Steve Krug — *Don't Make Me Think*
- Refactoring UI — Adam Wathan & Steve Schoger

### Accesibilidad
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [a11y Project](https://www.a11yproject.com/)

### Educación financiera
- Dave Ramsey — *The Total Money Makeover*
- Ramit Sethi — *I Will Teach You To Be Rich*
- Robert Kiyosaki — *Rich Dad Poor Dad*
- Elizabeth Warren — *All Your Worth* (origen del 50/30/20)
- Vicki Robin — *Your Money or Your Life*

### Sistemas de diseño (referencia)
- [Material Design 3](https://m3.material.io/)
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)
- [IBM Carbon](https://carbondesignsystem.com/)
- [Atlassian Design System](https://atlassian.design/)

### Tipografía
- [Modular Scale](https://www.modularscale.com/)
- [Type Scale](https://typescale.com/)

### Colores
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Coolors — Generador de paletas accesibles](https://coolors.co/)

---

## 🎯 Cómo usar este documento

1. **Imprime o ten abierto este archivo** durante el trabajo
2. **Trabaja UNA fase a la vez** — no saltes ni hagas varias en paralelo
3. **Marca con ✅** cada checkbox conforme completas
4. **Al terminar una fase**: verificar criterios de aceptación + commit con mensaje claro
   ```bash
   git commit -m "feat(dashboard): fase 1 — escala tipográfica modular"
   ```
5. **Si algo no funciona** en una fase: NO avances. Documenta el bloqueo aquí mismo en una sección "Notas".

---

## 📝 Notas y bloqueos

> *Esta sección queda vacía y se llena conforme avances. Anota aquí decisiones, dudas, cambios al plan, etc.*

### Fase 1 — Tipografía
*(vacío)*

### Fase 2 — Colores
*(vacío)*

### Fase 3 — Score visible
*(vacío)*

### Fase 4 — Predicción
*(vacío)*

### Fase 5 — Bolsillos
*(vacío)*

### Fase 6 — Acciones rápidas
*(vacío)*

### Fase 7 — Educación
*(vacío)*

### Fase 8 — Accesibilidad
*(vacío)*

### Fase 9 — Responsive
*(vacío)*

### Fase 10 — Onboarding
*(vacío)*

---

**Última actualización**: 2026-05-04
**Próxima revisión**: Al completar Fase 3
