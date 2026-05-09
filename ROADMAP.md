# Roadmap de Ejecución — Finko Pro v5.0

> **Versión actual:** v4.x estable.
> **Versión objetivo:** v5.0 (reorganizada, modernizada, con coaching financiero ampliado).
> **Estimación total:** **~80–110 horas** de trabajo distribuidas en 8 fases (asumiendo 5–6 h productivas/día y buffer del 25 % por imprevistos).
> **Pre‑requisito:** todos los `.md` de la nueva colección leídos y aprobados.

---

## 1 · Objetivo

Convertir Finko Pro v4.x en **v5.0** sin romper nada y sin perder ninguna funcionalidad valiosa, usando una secuencia estricta de fases con criterios de salida verificables.

Las metas concretas:

- **Estructura:** archivos < 500 LOC promedio, dominios particionados.
- **HTML:** ≤ 60 inline styles, mantener 0 `onclick`, mantener / mejorar 182 ARIA attrs.
- **CSS:** tokens completos (paleta + escala + spacing), Bento Grid, modo claro/oscuro consistente.
- **UX:** Bento Grid en desktop, empty states, microcopy unificado, onboarding.
- **Lógica financiera:** 7 gaps críticos cerrados (auto‑update usura, bloqueo tasa ilegal, mora inminente, distribución prima, plan ataque, tabla amortización, GMF acumulado, quiz, DIAN, cesantías).
- **Calidad:** Lighthouse Accessibility ≥ 95, Performance ≥ 90, axe‑core sin críticos, ≥ 90% cobertura tests.

---

## 2 · Alcance

Cubre **8 fases** organizadas para que cada una pueda ejecutarse de forma independiente con tests verdes y rollback fácil:

```
Fase 0 — Red de seguridad
Fase 1 — Limpieza documental
Fase 2 — Reorganización HTML
Fase 3 — Reorganización CSS
Fase 4 — Reorganización JavaScript
Fase 5 — UX / UI moderna
Fase 6 — Lógica financiera avanzada
Fase 7 — Verificación final + release v5.0
```

Cada fase tiene su documento de detalle correspondiente (`AUDIT.md`, `REORG_HTML.md`, etc.).

---

## 3 · Estado actual (baseline)

| Métrica | Hoy | Objetivo v5 |
|---|---:|---:|
| LOC promedio archivo dominio | 1.410 | < 500 |
| `style=""` inline en HTML | 341 | < 60 |
| `window.X = …` en `events.js` | 74 (medido) | ≤ 16 |
| `window.X = …` en todo `modules/` | 210 (medido) | < 30 |
| Archivos `.md` raíz | 11 (4 vigentes + 7 desactualizados/personales) | 12 (9 nuevos + CLAUDE + CHANGELOG + CONTRIBUTING) |
| Lighthouse Accessibility | ~85 | ≥ 95 |
| Lighthouse Performance | ~85 | ≥ 90 |
| Detectores legales / financieros | 13 | 20+ |
| Auto‑actualización constantes legales | manual anual | trimestral con fallback |
| Onboarding | ❌ | ✅ wizard 3 pasos |
| Bento Grid | ❌ | ✅ |
| Tests | 1.311 (verdes) | ≥ 1.450 |
| Cobertura lógica financiera | ~85% | ≥ 90% |

---

## 4 · Problemas detectados (resumen — detalle en `AUDIT.md`)

- **Críticos:** 4 archivos > 1.500 LOC, render acoplado al DOM, `window.*` con ~50 funciones, 341 inline styles.
- **Altos:** CRUD duplicado, detección de anomalías repetida, modales abrir/editar repetidos, tasa de usura hardcoded, `analisis.js` carga eager.
- **Medios:** documentación raíz redundante, reporte Lighthouse versionado, falta `CHANGELOG`/`CONTRIBUTING`.
- **Bajos:** algunas clases gradient sin uso, naming mixto ES/EN, falta lint config.

---

## 5 · Propuesta — 8 fases

> Cada fase tiene: pre‑requisitos, salida esperada, criterio de verificación y commit message sugerido.

