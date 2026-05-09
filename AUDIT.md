# Auditoría Técnica — Finko Pro

> **Fecha de auditoría:** 2026‑05‑07
> **Versión auditada:** v4.x (post‑v5 audit pero pre‑refactor v5.0)
> **Auditor:** Senior Full‑Stack Architect (Claude)

---

## 1 · Objetivo

Diagnosticar el **estado real** del repositorio y entregar al equipo un mapa accionable de:

- Qué funciona bien y debe permanecer intacto.
- Qué está bien hecho pero se puede pulir.
- Qué tiene riesgo (frágil, duplicado, gigante) y necesita refactor.
- Qué sobra (archivos, código muerto, documentación rancia).
- Qué falta (cobertura, features, constantes vivas).

Esta auditoría **no toca código**. Sirve como insumo para `ROADMAP.md`, `REORG_*.md`, `DESIGN_SYSTEM.md` y `FINANCIAL_LOGIC_CO.md`.

---

## 2 · Alcance

Incluye:

- `index.html` (1.942 LOC)
- `style.css` (1.241 LOC)
- `service-worker.js` (495 LOC)
- `manifest.json`, `package.json`, `vercel.json`, `.gitignore`, `.vercelignore`
- `modules/` (14 archivos JS, ~17.000 LOC totales)
- `tests/` (Vitest, 1.311 tests)
- 11 archivos `.md` en raíz
- Scripts auxiliares (`dev-routine.sh`)

No incluye:

- Análisis del Service Worker en profundidad (auditoría aparte recomendada).
- Lighthouse / Web Vitals (insumo separado: ver reporte HTML existente).
- Seguridad (no hay backend; surface es nula).

---

## 3 · Estado actual — métricas duras

### 3.1 · Código JavaScript

| Archivo | LOC | Rol |
|---|---:|---|
| `modules/dominio/analisis.js` | **2.849** | Stats, logros, salud, alertas, predicciones |
| `modules/dominio/compromisos.js` | **1.992** | Fijos + agenda + deudas |
| `modules/dominio/ingresos.js` | **1.623** | Gastos + dashboard + resumen + historial |
| `modules/dominio/tesoreria.js` | **1.602** | Cuentas + fondo emergencia + bolsillos |
| `modules/core/storage.js` | 1.003 | Persistencia + migraciones + undo |
| `modules/dominio/metas.js` | 979 | Objetivos + inversiones |
| `modules/ui/shell.js` | 797 | Navegación + UI shell |
| `modules/calculadoras.js` | 593 | CDT/Crédito/Compuesto/72/Prima |
| `modules/dominio/exports.js` | 425 | JSON/CSV/HTML |
| `modules/dominio/personales.js` | 396 | Préstamos personales |
| `modules/ui/events.js` | 363 | Bootstrap + window.* + delegación |
| `modules/infra/utils.js` | 276 | Helpers + diálogos |
| `modules/infra/render.js` | 124 | renderSmart, updSaldo, badge |
| `modules/infra/a11y.js` | 99 | Anuncios screen reader |
| `modules/core/constants.js` | 88 | SMMLV, UVT, GMF, usura, bancos |
| `modules/ui/actions.js` | 50 | Delegador `data-action` |
| `modules/core/state.js` | 41 | Singleton `S`, EventBus |
| **Total** | **~13.300** | |

**Bandera roja:** 4 archivos > 1.500 LOC (los cuatro dominios principales). Cualquier desarrollador nuevo necesita ≥ 1 hora para orientarse en cualquiera de ellos.

### 3.2 · HTML

- 1.942 LOC.
- 9 secciones (`#sec-dash`, `#sec-quin`, `#sec-gast`, `#sec-alcancias`, `#sec-inve`, `#sec-agenda`, `#sec-deudas`, `#sec-meDeben`, `#sec-stat`).
- 20 modales con patrón uniforme (`<div class="modal-ov" role="dialog" aria-modal="true">`).
- **0** `onclick=""` ✅ — migración a `data-action` completada.
- 156 `data-action=""` con `data-arg-*` para parámetros.
- **341** `style="..."` inline (objetivo v5: < 60).
- 208 atributos ARIA (conteo preciso con `grep -oE 'aria-[a-z]+' index.html | wc -l`; conteo aproximado por línea = 191).
- Meta tags PWA completos (viewport, theme‑color, apple‑touch‑icon, manifest, modulepreload de 7 módulos core).

