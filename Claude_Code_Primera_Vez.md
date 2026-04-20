# 🚀 Claude Code paso a paso — Tu primera vez

> Para Esteban (Windows + Finko Pro). Asume que nunca abriste Claude Code antes.
> Tiempo total estimado: **30 a 45 minutos** desde cero hasta tu primer commit hecho con Claude.

---

## Parte A — Antes de instalar (5 min)

### A.1 ¿Qué es Claude Code?

Es **Claude trabajando dentro de tu terminal**. Te ayuda a:

- Leer archivos de tu proyecto y entender qué hace tu código.
- Editar, crear y borrar archivos por vos.
- Correr comandos (`npm test`, `git commit`, etc.) con tu permiso.
- Hacer refactors grandes que vos dirigís.

A diferencia del chat web, **vive dentro de tu carpeta** y puede tocar archivos de verdad. Por eso tiene un sistema de permisos: te pide confirmación antes de cada acción importante.

### A.2 Requisitos en Windows

- **Windows 10 o 11** con permisos para instalar software.
- **Git para Windows**. Si no lo tenés: descargalo de https://git-scm.com/download/win e instalalo con la configuración por defecto.
- **Node.js** ya lo tenés (Finko usa Vitest), perfecto.
- **Suscripción Claude Pro o Max** (o una API key de Anthropic con saldo). El plan gratuito no incluye Claude Code.

### A.3 ¿Qué terminal usar?

Mejor opción: **Windows Terminal** (gratis en Microsoft Store). Soporta colores, emojis y se lleva bien con Claude Code.
Segunda opción: **Git Bash** (se instala junto con Git).
Evitá: el viejo CMD de Windows — tiene problemas con caracteres especiales.

---

## Parte B — Instalación (10 min)

### B.1 Descargar e instalar

1. Abrí tu navegador y andá a **https://code.claude.com**.
2. Buscá el botón de descarga para Windows (instalador nativo). Es el método recomendado y se actualiza solo.
3. Ejecutá el instalador `.exe` descargado.
4. Si te pregunta por Git, asegurate de tenerlo instalado primero (paso A.2).
5. El instalador deja el ejecutable `claude` disponible en tu sistema.

### B.2 Verificar que quedó bien

Abrí **Windows Terminal** o **Git Bash** y escribí:

```bash
claude --version
```

Debería mostrarte algo como `claude-code 1.x.x`. Si dice "comando no encontrado":

- Reiniciá la terminal (a veces no toma el PATH hasta que cerrás y abrís de nuevo).
- Si sigue sin funcionar, agregá `C:\Users\USUARIO\.local\bin` al PATH de Windows:
  1. Tecla Windows → escribí "variables de entorno" → abrí "Editar las variables de entorno del sistema".
  2. Botón "Variables de entorno" → en la sección de tu usuario, doble click en `Path`.
  3. "Nuevo" → pegá `C:\Users\USUARIO\.local\bin` → Aceptar todo.
  4. Cerrá y volvé a abrir la terminal.

---

## Parte C — Primer arranque y login (5 min)

### C.1 Abrir Claude Code

Andá a la carpeta de Finko Pro:

```bash
cd C:\ruta\a\finko-pro
```

(Reemplazá `C:\ruta\a\finko-pro` con la ruta real de tu proyecto.)

Una vez dentro, ejecutá:

```bash
claude
```

### C.2 Login

La primera vez te abre el navegador automáticamente para que inicies sesión con tu cuenta de Anthropic. Iniciá sesión normal, autorizá el acceso, volvé a la terminal — listo, queda autenticado.

> Si tenés API key en vez de suscripción, podés exportarla antes de arrancar:
> ```bash
> setx ANTHROPIC_API_KEY "tu-api-key"
> ```
> Cerrá la terminal y volvé a abrirla para que tome el cambio.

### C.3 La pantalla que vas a ver

Una vez adentro, ves un cursor parpadeando esperando que escribas. Eso es todo. **Es como un chat**, pero todo lo que escribas lo lee Claude con acceso a tu carpeta.

Probá un primer mensaje sencillo:

```text
Listame los archivos de la carpeta modules y decime cuántas líneas tiene cada uno.
```

Claude va a pedirte permiso para correr `ls` o `wc`. Aceptá. Vas a ver el resultado y ya estás trabajando con Claude Code.

---

## Parte D — Comandos esenciales que necesitás conocer (5 min)

Dentro de Claude Code, los **comandos slash** se escriben con `/` al principio:

| Comando | Para qué sirve |
|---|---|
| `/help` | Te muestra todos los comandos disponibles. Útil cuando no recordás algo. |
| `/model` | Cambia el modelo (Sonnet, Opus, Haiku). Te muestra un menú interactivo. |
| `/init` | Le dice a Claude que escanee tu proyecto y cree un `CLAUDE.md` con notas que va a usar siempre. **Hacelo una vez al inicio.** |
| `/clear` | Borra el historial de la conversación actual. Útil cuando cambiás de tarea o sentís que Claude se está confundiendo. |
| `/resume` | Retoma una conversación anterior. |
| `/permissions` | Configura qué cosas puede hacer Claude sin pedirte permiso cada vez. |
| `/status` | Te muestra qué modelo está activo y si estás logueado. |
| `Ctrl + C` | Cancela una operación en curso (si Claude se quedó pensando demasiado). |
| `Ctrl + D` o `/exit` | Sale de Claude Code. |

### D.1 Cambiar el modelo paso a paso

1. Escribí `/model` y Enter.
2. Aparece una lista: Haiku, Sonnet, Opus.
3. Movete con flechas y Enter para elegir.
4. Vas a ver "Modelo cambiado a X" — listo.

Para Finko (según el plan que armamos):

- **Fase 0** (apagar bugs): elegí **Haiku 4.5**.
- **Fases 1, 3, 4**: elegí **Sonnet 4.6**.
- **Fase 2** (reorganización grande): elegí **Opus 4.6**.

### D.2 Configurar permisos para no aprobar cada cosa

Por defecto Claude te pide permiso para cada `Edit`, `Write`, `Bash`. Después del tercer "sí" cansa.

Opción cómoda y segura: escribí `/permissions` y agregá reglas. Por ejemplo:

- `Edit(modules/**)` → "allow" → no te va a preguntar más al editar archivos en `modules/`.
- `Bash(npm test)` → "allow" → no te pregunta cada vez que corre los tests.
- `Bash(git *)` → dejalo en "ask" → mejor confirmar cada acción de git.

Las reglas quedan guardadas en `.claude/settings.json` dentro de tu proyecto.

> ⚠️ **No uses `--dangerously-skip-permissions`** como principiante. Suena tentador pero te puede borrar archivos sin avisar.

---

## Parte E — Tu primera sesión real con Finko (10 min)

Vamos a hacer la **Fase 0 del plan** — apagar los dos bugs bloqueantes — para que veas el flujo completo.

### E.1 Preparar el proyecto

En la terminal, antes de abrir Claude Code:

```bash
cd C:\ruta\a\finko-pro
git checkout -b refactor/v5-reorganizacion
git status
```

Verificá que estás en una rama nueva y limpia. Después abrí Claude Code:

```bash
claude
```

### E.2 Inicializar el contexto del proyecto (sólo la primera vez)

Dentro de Claude Code, escribí:

```text
/init
```

Claude va a leer tu proyecto y crear un archivo `CLAUDE.md` con un resumen de qué hace, cómo está estructurado, qué scripts tenés. Aceptá los cambios. Este archivo lo lee Claude **cada vez que arrancás** una sesión nueva, así no tenés que explicarle todo de cero.

### E.3 Elegir modelo para Fase 0

```text
/model
```

Elegí **Haiku 4.5** (suficiente para 2 bugs simples, rápido y económico).

### E.4 Pegar el contexto del proyecto

Pegá el **Prompt 0** del archivo `Finko_Pro_Claude_Code_Plan.md` (el que empieza con "Sos un Co-Desarrollador Senior trabajando en Finko Pro…"). Claude va a responder algo como "Entendido, listo para Fase 0".

### E.5 Pegar el prompt de Fase 0

Ahora pegá el **Prompt 1 — Fase 0** del mismo plan. Claude va a:

1. Pedirte permiso para leer `modules/storage.js` → aceptá.
2. Mostrarte el archivo y explicarte qué encontró.
3. Pedirte permiso para editar el archivo → revisá el diff y aceptá si se ve bien.
4. Repetir con `modules/events.js`.
5. Pedirte permiso para correr `npm test` → aceptá.
6. Mostrarte el resultado.
7. Pedirte permiso para hacer commit → aceptá.

### E.6 Verificar que todo funcionó

Salí de Claude Code (`/exit`) y en la terminal:

```bash
git log --oneline
```

