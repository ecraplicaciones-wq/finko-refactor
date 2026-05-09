# 04 · Roadmap de Ejecución — Plano de Ejecución Maestro

> **Coordinador:** Senior Full-Stack Architect
> **Fecha:** 2026-05-06
> **Modo de uso:** este documento es el **manual operativo** que vos (o Claude Code / OpenCode) seguís paso a paso para ejecutar la transformación. Cada fase es **commit-able y reversible**.

---

## 0 · Cómo leer este documento

Cada **Fase** está dividida en **Tareas atómicas** con la siguiente estructura:

```
[Tx.y] Título corto
  Objetivo:    qué se logra
  Archivos:    qué tocás
  Pasos:       1, 2, 3 ejecutables
  Verificación: cómo sabés que quedó bien
  Commit:      mensaje sugerido
  Rollback:    cómo deshacés
  Esfuerzo:    minutos estimados
  Depende de:  tareas previas
```

> **Regla absoluta:** un commit por tarea. `npm test` antes de cada commit. Si una tarea rompe algo, `git revert <hash>` y se reintenta. Sin atajos.

---

## 1 · Vista de pájaro — las 5 fases

| Fase | Nombre | Duración estimada | Output |
|---|---|---:|---|
| **Fase 0** | Pre-flight (red de seguridad) | 1.5 h | CI verde, baseline medido, branch protegido |
| **Fase 1** | Limpieza ortodóncica | 4 h | Repo poda muertos, README real, CHANGELOG |
| **Fase 2** | Refactor estructural | 16 h | 4 archivos gigantes partidos en carpetas-fachada |
| **Fase 3** | Modernización UI/UX | 24 h | Bento Grid, tipografía nueva, sistema nudges, A11y AA |
| **Fase 4** | Lógica financiera ampliada | 15 h | Detectores legales, distribución de prima, cesantías |
| **Fase 5** | Pulida y release | 4 h | Lighthouse 90+, manual del autor, v5.0.0 tag |

**Total estimado: ~64 h netas.** En sesiones de 2 h al día = **6-7 semanas**. En sesiones de 4 h = **3-4 semanas**.

---

## 2 · Mapa visual de dependencias

```
Fase 0 (pre-flight)
   │
   ├──> Fase 1 (limpieza) ────────┐
   │                               │
   ├──> Fase 2 (refactor) ────┐    │
   │           │              │    │
   │           ▼              │    │
   │       Fase 3 (UI) ◄──────┘    │
   │           │                   │
   │           ▼                   │
   │       Fase 4 (financiero) ◄──┘
   │           │
   ▼           ▼
   Fase 5 (release)
```

> Fase 1 y Fase 2 son **independientes** (limpieza no depende de refactor). Fase 3 prefiere Fase 2 hecha (porque mover archivos durante un rediseño visual genera ruido). Fase 4 puede correr en paralelo con Fase 3 si dos personas/sesiones están disponibles.

---

## 3 · FASE 0 — Pre-flight (red de seguridad)

> **Por qué primero:** sin esta fase, cualquier error de las siguientes es difícil de detectar. Es la diferencia entre cirujano con monitoreo de signos vitales y cirujano a ciegas.

### [T0.1] Verificar baseline funciona
- **Objetivo:** confirmar que la app actual abre y guarda
- **Archivos:** ninguno (solo verificación)
- **Pasos:**
  1. `npm install`
  2. `npm test` → debe pasar 100%
  3. `python -m http.server 8080` → abrir `http://localhost:8080`
  4. Crear una cuenta, registrar un gasto, recargar la página
  5. Verificar que el gasto sigue ahí
- **Verificación:** screenshot de la app funcionando + tests pasando
- **Commit:** _no aplica_
- **Esfuerzo:** 15 min

### [T0.2] Snapshot de métricas baseline
- **Objetivo:** medir el "antes" para poder comparar el "después"
- **Pasos:**
  1. Crear archivo temporal `BASELINE_METRICS.md` (no commitear)
  2. Ejecutar y guardar:
     ```bash
     # LOC totales
     wc -l index.html style.css modules/**/*.js | tail -1
     # Inline styles
     grep -c 'style="' index.html
     # window.* assignments
     grep -rc 'window\.' modules/ | sort
     # onclick attributes
     grep -rc 'onclick=' . --include="*.html" --include="*.js"
     # ARIA atributes
     grep -c 'aria-' index.html
     ```
  3. Correr Lighthouse mobile + desktop → guardar reportes en carpeta privada
- **Verificación:** archivo con números registrados
- **Esfuerzo:** 20 min

### [T0.3] Crear branch protegido
- **Objetivo:** trabajar en una rama, no en `main`
- **Pasos:**
  1. `git status` → confirmar clean
  2. `git checkout -b refactor/v5-modernizacion`
  3. `git push -u origin refactor/v5-modernizacion`
  4. (Opcional) En GitHub: configurar branch protection en `main` — requiere review + CI verde
- **Verificación:** `git branch --show-current` muestra la rama nueva
- **Esfuerzo:** 5 min

### [T0.4] Verificar CI corre en la rama
- **Objetivo:** que el push a la rama dispare workflows
- **Pasos:**
  1. Hacer un commit vacío: `git commit --allow-empty -m "ci: verify workflows trigger on refactor branch"`
  2. `git push`
  3. Ir a GitHub Actions y verificar que `test.yml` corre
- **Verificación:** workflow verde en GitHub
- **Commit:** `ci: verify workflows trigger on refactor branch`
- **Esfuerzo:** 10 min

### [T0.5] Setup local de verificación rápida
- **Objetivo:** un alias para "verificar todo" antes de cada commit
- **Pasos:**
  1. Crear `scripts/verify.sh`:
     ```bash
     #!/usr/bin/env bash
     set -e
     echo "▶ Running tests..."
     npm test
     echo "▶ Counting metrics..."
     echo "  index.html LOC: $(wc -l < index.html)"
     echo "  inline styles:  $(grep -c 'style="' index.html)"
     echo "  window.*:        $(grep -rc 'window\.' modules/ | wc -l)"
     echo "✅ Verify passed"
     ```
  2. `chmod +x scripts/verify.sh`
  3. Probar: `./scripts/verify.sh`
