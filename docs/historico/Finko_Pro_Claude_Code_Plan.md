# 🔍 PROMPT DE AUDITORÍA EXHAUSTIVA PARA FINKO PRO

**Instrucción para Opus:** Este es un prompt de auditoría para revisar la PWA Finko Pro de finanzas personales para Colombia. Necesito que hagas un análisis **EXHAUSTIVO Y SIN PIEDAD** de todos los aspectos: código, diseño, UX, accesibilidad, precisión financiera colombiana, responsividad, y experiencia del usuario. Señala TODO lo que esté mal, falta, o pueda mejorar. Propón soluciones concretas.

---

## 📋 CONTEXTO DE LA APP

**Finko Pro** es una PWA (Progressive Web App) de finanzas personales diseñada específicamente para colombianos que quieren aprender a gestionar su dinero desde cero. No es un app para inversores sofisticados, es para gente común que necesita:
- Registrar gastos e ingresos
- Entender dónde va su dinero
- Planificar meses adelante
- Pagar deudas de forma inteligente
- Ahorrar sin sacrificarse
- Aprender finanzas mientras la usan

**Stack técnico:**
- Vanilla JavaScript (sin frameworks)
- HTML5 semántico
- CSS3 con variables y Flexbox/Grid
- PWA completa: manifest.json + service worker
- LocalStorage para persistencia
- Mobile-first responsive design

**Secciones implementadas:**
- Dashboard (resumen del estado financiero)
- Planificar (presupuestos y proyecciones)
- Gastos (registro diario y categorizado)
- Fijos (suscripciones y gastos recurrentes)
- Objetivos (metas de ahorro con gamificación)
- Inversiones (simulaciones de rentabilidad)
- Deudas (Avalancha + Bola de Nieve + alertas legales colombianas)
- Agenda (calendario de eventos financieros importantes)
- Estadísticas (gráficos mensuales y anuales)
- Historial (búsqueda y auditoría de transacciones)

**Pendiente:** Sección "Me Deben 🤝" (deudas personales entre amigos/familia)

---

## 🎯 CRITERIOS DE AUDITORÍA

### A. ACCESIBILIDAD (WCAG 2.1 AA) - CRÍTICO

**Revisar y reportar:**

1. **Contraste de colores:**
   - [ ] Medir contraste en todos los textos (mínimo 4.5:1 para normal, 3:1 para texto grande) en AMBOS temas (claro y oscuro)
   - [ ] Revisar si los colores verdes, amarillos, azules cumplen en contraste
   - [ ] Verificar que los estados "deshabilitados" sean claramente visibles
   - [ ] Probar con simulador de daltonismo (rojo-verde es el más común)

2. **Navegación por teclado:**
   - [ ] ¿Se puede tabular por toda la app con Tab/Shift+Tab sin quedarse atrapado?
   - [ ] ¿Existen focus traps innecesarios en modales?
   - [ ] ¿Escape cierra los modales siempre?
   - [ ] ¿Los botones son accesibles con Enter y los checkboxes con Space?
   - [ ] ¿Los selects (dropdowns) usan las flechas arriba/abajo para navegar?

3. **ARIA y roles semánticos:**
   - [ ] ¿Todos los botones tienes aria-label o texto visible descriptivo?
   - [ ] ¿Los inputs tienen <label> o aria-label ligados correctamente?
   - [ ] ¿Los modales tienen role="dialog" y aria-modal="true"?
   - [ ] ¿Las alertas/errores tienen role="alert" para lectores de pantalla?
   - [ ] ¿Los elementos decorativos (emojis bonitos) tienen aria-hidden="true"?
   - [ ] ¿Los expanders/acordeones tienen aria-expanded correctamente?
   - [ ] ¿Las tablas (si las hay) tienen <thead>, <tbody>, headers correctos?

4. **Lectores de pantalla:**
   - [ ] ¿Un usuario ciego podría entender qué hace cada botón sin ver el icono?
   - [ ] ¿Se anuncia cuando un saldo cambia (aria-live)?
   - [ ] ¿Se anuncia el error en el formulario antes de que el usuario navegue?
   - [ ] ¿Las transacciones se describen de forma clara: "Gasto en alimentos: $50.000"?