### **Fase 0 — Red de Seguridad** (½ día, **OBLIGATORIA**)

**Objetivo:** garantizar que cualquier futuro refactor sea reversible y verificable.

**Salida:**

- Snapshot baseline: Lighthouse, axe‑core, métricas (LOC por archivo, % cobertura).
- `npm test` verde confirmado.
- Tag git `v4.x-baseline` creado.
- `service-worker.js` `CACHE_NAME` documentado como punto de control.
- Rama de trabajo `claude/refactor-v5` creada y protegida.

**Verificación:**
- [ ] `npm test` → 1.311 verdes.
- [ ] Tag `v4.x-baseline` existe.
- [ ] Reportes de Lighthouse y axe‑core capturados.
- [ ] Documentación de baseline en `AUDIT.md` §3 actualizada.

---

### **Fase 1 — Limpieza Documental** (¼ día)

**Objetivo:** dejar la raíz del repo con solo los `.md` profesionales.

**Acciones:**

1. Confirmar la nueva colección de 9 documentos (creada en este PR).
2. Eliminar / mover según §6 de `AUDIT.md`:
   - **ELIMINAR de raíz:**
     - `01_auditoria_y_limpieza.md` (reemplazado por `AUDIT.md`)
     - `02_ux_ui_modernizacion.md` (reemplazado por `DESIGN_SYSTEM.md`)
     - `03_logica_financiera_col.md` (reemplazado por `FINANCIAL_LOGIC_CO.md`)
     - `04_roadmap_ejecucion.md` (reemplazado por este `ROADMAP.md`)
     - `Finko_Pro_Auditoria_v5.md` (duplicado byte‑a‑byte de la versión _Reorganizacion)
     - `Claude_Code_Primera_Vez.md` (tutorial personal del autor)
     - `DEVELOPMENT_ROUTINE.md` (rutina personal del autor)
     - `QUICK_START.md` (fusionado en `README.md`)
     - `localhost_2026-04-20_07-30-25.report.html` (Lighthouse vencido)
   - **MOVER a `docs/historico/`** (preservar contexto del refactor v5):
     - `Finko_Pro_Auditoria_v5_Reorganizacion.md`
     - `Finko_Pro_Claude_Code_Plan.md`
   - **MOVER a `scripts/`:**
     - `dev-routine.sh`
3. Actualizar `CLAUDE.md`:
   - Eliminar sección "Known Bugs" (ya resueltos).
   - Agregar fecha "Última revisión".
   - Apuntar a la nueva colección de docs.
4. Crear `CHANGELOG.md` con histórico v4.x → v5.0 plan.
5. Crear `CONTRIBUTING.md` con convenciones del repo.

**Verificación:**
- [ ] Raíz contiene solo: `README.md`, `AUDIT.md`, `ARCHITECTURE.md`, `REORG_HTML.md`, `REORG_CSS.md`, `REORG_JS.md`, `DESIGN_SYSTEM.md`, `FINANCIAL_LOGIC_CO.md`, `ROADMAP.md`, `CLAUDE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`.
- [ ] `docs/historico/` contiene los 2 archivos del refactor v5 anterior.
- [ ] `scripts/dev-routine.sh` existe.
- [ ] Ningún cambio en `.html`, `.css`, `.js`.

**Commit:** `docs: limpiar raíz, nueva colección de planos, histórico en docs/`

---

### **Fase 2 — Reorganización HTML** (2–3 días)

**Documento de detalle:** `REORG_HTML.md`.

**Sub‑fases:**

| # | Sub‑fase | Tiempo |
|---|---|---|
| HTML‑1 | Mapeo y baseline (tabla inline → clase) | ½ día |
| HTML‑2 | Crear clases nuevas en CSS | ½ día |
| HTML‑3 | Migrar inline styles por sección (9 secciones) | 1–2 días |
| HTML‑4 | Migrar 20 modales a contrato uniforme | 1 día |
| HTML‑5 | Migrar HTML dinámico a `data-action` | 2 días |
| HTML‑6 | Pulido final (`<noscript>`, `lang="es-CO"`, comentarios) | ½ día |

