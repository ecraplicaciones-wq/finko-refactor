# 🛠️ Finko Pro — Plan de ejecución en Claude Code

> Basado en: `Finko_Pro_Auditoria_v5_Reorganizacion.md`
> Destino: ejecutar la auditoría usando **Claude Code** (CLI).
> Estrategia: **un modelo por fase** para optimizar costo y calidad.

---

## 1. ¿Qué modelo usar?

Claude Code deja cambiar de modelo con `/model`. La recomendación por fase:

| Fase | Tipo de trabajo | Modelo recomendado | Por qué |
|---|---|---|---|
| **Fase 0** — Bugs bloqueantes | 2 ediciones puntuales, 7 minutos | **Haiku 4.5** | Cambios triviales y bien localizados. Rápido y barato. |
| **Fase 1** — Limpieza + tests + a11y top 10 | Correcciones dispersas, leer varios archivos | **Sonnet 4.6** | Mejor relación calidad/costo para refactor de código normal. |
| **Fase 2** — Reorganización física (28→13 archivos) | Refactor arquitectónico grande, muchas decisiones | **Opus 4.6** | Es la fase más delicada: mover módulos sin romper imports, respetando `S` global y `window.*`. Vale la pena el modelo más fuerte. |
| **Fase 3** — Migración a `data-action` | Trabajo sistemático repetitivo | **Sonnet 4.6** | Patrón claro, ejecutable en lotes. |
| **Fase 4** — Feature work (backup automático, Web Components, etc.) | Diseño + código | **Sonnet 4.6** (o **Opus** si es arquitectónico) | Depende de la feature. |

> **Si sólo podés elegir un modelo para todo el refactor:** andate con **Sonnet 4.6**. Cubre el 90% del trabajo bien y barato. Sólo subí a Opus en Fase 2 si sentís que Sonnet está tomando decisiones dudosas sobre la estructura de carpetas.

---

## 2. Preparación (una sola vez)

Antes de pegar el primer prompt, dejá el proyecto listo:

```bash
# 1. Clonar o abrir el repo en el directorio de Finko
cd ruta/a/finko-pro

# 2. Crear rama de trabajo — NO trabajar en main
git checkout -b refactor/v5-reorganizacion

# 3. Asegurarse de que los tests existentes corran
npm install
npm test

# 4. Abrir Claude Code en esa carpeta
claude
```

Dentro de Claude Code, como **primer mensaje** del chat, pegá el **Prompt 0** (de abajo). Le da contexto y reglas del proyecto para toda la sesión.

---

## 3. Prompts por fase

### Prompt 0 — Contexto del proyecto (pegá esto primero)

```text
Sos un Co-Desarrollador Senior trabajando en Finko Pro, una app web de finanzas personales en Colombia (v4.2.0). Stack: vanilla JS con ES Modules, sin build step, PWA, 28 módulos en /modules, estado global S con localStorage, tests con Vitest + happy-dom.

REGLAS DEL PROYECTO (no negociables):
1. ADN colombiano: todo texto visible para el usuario en español colombiano cálido. Nada de tecnicismos bancarios secos.
2. Accesibilidad WCAG 2.1: todo elemento interactivo nuevo con aria-label. Anunciar cambios importantes con sr().
3. Persistencia: cualquier cambio en S debe llamar save() (con debounce).
4. Arquitectura: respetar la estructura de módulos. No introducir dependencias nuevas sin avisarme.
5. Iconos: sistema de símbolos SVG.

REGLAS DE TRABAJO:
- Antes de editar un archivo, leélo completo para no perder contexto.
- Después de cada cambio significativo, corré npm test y mostrame el resultado.
- Commits atómicos con mensajes descriptivos en español: `fix:`, `refactor:`, `feat:`, `chore:`, `test:`.
- Si una decisión afecta varios archivos, explicame el plan ANTES de ejecutar.
- Nunca borres historial de git ni hagás force push.

Tengo un reporte de auditoría en `Finko_Pro_Auditoria_v5_Reorganizacion.md` (si no está en el repo, te lo paso). Vamos a ejecutarlo por fases. Cuando te diga "Fase N", seguís el plan de esa fase paso a paso, confirmando commits conmigo.

¿Listo? Empezamos con Fase 0.
```

---

### Prompt 1 — Fase 0: apagar los dos incendios