### 3.3 · CSS

- 1.241 LOC.
- 7 capas `@layer`: `reset → base → layout → components → modals → theme → responsive → utils` (orden correcto).
- ~70 tokens CSS (colores, surfaces, borders, text, acentos, semánticos, radii, sombras, gradientes).
- Tipografías: Inter (UI, pesos 300‑800) + DM Mono (valores, 300‑500), cargadas vía Google Fonts con `preconnect` y `display=swap`.
- Modo oscuro/claro completo: `body.light-theme` sobrescribe todos los tokens.
- Glassmorphism suave (`backdrop-filter: blur(4px)`), acento verde neón `#00dc82`, ambient glow radial.
- Componentes reusables (`.btn` + 8 variantes, `.card` + accents, `.ui-row`, `.ui-chip`, `.ui-acc-btn`, `.hist-card`, `.inv-card`, etc.).
- Breakpoints: 1.440px / 769‑1.024px / 481‑768px / ≤480px / ≤359px (sin container queries).

### 3.4 · Tests

| Archivo | Tests | Cobertura |
|---|---:|---|
| `analisis.test.js` | 410 | Exhaustiva |
| `storage.test.js` | 207 | Exhaustiva (migraciones, snapshots, undo) |
| `tesoreria.test.js` | 171 | Exhaustiva |
| `ingresos.test.js` | 159 | Exhaustiva |
| `compromisos.test.js` | 129 | Exhaustiva (avalancha/bola/mora/cuota) |
| `metas.test.js` | 105 | Exhaustiva |
| `calculadoras.test.js` | 35 | Parcial (faltan edge cases: tasa 0%, negativa) |
| `personales.test.js` | 29 | Mínima (solo happy path) |
| `utils.test.js` | 21 | Mínima |
| `exports.test.js` | 20 | Completa |
| `migrations.test.js` | 18 | Completa |
| `state.test.js` | 7 | Mínima |
| **Total** | **1.311** | **~85% de la lógica financiera crítica** |

### 3.5 · Documentación

11 archivos `.md` en la raíz. Diagnóstico:

- 4 documentos de auditoría reciente (`01_*` … `04_*`) generados hace horas, vigentes pero **no profesionalmente nombrados**.
- 3 documentos históricos de plan v5 (con redundancia byte‑a‑byte entre dos de ellos).
- 3 documentos personales del autor (rutina, tutorial, quick start).
- 1 `CLAUDE.md` vigente con instrucciones para herramientas IA.

→ Reemplazo total de la documentación de raíz se detalla en §6 de este documento y se ejecuta en este mismo PR.

---

## 4 · Lo que funciona bien (NO TOCAR)

> Estas decisiones son ADN del proyecto. Cambiarlas introduce riesgo sin ganancia.