5. **Responsive y táctil:**
   - [ ] ¿Los botones/targets táctiles tienen mínimo 44x44px en móvil?
   - [ ] ¿Hay suficiente espacio entre botones para evitar clics accidentales?
   - [ ] ¿Los inputs numéricos abren el teclado correcto (type="number")?
   - [ ] ¿Las fechas tienen date picker en vez de escribir?

---

### B. RESPONSIVIDAD Y ADAPTACIÓN DE DISPOSITIVOS - CRÍTICO

**Revisar en breakpoints reales (no solo pantalla ancha):**

1. **Móvil pequeño (375px - iPhone SE):**
   - [ ] ¿Cabe todo sin scroll horizontal? (Es el pecado mortal)
   - [ ] ¿El menú lateral se convierte en bottom bar o hamburguesa?
   - [ ] ¿Las tablas tienen scroll horizontal elegante o se reorganizan?
   - [ ] ¿Las columnas de dos elementos se apilan en columna única?
   - [ ] ¿Los textos son legibles sin zoom (mínimo 14px)?
   - [ ] ¿Los números de pesos se ven completos ($1.500.000)?
   - [ ] ¿Los gráficos se adaptan manteniendo legibilidad?
   - [ ] ¿Los modales se comportan como bottom sheets sin cobertura excesiva?

2. **Móvil grande (820px - iPad mini o Android tablet):**
   - [ ] ¿Se aprecha más contenido sin saturar?
   - [ ] ¿El menú sigue siendo bottom bar o pasa a sidebar?
   - [ ] ¿Hay dos columnas donde tiene sentido (gastos + categorías)?

3. **Tablet (1024px+):**
   - [ ] ¿El menú es sidebar vertical a la izquierda?
   - [ ] ¿Las tarjetas se distribuyen en 2-3 columnas?
   - [ ] ¿Los gráficos usan más espacio aprovechado?

4. **Escritorio (1920px+):**
   - [ ] ¿El contenido está restringido a max-width (no 100% en una línea)?
   - [ ] ¿La simetría visual es buena?

5. **Comportamientos específicos de dispositivos:**
   - [ ] ¿El app respeta el safe area en notches de iPhones (padding-top)?
   - [ ] ¿El color de la barra de estado (theme-color) se adapta al tema?
   - [ ] ¿El teclado virtual de Android no oculta inputs críticos?
   - [ ] ¿Los date pickers abren el selector nativo de cada SO?

---

### C. DISEÑO Y UX - IMPORTANTE

1. **Coherencia visual:**
   - [ ] ¿La paleta de colores es consistente en todos lados?
   - [ ] ¿Los tonos de verde (ingresos), rojo (deudas), amarillo (alertas) están claros?
   - [ ] ¿El modo oscuro es legible y atractivo, no sale del "gris sucio"?
   - [ ] ¿El modo claro tiene suficiente contraste sin ser cegador?
   - [ ] ¿Hay coherencia en espaciados (padding, margins) en toda la app?

2. **Tipografía:**
   - [ ] ¿Se usa Inter para textos (fácil de leer)?
   - [ ] ¿Se usa DM Mono o monoespaciado para números grandes ($1.500.000)?
   - [ ] ¿Los tamaños de texto tienen jerarquía clara?
   - [ ] ¿Hay suficiente line-height (1.5-1.6) para legibilidad?
   - [ ] ¿Las fuentes se cargan rápido o hay fallback legible?

3. **Animaciones:**
   - [ ] ¿Las transiciones son rápidas (0.3s) o quedan lentas?
   - [ ] ¿Los easing son naturales (cubic-bezier) o robóticos?
   - [ ] ¿Las animaciones aportan información o son solo ruido?
   - [ ] ¿Respetan prefers-reduced-motion para usuarios sensibles?

4. **Microinteracciones:**
   - [ ] ¿Los botones tienen feedback visual (hover, active)?
   - [ ] ¿Las tarjetas suben o cambian al pasar el mouse/toque?
   - [ ] ¿Los inputs tienen focus ring visible y diseñado?
   - [ ] ¿Los checkboxes y radios tienen estados claros (checked, unchecked, disabled)?
   - [ ] ¿Las transacciones tienen animación suave al insertarse?