Deberías ver tu primer commit hecho con Claude Code:
`fix: bloqueantes de carga (save duplicada, refs zombi a calculadoras)`

¡Felicitaciones! Ya hiciste tu primera sesión real con Claude Code. 🎉

---

## Parte F — Trucos para que la experiencia sea mejor

### F.1 Lecturas rápidas vs cambios grandes

- Si querés que Claude **sólo lea** y no toque nada: aclarale en el mensaje "no edites nada, sólo decime qué encontrás".
- Si querés que Claude **planifique antes de actuar** en un cambio grande: pedile "primero hacé un plan detallado y mostrámelo, no edites archivos hasta que yo apruebe".

### F.2 Cuando Claude se confunde

A veces, en sesiones largas, Claude empieza a "olvidar" o repetir cosas. Solución:

1. `/clear` para limpiar el historial.
2. Pegá de nuevo el Prompt 0 (contexto del proyecto).
3. Pegá el prompt de la fase actual.

### F.3 Si algo se rompió feo

```bash
git status              # ver qué cambió
git diff                # ver los cambios sin commit
git restore archivo.js  # descartar cambios de un archivo
git reset --hard HEAD   # ⚠️ descarta TODO lo no comiteado
git reset --hard pre-refactor-v5  # vuelve al tag de respaldo
```

Por eso la Fase 1 incluye crear el tag `pre-refactor-v5` antes de la Fase 2 — es tu red de seguridad.

### F.4 Hooks útiles (avanzado, opcional)

Cuando ya estés cómodo, podés crear `.claude/settings.json` para que Claude corra los tests automáticamente después de cada edición:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "npm test --silent" }]
    }]
  }
}
```

Así, si Claude rompe algo, te enterás al instante en vez de descubrirlo media hora después.

### F.5 Costos

Claude Code consume tokens según el modelo y el tamaño de los archivos que lee. Tips para ahorrar:

- Usá Haiku para tareas chicas y mecánicas.
- No le pegues archivos enteros si Claude puede leerlos con `Read` — es más eficiente.
- `/clear` entre fases libera contexto y baja el costo de los siguientes mensajes.
- Si tenés Pro o Max, tenés un límite mensual generoso. Si pasás del límite, te avisa.

---

## Parte G — Resumen visual del flujo completo

```
┌────────────────────────────────────────────────────────────┐
│  1. Instalar Claude Code (instalador nativo)              │
│  2. cd a la carpeta de Finko Pro                           │
│  3. git checkout -b refactor/v5-reorganizacion             │
│  4. claude                                                 │
│  5. /init  → genera CLAUDE.md                              │
│  6. /model → elegir Haiku para Fase 0                      │
│  7. Pegar Prompt 0 (contexto)                              │
│  8. Pegar Prompt 1 (Fase 0)                                │
│  9. Aprobar cambios uno por uno                            │
│ 10. Verificar con git log que quedó el commit              │
│                                                            │
│ Para la siguiente fase:                                    │
│ 11. /model → cambiar a Sonnet (o Opus para Fase 2)         │
│ 12. /clear (opcional, para empezar limpio)                 │
│ 13. Pegar Prompt 0 + Prompt N de la fase                   │
│ 14. Repetir                                                │
└────────────────────────────────────────────────────────────┘
```

---

## Parte H — Glosario rápido

- **Slash command**: comando que empieza con `/`, ejecutado por Claude Code (no por la shell).
- **Prompt**: mensaje en lenguaje natural que vos le escribís a Claude.
- **Tool / Herramienta**: acción que Claude pide hacer (Read, Edit, Bash). Te pide permiso para usarla.
- **Subagent**: un Claude más pequeño que se lanza para una tarea específica (Explore, Plan, etc.). No los necesitás para empezar.
- **MCP**: protocolo para conectar Claude a apps externas (GitHub, Slack, etc.). Más adelante.
- **CLAUDE.md**: archivo que Claude lee al iniciar cada sesión para entender tu proyecto.

---

## Próximo paso

Ahora mismo:

1. Instalá Claude Code (Parte B).
2. Hacé el primer login (Parte C).
3. Probá la **Fase 0** con Haiku siguiendo la Parte E.

Cuando termines la Fase 0 y veas que la app vuelve a abrir, ya estás listo para Fase 1 (limpieza + tests + a11y) con Sonnet, siguiendo el mismo flujo del plan que armamos antes.

Si en algún paso te trabás, decime qué pasó y te ayudo a desbloquear.

— Listo para empezar 🚀