- **Verificación:** script imprime "Verify passed"
- **Commit:** `chore: add scripts/verify.sh helper`
- **Esfuerzo:** 15 min

> ✅ **Fase 0 completa.** Si llegaste acá, la red de seguridad está armada.

---

## 4 · FASE 1 — Limpieza ortodóncica (4 h)

> **Objetivo:** podar lo muerto, consolidar la documentación, sin tocar lógica.
> **Estrategia:** un commit por archivo borrado / movido. Imposible romper algo.

### [T1.1] Borrar duplicados y reportes vencidos
- **Archivos:**
  - `Finko_Pro_Auditoria_v5.md` (idéntico a `Finko_Pro_Auditoria_v5_Reorganizacion.md`)
  - `localhost_2026-04-20_07-30-25.report.html`
- **Pasos:**
  1. Verificar duplicado: `diff Finko_Pro_Auditoria_v5.md Finko_Pro_Auditoria_v5_Reorganizacion.md` → debe ser vacío
  2. `git rm Finko_Pro_Auditoria_v5.md`
  3. `git rm localhost_2026-04-20_07-30-25.report.html`
- **Verificación:** ambos archivos no existen
- **Commit:** `chore: borrar auditoría v5 duplicada y reporte Lighthouse vencido`
- **Esfuerzo:** 5 min

### [T1.2] Borrar docs personales del autor
- **Archivos:** `Claude_Code_Primera_Vez.md`, `DEVELOPMENT_ROUTINE.md`
- **Pasos:**
  1. `git rm Claude_Code_Primera_Vez.md DEVELOPMENT_ROUTINE.md`
- **Commit:** `chore: borrar docs personales del autor (no aplican al proyecto)`
- **Esfuerzo:** 2 min

### [T1.3] Mover script al lugar correcto
- **Archivos:** `dev-routine.sh` → `scripts/dev-routine.sh`
- **Pasos:**
  1. `mkdir -p scripts`
  2. `git mv dev-routine.sh scripts/dev-routine.sh`
- **Commit:** `chore: mover dev-routine.sh a scripts/`
- **Esfuerzo:** 3 min

### [T1.4] Crear `docs/historico/` para auditorías viejas
- **Pasos:**
  1. `mkdir -p docs/historico`
  2. `git mv Finko_Pro_Auditoria_v5_Reorganizacion.md docs/historico/`
  3. `git mv Finko_Pro_Claude_Code_Plan.md docs/historico/`
- **Commit:** `chore: archivar auditorías históricas en docs/historico/`
- **Esfuerzo:** 5 min

### [T1.5] Crear `README.md` real (fusionando QUICK_START)
- **Objetivo:** un README profesional como punto de entrada
- **Pasos:**
  1. Leer `QUICK_START.md` y `CLAUDE.md` para extraer el contenido
  2. Crear nuevo `README.md` con secciones:
     - Tagline (1 línea): "PWA de finanzas personales para Colombia, 100% local, sin cuentas, offline-first"
     - Qué hace
     - Capturas o link a demo
     - Stack
     - Setup local (los 4 comandos del package.json)
     - Estructura del proyecto (alto nivel)
     - Documentación detallada (links a los 4 planos)
     - Licencia
  3. `git rm QUICK_START.md`
- **Verificación:** abrir el `README.md` en GitHub muestra bien
- **Commit:** `docs: crear README.md unificando QUICK_START`
- **Esfuerzo:** 45 min

### [T1.6] Limpiar `CLAUDE.md` (sacar "Known Bugs" ya resueltos)
- **Pasos:**
  1. Editar `CLAUDE.md`
  2. Borrar la sección "## Known Bugs (Pre-Refactor)" — bugs A y B ya están resueltos
  3. Verificar el resto sigue siendo correcto (paths, comandos)
- **Commit:** `docs(claude): limpiar sección de bugs ya resueltos`
- **Esfuerzo:** 10 min

### [T1.7] Crear `CHANGELOG.md` (extraer de cabecera SW)
- **Objetivo:** mover los 300+ líneas de changelog del SW a un archivo dedicado
- **Pasos:**
  1. Crear `CHANGELOG.md` con encabezado y formato Keep-a-Changelog
  2. Copiar las descripciones v6→v37 de `service-worker.js` (líneas 14-300)
  3. Reformatear como secciones por versión: Added / Changed / Fixed
  4. En `service-worker.js`: dejar solo "Ver `CHANGELOG.md` para historial completo" + el bloque de install/activate
- **Verificación:** `npm test` sigue verde
- **Commit:** `docs: extraer changelog del service worker a CHANGELOG.md`
- **Esfuerzo:** 1.5 h

### [T1.8] Crear `CONTRIBUTING.md`
- **Objetivo:** convenciones del proyecto explícitas
- **Pasos:**
  1. Crear `CONTRIBUTING.md` con secciones:
     - Filosofía: vanilla JS, no frameworks, offline-first, lenguaje colombiano
     - Convenciones de naming (ver Plano 01 §5.1)
     - Estructura interna por módulo (ver Plano 01 §5.2)
     - Reglas de oro (ver Plano 01 §5.3)
     - Cómo agregar una constante financiera
     - Cómo agregar un detector
     - Cómo agregar una acción `data-action`
     - Cómo bumpear `service-worker.js::CACHE_NAME`
     - Ritual trimestral: actualizar `TASA_USURA_EA`
     - Ritual anual: actualizar `SMMLV_*`, `UVT_*`, `VENCEN_EN`
- **Commit:** `docs: agregar CONTRIBUTING.md con convenciones del proyecto`
- **Esfuerzo:** 45 min

### [T1.9] Borrar comentario obsoleto en `events.js`
- **Archivo:** `modules/ui/events.js`
- **Pasos:**
  1. Buscar la línea `// _initCalculadoras() eliminada — ver sections.js::_cargarCalculadoras()`
  2. Borrarla (la función ya no existe, el comentario es ruido)
- **Verificación:** `npm test` verde
- **Commit:** `chore(events): borrar comentario obsoleto sobre _initCalculadoras`
- **Esfuerzo:** 2 min