5. **Mensajería y tono:**
   - [ ] ¿El lenguaje es amigable o suena como manual bancario?
   - [ ] ¿Se usa "tú" (informal) y no "usted"?
   - [ ] ¿Los mensajes de error dicen QUÉ hacer, no qué salió mal?
   - [ ] ¿Hay celebraciones cuando el usuario logra algo (paga deuda, ahorra)?
   - [ ] ¿Los tips y consejos son concretos (con ejemplos locales)?

6. **Estados vacíos:**
   - [ ] ¿Hay un estado vacío bonito cuando no hay datos?
   - [ ] ¿Se invita al usuario a crear el primer gasto/ingreso?
   - [ ] ¿Hay onboarding sutil para nuevos usuarios?

7. **Errores y validaciones:**
   - [ ] ¿Los errores aparecen en rojo y con texto claro?
   - [ ] ¿Se previenen con validación client-side inteligente?
   - [ ] ¿No hay errores silenciosos en console?

---

### D. PRECISIÓN FINANCIERA COLOMBIANA - CRÍTICO

**ANTES de cualquier análisis, verificar que esto sea correcto:**

1. **Modelo de períodos de nómina:**
   - [ ] ¿Se reconocen correctamente quincenas: 1-15 y 16-31?
   - [ ] ¿Las fechas de corte están correctas?
   - [ ] ¿Los ingresos quincenales se proyectan correctamente?

2. **Primas legales:**
   - [ ] ¿Se incluyen en los cálculos de ahorro?
   - [ ] ¿Se avisa que en junio y diciembre se reciben?
   - [ ] ¿Se enseña a segregarlas (prima es para emergencias)?

3. **Cesantías y prestaciones sociales:**
   - [ ] ¿Se incluyen en el flujo de caja anual?
   - [ ] ¿Se explica que son dinero que "ya ganaste"?
   - [ ] ¿Se propone como colchón de emergencia?

4. **GMF (4×1000):**
   - [ ] ¿Se aplica correctamente (0.4% sobre transacciones)?
   - [ ] ¿Se excluyen ingresos (sueldos, giros)?
   - [ ] ¿Se suma automáticamente en proyecciones?
   - [ ] ¿Se avisa al usuario que existe?

5. **Tasas de interés:**
   - [ ] ¿Se muestra siempre en E.A. (Efectivo Anual)?
   - [ ] ¿Se aclara que nunca es nominal?
   - [ ] ¿Se dan rangos reales del mercado colombiano?
   - [ ] ¿Se calcula correctamente la capitalización?

6. **Deudas y mora:**
   - [ ] ¿Mora >90 días activa reporte negativo (Ley 1266)?
   - [ ] ¿Se avisa con 20 días de anticipación?
   - [ ] ¿El reporte negativo dura máximo 4 años?
   - [ ] ¿Se explica compra de cartera como alternativa?
   - [ ] ¿Se calcula correctamente el interés moratorio?
   - [ ] ¿Hay opción de pagar en Avalancha (más interés primero)?
   - [ ] ¿Hay opción de pagar en Bola de Nieve (deuda más pequeña primero)?

7. **Bancos y neobancos colombianos:**
   - [ ] ¿Se menciona Bancolombia, Davivienda, Nequi, Nubank, Lulo, BBVA?
   - [ ] ¿Se reconocen las comisiones típicas?
   - [ ] ¿Se comparan tasas reales vs advertidas?

8. **Centrales de riesgo:**
   - [ ] ¿Se menciona Datacrédito y TransUnión?
   - [ ] ¿Se explica cómo funciona el score (1-900)?
   - [ ] ¿Se enseña a consultar el reporte gratis (Ley 1266)?

9. **DIAN y declaración de renta:**
   - [ ] ¿Se menciona el umbral anual actualizado?
   - [ ] ¿Se reconocen deducibles colombianos?
   - [ ] ¿Se previene sobre multas de no declarar?

10. **Método de ahorro:**
    - [ ] ¿Se enseña el 50/30/20 (Superfinanciera)?
    - [ ] 50% necesidades (arriendo, servicios, comida)
    - [ ] 30% deudas/ahorros (según prioridad del usuario)
    - [ ] 20% lujos (entretenimiento, salidas)
    - [ ] ¿Se adapta a realidad colombiana (no todos ganan $5M)?

---

### E. FUNCIONALIDAD Y BUGS - IMPORTANTE

**Por cada sección:**

