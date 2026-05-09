# Finko Pro

> Coach financiero personal para Colombia — offline‑first, sin esfuerzo, sin tecnicismos.

Finko Pro es una aplicación web (PWA) para personas que **no tienen formación financiera** pero quieren entender en qué se les va la plata, organizar deudas, ahorrar para metas y tomar mejores decisiones — todo bajo la realidad legal y económica colombiana (SMMLV, UVT, GMF, tasa de usura, prima, cesantías, Datacrédito).

La app corre 100% en el navegador: no hay servidor, no hay cuenta, no hay sincronización en la nube. Tus datos viven en `localStorage` y **nadie más los ve**.

---

## ¿Qué hace por vos?

- 💰 **Saldo en vivo:** sumás tus cuentas (efectivo, banco, ahorros) y el dashboard te muestra cuánto tenés realmente y cuánto se va este mes.
- 🐜 **Detector de hormigas:** identifica gastos pequeños y repetidos que parecen inofensivos pero te suman al año (con cifra concreta).
- 🧱 **Pagos fijos y agenda:** recordatorios de servicios, suscripciones y cuotas con calendario integrado.
- 🪜 **Estrategias de deudas:** elegí entre **Avalancha** (más barato a largo plazo) o **Bola de Nieve** (motivacional, ganás victorias rápidas).
- 🎯 **Metas y alcancías:** plata separada por propósito, con barra de progreso y nudges ("te falta el 20%, en 3 meses lo tenés").
- 🛟 **Fondo de emergencia:** la app te dice cuántos meses cubrís hoy y qué falta para llegar a 6.
- 📊 **Salud financiera:** un puntaje de 0 a 100 con 6 componentes (sin atrasos, ahorrando, fondo, deudas controladas, backup reciente, hormigas).
- 🇨🇴 **Constantes legales vivas:** SMMLV 2026, UVT 2026, GMF 4×1000 con exención 350 UVT, tasa de usura trimestral, retenciones.
- 🧮 **Calculadoras:** CDT, crédito (sistema francés), interés compuesto, regla del 72, prima.
- 📥 **Backup y exportación:** JSON, CSV, reporte HTML imprimible.
- 📵 **Offline real:** Service Worker cachea todo; funciona sin internet.

---

## Estado del proyecto

Versión vigente: **v4.x** estable.
Próximo hito: **v5.0 — Reorganización + UX moderna + estrategias avanzadas** (ver [`ROADMAP.md`](./ROADMAP.md)).

| Métrica actual | Valor |
|---|---:|
| Módulos JS | 17 archivos en `modules/` |
| LOC totales (`modules/`) | ~13.300 |
| LOC totales (raíz: HTML+CSS+SW) | ~3.700 |
| Tests | 1.311 (100% passing) |
| Cobertura lógica financiera crítica | ~85% |
| `onclick=""` en HTML | **0** ✅ |
| `data-action=""` | 156 |
| ARIA attrs en `index.html` (conteo preciso) | 208 |
| Tipografías | Inter (UI) + DM Mono (valores) |
| Tokens CSS | ~70 |
| Modo oscuro / claro | ✅ |
| Service Worker | ✅ cache‑first |

---

## Setup local (2 minutos)

Requisitos: **Node 18+** y **Python 3** (o cualquier servidor estático).

```bash
# Instalar dependencias de testing
npm install

# Correr todos los tests una vez
npm test

# Tests en watch mode mientras editás
npm run test:watch

# Cobertura
npm run coverage

# Servir la app localmente (no requiere build)
python -m http.server 8080
# → Abrir http://localhost:8080
```

No hay step de build. Ningún bundler. Vanilla JS ES6 modules cargados directamente por el navegador.

---

## Estructura del repo (alto nivel)