**Verificación de salida:**
- [ ] `style=""` inline ≤ 60.
- [ ] `data-action=""` ≥ 156, `onclick=""` = 0.
- [ ] ARIA attrs ≥ 182.
- [ ] Lighthouse Accessibility ≥ 90 (mejora intermedia).
- [ ] axe‑core sin críticos.
- [ ] Validador W3C limpio.

**Commits estimados:** 12–15 (uno por sub‑fase + sección).

---

### **Fase 3 — Reorganización CSS** (1–2 días)

**Documento de detalle:** `REORG_CSS.md`.

**Sub‑fases:**

| # | Sub‑fase | Tiempo |
|---|---|---|
| CSS‑1 | Tokens y utilities (spacing + tipografía + colores) | ½ día |
| CSS‑2 | Refactor de cards genéricas (`.list-item`) | ½ día |
| CSS‑3 | Bento Grid base | ½ día |
| CSS‑4 | `prefers-reduced-motion` + a11y | ¼ día |
| CSS‑5 | Limpieza `display: none` | ½ día |
| CSS‑6 | Documentar tokens en `DESIGN_SYSTEM.md` | ¼ día |

**Verificación de salida:**
- [ ] Tokens vivos en DevTools.
- [ ] Cards consolidadas en `.list-item`.
- [ ] `.bento` y `.bento__cell--*` listos.
- [ ] `prefers-reduced-motion` global aplicado.
- [ ] Modo claro / oscuro intacto visualmente (capturas).

**Commits estimados:** 6–8.

> **Nota:** Fases 2 y 3 se solapan parcialmente — clases nuevas de CSS son prerequisito de la migración HTML. Coordinar.

---

### **Fase 4 — Reorganización JavaScript** (4–5 días)

**Documento de detalle:** `REORG_JS.md`.

**Sub‑fases:**

| # | Sub‑fase | Tiempo |
|---|---|---|
| JS‑1 | Helper `infra/crud.js` + tests | ½ día |
| JS‑2 | Partir `analisis.js` → `analisis/` (6 sub‑archivos) | 1.5 días |
| JS‑3 | Partir `compromisos.js` → `compromisos/` (3) | 1 día |
| JS‑4 | Partir `ingresos.js` → `ingresos/` (4) | 1 día |
| JS‑5 | Partir `tesoreria.js` → `tesoreria/` (3) | ½ día |
| JS‑6 | Partir `calculadoras.js` → `calculadoras/` (5) | ½ día |
| JS‑7 | Reducir `window.*` (de ~50 a ≤16) | 1 día |
| JS‑8 | EventBus expandido | ½ día |
| JS‑9 | Linter (opcional) | ¼ día |

**Verificación de salida:**
- [ ] Ningún archivo dominio > 800 LOC; mediana < 500 LOC.
- [ ] `crud.js` reusado en ≥ 5 dominios.
- [ ] `window.*` ≤ 16.
- [ ] `analisis/` carga lazy (verificable en Network).
- [ ] 1.311 tests siguen verdes.
- [ ] `service-worker.js` actualizado (lista de assets + `CACHE_NAME` bumpeado).
- [ ] `ARCHITECTURE.md` refleja nuevo árbol.

**Commits estimados:** 10–14 (uno por dominio + cleanup).

---

### **Fase 5 — UX / UI Moderna** (3–4 días)

**Documento de detalle:** `DESIGN_SYSTEM.md`.

**Sub‑fases:**

| # | Sub‑fase | Tiempo |
|---|---|---|
| UX‑1 | Aplicar Bento Grid en `#sec-dash` | 1 día |
| UX‑2 | Empty states en las 9 secciones | 1 día |
| UX‑3 | Microcopy global con glosario | ½ día |
| UX‑4 | Onboarding wizard (3 pasos) | 1 día |
| UX‑5 | Iconografía Material Symbols | ½ día |
| UX‑6 | Pulido a11y final (axe + Lighthouse) | ½ día |

