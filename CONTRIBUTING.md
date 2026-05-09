# Contribuir a Finko Pro

Gracias por querer aportar al proyecto. Acá están las reglas de juego para que tu cambio entre rápido y sin fricción.

---

## 1 · Antes de tocar código

Leé en este orden:

1. [`README.md`](./README.md) — entender qué hace la app.
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — capas, flujo de datos, reglas innegociables.
3. [`AUDIT.md`](./AUDIT.md) — estado real, deuda técnica conocida.
4. [`ROADMAP.md`](./ROADMAP.md) — fase activa y dependencias.
5. El `REORG_*.md`, `DESIGN_SYSTEM.md` o `FINANCIAL_LOGIC_CO.md` específico de tu cambio.

Si tu PR no respeta la fase activa del roadmap, conviene avisar antes en un issue.

---

## 2 · Setup local

```bash
# Clonar
git clone <repo>
cd Finko-Refactor

# Instalar deps de testing
npm install

# Tests
npm test
npm run test:watch
npm run coverage

# Servir la app (no hay build step)
python -m http.server 8080
# → http://localhost:8080
```

Stack: vanilla JS ES6 modules, sin framework, sin bundler, Vitest + happy-dom.

---

## 3 · Reglas innegociables

Estas decisiones son ADN del proyecto. **No** se rompen sin discusión explícita:

1. **Vanilla JS sin build step** (no TS, no bundler, no framework).
2. **Offline-first**: la app debe funcionar sin red.
3. **Sin servidor / sin sync** en v5. Cualquier feature de red debe ser opt-in y documentada.
4. **Estado mutable singleton `S`** — no agregar reactivity.
5. **`save()` debounced** — no escribir a `localStorage` sincrónicamente.
6. **Migraciones idempotentes** — cada bump de schema sube datos sin perder nada.
7. **`data-action` delegado** — 0 `onclick=""` en HTML estático.
8. **Lenguaje del usuario** — "tu plata" antes que "saldo disponible".
9. **Constantes legales vivas** — revisión trimestral obligatoria de la tasa de usura.

Detalle en [`ARCHITECTURE.md §4`](./ARCHITECTURE.md).

---

## 4 · Convenciones

### Naming

- **Dominios:** español neutro (`ingresos`, `compromisos`, `tesoreria`, `metas`, `analisis`).
- **Infra/UI:** inglés (`state`, `storage`, `events`, `actions`, `shell`).
- **Funciones:** `camelCase`, verbo primero (`agregarGasto`, `renderDeudas`).
- **Constantes:** `SCREAMING_SNAKE_CASE` (`SMMLV_2026`, `USURA_EA`).
- **IDs DOM:** `kebab-case` (`g-mo`, `desglose-hero-body`).
- **Clases CSS:** `.kebab-case` con prefijo por capa (`.ui-row`, `.modal-ov`, `.list-item`).

### Imports

- Siempre con extensión `.js` (necesario para módulos en navegador).
- Rutas relativas con `../`. Sin path mapping ni aliases.
- Agrupar por capa: core → infra → ui → dominio.

### Commits

Formato: `tipo(área): descripción corta`.

Tipos comunes:

- `feat` — nueva funcionalidad.
- `fix` — corrección de bug.
- `refactor` — cambio interno sin afectar comportamiento.
- `test` — agregar / corregir tests.
- `docs` — cambios en documentación.
- `chore` — tareas auxiliares (config, scripts).
- `style` — formato, indentación (no afecta lógica).

Ejemplos:

```
feat(deudas): bloqueo educativo si tasa supera usura
fix(agenda): clamp día 31 en febrero bisiesto
refactor(analisis): partir en sub‑archivos por subdominio
docs(roadmap): aclarar buffer de horas en Fase 4
```

Cuerpo del commit (opcional pero recomendado): explicar el "porqué" cuando no es obvio.

---

## 5 · Flujo de trabajo

1. **Crear rama** desde `main`: `git checkout -b feat/mi-feature`.
2. **Tests verdes localmente** antes del primer commit (`npm test`).
3. **Un commit = una idea**. Si tu PR tiene 3 ideas, son 3 commits.
4. **Tests verdes obligatorios** antes de pushear.
5. **PR pequeños**. Si el diff supera 500 líneas, dividir.
6. **Bumpear `CACHE_NAME`** del Service Worker si cambiaste assets cacheados.
7. **Actualizar `CHANGELOG.md`** sección `[Unreleased]` con tu cambio.

---

## 6 · Tests

- Funciones puras (sin DOM, sin `S` mutado vía window) son siempre testeables; cobertura objetivo ≥ 90 %.
- Funciones DOM se testean indirectamente via las puras que llaman.
- Si tocaste constantes legales (SMMLV, UVT, usura), agregar test que valide la nueva constante.
- Las migraciones de schema **siempre** requieren test en `migrations.test.js`.

---

## 7 · Constantes legales

Si modificás `modules/core/constants.js`:

1. Verificar fecha de origen (decreto / resolución).
2. Actualizar también [`FINANCIAL_LOGIC_CO.md §5`](./FINANCIAL_LOGIC_CO.md) con la nueva constante y vencimiento.
3. Tag de commit: `chore(legal): actualizar tasa de usura Q3-2026`.
4. Bumpear `CACHE_NAME` del Service Worker.

**Ritual obligatorio:** cada trimestre, verificar tasa de usura vs Superfinanciera.

---

## 8 · Accesibilidad

Cualquier cambio en HTML / CSS debe mantener o mejorar:

- Contraste WCAG 2.1 AA (≥ 4.5:1 para texto normal).
- Foco visible (`outline 2px solid var(--a1)` con offset 3px).
- ARIA en modales (`role="dialog" aria-modal="true" aria-labelledby="…"`).
- Min touch target 44×44 px.
- Skip-link funcional.
- Soporte teclado completo.

Antes de mergear cambios visuales, correr Lighthouse (target Accessibility ≥ 95).

---

## 9 · Lo que NO hacer

- ❌ Agregar `onclick="…"` en HTML — usar `data-action`.
- ❌ Mutar `S` sin `save()` después.
- ❌ Render con `innerHTML` sin escapar input del usuario (usar `he()` de `utils.js`).
- ❌ Hacer fetch a internet (rompe offline-first).
- ❌ Borrar tests sin justificación explícita.
- ❌ Cambiar `CACHE_NAME` sin avisar.
- ❌ Asumir backward-compat de schema; siempre escribir migración idempotente.

---

## 10 · Para asistentes IA (Claude Code, Cursor, Copilot)

Leer también [`CLAUDE.md`](./CLAUDE.md), que explicita expectativas de contrato. Reglas extras:

- **No hacer cambios destructivos sin pedir confirmación** (eliminar archivos, force push, reescribir historial, romper API pública).
- **Una sub-fase por sesión** según `ROADMAP.md`.
- **Tests verdes después de cada cambio** o frenar y reportar.
- **Commits sugeridos**, no auto-commits sin aprobación humana.

---

## 11 · ¿Tenés dudas?

Abrir issue con el contexto suficiente: qué intentaste hacer, qué esperabas, qué pasó. La app es chica, las dudas se resuelven rápido.

¡Gracias por aportar! 🙌