> ✅ **Fase 1 completa.** El repo ahora tiene `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md` reales, sin docs muertos, ni comentarios fósiles.

---

## 5 · FASE 2 — Refactor estructural (16 h)

> **Objetivo:** partir los 4 archivos gigantes en carpetas-fachada **sin cambiar la API pública**.
> **Estrategia:** carpeta + `index.js` re-exporta — los `import` externos no cambian.

### [T2.1] Migración de `analisis.js` a carpeta-fachada (R1)

#### [T2.1.1] Crear estructura de carpeta
- **Pasos:**
  1. `mkdir -p modules/dominio/analisis/detectores`
  2. Crear `modules/dominio/analisis/index.js` vacío con `// re-exports`
- **Verificación:** carpeta existe
- **Esfuerzo:** 5 min

#### [T2.1.2] Mover funciones de rachas
- **Origen:** `modules/dominio/analisis.js` (las funciones `calcularRachaHormiga`, `calcularRachaAhorro`)
- **Destino:** `modules/dominio/analisis/rachas.js`
- **Pasos:**
  1. Crear `analisis/rachas.js` con las 2 funciones movidas + sus imports
  2. En `analisis/index.js`: `export { calcularRachaHormiga, calcularRachaAhorro } from './rachas.js';`
  3. Borrar las funciones del `analisis.js` viejo
  4. **NO** mover el archivo viejo todavía
- **Verificación:** `npm test` — los tests de rachas siguen pasando
- **Commit:** `refactor(analisis): extraer rachas.js`
- **Esfuerzo:** 30 min

#### [T2.1.3] Mover detectores agrupados (4 archivos)
- **Estructura objetivo:**
  - `analisis/detectores/atrasos.js` — `detectarFijosSinPagar`, `detectarMesesSinCerrar`, `detectarDeudasDurmiendo`
  - `analisis/detectores/comportamiento.js` — `detectarHormigaAcumulada`, `detectarObjetivosSinProgreso`, `detectarBolsillosOlvidados`, `detectarBolsillosEnFuga`
  - `analisis/detectores/integridad.js` — `validarSaldosCoherentes`, `calcularRebalanceoBolsillos`, `detectarDuplicadoGasto`, `detectarGastoAtipico`
  - `analisis/detectores/proyeccion.js` — `predecirFinQuincena`, `calcularTendencias`, `calcularComparacionCategorias`, `detectarPatronGastoSemanal`, `calcularProyeccionFondo`
- **Pasos** (repetir 4 veces, una por archivo):
  1. Crear archivo destino con las funciones + imports
  2. En `analisis/index.js`: re-exportar
  3. Borrar del `analisis.js` viejo
  4. `npm test`
  5. Commit incremental
- **Commits sugeridos:**
  - `refactor(analisis): extraer detectores/atrasos.js`
  - `refactor(analisis): extraer detectores/comportamiento.js`
  - `refactor(analisis): extraer detectores/integridad.js`
  - `refactor(analisis): extraer detectores/proyeccion.js`
- **Esfuerzo:** 2 h (4×30 min)

#### [T2.1.4] Mover salud financiera y alertas
- **Destino:** `analisis/salud.js`, `analisis/alertas.js`
- **Pasos:**
  1. Mover `calcularSaludFinanciera`, `calcularChecklistSalud` → `salud.js`
  2. Mover `detectarAlertasUrgentes`, `detectarAlertasFinancieras` → `alertas.js`
  3. Re-exportar
- **Commits:**
  - `refactor(analisis): extraer salud.js`
  - `refactor(analisis): extraer alertas.js`
- **Esfuerzo:** 45 min

#### [T2.1.5] Mover renders al final
- **Destino:** `analisis/render.js` (lo que toca DOM: `renderStats`, `renderLogros`, `renderRachaWidget`, `evaluarLogros`)
- **Pasos:** mover, re-exportar, `npm test`
- **Commit:** `refactor(analisis): extraer render.js`
- **Esfuerzo:** 30 min

#### [T2.1.6] Borrar `analisis.js` viejo y actualizar consumidores
- **Pasos:**
  1. Verificar que `analisis.js` quedó vacío (todo migrado)
  2. `git rm modules/dominio/analisis.js`
  3. Buscar consumidores: `grep -rn "from '../dominio/analisis.js'" modules/`
  4. Cambiar a `from '../dominio/analisis/index.js'` (o omitir el `/index.js` si bundler lo permite)
  5. Actualizar `service-worker.js::PRECACHE_ASSETS` con los nuevos paths
  6. **Bumpear `CACHE_NAME`** de `finko-pro-v37` → `finko-pro-v38`
- **Verificación:**
  - `npm test` ✅
  - Recargar manual en browser → la app abre, los detectores funcionan
- **Commit:** `refactor(analisis): completar migración a carpeta-fachada (R1)`
- **Esfuerzo:** 45 min

> ✅ **Sub-fase R1 completa.** `analisis.js` (2849 LOC) → 8 archivos < 500 LOC cada uno.

### [T2.2] Migración de `compromisos.js` (R2) — mismo patrón

- **Estructura objetivo:**
  ```
  compromisos/
  ├─ index.js
  ├─ deudas/
  │  ├─ index.js
  │  ├─ estrategias.js     (ordenarDeudas, calcularCuotaSugerida, planAtaqueDeuda)
  │  ├─ mora.js            (calcularDiasMora, clasificarMora, clasificarCargaDeuda)
  │  └─ tiempo.js          (calcularTiempoRestanteDeuda)
  ├─ fijos/
  │  ├─ index.js
  │  └─ logica.js          (lógica pura periodicidad/pagadoEn)
  ├─ agenda/
  │  └─ calendario.js
  └─ render.js             (todos los render*)
  ```
- **Pasos:** repetir el patrón T2.1.1 → T2.1.6
- **Commits:** uno por sub-extracción
- **Esfuerzo:** 3 h
- **Bumpear:** `CACHE_NAME` → `v39`