1. **Dashboard:**
   - [ ] ¿Muestra saldos correctos (ingresos - gastos)?
   - [ ] ¿Se actualiza en tiempo real al agregar transacciones?
   - [ ] ¿Los gráficos se renderizan rápido?
   - [ ] ¿Hay indicadores de salud financiera claros?

2. **Gastos:**
   - [ ] ¿Se pueden agregar con fecha, monto, categoría?
   - [ ] ¿Las categorías son lógicas y colombianas?
   - [ ] ¿Se pueden editar/eliminar transacciones?
   - [ ] ¿Hay filtro por rango de fechas?
   - [ ] ¿Hay búsqueda por concepto?

3. **Ingresos:**
   - [ ] ¿Se diferencian de gastos visualmente?
   - [ ] ¿Se pueden registrar quincenales?
   - [ ] ¿Se proyectan correctamente para el mes?

4. **Deudas:**
   - [ ] ¿Se puede crear deuda con monto, tasa, plazo?
   - [ ] ¿Se calcula la cuota correctamente?
   - [ ] ¿Se permite cambiar el método (Avalancha/Bola de Nieve)?
   - [ ] ¿Se muestra progreso visual?
   - [ ] ¿Se advierte sobre mora próxima?

5. **Fijos:**
   - [ ] ¿Se pueden crear suscripciones recurrentes?
   - [ ] ¿Se diferencian en el presupuesto?
   - [ ] ¿Se pueden marcar como pagadas?

6. **Objetivos:**
   - [ ] ¿Se pueden crear metas con monto y plazo?
   - [ ] ¿Se muestra progreso (% completado)?
   - [ ] ¿Hay notificaciones de cumplimiento?

7. **Inversiones:**
   - [ ] ¿Se pueden simular rentabilidades?
   - [ ] ¿Los cálculos de capitalización son correctos?
   - [ ] ¿Se explica la diferencia entre rendimiento simple y compuesto?

8. **Estadísticas:**
   - [ ] ¿Los gráficos son legibles en móvil?
   - [ ] ¿Se pueden filtrar por mes/año?
   - [ ] ¿Hay desglose por categoría?

9. **Historial:**
   - [ ] ¿Se pueden buscar transacciones antiguas?
   - [ ] ¿Hay paginación o scroll infinito eficiente?
   - [ ] ¿Se puede filtrar por tipo (gasto/ingreso)?

---

### F. RENDIMIENTO Y PWA - IMPORTANTE

1. **Velocidad:**
   - [ ] ¿La app carga en <2s en 4G?
   - [ ] ¿Las transiciones entre secciones son instantáneas?
   - [ ] ¿No hay lag en inputs de texto?
   - [ ] ¿Los gráficos se renderizan sin bloquear UI?

2. **PWA completa:**
   - [ ] ¿Hay manifest.json con todos los campos?
   - [ ] ¿Se puede instalar en Android e iOS?
   - [ ] ¿Funciona offline sin conexión?
   - [ ] ¿Los datos se sincronizan al volver online?
   - [ ] ¿Hay un service worker que cachea los assets?
   - [ ] ¿El icono de instalación es claro y atractivo?

3. **Almacenamiento:**
   - [ ] ¿LocalStorage se usa correctamente?
   - [ ] ¿No hay límite artificial de transacciones?
   - [ ] ¿Se avisa cuando el almacenamiento está lleno?
   - [ ] ¿Hay opción de exportar datos?
   - [ ] ¿Hay opción de importar datos (backup)?

4. **SEO (aunque sea app):**
   - [ ] ¿Hay meta tags correctos en index.html?
   - [ ] ¿La descripción atrae a nuevos usuarios?
   - [ ] ¿Hay Open Graph para compartir?

---

### G. SEGURIDAD Y PRIVACIDAD - IMPORTANTE

1. **Datos del usuario:**
   - [ ] ¿Se guardan SOLO en el dispositivo (nunca en servidor)?
   - [ ] ¿No hay tracking ni analytics invasivos?
   - [ ] ¿Se avisa claramente sobre privacidad?

2. **Validaciones:**
   - [ ] ¿No hay inyecciones de HTML en inputs?
   - [ ] ¿Los montos se validan (no negativos)?
   - [ ] ¿Las fechas se validan correctamente?

3. **Backup:**
   - [ ] ¿El usuario puede exportar datos como JSON/CSV?
   - [ ] ¿Hay advertencia sobre borrar datos?
   - [ ] ¿Hay opción de resetear la app sin perder datos por error?