1. **Vanilla JS sin build step.** Hace al proyecto auditable en cualquier máquina con un navegador. Ningún framework justifica perder esa simplicidad para esta app.
2. **Singleton `S` mutable + `save()` debounced.** Es predecible, fácil de debuggear, no necesita reactivity. La regla `mutación → save() → renderX()` está clara y respetada.
3. **`data-action` delegado.** Migración 100% completa en HTML estático. 0 `onclick`. Esta es la columna vertebral de la accesibilidad y la mantenibilidad — proteger a toda costa.
4. **Migraciones idempotentes en `storage.js`.** El sistema de versionado (`fco_v4`, schema v5, 5 migraciones aplicadas en orden) es sólido y nunca rompe backward‑compat.
5. **Capas `@layer` en CSS.** El orden está bien pensado y respetado en el archivo. Tocar la cascada introduce regresiones difíciles.
6. **Estética actual (verde neón + glassmorphism suave).** Es un diferencial visual ya validado. La modernización debe **expandirla**, no reemplazarla. Ver `DESIGN_SYSTEM.md`.
7. **Funciones puras de dominio testeadas.** `ordenarDeudas`, `calcularDiasMora`, `clasificarMora`, `calcularCuotaSugerida`, `clasificarCargaDeuda`, `calcularSaludFinanciera` están aisladas, sin DOM, con tests sólidos. Son patrimonio del proyecto.
8. **PWA + Service Worker cache‑first.** Funciona. Solo requiere bumpear `CACHE_NAME` cuando cambien assets.
9. **EventBus emergente en `state.js`.** Pequeño, simple, ya conectado a `state:save` y `ui:renderAll`. Es la base correcta para desacoplar dominios.

---

## 5 · Problemas detectados

### 5.1 · Críticos (bloquean evolución)

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| **C‑1** | 4 archivos de dominio > 1.500 LOC fusionan 2‑4 sub‑dominios cada uno | `analisis.js` 2.849, `compromisos.js` 1.992, `ingresos.js` 1.623, `tesoreria.js` 1.602 | Onboarding lento, regresiones cruzadas, miedo a tocar |
| **C‑2** | Lógica de negocio acoplada al DOM dentro de los dominios | Renders generan `innerHTML` mezclado con cálculos en mismo archivo | Cambios de UI obligan a tocar dominios |
| **C‑3** | 74 funciones expuestas a `window.*` solo desde `events.js` (210 en todo `modules/` — medido con `grep -cE '^\s*window\.[a-zA-Z_]+\s*=' modules/ui/events.js`) | Bloque `if (typeof window !== 'undefined')` con asignaciones masivas | Ningún call‑site claro; cambiar firma rompe cosas en silencio |
| **C‑4** | 341 `style=""` inline en HTML estático | Mezcla de propósitos: dimensiones fijas, colores, gradientes, layout | Dificulta tema, consistencia visual y mantenimiento |

### 5.2 · Altos (deuda técnica significativa)

| # | Problema | Evidencia |
|---|---|---|
| **A‑1** | CRUD boilerplate duplicado 6‑8 veces (guardar/eliminar/editar) | `guardarFijo`, `guardarCuenta`, `guardarObjetivo`, `delGasto`, `delFijo`, `delDeu`, etc. |
| **A‑2** | Detección de anomalías repetida con patrón similar | `detectarDeudasDurmiendo`, `detectarGastoAtipico`, `detectarMesesSinCerrar` |
| **A‑3** | Modales abrir/editar repetidos | `abrirEditarGasto`, `abrirModalFijo`, `abrirPagarCuota`, `abrirEditarDeuda` (4 variantes mismo patrón) |
| **A‑4** | Tasa de usura hardcoded trimestral (24.36% Q1‑2026) | `constants.js` sin auto‑actualización |
| **A‑5** | Tabla SMMLV/UVT por año no expuesta como histórico | Solo año vigente |
| **A‑6** | Calc helpers en `calculadoras.test.js` con cobertura parcial (35 tests, faltan edge cases) | Comparado con dominios (100‑400 tests c/u) |
| **A‑7** | Lazy‑load existe solo para calculadoras | `analisis.js` (2.849 LOC) y `exports.js` se cargan eager innecesariamente |

### 5.3 · Medios (pulido)

| # | Problema | Evidencia |
|---|---|---|
| **M‑1** | Documentación raíz redundante o personal | `Finko_Pro_Auditoria_v5.md` ≡ `..._Reorganizacion.md`, plus 3 archivos personales |
| **M‑2** | Reporte Lighthouse versionado en raíz | `localhost_2026-04-20_07-30-25.report.html` (282 KB) |
| **M‑3** | `dev-routine.sh` en raíz | Pertenece a `scripts/` |
| **M‑4** | 29 reglas `display:none` en CSS (algunas pueden ser hidden attribute en HTML) | Análisis caso por caso |
| **M‑5** | Sin `CHANGELOG.md` ni `CONTRIBUTING.md` | Historial vive en commits y en `Finko_Pro_*` históricos |
| **M‑6** | `Known Bugs` en `CLAUDE.md` ya están resueltos | Falsa información para asistentes IA |