### [T2.3] Migración de `ingresos.js` (R3)
- **Estructura objetivo:**
  ```
  ingresos/
  ├─ index.js
  ├─ gastos/
  │  ├─ logica.js           (agregarGasto pure parts, validaciones, dedup)
  │  └─ render.js           (renderGastos, abrirEditarGasto)
  ├─ dashboard/
  │  ├─ index.js
  │  └─ render.js           (updateDash + sub-renders por nudge)
  ├─ resumen/
  │  └─ render.js           (mostrarResumenQuincena, generarConsejo)
  └─ historial/
     └─ archivado.js        (cerrarQ, renderHistorial)
  ```
- **Esfuerzo:** 3 h

### [T2.4] Migración de `tesoreria.js` (R4)
- **Estructura objetivo:**
  ```
  tesoreria/
  ├─ index.js
  ├─ cuentas.js            (guardarCuenta, delCuenta, render*Cuentas, BANCOS_CO ops)
  ├─ fondo.js              (calcularFondoEmergencia, registrarAbonoFondo, calcularProyeccionFondo)
  └─ bolsillos.js          (CRUD bolsillos, plato libre, rebalanceo)
  ```
- **Esfuerzo:** 2 h

### [T2.5] Migrar window.* restantes a data-action
- **Objetivo:** bajar de 378 → < 80 `window.*` en módulos
- **Pasos:**
  1. `grep -rn "window\." modules/dominio/ | wc -l` → medir punto de partida
  2. Por cada `window.X = X` en módulos, buscar quién la llama:
     - Si la llama HTML estático → cambiar `onclick="X()"` por `data-action="X"` y `registerAction('X', ...)`
     - Si la llama HTML dinámico (innerHTML) → migrar el template a `data-action`
     - Si la llama otro módulo → cambiar a `import` directo
  3. Borrar la asignación `window.X = X`
- **Verificación:** después de cada módulo, `npm test` + smoke test manual
- **Commits:** uno por módulo migrado
  - `refactor(tesoreria): migrar 12 window.* a data-action`
  - `refactor(ingresos): migrar 18 window.* a data-action`
  - `refactor(compromisos): migrar 11 window.* a data-action`
  - `refactor(metas): migrar 10 window.* a data-action`
- **Esfuerzo:** 4 h (~1h por módulo)

> ✅ **Fase 2 completa.** El proyecto pasa de 4 archivos gigantes a una estructura modular con archivos < 500 LOC, y de 378 `window.*` a < 80.

---

## 6 · FASE 3 — Modernización UI/UX (24 h)

> **Objetivo:** aplicar el Plano 02 — Bento Grid, tipografía, sistema de nudges, A11y AA.
> **Estrategia:** comenzar por tokens (afecta todo), luego layout, luego componentes, luego microcopy.

### [T3.1] Tokens y tipografía nueva (3 h)

#### [T3.1.1] Cargar Geist como display
- **Archivos:** `index.html`, `style.css`
- **Pasos:**
  1. En `<head>` de `index.html`, agregar al link de Google Fonts:
     `&family=Geist:wght@500;700;800` (siempre que `Inter` siga estando)
  2. En `style.css :root`: agregar `--ff-display: 'Geist', var(--ff);`
  3. Crear clase `.display { font-family: var(--ff-display); }`
- **Verificación:** abrir browser, network tab muestra Geist cargada
- **Commit:** `feat(typography): agregar Geist como display font`
- **Esfuerzo:** 30 min

#### [T3.1.2] Escala tipográfica armónica
- **Archivo:** `style.css`
- **Pasos:**
  1. Agregar tokens `--text-2xs` a `--text-4xl` (ver Plano 02 §2.3)
  2. Agregar tokens de pesos `--w-*`
  3. Agregar tokens de line-height `--lh-*`
  4. **No** reemplazar todos los `font-size:Xpx` aún — eso viene gradual
- **Commit:** `feat(typography): tokens de escala 8pt y line-heights`
- **Esfuerzo:** 30 min

#### [T3.1.3] Refinar paleta + light theme completo
- **Archivo:** `style.css`
- **Pasos:**
  1. Aplicar cambios sugeridos en Plano 02 §3.2 a tokens dark
  2. Agregar el bloque completo `body.light-theme { ... }` con tokens light (Plano 02 §3.2)
  3. Verificar que `body.light-theme` activa al togglear tema
- **Verificación:**
  1. Toggle tema → cambia paleta
  2. Probar contraste en zonas críticas
- **Commit:** `feat(theme): refinar dark + completar light theme`
- **Esfuerzo:** 1 h

#### [T3.1.4] Number formatting + tabular-nums
- **Pasos:**
  1. En `style.css`, agregar a `.mono`, `.ui-val`, `.ui-val-*`:
     ```css
     font-variant-numeric: tabular-nums;
     font-feature-settings: 'tnum' 1;
     ```
- **Commit:** `feat(typography): tabular-nums en cifras monetarias`
- **Esfuerzo:** 5 min

#### [T3.1.5] Aplicar `.display` a títulos clave
- **Archivo:** `index.html`
- **Pasos:**
  1. Agregar `class="display"` a:
     - El número héroe del Dashboard (`#d-tot`)
     - Títulos H1 de cada sección (`.st`)
     - Score de salud financiera
- **Commit:** `feat(typography): aplicar font display a títulos clave`
- **Esfuerzo:** 30 min

#### [T3.1.6] Smoke test visual
- **Pasos:** abrir cada sección, verificar que tipografías cargan, no hay FOUT visible
- **Esfuerzo:** 15 min

### [T3.2] Bento Grid en desktop (3 h)

#### [T3.2.1] CSS del sistema Bento
- **Archivo:** `style.css`
- **Pasos:**
  1. Dentro de `@layer layout`, agregar el bloque `.bento` y `.bento-*` (ver Plano 02 §4.3)
  2. Agregar media queries tablet (8-col) y mobile (stack)
- **Commit:** `feat(layout): sistema Bento Grid CSS`
- **Esfuerzo:** 1 h

#### [T3.2.2] Migrar Dashboard a Bento
- **Archivo:** `index.html`
- **Pasos:**
  1. Identificar las cards del `<section id="sec-dash">`
  2. Envolver con `<div class="bento">`
  3. Agregar `bento-hero|kpi-tall|kpi-wide|kpi|pill|list` a cada card según importancia
  4. Verificar visualmente en desktop y mobile
