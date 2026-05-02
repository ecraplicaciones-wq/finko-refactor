// ─────────────────────────────────────────────────────────────────────────────
// Finko Pro — Service Worker v4
// Estrategia: Cache-First con revalidación en background (stale-while-revalidate)
//
// CHANGELOG v4 (bugs corregidos):
// ① Faltaban ahorrado.js, exports.js e iconos del manifest en PRECACHE_ASSETS.
// ② style.css?v=2.1 nunca hacía match en el caché — URL normalizada en fetch.
// ③ skipWaiting() automático en install movido al handler de SKIP_WAITING.
// ④ Filtro Google Fonts era .includes('fonts.g') — ahora verifica dominios exactos.
// ⑤ Fallback offline era Response('', 408) vacío — ahora sirve index.html o 503.
// ⑥ Se agrega _notificarOffline() para mostrar banner visible al usuario.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ Actualizar CACHE_NAME con cada release que cambie assets críticos.
// v6: se corrigieron los paths de PRECACHE_ASSETS — antes listaba 11 módulos
// fantasma (dashboard/gastos/fijos/…) que no existen en la estructura real
// core/infra/ui/dominio → todo caía al catch de install y la app no funcionaba
// offline. Ver auditoría C1.
// v10: se rompió la dependencia circular events.js ↔ dominio extrayendo
// registerAction a ui/actions.js. Bump obligatorio: usuarios con el caché v9
// recibían el TDZ "Cannot access 'ACTIONS' before initialization" porque el
// SW seguía sirviendo la versión vieja de tesoreria.js que importaba desde
// events.js. El activate de v10 borra el caché v9 y re-precachea limpio.
// v11: tres fixes + una capa de defensa:
//   (a) compromisos.js: aria-expanded recibía un string con comillas dobles
//       literales y rompía el render del botón "Ver consejo".
//   (b) shell.js: refactor de go() para que el highlight del sidebar respete
//       el item clickeado (Metas ya no resalta Alcancías).
//   (c) storage.js: snapshots rotativos (3 slots) + recuperación automática
//       en loadData() si el JSON principal se corrompe. Defensa por capas
//       junto con el banner de respaldo cada 30 días.
// v12: detector de duplicados en agregarGasto. Si el usuario registra el
//   mismo desc + monto + cat en menos de 5 min (doble-tap o "no sé si
//   guardó → relog"), aparece un confirm. Función pura
//   detectarDuplicadoGasto() con 37 tests dedicados.
// v13: detector de gastos atípicos (anti-typo del monto). Si el monto del
//   gasto es ≥4× el promedio de la misma categoría en los últimos 30 días
//   (con al menos 3 muestras), aparece un confirm "¿Le erraste a un cero?".
//   Pura: detectarGastoAtipico() con 59 tests dedicados. Default-safe =
//   Cancelar (Escape no debe crear basura por accidente).
// v14: compactación inteligente del historial. archivarHistorialAntiguo()
//   ahora intenta primero compactarHistorial() — fusiona los quincenales
//   viejos del mismo mes en un solo entry mensual con totales sumados y
//   catMap mergeado. Solo recurre al slice destructivo si tras compactar
//   todavía hay >24 entries. Pura, determinística, 43 tests dedicados.
//   Resultado: el historial puede crecer logarítmicamente en vez de lineal,
//   preservando totales mensuales que antes se perdían silenciosamente.
// v15: undo de 1 paso para operaciones destructivas. Antes de resetTodo,
//   resetQuincena e importarDatos, se captura un snapshot dedicado del estado
//   en localStorage (key fco_v4_undo, separado de los snapshots rotativos).
//   Banner no-bloqueante con botón "Deshacer", auto-dismiss 8s, TTL del
//   snapshot 10 min. Pure helpers crearSnapshotUndo() y validarSnapshotUndo()
//   con 53 tests dedicados. Best-effort: si la quota está llena igual procede
//   la op, simplemente sin undo. La capa hace la diferencia entre "ay no, le
//   di a Borrar todo" y "perdí 6 meses de registros".
// v16: detector de bolsillos "en fuga". Distinto de bolsillosOlvidados (sin
//   aportes hace M días, pasivo): este detecta bolsillos donde en los últimos
//   3 meses solo salieron retiros — la app prevenía monto<0 pero no advertía
//   que un bolsillo de $500k para "Viaje" se vacíe a $50k sin un solo abono.
//   detectarBolsillosEnFuga() pura, ordenada por severidad (alta=saldo>0+sin
//   abonar, media=retira más de lo que abona, baja=ya quedó vacío). 45 tests
//   dedicados. Render visible en el dashboard con CTA según el caso (Abonar
//   para frenar la fuga, Revisar para cerrar/replantear).
// v17: detector de meses sin cerrar. Si el usuario abandona la app y vuelve
//   2+ meses después, S.gastos acumula gastos de varios meses que nunca se
//   archivaron al historial — el dashboard mezcla todo bajo "este período" y
//   los KPIs salen disparados. detectarMesesSinCerrar() compara los meses de
//   S.gastos contra S.historial.mes y devuelve los huérfanos (excluyendo el
//   mes actual y futuros). Pure, 35 tests. Banner naranja en el dashboard
//   muestra hasta 3 meses huérfanos con CTA "Exportar backup" — la app no
//   auto-archiva (riesgo de mezclar contextos), solo informa para que el
//   usuario decida qué hacer.
// v18: detector de deudas durmiendo. Distinto de calcularDiasMora (atraso del
//   mes corriente): identifica deudas vivas (pendiente > 0) sin pagos hace
//   2+ meses — el caso del usuario que CREE que está pagando porque ve la
//   deuda en la lista, pero los intereses corren igual. Fuente del último
//   pago en orden: deuda.fechaUltimoPago (set por confPagarCuota) → gasto
//   con deudaId match → id como Date.now() (fallback a creación). Severidad
//   alta (≥6m) / media (≥3m) / baja (≥umbral=2). Sugerencia liquidar (un
//   pago la cierra) o retomar. Pure, 42 tests. Banner violeta en dashboard
//   con CTA "Pagar cuota" → reusa el modal m-pgc existente.
// v19: detector de gastos fijos sin pagar del mes corriente. Si el día del
//   fijo ya pasó y el mes actual no aparece en `pagadoEn` → atrasado. Para
//   quincenales: 2 pagos esperados al mes (día y día+15 con clamp al fin del
//   mes — feb=28). Severidad por días de atraso: leve (0-3), moderada (4-10),
//   urgente (11+). tipoFalta diferenciado para quincenales: q1, q2 o ambos.
//   Pure, 38 tests. Banner rojo en TOP del dashboard (severidad máxima — los
//   recargos son $$$$ inmediato), CTA "Pagar" reusa el modal m-pagar-fijo
//   existente vía abrirModalFijo.
// v20: análisis retrospectivo de hormigas acumuladas del mes corriente.
//   Distinto de calcularImpactoHormiga (preview "si hacés esto cada día...")
//   y de calcularRachaHormiga (días sin hormiga). Este suma lo que ya pasó
//   este mes: total, nGastos, top categorías, proyección lineal al fin del
//   mes, mayor gasto individual. Severidad por % del ingreso (5% warn, 15%
//   urgent) o por count (10/25) si no hay ingreso. Compatible con dos
//   representaciones de hormiga (g.hormiga===true post-v4 y g.tipo==='hormiga'
//   pre-v4). Pure, 40 tests. Banner solo aparece en warn/urgent (info no
//   distrae). Surface el "death by 1000 cuts" del café diario + propinas +
//   app stores que el usuario no dimensiona porque cada gasto es chico.
// v21: atajo Ctrl+Z global para deshacer. Cierra el ciclo del feature de undo
//   (v15) — el banner se descubre, pero el usuario eventualmente lo cierra y
//   pierde la pista. Ctrl+Z (Windows/Linux) o Cmd+Z (Mac) lo trae de vuelta.
//   Pure helper shouldFireUndoShortcut(ctx) con guards: NO fire si target es
//   editable (input/textarea/select/contenteditable), si hay modal abierto,
//   o si Shift está presionado (eso es redo). 30 tests dedicados. initUndoShortcut()
//   idempotente, llamada desde events.js _initUI. Si no hay undo disponible,
//   notifica con sr() pero no consume el evento — preserva undo nativo en
//   campos que pasamos por alto.
// v22: detector de objetivos sin progreso. Cierra el set de detectores
//   defensivos: ya tenemos para gastos (atípicos+duplicados), deudas
//   (durmiendo), fijos (sin pagar), bolsillos (olvidados+fuga), hormigas
//   (acumuladas). Faltaba el caso del objetivo abandonado: usuario crea
//   "Viaje Diciembre $3M", abona dos veces y se olvida. detectarObjetivosSinProgreso()
//   pure, fuente del último aporte en orden: obj.fechaUltimoAporte (set por
//   ejecutarAccionObjetivo) → gasto con metaId match + tipo='ahorro' → id
//   como Date.now(). Severidad alta (≥6m) / media (≥3m) / baja (≥umbral=2).
//   Sugerencia 'eliminar' si nunca se aportó nada o 'replantear' si hay
//   progreso. 42 tests dedicados. Banner cyan en dashboard con CTA según
//   sugerencia. Bonus: data-action 'abrirAccionObj' ahora soporta data-arg-accion.
// v23: validador de coherencia de saldos. Capa nueva de "data integrity"
//   sobre los detectores de comportamiento. Detecta 4 tipos de incoherencia:
//   drift-banco (saldos.banco != Σ cuentas), cuenta-negativa (cuenta con
//   saldo<0), banco-negativo, efectivo-negativo. Causas típicas: import de
//   backup pre-v5, edición manual del JSON via DevTools, bug viejo. Pure
//   con umbral configurable (default 1000 pesos para tolerar redondeo).
//   Severidad por monto: leve <10k, moderada 10-100k, grave 100k+. Banner
//   rojo en TOP del dashboard (los datos malos invalidan los demás indicadores).
//   CTA "Recalcular" con auto-fix recalcularSaldoBanco() que sincroniza
//   saldos.banco a Σ cuentas. 34 tests dedicados.
// v24: indicador de salud financiera global. Cierra el loop emocional del
//   dashboard — hasta v23 son 9 nudges defensivos que regañan al usuario;
//   este premia al disciplinado. Pure calcularSaludFinanciera() con 6
//   componentes de peso fijo (total 100): atrasos (25), ahorro (25), fondo
//   emergencia (20), deudas (15), backup (10), hormigas (5). Etiqueta:
//   'critica' <40, 'mejorable' <70, 'buena' <90, 'excelente' ≥90. El banner
//   verde aparece SOLO con score ≥ 70 — debajo, los nudges defensivos hablan
//   y este se calla para no saturar visualmente. Muestra score, barra de
//   progreso, y top 3 wins (componentes con score ≥80% de su peso). 57 tests
//   dedicados que cubren cada componente individualmente más casos reales.
// v25: comparación de categorías (período actual vs anterior). Complemento
//   a calcularComparacionQuincenas (que compara 4 totales) — esta compara
//   EL DESGLOSE POR CATEGORÍA, donde realmente se ve el cambio de
//   comportamiento. Pure calcularComparacionCategorias(catMapA, catMapP,
//   config) con 5 direcciones: 'subio', 'bajo', 'igual' (|deltaPct|<5%),
//   'nueva' (solo en actual), 'desaparecio' (solo en anterior). Devuelve
//   categorías ordenadas por |delta| desc, top 3 highlights tagged
//   'mejora'/'alerta', y totales. 32 tests dedicados. Render con barras
//   side-by-side (anterior gris, actual verde) en card del dashboard,
//   informativo (no urgente) entre los nudges y el banner de salud.
// v26: rebalanceo de bolsillos sobre-asignados. platoLibre() devuelve
//   Math.max(0, ...) y oculta cuando Σ bolsillos > saldo real (post import,
//   eliminar cuenta, edición manual). Sin rebalanceo, los retiros funcionan
//   con plata fantasma. Pure calcularRebalanceoBolsillos(saldos, bolsillos,
//   config) reduce cada bolsillo proporcionalmente al saldo real, residuo
//   de redondeo al bolsillo más grande para que Σ ajustes = saldoReal exacto.
//   Auto-fix aplicarRebalanceoBolsillos() registra movimiento tipo 'retiro'
//   con nota descriptiva en cada bolsillo afectado. 29 tests dedicados.
//   Banner naranja en dashboard (data-integrity, severidad alta), aparece
//   inmediatamente después del validador de saldos.
// v27: detector de tendencias multi-período. Complemento a la comparación
//   pareada (Q vs Q anterior): mira la TRAYECTORIA de las últimas N entradas
//   del historial — racha consecutiva, dirección sostenida, pendiente
//   promedio. "Tu ahorro lleva 3 meses bajando" detecta patrones graduales
//   que las comparaciones pareadas pasan por alto. Pure calcularTendencias()
//   con 4 direcciones: subiendo, bajando, estable (cambios <5%), volatil.
//   Highlights tagged mejora/alerta cuando racha ≥ rachaMin (default 3),
//   considerando polaridad ('mas-es-mejor' para ahorro/ingreso, 'menos-es-
//   mejor' para gastado/hormiga). 41 tests dedicados. Card aparece en
//   dashboard solo si hay highlights (sin patrón notable, no distrae).
//   Resumen visual de las 4 métricas con flechas direccionales coloreadas.
// v28: predictor de fin de quincena. Primer banner FORWARD-LOOKING del
//   dashboard — los 13 nudges previos miran hacia atrás. Pure
//   predecirFinQuincena(gastos, ingreso, saldoActual, tipoPeriodo, hoyStr,
//   config) toma el ritmo de gasto del periodo en curso (gastoActual /
//   diasTranscurridos) y proyecta linealmente al cierre. Pesimista por
//   diseño: prefiere asustar hoy a sorprender al final. Severidad con
//   ingreso: critico (saldoProy<0), alerta (<5%), cuidado (>=95% pct),
//   excelente (<70%), ok intermedio. Sin ingreso: critico/alerta/ok por
//   saldo. Diagnósticos: sin-datos, periodo-sin-iniciar (<2 días),
//   fuera-de-periodo, fin-de-periodo, normal. Banner solo aparece en
//   {critico, alerta, cuidado} con diagnóstico=normal — silencio en lo
//   positivo (la salud financiera ya cubre eso). Helper interno
//   _rangoPeriodo() calcula 1-15 / 16-último / 1-último según tipoPeriodo
//   con Date.UTC anti-DST y soporte de bisiestos. ~50 tests dedicados.
//   Posición en updateDash: entre renderHormigaAcumulada (backward) y
//   renderObjetivosSinProgreso, formando el cluster behavioral
//   pasado-futuro-acción.
// v29: refactor onclick → data-action en HTML dinámico de los módulos.
//   Phase 2 del plan de auditoría v5: completa la migración del sistema
//   de delegación de eventos. Antes ~37 onclick="" estaban inline en los
//   template strings de compromisos/tesoreria/ingresos/metas/shell/storage/
//   analisis y 2 en index.html. Ahora todos viajan por data-action +
//   data-arg-*, manejados por el listener delegado en ui/actions.js.
//   Bonus fixes (bugs preexistentes detectados durante el refactor):
//   (a) abrirModalFijo registrado como () pero llamado con (id) — ahora
//       pasa el id correctamente vía ({ id }).
//   (b) showDayDetails registrado con ({ fecha }) pero la función espera
//       (day, element) — ahora destructura ({ day }, el).
//   Funciones helper extraídas:
//   (a) toggleConsejoDeuda(id) en compromisos — antes era un onclick
//       inline gigante (>200 chars de JS embebido).
//   (b) toggleCdtRetencion en events — toggle del checkbox CDT con
//       fallback a click en el input.
//   (c) irALogros en analisis — antes go() + setTimeout encadenados.
//   (d) dismissStorageBanner en events — cierre del banner de quota.
//   Calculadoras lazy-loaded (cCDT, cCre, cIC, cMeta, cPila, cInf, cR72)
//   ahora se registran como acciones al cargar el módulo. Resultado:
//   ningún onclick="" funcional en el codebase (solo 2 comentarios
//   históricos). El sistema queda preparado para escalar sin saturar
//   window.* con cada nueva acción.
// v30: validador de tipoPeriodo para sincronización defensiva. El usuario puede
//   cambiar manualmente tipoPeriodo vía UI, cargar desde storage stale (sync
//   entre dispositivos), o tener corrupciones. El predictor de fin de quincena
//   depende de que S.tipoPeriodo sea consistente con la fecha actual para
//   calcular rangos correctos. validarTipoPeriodo(hoyStr, tipoPeriodoActual)
//   verifica: día 1-15 → debe ser q1, día 16-31 → debe ser q2. Si hay
//   mismatch, auto-corrige silenciosamente (console.debug + save). Integrada
//   en renderPrediccionFinPeriodo() (defensiva ante render aislado) e
//   updateDash() (sincronización una vez por sesión). Pure function sin
//   Date.UTC ni cálculos complejos — determinístico basado solo en día del
//   mes, garantizando consistencia con _rangoPeriodo(). ~15 tests dedicados
//   cubriendo rangos (q1/q2 válidos/inválidos), edge cases (formato inválido,
//   día 0/32, tipoPeriodo typo), determinismo e integración con _rangoPeriodo.
// v31: detector de inversiones sin actualizar. El usuario registra CDT, fondos,
//   acciones pero los olvida en el dashboard. Sin actualización del rendimiento
//   hace 2+ meses (configurable), no hay visibilidad de cambios. Pure
//   detectarInversionesSinActualizar(inversiones, hoyISO, config) retorna
//   array ordenado por severidad (alta/media/baja según 6+mo/3-5mo/2mo).
//   Fecha última actualización: usa campo fechaUltimaActualizacion si existe
//   (post-v17), fallback a inversion.id (Date.now() → YYYY-MM-DD). Sugerencia
//   contextual: capital>10M → 'actualizar', ≤10M → 'revisar'. Render integrado
//   en updateDash() antes de renderSaludFinanciera, muestra top 3. Banner
//   naranja (alerta informativa, no urgente). ~20 tests dedicados cubriendo
//   cálculos de días/meses, severidades (incluyendo custom umbral),
//   sugerencias contextuales, robustez (id inválido, hoy malformado, negativas),
//   ordenamiento, determinismo, mutación.
// v32: validador de coherencia de objetivos. Capa final de "data integrity"
//   para el dominio de metas. El usuario puede importar backup pre-v8, editar
//   JSON via DevTools, o sufrir bugs viejos que generaban ahorrado>objetivo o
//   gastado<0. Pure normalizarObjetivos(objetivos) normaliza en loadData()
//   silenciosamente (sin notificaciones al usuario, cleanup defensivo one-time).
//   Normalizaciones: id → Math.floor(id) || Date.now(); nombre → trim ||
//   'Sin nombre'; tipo → 'evento'|'ahorro'; icono → ... || '🎯';
//   objetivoAhorro/gastado → Math.max(0, Number(...)); ahorrado → capeado a
//   [0, objetivoAhorro]; tipo='evento' → ahorrado=0, presupuesto y gastado solo
//   para eventos; tipo='ahorro' → presupuesto=gastado=0; gastos → array validado;
//   fechaUltimoAporte → ISO date válida o undefined. Idempotente (aplicar 2 veces
//   = 1 vez) y no-muta input. Integrada en loadData() después de migraciones
//   pero antes de guardias finales. Devuelve [] si input null/undefined/no-array.
//   ~36 tests dedicados cubriendo input inválido, tipos, montos (negativos, NaN,
//   overcapped), strings (trim, defaults), arrays, id/fecha, robustez (malformados,
//   null/undefined fields), casos reales (import pre-v8, edición DevTools,
//   all-NaN), determinismo, idempotencia.
// v33: sistema de alertas inteligentes (Tanda 19). detectarAlertasUrgentes()
//   pura en analisis.js cubre territorio NO incluido en las alertas inline de
//   updateDash(): (1) saldo-negativo — efectivo+banco < 0; (2) evento-excedido
//   — objetivo tipo evento con gastado > presupuesto; (3) evento-cerca — gastado
//   >= pctCercaLimite (default 85%) del presupuesto; (4) sin-registro — ningún
//   movimiento en los últimos N días (default 7). renderAlertasUrgentes() inyecta
//   en nuevo div#d-alertas-inteligentes (aria-live=assertive). Se integra como
//   PRIMERA llamada de render en updateDash() (máxima urgencia). ~30 tests
//   cubriendo: input inválido, saldo negativo (borde: cero no es negativo, suma
//   positiva), evento excedido (nombre, %, tipo ahorro ignorado, presupuesto=0),
//   evento cerca (umbral inclusivo, por debajo, config custom, prioridad excedido),
//   sin-registro (días exactos, ayer=no-alerta, gastos=[]=no-alerta, diasUmbral
//   custom, hoyStr inválido, fecha undefined), combinaciones, determinismo.
// v34: detectarAlertasFinancieras() (Tanda 20). Las 6 condiciones de salud
//   financiera del periodo (saldo-cero, gasto-excesivo, hormiga-alta, sin-ahorro,
//   cuotas-altas, fijos-sin-pagar) que vivían como código inline en updateDash()
//   se extraen a función pura testeable en analisis.js. Retorna [{tipo, html}]
//   donde `tipo` identifica la condición (para tests) y `html` es el fragmento
//   listo para inyectar en d-alr. Umbrales configurables (umbralGasto, umbralHormiga,
//   umbralCuotas). updateDash() ahora llama detectarAlertasFinancieras() y
//   pushea los html al array al[], manteniendo las alertas de calendario
//   (prima/cesantías/DIAN) como código date-dependent inline. ~22 tests cubriendo
//   input inválido, las 6 condiciones, umbrales exclusivos, config custom, html
//   output, determinismo, no-mutación.
// v35: calcularChecklistSalud() (Tanda 21). Las 5 dimensiones del checklist de
//   salud financiera (gastos, ahorro, hormiga, deudas, metas) que vivían inline
//   en calcScore() con umbrales hardcodeados en dos lugares se extraen a función
//   pura testeable en analisis.js. Retorna [{tipo, estado, etiqueta}] con los
//   mismos umbrales default que detectarAlertasFinancieras() (0.9/0.15/0.3),
//   configurables via config. calcScore() ahora llama calcularChecklistSalud()
//   y mapea estado → iconos/colores HTML. ~20 tests cubriendo input inválido,
//   las 5 dimensiones (ok/mal/info, umbrales, labels), condicionales (deudas
//   solo si cuotasPeriodo>0, metas solo si tieneObjetivos), orden, estructura,
//   config custom, determinismo.
// v36: proyección de fondo de emergencia (Tanda 22). calcularProyeccionFondo()
//   pura en tesoreria.js: dado faltaPorAhorrar y ahorroMensualEstimado, devuelve
//   {yaCompletado, mesesFaltantes, fechaEstimada, ahorroMensualUsado}. fechaEstimada
//   en formato YYYY-MM con manejo correcto de cruce de año. mesesFaltantes=null si
//   ahorro=0 (no hay proyección posible). actualizarVistaFondo() extendida para
//   estimar ahorroMensual desde historial reciente (últimos 4 periodos × 2) y
//   renderizar en nuevo div#fe-proyeccion. ~22 tests cubriendo input inválido,
//   meta alcanzada, sin ahorro, cálculo de meses (ceil), fechas (cruce de año,
//   formato YYYY-MM), estructura, determinismo, strings numéricos.
// v37 (Tanda 23): detectarPatronGastoSemanal — detector de días de semana con
//   gasto inusualmente alto. Ventana 90 días, día-de-semana anti-DST (Date.UTC +
//   getUTCDay), factorUmbral configurable (default ×2.0), mini bar-chart en
//   d-patron-semanal. Render condicional: solo severidad alta/media visible.
const CACHE_NAME = 'finko-pro-v37';