### 5.4 · Bajos (cosméticos / opcionales)

| # | Problema |
|---|---|
| **B‑1** | Algunas clases CSS de gradientes (`accent-*`) no se usan en todos los contextos previstos |
| **B‑2** | Naming inconsistente: español + inglés mezclados en módulos (`compromisos`, `events`, `actions`) |
| **B‑3** | Falta diagrama actualizado de dependencias entre módulos |
| **B‑4** | Falta `prettier` / `eslint` config (si bien el código es limpio, no hay enforcement automático) |

---

## 6 · Documentación actual — clasificación uno por uno

| Archivo | Decisión | Justificación |
|---|---|---|
| `01_auditoria_y_limpieza.md` | **REEMPLAZAR por `AUDIT.md`** | Información reciente y útil, pero el nombre con prefijo numérico es interno; este archivo (`AUDIT.md`) consolida los hallazgos con métricas frescas y nomenclatura profesional. |
| `02_ux_ui_modernizacion.md` | **REEMPLAZAR por `DESIGN_SYSTEM.md`** | Excelente contenido visual; se refunda con sistema de diseño formal, accesibilidad explícita y Bento Grid documentado. |
| `03_logica_financiera_col.md` | **REEMPLAZAR por `FINANCIAL_LOGIC_CO.md`** | Misma intención; el nombre nuevo deja claro que es referencia legal viva (no un plan one‑shot). |
| `04_roadmap_ejecucion.md` | **REEMPLAZAR por `ROADMAP.md`** | Plan vigente; el nombre nuevo es estándar GitHub y más legible. |
| `CLAUDE.md` | **CONSERVAR** (con micro‑update sugerido) | Contrato vivo entre repo y herramientas IA. Solo eliminar la sección "Known Bugs" (ya resueltos) y agregar referencia a `AUDIT.md`. |
| `Finko_Pro_Auditoria_v5.md` | **ELIMINAR** | Duplicado byte‑a‑byte de `Finko_Pro_Auditoria_v5_Reorganizacion.md` (mismo contenido, distinto nombre). Mantenerlos confunde. |
| `Finko_Pro_Auditoria_v5_Reorganizacion.md` | **ELIMINAR (mover a histórico opcional)** | Insumo del refactor v5 ya ejecutado. Toda información valiosa quedó en `AUDIT.md`. Se puede mover a `docs/historico/` si el equipo quiere preservar contexto. |
| `Finko_Pro_Claude_Code_Plan.md` | **ELIMINAR (mover a histórico opcional)** | Plan generador del refactor v5; ya ejecutado. Información de procedimiento sobrevive en `ROADMAP.md`. |
| `Claude_Code_Primera_Vez.md` | **ELIMINAR** | Tutorial personal del autor para configurar Claude Code en su máquina. No es documentación del proyecto. |
| `DEVELOPMENT_ROUTINE.md` | **ELIMINAR** | Rutina personal de desarrollo del autor. Pertenece a `~/.claude/`, no al repo. |
| `QUICK_START.md` | **FUSIONAR EN `README.md` Y ELIMINAR** | Sus 3 secciones ya quedaron incorporadas en `README.md` (setup, comandos, deploy). |

**Justificación general para eliminaciones:** ningún archivo eliminado contiene información que no esté ya cubierta por la nueva documentación o por el contenido de `CLAUDE.md`. La eliminación es **conservadora**: lo histórico se puede mover a `docs/historico/` si el equipo quiere preservar la cápsula del tiempo del refactor v5.