- **Commit:** `feat(dashboard): migrar a Bento Grid`
- **Esfuerzo:** 1.5 h

#### [T3.2.3] Animación de entrada (cascada)
- **Archivo:** `style.css`
- **Pasos:**
  1. Agregar el `@keyframes bentoIn` con `prefers-reduced-motion: no-preference` guard
  2. Aplicar `nth-child` con delays escalonados (Plano 02 §5.4)
- **Commit:** `feat(motion): animación cascada al entrar al dashboard`
- **Esfuerzo:** 30 min

### [T3.3] Sistema de nudges (4 h)

#### [T3.3.1] CSS de `.nudge`
- **Archivo:** `style.css`
- **Pasos:** agregar el bloque `.nudge`, `.nudge-{critical|high|medium|info|success}` (Plano 02 §6.3)
- **Commit:** `feat(ui): sistema de tarjetas .nudge con 5 niveles`
- **Esfuerzo:** 45 min

#### [T3.3.2] Migrar nudges existentes al sistema
- **Archivos:** `modules/dominio/analisis/render.js` + sub-archivos de detectores
- **Pasos:**
  1. Identificar las funciones `_renderXNudge` que generan HTML inline
  2. Cambiar a usar la estructura `.nudge` con clase de nivel apropiado
  3. Mapear cada detector → su nivel (ver Plano 02 §6.2)
- **Commits:** uno por familia de nudges
  - `refactor(nudges): migrar atrasos al sistema unificado`
  - `refactor(nudges): migrar comportamiento al sistema unificado`
  - `refactor(nudges): migrar proyección al sistema unificado`
- **Esfuerzo:** 2 h

#### [T3.3.3] Reescribir microcopy
- **Pasos:**
  1. Tomar la tabla de "Antes/Después" del Plano 02 §6.4
  2. Buscar en cada detector el texto actual
  3. Reemplazar con la versión cálida + accionable
- **Commit:** `style(microcopy): reescribir mensajes de nudges con tono cálido`
- **Esfuerzo:** 1.5 h

### [T3.4] Empty states (1.5 h)

#### [T3.4.1] CSS `.empty-state`
- **Archivo:** `style.css`
- **Pasos:** agregar bloque (Plano 02 §9.2)
- **Commit:** `feat(ui): clase .empty-state`
- **Esfuerzo:** 15 min

#### [T3.4.2] Migrar 6 secciones (cuentas, gastos, objetivos, deudas, inversiones, bolsillos)
- **Pasos:** por cada sección, encontrar el "empty state" actual y reemplazar con la propuesta del Plano 02 §9.1
- **Commit:** `style(empty): empty states cálidos en 6 secciones`
- **Esfuerzo:** 1.25 h

### [T3.5] Onboarding wizard (4 h)

#### [T3.5.1] Diseñar 3 modales del wizard
- **Archivo:** `index.html`
- **Pasos:**
  1. Crear `<div class="modal-ov" id="onb-ov">` con secuencia de 3 paneles
  2. Estructura por panel: header + body con form + footer con botones
- **Commit:** `feat(onb): estructura HTML del wizard de onboarding`
- **Esfuerzo:** 1 h

#### [T3.5.2] Lógica del wizard
- **Archivo:** `modules/ui/onboarding.js` (nuevo)
- **Pasos:**
  1. `abrirWizard()`, `siguientePaso()`, `pasoAnterior()`, `cerrarWizard()`
  2. Al cerrar: setear `S.onboardingCompleto = true`, `save()`, `renderAll()`
- **Commit:** `feat(onb): lógica del wizard de onboarding`
- **Esfuerzo:** 1.5 h

#### [T3.5.3] Trigger en `_initUI`
- **Archivo:** `modules/ui/events.js`
- **Pasos:**
  1. Después de `loadData()`: si `!S.onboardingCompleto`, llamar `abrirWizard()`
- **Commit:** `feat(onb): mostrar wizard en primer arranque`
- **Esfuerzo:** 30 min

#### [T3.5.4] Migración para usuarios existentes
- **Archivo:** `modules/core/storage.js`
- **Pasos:**
  1. En migrar(): `if (v < 8) { d.onboardingCompleto = true; v = 8; }` — usuarios con datos no ven el wizard
  2. Bumpear `CURRENT_VERSION` a 8
- **Commit:** `feat(storage): migración v8 — onboardingCompleto = true para usuarios existentes`
- **Esfuerzo:** 30 min

### [T3.6] Microinteracción "logro desbloqueado" (2 h)

- **Archivos:** `modules/dominio/analisis/render.js`, `style.css`
- **Pasos:**
  1. Agregar función `celebrarLogro(logro)` (ver Plano 02 §8.3)
  2. CSS de `.logro-toast` + animación de entrada/salida
  3. Confetti CSS-only (~30 spans, ~80 LOC CSS)
  4. Llamar `celebrarLogro` desde `evaluarLogros` cuando detecta nuevo
- **Commit:** `feat(ui): celebración visual de logro desbloqueado`
- **Esfuerzo:** 2 h

### [T3.7] Accesibilidad — auditoría y fixes (4 h)

#### [T3.7.1] Auditoría con axe-core
- **Pasos:**
  1. Cargar axe-core en consola del browser:
     `await import('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js')`
  2. `axe.run().then(r => console.log(r.violations))`
  3. Documentar las violations en `docs/a11y-baseline.md`
- **Esfuerzo:** 30 min

#### [T3.7.2] Top 10 fixes priorizados
- **Pasos:** atacar las 10 violations más frecuentes (probable: `aria-label` faltantes, contrastes light, role en algunos divs interactivos)
- **Commits:** uno cada 2-3 fixes
- **Esfuerzo:** 2 h

#### [T3.7.3] Day-picker accesible por teclado
- **Archivo:** `modules/ui/shell.js`
- **Pasos:**
  1. Cambiar `<div>` del day-picker a `role="grid"` con `role="gridcell"` por día
  2. Manejo de teclado: ←/→ avanza día, ↑/↓ avanza semana, Home/End primera/última
  3. Trap focus dentro del picker mientras está abierto