// ─── ASSETS QUE SE CACHEAN AL INSTALAR ───────────────────────────────────────
const PRECACHE_ASSETS = [
  // ─── Raíz ──────────────────────────────────────────────────────────────────
  './',
  './index.html',
  './style.css',      // El query param ?v=X se normaliza en el fetch handler (Fix ②)
  './manifest.json',

  // ─── Módulos JS (estructura real: core/infra/ui/dominio) ───────────────────
  // core/
  './modules/core/state.js',
  './modules/core/storage.js',
  './modules/core/constants.js',
  // infra/
  './modules/infra/utils.js',
  './modules/infra/a11y.js',
  './modules/infra/render.js',
  // ui/
  './modules/ui/actions.js',   // hoja del sistema data-action — sin esto, TDZ en v9
  './modules/ui/shell.js',
  './modules/ui/events.js',
  // dominio/
  './modules/dominio/analisis.js',
  './modules/dominio/compromisos.js',
  './modules/dominio/exports.js',
  './modules/dominio/ingresos.js',
  './modules/dominio/metas.js',
  './modules/dominio/personales.js',  // R3 — préstamos personales (auto-registra)
  './modules/dominio/tesoreria.js',
  // lazy-loaded (pero lo precacheamos para offline completo)
  './modules/calculadoras.js',

  // ─── Iconos para instalación PWA ───────────────────────────────────────────
  // ✅ Fix ①: el manifest.json referencia estos archivos. Sin cachearlos, el
  // ícono del launcher y la pantalla de instalación quedan rotos sin conexión.
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// ─── INSTALL: llenar el caché con los assets críticos ────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        // allSettled: si un asset falla, el SW instala igual.
        // Los assets fallidos se intentan en la primera visita online.
        Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn(`[SW Finko] No se pudo cachear: ${url}`, err)
            )
          )
        )
      )
      .then(results => {
        const ok      = results.filter(r => r.status === 'fulfilled').length;
        const fallidas = results.filter(r => r.status === 'rejected').length;
        if (fallidas > 0) {
          console.warn(`[SW Finko] ${fallidas} asset(s) sin cachear. ${ok} cacheados correctamente.`);
        } else {
          console.log(`[SW Finko] Precache completo ✅ — ${ok} assets listos offline.`);
        }
        // ✅ Fix ③: NO skipWaiting() automático. El cliente lo pide via mensaje
        // solo cuando ya no quedan tabs con la versión anterior. Sin esto, un
        // usuario con la app abierta podría recibir JS nuevo + caché viejo → crash.
      })
  );
});