**Verificación de salida:**
- [ ] Bento Grid funcional desktop + degradación móvil.
- [ ] Empty states con CTA en las 9 secciones.
- [ ] Microcopy revisado sección por sección.
- [ ] Onboarding wizard se muestra solo a usuarios nuevos (`!S.onboarded`).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] axe‑core sin issues críticos.
- [ ] Test manual con teclado completo.

**Commits estimados:** 8–12.

---

### **Fase 6 — Lógica Financiera Avanzada** (2–3 días)

**Documento de detalle:** `FINANCIAL_LOGIC_CO.md`.

**Sub‑fases:**

| # | Sub‑fase | Tiempo |
|---|---|---|
| F‑1 | Auto‑update tasa de usura (map trimestral) | 1 h |
| F‑2 | Bloqueo educativo de tasa ilegal | 2 h |
| F‑3 | Detector mora inminente (5 días) | 2 h |
| F‑4 | Distribución sugerida de prima | 2 h |
| F‑5 | `planAtaqueDeuda()` | 1.5 h |
| F‑6 | Tabla de amortización | 2 h |
| F‑7 | GMF acumulado por cuenta | 1.5 h |
| F‑8 | Quiz Avalancha vs Bola | 1.5 h |
| F‑9 | Detector umbral DIAN | 1 h |
| F‑10 | Calculadora cesantías | 1 h |

**Total:** ~15.5 h ≈ 2–3 días.

**Verificación de salida:**
- [ ] Tasa de usura auto‑actualizable sin romper offline.
- [ ] Modal educativo aparece al ingresar tasa > usura.
- [ ] Banner de mora inminente con countdown funcional.
- [ ] Modal de distribución de prima con 5 sliders.
- [ ] Tabla de amortización accesible desde detalle de deuda.
- [ ] GMF acumula correctamente con tope 350 UVT.
- [ ] Quiz aparece la primera vez con ≥ 2 deudas.
- [ ] Detector DIAN dispara al 80% del umbral.
- [ ] Calculadora cesantías agregada.
- [ ] Cobertura tests financieros ≥ 90%.

**Commits estimados:** 10 (uno por feature).

---

### **Fase 7 — Verificación Final + Release v5.0** (½ día)

**Acciones:**

1. **Smoke test manual** completo:
   - Abrir app sin datos → onboarding aparece.
   - Crear ingreso, gasto, fijo, deuda, objetivo, inversión, cuenta.
   - Cerrar quincena.
   - Probar import / export.
   - Toggle modo claro/oscuro.
   - Probar offline (DevTools → Network throttle to offline).
2. **Métricas finales:**
   - Lighthouse Accessibility ≥ 95 (target).
   - Lighthouse Performance ≥ 90 (target).
   - axe‑core 0 críticos.
   - 1.450+ tests verdes.
   - Cobertura ≥ 90%.
3. **Bumpear versiones:**
   - `manifest.json` → `1.0.0` (o lo que corresponda).
   - `package.json` → `5.0.0`.
   - `service-worker.js` → `CACHE_NAME = 'finko-pro-v50'`.
4. **Actualizar `CHANGELOG.md`** con todo lo que entró en v5.0.
5. **Tag git** `v5.0.0`.
6. **Deploy a Vercel** (si aplica).

**Verificación de salida:**
- [ ] Todas las métricas alcanzadas.
- [ ] Tag `v5.0.0` creado.
- [ ] `CHANGELOG.md` actualizado.
- [ ] Smoke test exitoso.

**Commit final:** `release: v5.0.0 — refactor + modernización + coaching financiero`.

---

## 6 · Pasos detallados — ejemplo de Fase 0