```
Finko-Refactor/
├─ index.html              # Shell de la app (todas las secciones y modales)
├─ style.css               # Sistema de diseño completo (tokens, layers, componentes)
├─ service-worker.js       # PWA cache-first
├─ manifest.json           # Manifest PWA
│
├─ modules/
│  ├─ core/                # Cimientos: state, storage, constants
│  ├─ infra/               # Utils, render, accesibilidad
│  ├─ ui/                  # Bootstrap, navegación, delegación de eventos
│  ├─ dominio/             # Lógica de negocio por dominio
│  │   ├─ ingresos.js
│  │   ├─ compromisos.js
│  │   ├─ tesoreria.js
│  │   ├─ metas.js
│  │   ├─ analisis.js
│  │   ├─ exports.js
│  │   └─ personales.js
│  └─ calculadoras.js      # Lazy-loaded cuando se entra a la sección
│
├─ tests/                  # Vitest + happy-dom
└─ docs (raíz)/            # Documentación (ver tabla abajo)
```

Para entender cómo se conectan las piezas, abrí [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Documentación

| Documento | Para qué sirve | Lo lee… |
|---|---|---|
| [`README.md`](./README.md) | Entrada al proyecto | Cualquier persona |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Cómo está hecha la app por dentro | Dev nuevo |
| [`AUDIT.md`](./AUDIT.md) | Estado real, deuda técnica, métricas | Quien va a refactorizar |
| [`REORG_HTML.md`](./REORG_HTML.md) | Plan de reorganización del HTML | Quien toca `index.html` |
| [`REORG_CSS.md`](./REORG_CSS.md) | Plan de reorganización del CSS | Quien toca `style.css` |
| [`REORG_JS.md`](./REORG_JS.md) | Plan de reorganización de JavaScript | Quien parte módulos grandes |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Sistema visual: paleta, tipografía, Bento Grid, accesibilidad, microcopy | Diseñador / dev UI |
| [`FINANCIAL_LOGIC_CO.md`](./FINANCIAL_LOGIC_CO.md) | Reglas legales colombianas + estrategias (avalancha, bola de nieve, nudges) | Dev de dominio |
| [`ROADMAP.md`](./ROADMAP.md) | Fases ordenadas para llegar a v5 sin romper nada | Lead técnico / stakeholder |
| [`CLAUDE.md`](./CLAUDE.md) | Instrucciones para asistentes IA (Claude Code) | Claude / Cursor / Copilot |

---

## Filosofía del proyecto

1. **Sin frameworks ni build step.** El navegador entiende ES6 modules; lo demás sobra.
2. **Offline siempre.** La plata es privada. Nada sale de tu dispositivo.
3. **Clean Code humano.** Cualquier persona razonable debe poder leer un archivo y entenderlo en < 10 minutos.
4. **Lenguaje simple.** No usamos "TIR", "yield" ni "WACC". Usamos *"si haces esto te queda X"*.
5. **Ley colombiana de verdad.** Si la regla cambia (ej. tasa de usura trimestral), la app se actualiza, no se rompe.
6. **Behavioral nudges con ética.** Te empujamos a decisiones buenas con datos honestos, no con manipulación.
7. **Accesibilidad WCAG AA.** ARIA, foco visible, contraste real, soporte de lector de pantalla.

---

## Cómo contribuir

1. Leé `ARCHITECTURE.md` y `CLAUDE.md` antes de tocar nada.
2. Para cambios grandes, leé también `ROADMAP.md` y respetá la fase activa.
3. **Tests verdes son obligatorios** (`npm test` antes de commitear).
4. Convención de commits: `tipo(área): descripción corta` — ej. `fix(deudas): redondeo en cuota sugerida`.
5. PRs chiquitos. Una idea = un commit = un PR cuando sea posible.
6. Si tocás constantes legales (SMMLV, UVT, usura), abrí también `FINANCIAL_LOGIC_CO.md` y actualizá la fecha de revisión.

---

## Licencia y datos

Proyecto personal del autor. Los datos del usuario nunca salen del dispositivo. Cualquier feature que requiera red (sincronización, cuentas) será **opt‑in explícito** y deberá documentarse en `FINANCIAL_LOGIC_CO.md`.

---

*Última actualización del README: 2026‑05‑07.*