> **Nota crítica:** los archivos `Finko_Pro_Auditoria_v5*` describen la lógica de migración v0→v5 (storage). Esta lógica ya está implementada y testeada en `storage.js` + `migrations.test.js`. **Mantener una copia en `docs/historico/Finko_Pro_Auditoria_v5_Reorganizacion.md` es la opción más segura** para no perder el "porqué" detrás de las decisiones del schema.

---

## 7 · Información valiosa que NO se puede perder

Antes de cualquier limpieza, asegurarse de que estos hechos quedan registrados en la nueva documentación:

- **Bug A (`save()` duplicado)** y **Bug B (referencias zombie a calculadoras)**: ambos están **resueltos**. Migrar a `CHANGELOG.md` (próxima fase del roadmap).
- **5 migraciones idempotentes** del schema (v0→v5): ya documentadas indirectamente en `storage.js` y `migrations.test.js`. Capturar el "porqué" de cada una en `ARCHITECTURE.md`.
- **Constantes legales con vencimiento trimestral** (tasa de usura): documentar protocolo de actualización en `FINANCIAL_LOGIC_CO.md`.
- **20+ logros gamificados** (objetivos, rachas, reglas de desbloqueo): listar todos en `FINANCIAL_LOGIC_CO.md` para que un nuevo dev pueda mantenerlos.
- **6 componentes de salud financiera** (sin atrasos / ahorrando / fondo / deudas controladas / backup / hormigas): explicar pesos y umbrales en `FINANCIAL_LOGIC_CO.md`.
- **Implementación pura de Avalancha y Bola de Nieve** (`ordenarDeudas` en `compromisos.js:39‑55`): joya del proyecto, documentar en `FINANCIAL_LOGIC_CO.md` con ejemplos.
- **Detector de hormigas + impacto anual proyectado**: caso de éxito de UX comportamental, capturar fórmula y umbrales.
- **Sistema francés de cuotas con conversión EA→periódica rigurosa**: matemática crítica, documentar fórmulas exactas.
- **Catálogo de bancos colombianos**: lista compilada en `constants.js`, mover snapshot a `FINANCIAL_LOGIC_CO.md` para revisión humana.
- **Estética glassmorphism + verde neón**: tokens y decisiones de paleta documentar en `DESIGN_SYSTEM.md` con ejemplos de contraste WCAG.

---

## 8 · Propuesta de organización ideal del repo

```
Finko-Refactor/
├─ index.html
├─ style.css
├─ service-worker.js
├─ manifest.json
├─ package.json
├─ vercel.json
├─ .gitignore / .vercelignore
│
├─ modules/
│  ├─ core/
│  │   ├─ state.js            # singleton S, EventBus
│  │   ├─ storage.js          # persistencia + migraciones
│  │   └─ constants.js        # constantes legales colombianas
│  ├─ infra/
│  │   ├─ utils.js            # f, hoy, dialogs
│  │   ├─ render.js           # renderSmart, updSaldo, badge
│  │   ├─ a11y.js             # screen reader announce
│  │   └─ crud.js             # ⭐ NUEVO: CRUD genérico (guardar/editar/eliminar)
│  ├─ ui/
│  │   ├─ events.js           # bootstrap + window.* (mantener mínimo)
│  │   ├─ shell.js            # navegación + tema + sidebar
│  │   └─ actions.js          # delegador data-action
│  ├─ dominio/
│  │   ├─ ingresos/           # 1.623 LOC → 4 archivos < 500 LOC
│  │   │   ├─ gastos.js
│  │   │   ├─ dashboard.js
│  │   │   ├─ resumen.js
│  │   │   ├─ historial.js
│  │   │   └─ index.js
│  │   ├─ compromisos/
│  │   │   ├─ fijos.js
│  │   │   ├─ deudas.js
│  │   │   ├─ agenda.js
│  │   │   └─ index.js
│  │   ├─ tesoreria/
│  │   │   ├─ cuentas.js
│  │   │   ├─ fondo-emergencia.js
│  │   │   ├─ bolsillos.js
│  │   │   └─ index.js
│  │   ├─ analisis/
│  │   │   ├─ rachas.js
│  │   │   ├─ logros.js
│  │   │   ├─ alertas.js
│  │   │   ├─ salud.js
│  │   │   ├─ predicciones.js
│  │   │   ├─ patrones.js
│  │   │   └─ index.js
│  │   ├─ metas.js
│  │   ├─ exports.js
│  │   └─ personales.js
│  └─ calculadoras.js
│
├─ tests/                       # se reordena espejo del nuevo árbol
│
├─ scripts/                     # ⭐ NUEVO
│  └─ dev-routine.sh
│
├─ docs/                        # ⭐ NUEVO (opcional)
│  └─ historico/
│      ├─ Finko_Pro_Auditoria_v5_Reorganizacion.md
│      └─ Finko_Pro_Claude_Code_Plan.md
│
└─ docs raíz/ (todos en raíz por convención)
   ├─ README.md
   ├─ AUDIT.md                  ← este archivo
   ├─ ARCHITECTURE.md
   ├─ REORG_HTML.md
   ├─ REORG_CSS.md
   ├─ REORG_JS.md
   ├─ DESIGN_SYSTEM.md
   ├─ FINANCIAL_LOGIC_CO.md
   ├─ ROADMAP.md
   ├─ CHANGELOG.md              ← futuro (Fase 1 del roadmap)
   ├─ CONTRIBUTING.md           ← futuro (Fase 1 del roadmap)
   └─ CLAUDE.md
```