- **Commit:** `a11y(day-picker): navegación por teclado completa`
- **Esfuerzo:** 1.5 h

### [T3.8] Light theme final review (1 h)

- **Pasos:**
  1. Toggle a light → recorrer todas las secciones
  2. Documentar contrastes problemáticos
  3. Ajustar tokens hasta pasar Lighthouse Accessibility ≥ 95 en light
- **Commit:** `style(theme): ajustes finales de contraste light theme`
- **Esfuerzo:** 1 h

> ✅ **Fase 3 completa.** UI moderna, accesible, con personalidad.

---

## 7 · FASE 4 — Lógica financiera ampliada (15 h)

> Implementa los gaps del Plano 03. Cada acción es independiente — se pueden hacer en cualquier orden.

### [T4.1] Auto-actualización trimestral de tasa de usura
- **Archivo:** `modules/core/constants.js`
- **Pasos:** ver Plano 03 §1.3 — array `USURA_TRIMESTRES_2026` + helper + warning
- **Commit:** `feat(legal): tasa de usura por trimestre con auto-fallback`
- **Esfuerzo:** 1 h

### [T4.2] Helpers `smmlvVigente` / `uvtVigente`
- **Archivo:** `modules/core/constants.js`
- **Pasos:** ver Plano 03 §1.3
- **Commit:** `feat(legal): helpers SMMLV/UVT por año`
- **Esfuerzo:** 30 min

### [T4.3] `planAtaqueDeuda` — distribuir bala por estrategia
- **Archivo:** `modules/dominio/compromisos/deudas/estrategias.js`
- **Pasos:**
  1. Implementar la función pura (Plano 03 §2.3)
  2. Tests unitarios (caso avalancha, bola, sin excedente)
  3. Render en card del Dashboard "🎯 Tu próxima victoria"
- **Commit:** `feat(deudas): planAtaqueDeuda + tarjeta dashboard`
- **Esfuerzo:** 3 h

### [T4.4] Bloqueo legal de deudas con tasa > usura
- **Archivos:** `modules/dominio/compromisos/deudas/render.js`
- **Pasos:**
  1. En el handler de `guardarDeuda`, si `tasa > tasaUsuraVigente()`, mostrar modal con Plano 03 §2.4
  2. Botón "Registrar a 24.36% (legal)" → ajusta tasa al máximo legal
  3. Botón "Cancelar" → no guarda
- **Commit:** `feat(legal): bloquear registro de deudas con tasa de usura`
- **Esfuerzo:** 1 h

### [T4.5] Detector de mora inminente
- **Archivo:** `modules/dominio/analisis/detectores/atrasos.js`
- **Pasos:**
  1. Función `detectarMoraInminente` (Plano 03 §5.3)
  2. Tests unitarios
  3. Render como `nudge-critical` en Dashboard
- **Commit:** `feat(detector): mora inminente (5 días antes de Datacrédito)`
- **Esfuerzo:** 2 h

### [T4.6] Modal educativo "¿Qué es Datacrédito?"
- **Archivos:** `index.html`, `modules/ui/events.js`
- **Pasos:** modal estático con el contenido del Plano 03 §5.4
- **Commit:** `feat(educa): modal explicativo de Datacrédito`
- **Esfuerzo:** 1 h

### [T4.7] GMF: acumulado mensual de cuenta exenta
- **Archivos:** `modules/dominio/tesoreria/cuentas.js`, `core/storage.js` (migración)
- **Pasos:**
  1. Migración v9: agregar `cuentaExentaGMF`, `acumuladoExentoMes`, `mesAcumulado` a cuentas
  2. Helper `calcularGMFSobreRetiro` (Plano 03 §6.2)
  3. UI: checkbox "Cuenta exenta del 4×1000" en modal editar cuenta (validar solo una)
- **Commit:** `feat(legal): GMF con acumulado mensual de cuenta exenta`
- **Esfuerzo:** 2 h

### [T4.8] Distribución sugerida de prima
- **Archivos:** `modules/calculadoras.js`
- **Pasos:**
  1. Después de `guardarPrima`, abrir modal con distribución sugerida (Plano 03 §7.3)
  2. Permitir personalizar % o aceptar default
  3. Al aceptar: ejecutar movimientos (abonar fondo, abonar deuda, abonar bolsillo, registrar inversión)
- **Commit:** `feat(prima): distribución inteligente sugerida`
- **Esfuerzo:** 2 h

### [T4.9] Recordatorio prima 30 días antes
- **Archivo:** `modules/dominio/analisis/detectores/calendario.js` (nuevo)
- **Pasos:**
  1. `detectarPrimaProxima` (Plano 03 §7.4)
  2. Render banner azul con CTA "Hacer plan de prima"
- **Commit:** `feat(detector): recordatorio prima 30 días antes`
- **Esfuerzo:** 1 h

### [T4.10] Calculadora de cesantías
- **Archivos:** `modules/calculadoras.js`, `index.html`
- **Pasos:**
  1. Función `calcularCesantias` (Plano 03 §8.3)
  2. UI dentro de la sección Plan
  3. Modal educativo "¿Para qué sirven mis cesantías?" (Plano 03 §8.4)
- **Commit:** `feat(calc): calculadora de cesantías + educación`
- **Esfuerzo:** 2 h

### [T4.11] Detector umbral DIAN
- **Archivo:** `modules/dominio/analisis/detectores/tributario.js` (nuevo)
- **Pasos:**
  1. Función `detectarUmbralDIAN` (Plano 03 §10.3)
  2. Render condicional según nivel
- **Commit:** `feat(detector): umbral DIAN para declarar renta`
- **Esfuerzo:** 1.5 h

### [T4.12] Toggle "soy independiente" + recordatorio aportes
- **Archivos:** `modules/dominio/analisis/detectores/calendario.js`, `state.js`
- **Pasos:**
  1. Migración v10: agregar `S.tipoEmpleo` (`empleado`|`independiente`|`mixto`)
  2. UI: toggle en el menú "Más"
  3. Detector: si `independiente|mixto` y día > 15 sin marcar "PILA pagada", mostrar nudge