```text
FASE 0 — Bugs bloqueantes (la app no carga hoy).

Hacé exactamente esto, en este orden:

BUG A — storage.js tiene dos `export function save()` declaradas (líneas ~200 y ~232).
- Abrí modules/storage.js
- Borrá la versión vieja (la que NO tiene debounce, la primera de las dos).
- Conservá la versión con `_savePendiente` y `_saveTimer`.
- Verificá que `_flushSave` y las funciones auxiliares queden intactas.

BUG B — events.js tiene referencias a funciones no importadas (líneas ~206–217).
- Abrí modules/events.js
- Borrá todo el bloque `// calculadoras` que asigna window.cCDT, window.cCre, window.cIC, window.cMeta, window.cMetaAporte, window.cPila, window.cInf, window.cR72, window.toggleCalc, window.calcPrima, window.guardarPrima.
- Las calculadoras se cargan lazy desde sections.js, ya está bien así.

Después:
1. Mostrame un diff resumido de los dos archivos.
2. Corré `npm test`.
3. Abrí manualmente mentalmente el flujo: si alguien hace `import { save } from './storage.js'` ¿qué obtiene? ¿Y si alguien llama `window.cCDT` desde un onclick del HTML?
4. Si hay onclick="cCDT(...)" en index.html que apuntan a window.cCDT, identificá en qué sección están y avisame (puede que necesiten eager-load o un listener específico).
5. Cuando todo esté verde, commit: `fix: bloqueantes de carga (save duplicada, refs zombi a calculadoras)`.

No avances a Fase 1 sin mi confirmación.
```

---

### Prompt 2 — Fase 1: limpieza + tests + accesibilidad top 10

```text
FASE 1 — Saneamiento básico.

Ejecutá estos ítems como tareas separadas (commit por tarea):

1. DUPLICACIÓN updateBadge
   - Buscá todas las definiciones de `updateBadge` (debería estar en render.js y ui-components.js).
   - Dejá UNA sola en render.js. Borrá la de ui-components.js.
   - Asegurate que ui-components.js la importe si la usa.
   - Commit: `refactor: unificar updateBadge en render.js`.

2. he() ESCAPA APÓSTROFES
   - Abrí modules/utils.js, buscá la función `he()`.
   - Agregá el reemplazo de `'` a `&#39;`.
   - Agregá un test en tests/unit/utils.test.js que verifique los 5 caracteres: <, >, &, ", '.
   - Commit: `fix: he() escapa apóstrofes para evitar romper aria-label`.

3. TESTS DE MIGRACIONES
   - Mirá modules/storage.js y la lógica de migraciones.
   - Creá tests/unit/migrations.test.js con al menos 3 casos:
     a) Estado v3 → v4 (lo que haya cambiado).
     b) Estado v4 → v5.
     c) Estado sin _version (legacy) → CURRENT_VERSION.
   - Mockeá S con estructuras representativas.
   - Commit: `test: cubrir migraciones v3→v4→v5`.

4. ACCESIBILIDAD TOP 10
   - Corré `npx lighthouse --only-categories=accessibility --quiet --chrome-flags="--headless" file://$(pwd)/index.html` (o abrilo manual con Lighthouse en Chrome).
   - Mostrame las top 10 violaciones.
   - Arreglá las 10, una por una, commit por cada una o agrupadas si son el mismo tipo.
   - Enfoque: contrastes, aria-label faltantes en botones ícono, labels en inputs.

5. BACKUP DE SEGURIDAD ANTES DE FASE 2
   - `git tag pre-refactor-v5`
   - Empujá el tag: `git push origin pre-refactor-v5`.

Al terminar, mostrame un resumen: qué se corrigió, qué tests se agregaron, qué score de accesibilidad quedó. Esperá confirmación antes de Fase 2.
```

---

### Prompt 3 — Fase 2: reorganización de carpetas (aquí es donde subo a Opus)

```text
FASE 2 — Reorganización física: 28 archivos → 13 archivos en /modules.

IMPORTANTE: esta es la fase más delicada. Trabajá en PASOS, no en un solo commit gigante. Entre pasos, corré tests y verificá que la app abre.

ESTRUCTURA OBJETIVO:
modules/
├─ core/
│  ├─ state.js
│  ├─ constants.js
│  └─ storage.js
├─ infra/
│  ├─ utils.js
│  ├─ render.js
│  └─ a11y.js          (extraer sr() y focus traps de utils.js)
├─ ui/
│  ├─ shell.js         (sections.js + ui-components.js fusionados)
│  └─ events.js
├─ dominio/
│  ├─ tesoreria.js     (cuentas + fondo + ahorrado)
│  ├─ compromisos.js   (fijos + agenda + deudas)
│  ├─ ingresos.js      (gastos + dashboard + resumen + historial)
│  ├─ metas.js         (objetivos + inversiones)
│  ├─ analisis.js      (stats + logros)
│  └─ exports.js
└─ calculadoras.js