### 8.1 · ¿Hace falta otro lenguaje (Python, scripts auxiliares)?

**Recomendación: NO en runtime. SÍ ocasionalmente en utilidades de mantenimiento.**

- **Runtime:** vanilla JS es la decisión correcta. Sumar TypeScript exige build step → rompe filosofía. No hacerlo.
- **Build/CI:** ningún build necesario. El navegador entiende ES6 modules.
- **Scripts auxiliares (opcionales, en `scripts/`):**
  - `scripts/check-constants.js` (Node) — verifica que SMMLV/UVT/usura coincidan con un fixture de validación; falla CI si están vencidas.
  - `scripts/lighthouse.sh` — corre Lighthouse local; útil pero no obligatorio.
  - `dev-routine.sh` — ya existe; mover a `scripts/`.
- **Python:** **no aporta valor**. Solo agregaría una dependencia más al onboarding sin justificación concreta. Si hace falta procesamiento de datos one‑shot, hacerlo en Node con `node --eval` o un script aislado. **Recomendación: descartar Python.**

---

## 9 · Fases de ejecución (resumen — detalle en `ROADMAP.md`)

> El detalle paso a paso vive en `ROADMAP.md`. Acá solo el orden y por qué.

1. **Fase 0 — Red de seguridad.** Confirmar tests verdes, definir métricas baseline (LOC por archivo, % cobertura, Lighthouse), bloquear merge si algo cae.
2. **Fase 1 — Limpieza documental.** Aplicar las decisiones de §6: eliminar/fusionar/mover. Crear `CHANGELOG.md`, `CONTRIBUTING.md`. Actualizar `CLAUDE.md`.
3. **Fase 2 — Reorganización HTML.** `REORG_HTML.md`: bajar 341 inline styles a < 60 reusando clases `ui-*`.
4. **Fase 3 — Reorganización CSS.** `REORG_CSS.md`: depurar tokens, formalizar Bento Grid, bajar redundancias.
5. **Fase 4 — Reorganización JS.** `REORG_JS.md`: partir los 4 dominios gigantes en sub‑carpetas, extraer `crud.js`, lazy‑load `analisis/`.
6. **Fase 5 — UX moderna.** `DESIGN_SYSTEM.md`: Bento Grid en desktop, microcopy, empty states, onboarding.
7. **Fase 6 — Lógica financiera avanzada.** `FINANCIAL_LOGIC_CO.md`: 7 gaps de coaching legal (auto‑actualización usura, distribución prima, mora inminente, tabla amortización, bloqueo tasa ilegal, quiz estrategia, GMF acumulado).
8. **Fase 7 — Verificación final.** Lighthouse ≥ 95 a11y, ≥ 90 perf. Cobertura ≥ 90%. Smoke test manual.