---

### H. PERSONALIDAD Y COLOMBIANIDAD - IMPORTANTE

**La app debe sentirse "hecha para mí", no como un clónico gringo:**

1. **Lenguaje:**
   - [ ] ¿Se usa "quincena" en vez de "paycheck"?
   - [ ] ¿Se menciona "arriendo" en ves de "rent"?
   - [ ] ¿Los ejemplos son colombianos (mercado, servicios, Netflix)?
   - [ ] ¿Se evita "amortización" y se usa "pago del préstamo"?
   - [ ] ¿Hay expresiones naturales ("vea", "mire", "quiere decir")?

2. **Contexto financiero:**
   - [ ] ¿Se enseña sobre primas en junio/diciembre?
   - [ ] ¿Se menciona GMF sin hacer pánico?
   - [ ] ¿Se reconoce la realidad de sueldos en COP?
   - [ ] ¿Se proponen ahorros realistas (no "ahorre $1M al mes")?
   - [ ] ¿Se enseña a comprar cartera (deuda)?
   - [ ] ¿Se sabe que los créditos colombianos son caros (18-35% E.A.)?

3. **Iconografía y emojis:**
   - [ ] ¿Se usan emojis naturalmente (💰, 📊, 🎯)?
   - [ ] ¿No hay emojis raros o fuera de contexto?

4. **Colores culturales:**
   - [ ] ¿El verde es verde esperanza (no neón)?
   - [ ] ¿El rojo es rojo deuda (no "warning orange")?

---

### I. ACCESIBILIDAD PARA PRINCIPIANTES - CRÍTICO

**La app DEBE ser guía para gente que NO sabe nada:**

1. **Onboarding:**
   - [ ] ¿Hay un tour visual para nuevos usuarios?
   - [ ] ¿Se explica cada sección antes de entrar?
   - [ ] ¿Hay un "primer gasto" guiado paso a paso?

2. **Tooltips y ayuda:**
   - [ ] ¿Hay puntos de ayuda (?) en conceptos complejos?
   - [ ] ¿Los tooltips explican sin tecnicismos?
   - [ ] ¿Se usa "¿Necesitas ayuda?" en secciones confusas?

3. **Educación en contexto:**
   - [ ] ¿Al crear deuda se explica qué es una "tasa"?
   - [ ] ¿Al crear objetivo se explica "fondo de emergencia"?
   - [ ] ¿Se recomiendan montos iniciales realistas?

4. **Ejemplos y plantillas:**
   - [ ] ¿Hay categorías de gastos sugeridas?
   - [ ] ¿Hay objetivos "predefinidos" (fondo de emergencia, vacaciones)?
   - [ ] ¿Se importan automáticamente para ahorrar clicks?

5. **Validación inteligente:**
   - [ ] ¿Se previene gastos >ingresos del mes?
   - [ ] ¿Se avisa si una deuda es "cara" (>25% E.A.)?
   - [ ] ¿Se sugiere consolidación si hay muchas deudas pequeñas?

---

## 📊 FORMATO DE REPORTE

Por favor, estructura tu análisis así:

```
## 🔴 CRÍTICO (Bloquea uso):
- [ ] Problema 1
  Descripción: ...
  Impacto: ...
  Solución: ...

## 🟠 IMPORTANTE (Degradación UX):
- [ ] Problema 2
  ...

## 🟡 RECOMENDACIÓN (Mejora futura):
- [ ] Problema 3
  ...

## 🟢 BIEN HECHO ✅:
- Lista de cosas que funcionan bien

## 📋 RESUMEN EJECUTIVO:
- Calificación general: X/10
- Listos para producción: Sí/No
- Prioridades inmediatas: 1, 2, 3
```

---

## 🎬 ACCIÓN FINAL

**Después del análisis, te pido:**

1. Una lista de **top 5 cambios críticos** que debo hacer ahora
2. Una lista de **top 5 mejoras** que no bloquean pero hacen grande la app
3. Un **checklist** de cosas a verificar manualmente (screenshots en móvil/tablet/escritorio)
4. **Ejemplos de código** para cada problema (no solo descripción)
5. Una **priorización clara**: ¿Qué hago primero para que sea perfecta?

---

**Gracias por el análisis exhaustivo. Esta app merece ser perfecta.** 🚀