PROCESO OBLIGATORIO:

PASO A — Crear carpetas y mover sin fusionar aún.
- Creá core/, infra/, ui/, dominio/ en modules/.
- Movimiento 1 a 1, actualizando rutas de imports.
- Corré `npm test` después de cada archivo movido.
- Si algo se rompe, revertí ese movimiento y avisame.
- Commit al final del PASO A: `refactor: reorganizar modules en core/infra/ui/dominio (sin fusión)`.

PASO B — Fusionar dominio/tesoreria.js.
- Copiar contenido de cuentas.js + fondo.js + ahorrado.js a un nuevo tesoreria.js.
- Estructura interna:
  // === API PÚBLICA ===
  // === LÓGICA PURA (testeable, sin DOM) ===
  // === ADAPTADORES UI ===
- Exports: los mismos que los 3 archivos tenían, para no romper events.js.
- Actualizar events.js para importar todo desde tesoreria.js.
- Borrar los 3 archivos viejos.
- Correr tests + smoke test manual (abrir la app, agregar cuenta, crear bolsillo, ver fondo).
- Commit: `refactor: fusionar cuentas + fondo + ahorrado en tesoreria.js`.

PASO C — Fusionar dominio/compromisos.js (fijos + agenda + deudas). Mismo patrón.

PASO D — Fusionar dominio/ingresos.js (gastos + dashboard + resumen + historial). Mismo patrón. Este es el más grande, tené paciencia.

PASO E — Fusionar dominio/metas.js (objetivos + inversiones).

PASO F — Fusionar dominio/analisis.js (stats + logros).

PASO G — Fusionar ui/shell.js (sections + ui-components).

Después de cada PASO, PARÁ y mostrame:
- Archivos tocados
- Resultado de npm test
- Tamaño del archivo nuevo vs la suma de los viejos

Esperá mi OK antes del siguiente PASO. No te adelantes.
```

---

### Prompt 4 — Fase 3: migrar onclick → data-action

```text
FASE 3 — Eliminar los 142 onclick="" inline del HTML y reducir las 277 asignaciones a window.*.

ESTRATEGIA:
- Crear un único listener en ui/events.js que escuche clicks a nivel document.
- Cada botón con lógica usa data-action="nombreAccion" y, si necesita argumentos, data-arg-*.
- El listener mapea data-action → función (importada localmente, ya no en window).

PASO A — Crear el sistema de delegación.
- En ui/events.js, definí:
  const ACTIONS = new Map();
  export function registerAction(name, fn) { ACTIONS.set(name, fn); }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const fn = ACTIONS.get(action);
    if (!fn) return console.warn('Acción no registrada:', action);
    const args = extractArgs(el.dataset); // data-arg-* → objeto
    fn(args, el, e);
  });
- Cada módulo de dominio llama registerAction('agregarGasto', agregarGasto) en su init.
- Commit: `feat: sistema de delegación con data-action`.

PASO B — Migrar por pantalla, una por una.
- Empezá con dashboard (menos botones).
- En index.html, los <button onclick="agregarGasto()"> se vuelven <button data-action="agregarGasto">.
- Borrá la asignación correspondiente de window.agregarGasto = agregarGasto.
- Si el onclick tenía argumentos (onclick="delGasto(3)"), usar data-action="delGasto" data-arg-id="3".
- Correr npm test + smoke test manual.
- Commit: `refactor: migrar dashboard a data-action`.

PASO C — Repetir para las otras 6 pantallas.

PASO D — Auditoría final.
- Buscar en todo el proyecto: `grep -rn "onclick=" index.html` → debería dar 0.
- Buscar: `grep -rn "window\." modules/` → debería dar <30 (sólo window.addEventListener y similares legítimos).
- Actualizar el reporte de auditoría con los nuevos números.
- Commit: `docs: actualizar métricas post-migración a data-action`.

Si en algún momento un onclick no se puede migrar limpio (por ejemplo porque es un onsubmit o onchange complejo), pausás y me preguntás.
```

---

### Prompt 5 — Fase 4: features de mentor (opcional pero muy recomendado)

```text
FASE 4 — Mejoras de producto que sugiere la auditoría.

Implementá estas 4 features, cada una en su propio commit/PR:

1. BACKUP AUTOMÁTICO ROTATIVO
   - En core/storage.js, agregar función `snapshotDiario()` que:
     a) Corre al arranque si `lastSnapshot` > 24h atrás.
     b) Copia S a localStorage['finko_backup_' + timestamp].
     c) Mantiene máximo 3 backups, borra el más viejo.
   - Agregar en dashboard un botón "Restaurar desde respaldo" (con showConfirm).
   - Commit: `feat: backup automático rotativo en localStorage`.

