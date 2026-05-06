# 📜 Guía de Contribución - Finko Pro

> **Última actualización:** Mayo 2026
> **Versión:** 1.0.0

¡Gracias por tu interés en contribuir a Finko Pro! Este documento establece las normas y convenciones que todo desarrollador debe seguir para mantener la calidad y consistencia del proyecto.

---

## 1. Filosofía de Desarrollo

### Clean Code & Código Autodocumentado

- **Nombres descriptivos:** Funciones y variables deben usar nombres claros en español/inglés que expliquen su propósito sin necesidad de comentarios.
  - ✅ `function calcularSaldoDisponible()` 
  - ❌ `function calc()` o `function hacerAlgo()`

- **Una función, una responsabilidad:** Cada función debe hacer una sola cosa bien hecha.

- **Mínimos comentarios:** Si necesitas un comentario para explicar qué hace una función, refactoriza el nombre en lugar de comentar.

- **DRY (Don't Repeat Yourself):** Si copy-pasteas código más de 2 veces, crea una función reutilizable.

---

## 2. Arquitectura Modular

### Estructura de 6 Módulos Core

Finko Pro sigue una **Arquitectura Lean** basada en módulos independientes:

| Módulo | Responsabilidad | Regla de Oro |
| :--- | :--- | :--- |
| `main.js` | Orquestador de acciones | Punto único de entrada, mapea `data-action` |
| `state.js` | Estado global `S` + persistencia | Single Source of Truth |
| `finance.service.js` | Lógica de Gastos, Cuentas, Bolsillos | NO toca el DOM |
| `planner.service.js` | Metas, Compromisos, Análisis | NO toca el DOM |
| `tools.service.js` | Calculadoras financieras | Lógica matemática pura |
| `ui.manager.js` | Capa de Presentación | Único módulo que toca el DOM |

### Patrón de Flujo de Datos

```
UI Evento → main.js (Action) → Service (Lógica) → state.js (S) → save() → ui.manager.js (Render)
```

### Reglas de Oro para Nuevas Funcionalidades

1. **Nueva lógica de negocio** → crear función en el servicio correspondiente
2. **Nueva acción UI** → registrar en `main.js` con `registerAction()`
3. **Nuevo render** → agregar función en `ui.manager.js`
4. **Nueva constante** → agregar en `state.js` (constantes financieras colombianas)

---

## 3. Proceso de Documentación

### Archivos Maestros (Fuente de Verdad)

Antes de realizar cambios estructurales, consultar:

| Archivo | Contenido |
| :--- | :--- |
| `01_auditoria_y_limpieza.md` | Estado actual del código y deuda técnica |
| `02_ux_ui_modernizacion.md` | Guía de estilo, tipografía, tokens CSS |
| `03_logica_financiera_col.md` | Constantes yvalidaciones legales colombianas |
| `04_roadmap_ejecucion.md` | Plan de release y tareas pendientes |

### Actualizar Docs tras Cambios Estructurales

Si modificas la estructura de módulos:
1. Actualizar el `README.md` con el nuevo mapa del proyecto
2. Si cambia la API pública de un servicio, documentar en los comentarios JSDoc
3. Si agregas nueva constante financiera, actualizar `03_logica_financiera_col.md`

---

## 4. Compromiso con la UX y Accesibilidad

### WCAG 2.1 AA Obligatorio

Todo cambio en la interfaz debe cumplir:

- **Contraste mínimo:** 4.5:1 para texto normal, 3:1 para texto grande
- **Navegación por teclado:** Toda funcionalidad accesible con Tab/Enter/Escape
- **ARIA:** Labels en botones e inputs, `role="dialog"` en modales
- **Etiquetado:** Todo elemento interactivo debe tener texto visible o `aria-label`

### Guía de Estilo Visual

- **Colores semánticos:**
  - 🟢 Verde (`--a1`): Ingresos, acciones positivas
  - 🔴 Rojo (`--a3`): Gastos, deudas, advertencias
  - 🟡 Amarillo (`--a2`): Pendientes, información

- **Tipografía:**
  - Números monetarios: `font-family: var(--fm)` (monospace)
  - Títulos: `font-family: var(--ff-display)` (Geist/Inter)
  - Cuerpo: cuerpo legible con `line-height: 1.5`

### Prevenir Fatiga Visual

- No introducir nuevos colores sin consultar `02_ux_ui_modernizacion.md`
- Mantener consistencia con border-radius existente (12px, 18px, 24px)
- Usar transiciones suaves (0.2s - 0.3s) para microinteracciones

---

## 5. Proceso de Commit

### Convenciones de Mensajes (Conventional Commits)

```
<tipo>(<alcance>): <descripción>

Tipos: feat, fix, refactor, chore, docs, style, a11y, test
```

| Tipo | Cuándo usar |
| :--- | :--- |
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `refactor` | Reestructuración sin cambio de comportamiento |
| `chore` | Mantenimiento, configs, dependencias |
| `docs` | Documentación |
| `style` | Solo cambios de formato (CSS) |
| `a11y` | Accesibilidad |
| `test` | Tests unitarios |

**Ejemplos:**
```
feat(finance): agregar detector de gastos hormiga
fix(dashboard): corregir cálculo de saldo libre
docs(readme): actualizar mapa del proyecto
a11y(modales): agregar aria-label a botones de cierre
```

### Reglas de Commit

1. **Un commit por tarea lógica** (ver `04_roadmap_ejecucion.md`)
2. **Tests verdes antes de commit:** `npm test` debe pasar 100%
3. **No commitear secretos:** Verificar `.gitignore` antes de agregar
4. **Staging check:** `git status` antes de commit para verificar archivos

---

## 6. Configuración del Entorno

### Requisitos

- Node.js 18+
- npm 9+

### Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar tests
npm test

# Iniciar servidor local
npx serve . # o python -m http.server 8080
```

### Service Worker

Cualquier cambio en JS/CSS requiere:
1. Bump `CACHE_NAME` en `service-worker.js`
2. Verificar funcionamiento offline en pestaña incógnita

---

## 7. Contacto y Soporte

- **Issues:** Usar GitHub Issues para bugs y features
- **-discussions:** Para preguntas y retroalimentación
- **Seguridad:** Reportar vulnerabilidadessecrets@finko-pro.com

---

> **NOTA:** Este documento evoluciona con el proyecto. Antes de contribuir, verificar la versión más reciente en `main`.

**¡Gracias por ayudar a hacer Finko Pro mejor!** 💰🚀