- **Commit:** `feat(legal): recordatorio aportes salud+pensión independientes`
- **Esfuerzo:** 2 h

### [T4.13] Tabla de amortización en modal de deuda
- **Archivo:** `modules/dominio/compromisos/deudas/render.js`
- **Pasos:**
  1. Función `generarTablaAmortizacion` (Plano 03 §4.3)
  2. Botón en el modal de detalle de deuda → abre tabla con scroll
- **Commit:** `feat(deudas): tabla de amortización mes a mes`
- **Esfuerzo:** 2 h

> ✅ **Fase 4 completa.** Finko Pro ya cubre los principales puntos de la legislación financiera colombiana con coaching activo.

---

## 8 · FASE 5 — Pulida y release (4 h)

### [T5.1] Lighthouse audit final
- **Pasos:**
  1. Correr Lighthouse mobile + desktop
  2. Comparar contra baseline de T0.2
  3. Atacar lo que esté por debajo del target (Performance ≥90, A11y ≥95)
- **Commit:** uno por fix
- **Esfuerzo:** 1.5 h

### [T5.2] Smoke test exhaustivo manual
- **Pasos:**
  1. Recorrer todos los flujos:
     - Crear cuenta → registrar gasto → cerrar quincena → ver resumen
     - Crear deuda → pagar cuota → marcar liquidada
     - Crear objetivo → abonar → ver progreso
     - Crear bolsillo → mover plata → rebalancear
     - Toggle dark/light en cada sección
     - Probar Ctrl+Z después de un reset
     - Probar exportar JSON / CSV / HTML
     - Recargar app después de offline
  2. Documentar bugs en `docs/release-notes.md`
- **Esfuerzo:** 1 h

### [T5.3] Bumpear `service-worker.js::CACHE_NAME` a v40
- **Archivo:** `service-worker.js`
- **Pasos:** un valor nuevo, agregar línea al CHANGELOG
- **Commit:** `chore(sw): bump CACHE_NAME a v40 — release v5.0`
- **Esfuerzo:** 5 min

### [T5.4] Bumpear `package.json::version` a `5.0.0`
- **Archivo:** `package.json`
- **Pasos:** `4.2.0` → `5.0.0`
- **Commit:** `chore(release): v5.0.0`
- **Esfuerzo:** 2 min

### [T5.5] CHANGELOG entry para v5.0
- **Archivo:** `CHANGELOG.md`
- **Pasos:** agregar sección `## [5.0.0] - 2026-XX-XX` con resumen de las 4 fases
- **Commit:** `docs(changelog): entry de v5.0.0`
- **Esfuerzo:** 30 min

### [T5.6] Tag y push
- **Pasos:**
  1. `git tag -a v5.0.0 -m "Release v5.0.0 — refactor estructural + UI/UX moderno + lógica legal ampliada"`
  2. `git push origin v5.0.0`
  3. Crear PR `refactor/v5-modernizacion` → `main`, esperar CI verde, merge
- **Esfuerzo:** 30 min

> ✅ **Fase 5 completa.** v5.0.0 desplegada.

---

## 9 · Reglas de oro durante toda la ejecución