2. RECORDATORIO DE EXPORT
   - Si pasaron 30+ días sin exportar (trackear lastExport en S), mostrar banner cálido:
     "🛡️ Hace un mes no bajás un respaldo de tu plata. ¿Te lo genero ahorita?"
   - Con botón "Bajar respaldo" y "Recordame en 7 días".
   - Commit: `feat: recordatorio amigable de export cada 30 días`.

3. TOP 3 HORMIGAS DE LA QUINCENA
   - En analisis.js (antes stats), calcular las 3 categorías de gasto hormiga más altas.
   - Mostrarlas como card en dashboard con emojis:
     "Tus 3 hormiguitas de esta quincena: ☕ Café $X, 🚕 Uber $Y, 📱 Datos $Z"
   - Incluir mensaje mentor: "Si bajás estas 3 a la mitad, te ahorrás $Z al mes."
   - Commit: `feat: top 3 hormigas visibles en dashboard`.

4. COMPARACIÓN VS QUINCENA PASADA
   - En dashboard, al lado del total gastado, mostrar `+12% vs la pasada 📈` o `-8% vs la pasada 📉`.
   - Color: rojo si subió, verde si bajó.
   - Sacar el dato de historial.js (ya lo tiene).
   - Commit: `feat: comparación vs quincena anterior en dashboard`.

Cada feature debe respetar el tono colombiano cálido. Cada texto largo pasámelo antes de pegarlo en el código para yo aprobarlo.
```

---

## 4. Flujo recomendado en Claude Code

Paso a paso:

1. **Abrí terminal** en la carpeta del proyecto y escribí `claude`.
2. **Fijá el modelo** para la fase que vas a correr. Al iniciar, escribí `/model` y elegí:
   - Haiku para Fase 0.
   - Sonnet para Fases 1, 3, 4.
   - Opus para Fase 2.
3. **Pegá el Prompt 0** (contexto) como primer mensaje.
4. **Pegá el Prompt N** de la fase correspondiente.
5. Claude Code **te va a pedir aprobación** para cada edición de archivo (o podés usar `/permissions` para confiar permanentemente en una ruta). Revisá los diffs antes de aceptar.
6. Al finalizar cada fase, **verificá con `git log --oneline`** que los commits quedaron atómicos y con mensajes claros.
7. **Cambiá de modelo** (`/model`) al pasar de fase si corresponde.
8. Entre Fase 2 y Fase 3, hacé **push de la rama** a GitHub para tener respaldo remoto:
   ```bash
   git push origin refactor/v5-reorganizacion
   ```

---

## 5. Consejos prácticos

- **Contexto limitado.** Claude Code mantiene contexto por sesión. Si sentís que se confundió, `/clear` y volvé a pegar Prompt 0 + el prompt de la fase actual.
- **Agentes especializados.** Claude Code soporta subagents. Si querés ir más estructurado:
  - `Explore` para escanear el código antes de refactorizar.
  - `Plan` para que te muestre el plan ANTES de ejecutar cambios grandes.
- **Hooks útiles.** En `.claude/settings.json` podés agregar un `PostToolUse` que corra `npm test` automáticamente tras cada edición:
  ```json
  {
    "hooks": {
      "PostToolUse": [{
        "matcher": "Edit|Write",
        "hooks": [{"type": "command", "command": "npm test --silent"}]
      }]
    }
  }
  ```
- **Escape hatch.** Si un refactor se rompe feo: `git reset --hard pre-refactor-v5` te devuelve al tag que creamos en Fase 1.
- **Costos.** Opus cuesta ~5× Sonnet. Por eso sólo lo uso para Fase 2 (la única donde las malas decisiones de arquitectura son caras). El resto lo maneja Sonnet sin problema.

---

## 6. Orden de ataque ideal (si tenés 1 semana)

- **Día 1 lunes, 1 hora:** Fase 0 con Haiku. La app vuelve a cargar.
- **Día 1 tarde, 3–4 horas:** Fase 1 con Sonnet. Tests, a11y, tag de respaldo.
- **Día 2 martes + Día 3 miércoles:** Fase 2 con Opus. Es la más larga pero la más valiosa.
- **Día 4 jueves:** Fase 3 con Sonnet. Migrar onclick.
- **Día 5 viernes:** Fase 4 con Sonnet. Features de mentor.

Al final de la semana: app más rápida, más accesible, más fácil de mantener, con 4 features nuevas visibles para el usuario.

— Fin del plan —