---

## 10 · Pasos detallados (alto nivel para esta auditoría)

Esta auditoría no propone cambios de código; los pasos viven en los `REORG_*` y `ROADMAP.md`. Lo único que se ejecuta dentro del alcance de este documento es:

1. ✅ Generar este `AUDIT.md` con datos verificados.
2. ✅ Generar nueva colección de `.md` profesionales.
3. ⏭ Aplicar limpieza de `.md` viejos (próxima fase, ver `ROADMAP.md` §Fase 1).
4. ⏭ NO tocar HTML / CSS / JS (regla absoluta de este PR).

---

## 11 · Criterios de verificación

Esta auditoría se considera completa cuando:

- [ ] El nuevo set de 9 archivos `.md` (README, AUDIT, ARCHITECTURE, REORG_HTML, REORG_CSS, REORG_JS, DESIGN_SYSTEM, FINANCIAL_LOGIC_CO, ROADMAP) existe en raíz.
- [ ] `CLAUDE.md` queda intacto (o solo con micro‑update aprobado por humano).
- [ ] Ningún archivo `.html`, `.css` o `.js` fue modificado.
- [ ] Las decisiones de §6 (conservar / fusionar / reemplazar / eliminar) tienen justificación de ≥1 línea cada una.
- [ ] Toda la información valiosa de §7 está capturada en algún `.md` nuevo.
- [ ] Los 4 documentos antiguos `01_*…04_*` están listados con su sucesor explícito.

---

## 12 · Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Eliminar un `.md` con información valiosa no migrada | Media | Alto | Doble checklist en §6 + §7. Mover a `docs/historico/` antes que borrar definitivamente. |
| `CLAUDE.md` desactualizado confunde a futuras IAs | Media | Medio | Micro‑update inmediato eliminando "Known Bugs" obsoletos. |
| Equipo cree que "auditoría completa" implica refactor inmediato | Baja | Alto | Banner explícito en cada `REORG_*.md`: "este documento NO se ha ejecutado todavía". |
| Nueva nomenclatura crea confusión transicional | Baja | Bajo | `README.md` lista los 9 docs con propósito claro. |
| Duplicación entre `AUDIT.md` y `Finko_Pro_Auditoria_v5_*` | Resuelto | — | Eliminación + opción de archivar en histórico. |

---

## 13 · Dependencias

- **Insumo:** este documento depende de la auditoría real de `index.html`, `style.css` y todos los módulos JS (ya realizada por 4 sub‑agentes en paralelo).
- **Salida:** alimenta a `ARCHITECTURE.md`, `REORG_HTML.md`, `REORG_CSS.md`, `REORG_JS.md`, `DESIGN_SYSTEM.md`, `FINANCIAL_LOGIC_CO.md`, `ROADMAP.md`.
- **Bloqueado por:** nada. Esta auditoría es la fuente de verdad.
- **Bloqueante de:** Fase 1 (limpieza) en adelante.

---

## 14 · Checklist final

- [x] Métricas duras de código (LOC, archivos, tests) verificadas.
- [x] HTML auditado (secciones, modales, eventos, ARIA, inline styles).
- [x] CSS auditado (layers, tokens, paleta, tipografías, modo claro).
- [x] Tests inventariados (1.311 totales, 12 archivos).
- [x] 11 documentos `.md` clasificados con decisión justificada.
- [x] Información valiosa identificada y mapeada a destino.
- [x] Propuesta de árbol de archivos ideal.
- [x] Lenguajes auxiliares evaluados (recomendación: solo Node ocasional, descartar Python).
- [x] Riesgos listados con mitigación.
- [x] No se modificó código en este PR.

---

*Fin de la auditoría. Próximo documento sugerido: [`ARCHITECTURE.md`](./ARCHITECTURE.md).*