```
1. cd al repo
2. git checkout main && git pull
3. npm install
4. npm test               → debe pasar 1.311 verde
5. Capturar Lighthouse:
   - Abrir Chrome DevTools → Lighthouse → "Mobile, Accessibility + Performance"
   - Guardar HTML report en `docs/baseline/lighthouse-2026-05-07.html`
6. Capturar axe‑core:
   - npx @axe-core/cli http://localhost:8080 > docs/baseline/axe-2026-05-07.txt
7. Capturar métricas LOC:
   - find modules -name "*.js" -exec wc -l {} \; | sort -rn > docs/baseline/loc-2026-05-07.txt
8. Capturar cobertura:
   - npm run coverage > docs/baseline/coverage-2026-05-07.txt
9. git add docs/baseline
10. git commit -m "chore: capture baseline v4.x for v5 refactor"
11. git tag v4.x-baseline
12. git checkout -b claude/refactor-v5
```

---

## 7 · Plantilla de prompt para asistente IA (Claude Code, Cursor, etc.)

> Usar al iniciar cada sub‑fase para mantener al asistente disciplinado.

```
Estoy ejecutando la Fase X.Y del ROADMAP.md de Finko Pro.

Contexto:
- Lee primero ARCHITECTURE.md y AUDIT.md.
- Estamos en la Fase {nombre}, sub‑fase {nombre}.
- Documento de detalle: {REORG_HTML.md | REORG_CSS.md | REORG_JS.md | DESIGN_SYSTEM.md | FINANCIAL_LOGIC_CO.md}.

Tarea concreta de esta sesión:
{describir 1 sub‑fase, máximo 1 acción}

Reglas:
1. NO toques nada fuera del scope de esta sub‑fase.
2. Después de cada cambio, corré `npm test`.
3. Si algún test falla: parar, mostrarme el output, no improvisar.
4. Al terminar, sugerí el commit message en formato `tipo(área): descripción`.
5. NO bumpees CACHE_NAME en service-worker.js sin avisarme.
```

---

## 8 · Criterios globales de verificación

Esta tabla resume las métricas duras que deben alcanzarse para considerar v5.0 cerrada:

| Métrica | Baseline (v4.x) | Target (v5.0) | Cómo se mide |
|---|---:|---:|---|
| LOC promedio archivo dominio | 1.410 | < 500 | `find modules/dominio -name "*.js" \| xargs wc -l \| awk '{sum+=$1; n+=1} END {print sum/n}'` |
| `style=""` inline en HTML | 341 | < 60 | `grep -c 'style="' index.html` |
| `window.*` total | ~50 | ≤ 16 | `grep -c 'window\.' modules/ui/events.js` |
| Lighthouse Accessibility | ~85 | ≥ 95 | Lighthouse mobile |
| Lighthouse Performance | ~85 | ≥ 90 | Lighthouse mobile |
| axe‑core issues críticos | desconocido | 0 | `npx @axe-core/cli` |
| Tests | 1.311 | ≥ 1.450 | `npm test` |
| Cobertura lógica financiera | ~85% | ≥ 90% | `npm run coverage` |
| Detectores legales / financieros | 13 | 20+ | Conteo manual en `analisis/alertas.js` + `compromisos/deudas.js` |
| Modo oscuro / claro consistencia | ✅ | ✅ | Capturas comparativas |
| Onboarding | ❌ | ✅ | Smoke test |
| Bento Grid | ❌ | ✅ | Visual + responsive |

---

## 9 · Riesgos y mitigaciones (vista global)

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Cambiar `S` schema rompe datos existentes | Baja | Alto | Migraciones idempotentes + tests + backup automático antes de major bumps |
| Service Worker sirve cache vieja | Alta | Medio | Bumpear `CACHE_NAME` al final de cada fase mayor |
| Tests no detectan regresión visual | Media | Medio | Capturas Lighthouse antes/después por fase |
| Refactor cross‑dominio bloqueado por circular import | Baja | Alto | EventBus + helpers en `infra/` para evitar |
| Cambio de tasas legales durante el refactor | Media | Medio | Map trimestral con fallback (Fase F‑1) |
| Tiempo total subestimado | Media | Bajo | Buffer del 25% sobre estimación; permitir saltar Fases 5/6 si es necesario |
| Eliminar `.md` valioso sin querer | Baja | Alto | Mover a `docs/historico/` antes de borrar definitivamente |
| Onboarding intrusivo molesta a usuarios actuales | Media | Bajo | Solo se muestra si `!S.onboarded`; skipeable |
| Bento Grid en mobile se ve apretado | Baja | Medio | Degradación a columna explícita |

