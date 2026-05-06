# 💰 Finko Pro - Refactored

Finko Pro es una aplicación PWA offline-first para la gestión de finanzas personales, optimizada para el contexto financiero colombiano.

## 🚀 Nueva Arquitectura Lean (v6)

Hemos migrado de una estructura fragmentada de +28 archivos a una **Arquitectura Lean** de 6 módulos core. Esta simplificación reduce la complejidad de importaciones y centraliza la lógica de negocio.

### 🗺️ Mapa del Proyecto

| Archivo | Responsabilidad | Descripción |
| :--- | :--- | :--- |
| `modules/main.js` | **Orquestador** | Punto de entrada. Gestiona el mapeo de acciones (`data-action`) y el ciclo de vida de la app. |
| `modules/state.js` | **Estado & Persistencia** | Singleton `S`. Centraliza datos, constantes y la sincronización con `localStorage`. |
| `modules/finance.service.js` | **Motor Financiero** | Lógica pura de Gastos, Cuentas, Bolsillos y Deudas. |
| `modules/planner.service.js` | **Planificación & Salud** | Metas, Compromisos, Análisis de Tendencias y Score de Salud Financiera. |
| `modules/tools.service.js` | **Calculadoras** | Lógica matemática pura para créditos, CDTs y otros instrumentos. |
| `modules/ui.manager.js` | **Capa de Presentación** | Único módulo que toca el DOM. Renderiza vistas, gestiona modales y navegación. |

## 🛠️ Flujo de Datos

`UI Evento` $\rightarrow$ `main.js (Action)` $\rightarrow$ `Service (Lógica)` $\rightarrow$ `state.js (S)` $\rightarrow$ `save()` $\rightarrow$ `ui.manager.js (Render)`

## 📌 Notas de Desarrollo
- **Pure Logic**: Los servicios (`finance`, `planner`, `tools`) NO deben tocar el DOM.
- **Single Source of Truth**: Toda la información reside en `S`.
- **Persistencia**: Cualquier cambio en `S` debe ir seguido de una llamada a `save()`.