### 9.1 Disciplina de commits
1. **Un commit por tarea.** Si una tarea se siente grande, partila en sub-tareas.
2. **`npm test` verde antes de cada commit.** Sin excepciones.
3. **Mensaje de commit:** `tipo(scope): descripción corta` (Conventional Commits).
   - `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `a11y`, `test`
4. **Al terminar una sub-fase grande** (ej: T2.1 completo), hacer un commit "epic" sin cambios:
   ```bash
   git commit --allow-empty -m "milestone: T2.1 analisis.js migrado a carpeta-fachada"
   ```

### 9.2 Disciplina de Service Worker
1. **Cualquier tarea que cree, mueva o renombre archivos JS/CSS** → bumpear `CACHE_NAME` (`v37` → `v38` → ...).
2. **Actualizar `PRECACHE_ASSETS`** con los nuevos paths.
3. **Probar en una pestaña incógnita** que la app carga 100% offline después del cambio.

### 9.3 Disciplina de tests
1. Cada función pura nueva → test unitario.
2. Cada migración de schema (`_migrar` en storage.js) → test que verifique idempotencia.
3. Si un test falla por "implementación detail" (ej: orden de propiedades) y no por bug → corregir el test, no romperlo.

### 9.4 Disciplina de A11y
1. Cada elemento interactivo nuevo → `aria-label` o texto visible.
2. Cada modal nuevo → `role="dialog"` + `aria-modal="true"` + focus trap.
3. Cada cambio de estado importante → anunciar con `sr()`.

### 9.5 Disciplina de microcopy
1. Mensajes en colombiano natural, **nunca como banco**.
2. Cada error explica **qué hacer**, no solo qué pasó.
3. Cada nudge tiene 3 partes: **qué** + **por qué importa en plata** + **qué hacer**.

### 9.6 Disciplina de "no romper users existentes"
1. Cada cambio de schema → migración idempotente en `_migrar`.
2. Bumpear `CURRENT_VERSION` solo si la migración es no-trivial.
3. Probar manualmente con datos reales antes de cada PR final.

---

## 10 · Checkpoints de calidad

Después de cada fase, verificar **todos** estos puntos:

### Checkpoint Fase 0 → 1
- [ ] CI verde en la rama
- [ ] `npm test` 100% pasando
- [ ] Baseline metrics archivado
- [ ] App carga y funciona en localhost

### Checkpoint Fase 1 → 2
- [ ] Solo `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md` y los 4 planos en raíz
- [ ] `docs/historico/` con auditorías viejas
- [ ] `npm test` 100%
- [ ] No hay docs huérfanos

### Checkpoint Fase 2 → 3
- [ ] Ningún archivo > 500 LOC en `modules/dominio/*`
- [ ] `npm test` 100% (los tests existentes deben seguir pasando con los nuevos paths)
- [ ] `window.*` count < 80
- [ ] Service worker bumped + offline funciona

### Checkpoint Fase 3 → 4
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse Performance ≥ 88
- [ ] Bento Grid funciona en desktop, mobile, tablet
- [ ] Light theme y dark theme se ven bien
- [ ] Onboarding wizard arranca para usuarios nuevos

### Checkpoint Fase 4 → 5
- [ ] Todos los detectores nuevos tienen tests
- [ ] Tasa de usura, SMMLV, UVT son auto-fallback
- [ ] Modal de Datacrédito accesible
- [ ] Calculadora de cesantías presente
- [ ] Toggle "soy independiente" funciona

### Checkpoint Fase 5 → Release
- [ ] CHANGELOG.md con entry v5.0.0
- [ ] package.json en 5.0.0
- [ ] Tag v5.0.0 creado
- [ ] PR mergeado a main
- [ ] Demo desplegada (Vercel) funciona

---

## 11 · Plan B — qué hacer si algo se rompe

### "El refactor de un dominio rompió tests"
- **Síntoma:** `npm test` falla en `tests/unit/<dominio>.test.js`
- **Acción:**
  1. `git revert <hash-de-la-tarea>` — vuelve al estado pre-refactor
  2. Identificar qué función no se exportó
  3. Re-aplicar la tarea con la corrección
  4. Volver a commitear

### "Service worker sirve versión vieja"
- **Síntoma:** después de un cambio, los usuarios ven el código viejo
- **Acción:**
  1. Verificar que `CACHE_NAME` se bumpeó
  2. En DevTools → Application → Storage → Clear site data
  3. Recargar; debe pedir nuevas versiones
  4. Si el problema persiste: `unregister` el SW y refrescar

### "Lighthouse cae después de un cambio"
- **Síntoma:** score baja vs baseline
- **Acción:**
  1. Identificar la métrica afectada (LCP, CLS, etc.)
  2. Comparar con baseline T0.2 — qué cambió
  3. Si es por una imagen nueva: optimizar
  4. Si es por JS: verificar que el módulo no carga en sync sin necesidad

### "Tarea muy grande, no se puede partir más"
- **Síntoma:** la tarea T2.1.X excede 1 h y no se ve fin
- **Acción:**
  1. **Pausar.** Hacer commit "WIP" con lo hecho.
  2. Releer Plano 02 / 03 — confirmar que el alcance no creció.
  3. Partir la tarea en sub-tareas más finas.
  4. Continuar.

### "Conflicto al mergear con `main`"
- **Síntoma:** `git pull main` muestra conflictos
- **Acción:**
  1. **Nunca** `git push --force` a `main`.
  2. Resolver conflictos en local.
  3. Si el conflicto es en un archivo que se borró en la rama: aceptar la versión de la rama.
  4. Re-correr `npm test` después de resolver.

---

## 12 · Estimación realista — calendario sugerido

### Sesiones de 4 h (×16 sesiones = 4 semanas)

| Semana | Sesión 1 (lun) | Sesión 2 (mié) | Sesión 3 (vie) | Sesión 4 (sáb) |
|---|---|---|---|---|
| **1** | T0.1-T0.5 + T1.1-T1.5 | T1.6-T1.9 | T2.1.1-T2.1.4 | T2.1.5-T2.1.6 |
| **2** | T2.2 (compromisos) | T2.3 (ingresos) | T2.4 (tesoreria) | T2.5 (window→data-action) |
| **3** | T3.1 + T3.2 | T3.3 (nudges) | T3.4 + T3.5 onboarding | T3.6 + T3.7 a11y |
| **4** | T3.7 + T3.8 | T4.1-T4.6 | T4.7-T4.13 | T5.1-T5.6 release |

### Sesiones de 2 h (×32 sesiones = 6-8 semanas)

Mismo plan, partido a la mitad por sesión. Más realista para un solo desarrollador con día laboral.

---

## 13 · Plantilla de prompt para Claude Code / OpenCode

> Cuando uses Claude Code para ejecutar las tareas, podés enviarle prompts del tipo:

```
Estoy ejecutando el roadmap del Plano 04 de Finko Pro.
Tarea actual: [Tx.y] Título de la tarea.

Contexto previo: [pegar bullets de las tareas previas completadas]

Pasos a ejecutar:
1. ...
2. ...
3. ...

Verificación esperada:
- [criterio 1]
- [criterio 2]

Por favor:
1. Ejecutá los pasos.
2. Antes de commitear, mostrame el diff y esperá mi OK.
3. Después de mi OK: `npm test`, commiteá con el mensaje sugerido, y pasá a la siguiente.
4. Si algún test falla: parar y mostrarme el output.
```

Esta plantilla mantiene a Claude **disciplinado**: ejecuta una tarea, espera review, commitea, sigue.

---

## 14 · Cierre

Este roadmap convierte un proyecto bueno (Finko Pro v4.2 actual) en uno excelente (v5.0):

| Métrica | Antes (medido) | Después (objetivo) |
|---|---:|---:|
| LOC promedio por archivo dominio | 1 410 | < 400 |
| `style="..."` inline en HTML | 341 | < 60 |
| `window.*` total | 378 | < 80 |
| Archivos `.md` raíz | 9 | 5 |
| Lighthouse Accessibility | ~85 | ≥ 95 |
| Lighthouse Performance | ~85 | ≥ 90 |
| Detectores legales/financieros | 35 | 41 (+6 nuevos) |
| Auto-actualización constantes legales | Manual anual | Trimestral con fallback |
| Onboarding | ❌ | ✅ Wizard 3 pasos |
| Bento Grid | ❌ | ✅ Dashboard moderno |

**El secreto:** disciplina por tarea, commits chiquitos, tests verdes siempre, y la red de seguridad (Fase 0) que captura cualquier desliz antes de que se vuelva costoso.

> **Tip final del mentor:** no apurés. Una tarea bien hecha hoy ahorra 5 tareas mal hechas la semana que viene. Y celebrá cada checkpoint — cuatro semanas de disciplina merecen, mínimo, un café bueno.

— *Fin del Plano 04 · Fin del set de planos.*
— *Próximo paso: revisarlos juntos y arrancar con la Fase 0.*