---

## 10 · Dependencias entre fases

```
Fase 0 — Red de seguridad
  ├──► Fase 1 — Limpieza documental
  ├──► Fase 2 — Reorg HTML  ◄────┐
  │     └─ requiere algunas clases de Fase 3
  ├──► Fase 3 — Reorg CSS  ──────┘  (se solapan)
  │
  ├──► Fase 4 — Reorg JS
  │     ├──► Fase 5 — UX/UI moderna
  │     └──► Fase 6 — Lógica financiera avanzada
  │
  └──► Fase 7 — Verificación + release v5.0
        (espera todas las anteriores)
```

**Notas:**

- Fases 2 y 3 son **simbióticas**. Se ejecutan juntas en pares (CSS añade clase → HTML la usa).
- Fase 4 desbloquea las Fases 5 y 6.
- Fase 5 y 6 pueden hacerse en paralelo con devs distintos.
- Fase 7 espera todo.

---

## 11 · Plan de contingencia (si el tiempo falta)

Si solo se puede entregar parte del v5.0, el orden de prioridad es:

1. **Fase 0 + Fase 1** — siempre. Sin red de seguridad y limpieza de docs no hay refactor sano.
2. **Fase 2 + 3** — siempre. Resuelven el problema más visible (inline styles).
3. **Fase 4** — siempre que haya 4+ días. Resuelve el problema más estructural.
4. **Fase 5** — si hay 3+ días extra. Mejora visual significativa.
5. **Fase 6** — si hay 2+ días extra. Coaching financiero diferencia la app.

**Versión mínima de "v5 light":** Fases 0 + 1 + 2 + 3 = ~5 días de trabajo. Resultado: app limpia, sin inline styles excesivos, con docs profesional, sin refactor de JS.

---

## 12 · Checklist final (release v5.0)

- [ ] Fase 0 completada (baseline capturada).
- [ ] Fase 1 completada (raíz limpia, `CHANGELOG` y `CONTRIBUTING` creados).
- [ ] Fase 2 completada (`style=""` ≤ 60).
- [ ] Fase 3 completada (tokens nuevos vivos).
- [ ] Fase 4 completada (dominios particionados).
- [ ] Fase 5 completada (Bento Grid + onboarding).
- [ ] Fase 6 completada (10 features financieros nuevos).
- [ ] Fase 7 completada (smoke test + métricas + tag `v5.0.0`).
- [ ] `manifest.json`, `package.json`, `service-worker.js` con versión bumpeada.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Lighthouse Performance ≥ 90.
- [ ] axe‑core sin críticos.
- [ ] 1.450+ tests verdes.
- [ ] Cobertura ≥ 90%.
- [ ] Deploy a producción exitoso.
- [ ] `CHANGELOG.md` actualizado con todo el set de cambios.

---

## 13 · Cierre

Este roadmap convierte un proyecto **bueno** (Finko Pro v4.x) en uno **excelente** (v5.0):

- **Mantenibilidad:** archivos chicos, dominios bien separados, docs explícita.
- **Identidad visual:** Bento Grid moderno + paleta refinada + microcopy unificado.
- **Coaching financiero:** 7 nuevos detectores + 3 nudges éticos + onboarding guiado.
- **Calidad técnica:** ≥ 95 a11y, ≥ 90 perf, ≥ 90% cobertura.

**El secreto:**

1. Disciplina por sub‑fase (commits chicos).
2. Tests verdes siempre.
3. Red de seguridad antes de cualquier cambio.
4. Cada fase se puede frenar y entregar parcial sin romper la app.

> **Tip final del mentor:** no apurés. Una sub‑fase bien hecha hoy ahorra cinco mal hechas la semana que viene. Y celebrá cada checkpoint — 80–110 horas de disciplina merecen, mínimo, un café de finca.

---

*Fin del roadmap — Próximo paso: revisar este set de docs juntos y arrancar con la **Fase 0**.*
