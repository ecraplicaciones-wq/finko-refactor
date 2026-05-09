# Changelog — Finko Pro

Todos los cambios notables del proyecto se documentan acá.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), versionado [SemVer](https://semver.org/lang/es/).

---

## [Unreleased] — v5.0 (en planificación)

> Plan completo: [`ROADMAP.md`](./ROADMAP.md). Tag baseline: `v4.x-baseline`.

### Documentación (Fase 1 — completada)

- **Add:** `README.md` profesional como entrada del proyecto.
- **Add:** `AUDIT.md` con auditoría exhaustiva v5 (métricas, deuda técnica, decisiones).
- **Add:** `ARCHITECTURE.md` con mapa técnico vigente + reglas innegociables.
- **Add:** `REORG_HTML.md`, `REORG_CSS.md`, `REORG_JS.md` con planes de reorganización.
- **Add:** `DESIGN_SYSTEM.md` con paleta, tipografía, Bento Grid, microcopy y a11y.
- **Add:** `FINANCIAL_LOGIC_CO.md` con constantes legales, estrategias y nudges.
- **Add:** `ROADMAP.md` con 8 fases ordenadas y plan de contingencia.
- **Add:** `CHANGELOG.md` (este archivo).
- **Add:** `CONTRIBUTING.md` con convenciones del repo.
- **Add:** `docs/baseline/` con métricas v4.x (LOC, coverage, HTML metrics).
- **Add:** `docs/historico/` con documentación del refactor v5 anterior preservada.
- **Move:** `dev-routine.sh` → `scripts/`.
- **Update:** `CLAUDE.md` reescrito para reflejar arquitectura actual.
- **Remove:** 9 archivos `.md` obsoletos / personales / duplicados de la raíz (justificación detallada en `AUDIT.md` §6).

### Planeado (sin ejecutar)

- **Reorg HTML:** bajar 341 → < 60 inline styles; mantener 0 `onclick`; mantener ≥ 156 `data-action`.
- **Reorg CSS:** tokens `--sp-*`, `--fs-*`, utilities, `.list-item`, Bento Grid base.
- **Reorg JS:** partir 4 dominios > 1.500 LOC en sub‑carpetas; helper `crud.js`; reducir `window.*` de 210 a < 30; lazy‑load de `analisis/`.
- **UX moderna:** Bento Grid en dashboard, empty states, microcopy unificado, onboarding wizard.
- **Lógica financiera:** auto‑update tasa de usura trimestral, bloqueo educativo de tasa ilegal, mora inminente, distribución de prima, tabla de amortización, GMF acumulado, quiz Avalancha vs Bola, detector DIAN, cesantías.

---

## [4.x] — Estado estable previo al refactor v5

> Tag git: `v4.x-baseline`.

### Métricas (capturadas 2026‑05‑07)

- 1.311 tests verdes (12 archivos de test).
- ~13.300 LOC en `modules/`.
- ~3.700 LOC en raíz (HTML + CSS + Service Worker).
- 0 `onclick=""` en HTML estático.
- 156 `data-action=""`.
- 208 atributos ARIA.
- 7 capas `@layer` en CSS, ~70 tokens, modo oscuro/claro completo.
- PWA cache‑first funcional.

### Bugs históricos resueltos antes de v4.x

- **Bug A — `save()` duplicado en `storage.js`:** dos declaraciones provocaban `SyntaxError`. Resuelto: solo queda la versión debounced.
- **Bug B — Referencias zombie a calculadoras en `events.js`:** 11 funciones (`cCDT`, `cCre`, …) sin import. Resuelto: las calculadoras se lazy‑loadean correctamente desde `modules/ui/shell.js`.
- **Bug — `save()` sincrónico:** reemplazado por debounce 200 ms.
- **Bug — Re‑render innecesario al cambiar tab:** mitigado con `renderSmart(fn, key)`.

### Funcionalidades vivas en v4.x

- Dashboard con saldo total, próximos pagos y salud financiera.
- Gestión de gastos con detector de hormigas + impacto anual.
- Pagos fijos con recordatorios y agenda calendario.
- Deudas con estrategias **Avalancha** y **Bola de Nieve** implementadas.
- Cuentas, fondo de emergencia y bolsillos / alcancías.
- Objetivos / metas e inversiones con rendimientos.
- Préstamos personales ("me deben").
- Calculadoras: CDT, crédito (sistema francés), interés compuesto, regla 72, prima.
- Exportación JSON / CSV / HTML.
- Modo oscuro y claro.
- Service Worker offline + banner de "sin conexión".
- Undo (Ctrl+Z) tras operaciones destructivas.
- 5 migraciones idempotentes del schema (v0→v5).
- 20+ logros gamificados.
- Constantes legales colombianas (SMMLV 2026, UVT 2026, GMF 4×1000 con exención 350 UVT, tasa de usura 24.36% Q1‑2026, retenciones, PILA, catálogo bancos).

---

*Las versiones anteriores a v4.x viven en el historial de commits. Los planos del refactor previo se archivaron en `docs/historico/`.*