// ─── ACTIVATE: limpiar cachés de versiones anteriores ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log(`[SW Finko] Eliminando caché obsoleto: ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        console.log('[SW Finko] Activado. Controlando todos los clientes.');
        return self.clients.claim();
      })
  );
});

// ─── FETCH: Cache-First + stale-while-revalidate ─────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ✅ Fix ④: antes era url.hostname.includes('fonts.g') — un string que podría
  // coincidir con dominios no relacionados. Ahora son los dos hostnames exactos.
  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (url.origin !== location.origin && !isGoogleFont) return;

  // ✅ Fix ②: index.html solicita style.css?v=2.1 pero el SW lo guardó como
  // ./style.css (sin query). La clave de caché no coincidía — offline, el CSS
  // nunca se encontraba y la app se veía sin estilos.
  // Solución: para requests del mismo origen con query string, normalizamos la
  // clave de caché eliminando los parámetros. El versionado real lo hace
  // CACHE_NAME — no el query param de la hoja de estilos.
  const cacheKey = (url.origin === location.origin && url.search)
    ? new Request(url.origin + url.pathname)
    : event.request;

  event.respondWith(
    caches.match(cacheKey).then(cached => {

      // ── Stale-While-Revalidate ─────────────────────────────────────────────
      if (cached) {
        fetch(event.request)
          .then(response => {
            if (response?.ok && response.type !== 'opaque') {
              // Clonar ANTES de que cualquier consumidor lea el body.
              // El clone va al caché; el original se descarta (no se sirve).
              const toCache = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, toCache));
            }
          })
          .catch(() => { _notificarOffline(); });
        return cached;
      }

      // ── Sin caché: intentar la red ─────────────────────────────────────────
      return fetch(event.request)
        .then(response => {
          if (!response?.ok || response.type === 'opaque') return response;
          // ✅ FIX clone(): clonar en variable separada antes de cache.put().
          // Si se pasa response.clone() directamente a una Promise asíncrona
          // y luego se devuelve response, ambos comparten el body stream y el
          // browser puede lanzar "Response body is already used".
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, toCache));
          return response;
        })
        .catch(() => {
          _notificarOffline();

          // ✅ Fix ⑤: antes devolvía new Response('', { status: 408 }) — un
          // cuerpo vacío que el browser rechaza silenciosamente. Resultaba en
          // errores de módulo sin mensaje claro para depurar.
          // Ahora: navegaciones reciben index.html (la app carga completa),
          // assets reciben un 503 con mensaje descriptivo en lugar de silencio.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          const esCss = url.pathname.endsWith('.css');
          return new Response(
            `/* [Finko Pro — Sin conexión]\n * ${url.pathname} no disponible sin internet.\n * Tus datos locales siguen intactos. */`,
            {
              status: 503,
              statusText: 'Sin conexión — datos locales activos',
              headers: { 'Content-Type': esCss ? 'text/css' : 'text/javascript' }
            }
          );
        });
    })
  );
});

// ─── MENSAJES DESDE LA APP ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  // ✅ Fix ③: skipWaiting SOLO cuando el cliente lo pide explícitamente.
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW Finko] Nueva versión activada por solicitud del cliente.');
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => console.log('[SW Finko] Caché limpiado manualmente.'));
  }
});

// ─── HELPER: avisar a los clientes que no hay conexión ───────────────────────
// ✅ Fix ⑥: events.js escucha este mensaje y muestra un banner visible.
// Antes no había ningún aviso — el usuario creía que la app estaba caída.
function _notificarOffline() {
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then(clients => clients.forEach(c =>
      c.postMessage({ type: 'FINKO_OFFLINE' })
    ));
}