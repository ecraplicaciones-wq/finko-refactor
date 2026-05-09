# Lógica Financiera y Ley Colombiana — Finko Pro

> **Documento vivo.** Revisión trimestral obligatoria por cambios legales (tasa de usura, SMMLV, UVT).
> **Última revisión:** 2026‑05‑07.
> **Próxima revisión obligatoria:** 2026‑08‑01 (cambio Q3 de tasa de usura).

---

## 1 · Objetivo

Documentar **toda la lógica financiera** que vive en la app y **todas las reglas legales colombianas** que la afectan, en lenguaje simple, con:

- Constantes vigentes (con su origen y vencimiento).
- Estrategias para el usuario (Avalancha, Bola de Nieve, nudges).
- Detectores y alertas legales.
- Gaps conocidos y plan para cubrirlos.

Audiencia: dev de dominio, auditor financiero, persona curiosa que quiera entender cómo decide la app.

---

## 2 · Alcance

Cubre:

- Constantes legales (SMMLV, UVT, GMF, usura, retenciones, PILA, DIAN, Datacrédito).
- Cálculos financieros (cuota fija, mora, interés compuesto, capacidad de endeudamiento).
- Estrategias de pago de deudas (Avalancha, Bola de Nieve).
- Estrategias de ayuda (nudges, semáforo, salud financiera, logros).
- Reglas legales colombianas que la app respeta o monitorea.

No cubre:

- Asesoría financiera personal (la app **informa**, no recomienda inversiones específicas).
- Cumplimiento tributario individual (la app alerta umbrales DIAN pero no llena formularios).

---

## 3 · Estado actual

### 3.1 · Constantes vivas en `modules/core/constants.js`

| Constante | Valor 2026 | Origen | Vence |
|---|---|---|---|
| `SMMLV_2026` | $1.750.905 | Decreto Min. Trabajo (anual) | 31 dic 2026 |
| `UVT_2026` | $52.374 | Resolución DIAN | 31 dic 2026 |
| `GMF_TASA` | 0.4% (4×1000) | Estatuto Tributario Art. 870 | indefinida (ley) |
| `GMF_EXENCION_UVT_MES` | 350 UVT | E.T. Art. 879 | indefinida |
| `USURA_EA` | 24.36% | Superfinanciera (trimestral) | **30 jun 2026 (Q2)** ⚠️ |
| `RETENCION_CDT` | 4% | E.T. (rendimientos financieros) | indefinida |
| `RETENCION_AHORRO` | 7% | E.T. | indefinida |
| `SALUD_INDEPENDIENTE` | 12.5% | Ley 100/93 + reformas | indefinida |
| `PENSION_INDEPENDIENTE` | 16% | Ley 100/93 | indefinida |
| `DIAN_TOPE_UVT` | 1.400 UVT | E.T. art. 594-3 | indefinida |
| `DATACREDITO_DIAS` | 30 días | Ley 1266/2008 (habeas data) | indefinida |
| `BANCOS` | catálogo de 25+ entidades CO | manual | revisar 2x/año |

### 3.2 · Funciones financieras puras (testeadas)

| Función | Archivo | Tests | Notas |
|---|---|---|---|
| `ordenarDeudas(deudas, modo)` | `compromisos.js:39` | 8 | Avalancha (tasa DESC) / Bola (pendiente ASC) |
| `calcularDiasMora(deuda, fecha, gastos)` | `compromisos.js:69` | 8 | Considera pago del mes; clamp febrero bisiesto |
| `clasificarMora(dias)` | `compromisos.js:104` | — | Leve / media / grave (umbrales legales) |
| `calcularCuotaSugerida(C, EA, n, freq)` | `compromisos.js:192` | 2 | Sistema francés. Conversión EA→periódica rigurosa |
| `clasificarCargaDeuda(pct)` | `compromisos.js:155` | 4 | Semáforo capacidad endeudamiento |
| `clasificarTasaCredito(EA, usura)` | `calculadoras.js:65` | 3 | Razonable / estándar / alta / usura |
| `calcularSaludFinanciera(S)` | `analisis.js` | 8 | 6 componentes ponderados, score 0-100 |
| `cCDT(C, EA, dias, ret)` | `calculadoras.js` | 5 | CDT con retención |
| `cCre(C, EA, n)` | `calculadoras.js` | 4 | Crédito sistema francés |
| `cComp(C, EA, n, periodos)` | `calculadoras.js` | 3 | Interés compuesto |
| `cR72(EA)` | `calculadoras.js` | 2 | Regla del 72 |
| `cPrima(salario, dias)` | `calculadoras.js` | 4 | Prima legal proporcional |

### 3.3 · Detectores / nudges existentes

| Nudge | Disparador | Acción |
|---|---|---|
| Hormiga + impacto anual | Gasto < 20.000 con repetición | Banner: "$X al año si seguís así" |
| Top 3 hormigas del mes | Dashboard | Lista agregada por descripción |
| Racha sin hormiga | Días consecutivos sin hormiga | Widget de motivación |
| Racha de ahorro | Aportes consecutivos a fondo / metas | Widget |
| Deudas durmiendo | 2+ meses sin pago en una deuda | Alerta dashboard, severidad alta/media/baja |
| Fijos sin pagar este mes | Día > fecha de pago sin marcar | Banner por urgencia (leve/moderada/urgente) |
| Meses sin cerrar | Quincenas anteriores con datos sin consolidar | Recordatorio dashboard |
| Salud financiera | Score 6 componentes | Indicador permanente dashboard |
| 20+ logros | Eventos específicos (cierre quincena, fondo completo, etc.) | Toast + S.logros.desbloqueados |
| Comparación quincena vs anterior | Cierre de quincena | Card de delta % |
| Aviso prima estacional | Junio / diciembre | Banner |
| Aviso cesantías estacional | Enero (intereses) / febrero (consignación) | Banner |
| Tasa de crédito alta | Al ingresar deuda con EA cercana a usura | Aviso, no bloquea |

### 3.4 · Tests financieros

- 1.311 tests totales.
- ~85% cobertura de la lógica financiera crítica.
- Tests de migraciones cubren v0→v5 con fixtures realistas.
- Edge cases: febrero bisiesto, día 31 en mes de 30, tasas en límite, ingresos cero.

---

## 4 · Problemas detectados

### 4.1 · Críticos

| # | Problema |
|---|---|
| **F‑C1** | Tasa de usura hardcoded a 24.36% Q1‑2026; `verificarVigenciaConstantes()` solo emite warning, no auto‑actualiza |
| **F‑C2** | Deudas con tasa > usura permiten registro sin bloqueo legal explícito |
| **F‑C3** | Sin detector de **mora inminente** (5 días antes de los 30 → reporte Datacrédito) |

### 4.2 · Altos

| # | Problema |
|---|---|
| **F‑A1** | Prima registrada sin sugerencia de distribución → usuarios la gastan en impulso |
| **F‑A2** | Cesantías no tienen calculadora dedicada (solo aviso estacional) |
| **F‑A3** | GMF se calcula por gasto pero no se acumula mensual por cuenta exenta (350 UVT) |
| **F‑A4** | `planAtaqueDeuda(strategy, balaMensual)` no existe (estrategia ordena pero no sugiere monto óptimo) |
| **F‑A5** | Falta tabla de amortización dinámica para cada deuda |
| **F‑A6** | Falta detector de umbral DIAN (1.400 UVT en ingresos = obligación de declarar) |
| **F‑A7** | Catálogo de bancos podría desactualizarse (sin auto‑update) |

### 4.3 · Medios

| # | Problema |
|---|---|
| **F‑M1** | SMMLV/UVT histórico (2024, 2025) no expuesto — útil para usuarios que registren periodos viejos |
| **F‑M2** | `calculadoras.test.js` con cobertura parcial (35 tests) |
| **F‑M3** | Sin enlace a fuentes oficiales en UI (Superfinanciera, DIAN) |

---

## 5 · Constantes legales — referencia detallada

### 5.1 · SMMLV (Salario Mínimo Mensual Legal Vigente)

- **2026:** $1.750.905 / mes.
- Auxilio de transporte 2026: $216.000 (no incluido en SMMLV pero se suma para cálculos como cesantías de empleados que ganan ≤ 2 SMMLV).
- **Origen:** Decreto Ministerio de Trabajo, publicado en diciembre del año anterior.
- **Uso en la app:**
  - Comparativa de ingresos del usuario vs SMMLV (semáforo de poder adquisitivo).
  - Cálculo de cesantías para empleados.
  - Cálculo de PILA para independientes (base mínima 1 SMMLV).

### 5.2 · UVT (Unidad de Valor Tributario)

- **2026:** $52.374.
- **Origen:** Resolución DIAN, fijada en noviembre del año anterior.
- **Uso en la app:**
  - Conversión de cifras legales (350 UVT, 1.400 UVT, etc.).
  - Tope DIAN de obligación de declarar.
  - Exención mensual GMF.

### 5.3 · GMF (Gravamen a Movimientos Financieros, "4 × 1000")

- **Tasa:** 0.4% del valor de la transacción.
- **Exención:** primeras 350 UVT/mes en **una sola cuenta** marcada por el usuario en el banco (Art. 879 E.T.).
- **No grava:** transferencias entre cuentas del mismo titular en el mismo banco; ciertas operaciones específicas.
- **Uso en la app:**
  - Toggle por gasto: ¿este movimiento aplica GMF?
  - Acumulado mensual de cuenta exenta (gap F‑A3).
  - Cálculo de costo real de transferencia.

### 5.4 · Tasa de usura

- **Q1‑2026 (E.A.):** 24.36%.
- **Q2‑2026:** se publica el 1 de abril de 2026 → **debe actualizarse antes del 30 jun 2026**.
- **Origen:** Superfinanciera, Resolución trimestral.
- **Definición legal:** la tasa de interés EA cobrada por crédito de consumo y ordinario; cobrar por encima es **usura, delito penal** (Art. 305 Código Penal).
- **Uso en la app:**
  - Aviso al ingresar deuda con tasa > usura.
  - Bloqueo educativo recomendado (gap F‑C2).
  - Comparación con tasas de mercado.

### 5.5 · Retenciones financieras

- **CDT (rendimientos):** 4% sobre rendimientos.
- **Cuenta de ahorros (rendimientos):** 7% sobre el exceso del umbral exento.
- **Origen:** Estatuto Tributario, art. 102‑1, 395.
- **Uso en la app:**
  - Calculadora CDT con toggle "aplicar retención".
  - Estimación de rendimiento neto.

### 5.6 · PILA (Planilla Integrada de Liquidación de Aportes) — independientes

- **Salud:** 12.5% de la base de cotización (mínimo 1 SMMLV).
- **Pensión:** 16% de la base de cotización.
- **Riesgo Laboral (ARL):** depende del riesgo (0.522% – 6.96%).
- **Origen:** Ley 100/93 + Decreto 1273/2018.
- **Uso en la app:**
  - Calculadora de costo PILA mensual para independientes.
  - Recordatorio de fecha de pago (variable según último dígito del NIT).

### 5.7 · Datacrédito (centrales de riesgo)

- **Reporte negativo:** se puede reportar tras **30 días de mora** (Ley 1266/2008, art. 13).
- **Permanencia del reporte:** doble del tiempo de mora, máximo 4 años desde el pago.
- **Notificación al deudor:** obligatoria 20 días antes del reporte.
- **Uso en la app:**
  - Detector de mora inminente (gap F‑C3): alerta a 25 días.
  - Educación al usuario sobre habeas data.

### 5.8 · DIAN — obligación de declarar

- **2026:** ingresos brutos ≥ 1.400 UVT = $73.323.600/año → debe declarar renta.
- **Otros umbrales:** patrimonio bruto, consumos con tarjeta, consignaciones bancarias.
- **Uso en la app:**
  - Detector de cercanía al umbral.
  - Avisos no invasivos cuando los ingresos del año superen el 80% del umbral.

---

## 6 · Estrategias para el usuario

### 6.1 · Avalancha

**Idea simple:** primero pagás la deuda con la tasa de interés más alta, sin importar el saldo. Te ahorra la mayor cantidad de plata en intereses a largo plazo.

**Implementación:**

```js
// modules/dominio/compromisos.js
function ordenarDeudasAvalancha(deudas) {
  return [...deudas].sort((a, b) => {
    if (b.tasaEA !== a.tasaEA) return b.tasaEA - a.tasaEA; // tasa DESC
    return b.pendiente - a.pendiente; // desempate por pendiente DESC
  });
}
```

**Cuándo recomendarla:** usuario racional, optimiza dinero, paciente.

**Microcopy:** *"Avalancha: pagá primero la que más caro te cuesta. Te ahorra plata pero las primeras victorias tardan."*

### 6.2 · Bola de Nieve

**Idea simple:** primero pagás la deuda más chica, no importa la tasa. Te da victorias rápidas que te motivan.

**Implementación:**

```js
function ordenarDeudasBolaNieve(deudas) {
  return [...deudas].sort((a, b) => {
    if (a.pendiente !== b.pendiente) return a.pendiente - b.pendiente; // ASC
    return b.tasaEA - a.tasaEA; // desempate por tasa DESC
  });
}
```

**Cuándo recomendarla:** usuario que necesita motivación, propenso a abandonar, varias deudas chicas.

**Microcopy:** *"Bola de nieve: la deuda más chica primero. Vas viendo deudas desaparecer y eso engancha."*

### 6.3 · Quiz "¿Cuál es para mí?"

**Pregunta única (3 opciones):**

> ¿Qué te ayuda más a perseverar?
> 1. 🧠 Saber que estoy ahorrando lo máximo posible (Avalancha)
> 2. 🎉 Tachar deudas rápido aunque sean chicas (Bola de Nieve)
> 3. 🤷 Mostrame las dos opciones, decido yo

Resultado: setea `S.preferenciaDeuda = 'avalancha' | 'bola' | 'manual'`.

### 6.4 · `planAtaqueDeuda` (gap F‑A4)

Función nueva propuesta:

```js
/**
 * Sugiere cuánta "bala" (pago extra) destinar a la deuda focal,
 * según ingreso disponible y estrategia elegida.
 */
function planAtaqueDeuda(deudas, modo, ingresoDisponibleMensual) {
  const ordenadas = ordenarDeudas(deudas, modo);
  const focal = ordenadas[0];
  const cuotasFijas = deudas.reduce((sum, d) => sum + d.cuotaMensual, 0);
  const sobrante = Math.max(0, ingresoDisponibleMensual - cuotasFijas);
  // 70% del sobrante va a la deuda focal, 30% a fondo si está incompleto
  const balaParaFocal = Math.round(sobrante * 0.70);
  const tiempoEstimado = focal.pendiente / (focal.cuotaMensual + balaParaFocal);
  return { focal, balaParaFocal, tiempoEstimadoMeses: Math.ceil(tiempoEstimado) };
}
```

### 6.5 · Otras estrategias (recomendadas para futuras versiones)

- **Consolidación:** si tenés 3+ deudas pequeñas con tasas altas, evaluar tomar un crédito único de menor tasa para pagarlas todas. La app puede sugerirlo cuando detecta el patrón.
- **Refinanciación:** negociar con el banco actual una tasa menor o plazo extendido.
- **50/30/20 ajustado a CO:** 50% necesidades / 30% deseos / 20% ahorro+deuda. La app puede mostrar la repartición real del usuario vs el ideal.
- **Pago quincenal de la cuota mensual:** dividir la cuota en dos pagos al mes acelera el pago y reduce intereses (técnica de "26 cuotas en lugar de 12" para créditos largos).

---

## 7 · Reglas y detectores legales

### 7.1 · Bloqueo de tasa ilegal (gap F‑C2)

**Reglas:**

- Si `deuda.tasaEA > USURA_EA` → al guardar, mostrar modal:
  - Título: "Esa tasa no es legal en Colombia"
  - Cuerpo: "La tasa de usura vigente es 24.36%. Cobrar más es delito (Art. 305 Código Penal). ¿Estás seguro de que la tasa es correcta?"
  - Acciones:
    - "Sí, así me la cobran" → registra con flag `legalmenteIlegal: true` para alertas posteriores.
    - "No, voy a corregir" → vuelve al formulario.
    - "Quiero ayuda" → enlace a Superfinanciera + Defensoría del Consumidor Financiero.

### 7.2 · Mora inminente (gap F‑C3)

**Función:**

```js
function detectarMoraInminente(deudas, hoy = new Date()) {
  return deudas
    .map(d => ({ deuda: d, dias: calcularDiasMora(d, hoy) }))
    .filter(({ dias }) => dias >= 25 && dias < 30);
}
```

**Acción UI:**

- Banner urgente con countdown: "En 5 días tu deuda con [Banco X] cumple 30 días de mora. A los 30 te pueden reportar a Datacrédito."
- CTA "Pagar ahora" → abre modal de pago.
- Educación contextual sobre habeas data.

### 7.3 · Auto‑actualización de tasa de usura

**Plan:**

```js
// constants.js
export const USURA_TRIMESTRES = {
  '2026-Q1': 24.36,
  '2026-Q2': null, // por publicar
  '2026-Q3': null,
  '2026-Q4': null,
};

export function obtenerUsuraVigente(hoy = new Date()) {
  const trimestre = `${hoy.getFullYear()}-Q${Math.floor(hoy.getMonth() / 3) + 1}`;
  const valor = USURA_TRIMESTRES[trimestre];
  if (valor === null || valor === undefined) {
    console.warn(`⚠️ Tasa de usura ${trimestre} no actualizada. Usando último valor conocido.`);
    return Object.values(USURA_TRIMESTRES).filter(v => v != null).at(-1);
  }
  return valor;
}
```

**Ritual del equipo:** cada trimestre, 1 hora para actualizar el archivo y bumpear `CACHE_NAME` del Service Worker.

### 7.4 · Acumulado GMF mensual por cuenta exenta (gap F‑A3)

```js
// state.js: agregar a cada cuenta
S.cuentas.forEach(c => {
  c.cuentaExentaGMF = false; // se selecciona una sola
  c.acumuladoExentoMes = 0;  // se resetea cada mes
  c.mesAcumuladoRef = '2026-05'; // formato YYYY-MM
});

// Al registrar transferencia desde cuenta exenta:
function calcularGMFSobreRetiro(cuenta, monto) {
  const mesActual = mesStr(new Date());
  if (cuenta.mesAcumuladoRef !== mesActual) {
    cuenta.mesAcumuladoRef = mesActual;
    cuenta.acumuladoExentoMes = 0;
  }
  const tope = 350 * UVT_2026;
  const restante = Math.max(0, tope - cuenta.acumuladoExentoMes);
  const exentoAhora = Math.min(monto, restante);
  const gravado = monto - exentoAhora;
  cuenta.acumuladoExentoMes += exentoAhora;
  return Math.round(gravado * GMF_TASA);
}
```

### 7.5 · Detector de umbral DIAN (gap F‑A6)

```js
function detectarCercaniaUmbralDIAN(ingresosAnuales) {
  const tope = 1400 * UVT_2026; // $73.323.600 en 2026
  const pct = ingresosAnuales / tope;
  if (pct >= 1.0) return { nivel: 'obligado', mensaje: 'Debés declarar renta.' };
  if (pct >= 0.80) return { nivel: 'cerca', mensaje: 'Estás cerca del umbral DIAN. Considerá hablar con un contador.' };
  return null;
}
```

---

## 8 · Salud financiera (6 componentes)

| Componente | Peso | Cálculo | Umbrales |
|---|---:|---|---|
| Sin atrasos | 25% | Ningún fijo, deuda o objetivo atrasado | 100% si todo al día; 0% si hay ≥1 atraso grave |
| Ahorrando | 25% | % ingreso destinado a ahorro/inversión | ≥20%: 100; ≥10%: 60; <5%: 0 |
| Fondo de emergencia | 20% | Meses cubiertos | 6+: 100; 3: 50; 0: 0 |
| Deudas controladas | 15% | Cuotas mensuales / ingreso | ≤25%: 100; ≤40%: 75; ≤60%: 40; >60%: 0 |
| Backup reciente | 10% | Días desde último export | ≤30d: 100; ≤90d: 60; >90d: 0 |
| Hormigas controladas | 5% | % ingreso en hormigas | ≤5%: 100; ≤10%: 60; >15%: 0 |

**Etiquetas:**

- 90‑100: Excelente
- 70‑89: Buena
- 40‑69: Mejorable
- 0‑39: Crítica

---

## 9 · Logros (gamificación)

20+ logros vivos en `analisis.js`. Documentación de los principales:

| Logro | Disparador | Mensaje toast |
|---|---|---|
| 🎉 Primer cierre de quincena | `cerrarQ()` exitoso | "¡Tu primera quincena cerrada! Llevás 1 / ∞ 🎉" |
| 🛡️ Fondo de emergencia activo | Fondo > 0 | "Empezaste tu colchón. Cualquier susto te resbala más." |
| 🏰 Fondo 1 mes | Fondo ≥ ingreso mensual | "Tenés 1 mes cubierto. Eso es libertad." |
| 💎 Fondo 6 meses | Fondo ≥ 6 × ingreso mensual | "6 meses de tranquilidad. Esto es fortaleza financiera." |
| 🪜 Una deuda menos | Deuda saldada | "¡Una menos! Llevás N / total." |
| 🔥 7 días sin hormiga | Racha hormiga = 7 | "Una semana sin hormigas. Sumás $X que no se fueron." |
| 🌟 30 días sin hormiga | Racha = 30 | "Un mes entero sin hormigas. Esto es disciplina." |
| 🎯 Primer objetivo cumplido | Objetivo al 100% | "¡Lo lograste! Lo que era plan ahora es real." |
| 📈 Primera inversión | Inversión > 0 | "Tu plata ya trabaja para vos." |
| 💪 Avalancha activada | Quiz responde Avalancha | "Modo Avalancha. Vamos por las caras primero." |

(Lista completa: `analisis.js` constante `LOGROS`.)

---

## 10 · Catálogo de bancos colombianos

Vive en `constants.js` como `BANCOS = [{id, nombre, codigo}]`. Incluye los más usados:

- Bancolombia
- Davivienda
- BBVA Colombia
- Banco de Bogotá
- Banco Caja Social
- AV Villas
- Banco Popular
- Banco Falabella
- Scotiabank Colpatria
- Itaú
- Citibank
- GNB Sudameris
- Banco Cooperativo Coopcentral
- Banco Agrario
- Banco Pichincha
- Bancoomeva
- Banco Serfinanza
- **Neobancos / billeteras:** Nequi, Daviplata, Movii, Lulo Bank, Ualá, RappiPay
- **Cooperativas comunes:** Cooprocenva, Cotrafa, Confiar
- Tu Caja

**Ritual:** revisión cada 6 meses. Si una entidad cambia nombre o se fusiona (ej. Itaú ↔ CorpBanca), actualizar.

---

## 11 · Glosario para el usuario

(Migrar a `DESIGN_SYSTEM.md §9.2` cuando aplique.)

| Si pensás… | Decimos… |
|---|---|
| Saldo disponible | Tu plata |
| Capacidad de endeudamiento | Cuánto podés pedir prestado tranquilo |
| TNA / TNM / EA | El interés que te cobran al año / al mes |
| Cuota fija | Cuota mensual de la deuda |
| Mora | Días tarde |
| Datacrédito / TransUnion | Centrales de riesgo |
| Aforo | Cuánto plata moviste |
| Indexación | Cómo sube por la inflación |
| Cesantías | Plata extra del trabajo (febrero) |
| Prima | Plata extra del trabajo (junio + diciembre) |
| GMF | "El 4 × 1000" |
| Usura | Lo que la ley considera robo en intereses |

---

## 12 · Fases de ejecución (resumen)

### Fase F‑1 — Auto‑update tasa de usura (1 h)

1. Convertir `USURA_EA` constante única en `USURA_TRIMESTRES` map.
2. Implementar `obtenerUsuraVigente()`.
3. Refactorizar consumidores.
4. Test.

### Fase F‑2 — Bloqueo legal de tasa ilegal (2 h)

1. Modal educativo en flujo de guardar deuda.
2. Flag `legalmenteIlegal` en deuda.
3. Test.

### Fase F‑3 — Mora inminente (2 h)

1. `detectarMoraInminente()` función pura.
2. Banner UI urgente con countdown.
3. Test (ya hay infraestructura en `compromisos.test.js`).

### Fase F‑4 — Distribución sugerida de la prima (2 h)

1. Modal con 5 sliders al registrar prima.
2. Defaults pre-configurados.
3. Posibilidad de ajustar antes de aplicar.

### Fase F‑5 — `planAtaqueDeuda()` (1.5 h)

1. Función pura.
2. Banner en sección Compromisos: "Tu deuda focal: X. Sugerimos abonar Y extra. La saldarías en Z meses."
3. Test.

### Fase F‑6 — Tabla de amortización (2 h)

1. Generar dinámicamente `[{periodo, cuota, interés, capital, saldo}]`.
2. Modal de detalle de deuda con tabla.
3. Test.

### Fase F‑7 — GMF acumulado por cuenta (1.5 h)

1. Migración: agregar campos a cuenta.
2. Helper `calcularGMFSobreRetiro()`.
3. Test.

### Fase F‑8 — Quiz Avalancha vs Bola (1.5 h)

1. Modal con 1 pregunta + 3 opciones.
2. `S.preferenciaDeuda` en estado.
3. Disparador: primera vez que el usuario entra a Compromisos con ≥2 deudas.

### Fase F‑9 — Detector umbral DIAN (1 h)

1. Función pura.
2. Banner informativo (no invasivo).

### Fase F‑10 — Calculadora de cesantías (1 h)

1. Función pura `calcularCesantias(salario, dias, auxTransporte)`.
2. UI dentro del módulo de calculadoras.
3. Test.

**Total estimado:** ~15.5 horas para cerrar todos los gaps.

---

## 13 · Pasos detallados (ejemplo: Fase F‑3)

1. Implementar `detectarMoraInminente(deudas, hoy)` en `compromisos/deudas.js`.
2. Test: 4 casos (mora 24 días → no urgente; 25 → urgente; 29 → urgente; 30 → ya no es inminente, es real).
3. Integrar en `analisis/alertas.js` para alimentar el dashboard.
4. UI: banner rojo con countdown + CTA "Pagar ahora".
5. Microcopy: "En X días tu deuda cumple 30 días de mora. A los 30 te pueden reportar a Datacrédito (Ley 1266/2008)."
6. Verificar a11y (rol="alert", aria-live="assertive").
7. Commit.

---

## 14 · Criterios de verificación

- [ ] Tasa de usura auto-actualizable (al menos con map trimestral).
- [ ] Deudas con tasa > usura tienen modal educativo.
- [ ] `detectarMoraInminente` implementado y testeado.
- [ ] Modal de distribución de prima activo.
- [ ] `planAtaqueDeuda` retorna recomendación coherente.
- [ ] Tabla de amortización accesible por deuda.
- [ ] GMF acumula correctamente por cuenta exenta.
- [ ] Quiz Avalancha vs Bola funcional.
- [ ] Detector DIAN dispara al 80%.
- [ ] Calculadora cesantías disponible.
- [ ] Tests financieros ≥ 90% cobertura.

---

## 15 · Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Constante legal cambia y nadie actualiza | Alta | Alto | Ritual trimestral + warning visible al usuario |
| Auto‑update fetcheando red rompe offline‑first | N/A | N/A | NO se hace fetch; updates manuales con commit |
| Usuario ingresa datos de mora incorrectos | Media | Medio | Validación de fechas + tooltip explicativo |
| Microcopy financiero mal traducido confunde | Media | Bajo | Glosario §11 como fuente única |
| Tasa cambia entre Q1 y Q2 sin que la app lo refleje | Alta | Medio | `verificarVigenciaConstantes()` muestra warning al user |

---

## 16 · Dependencias

- **Bloqueado por:** `REORG_JS.md` (idealmente; los nuevos features se implementan en la nueva estructura).
- **Coordinación con:** `DESIGN_SYSTEM.md` (microcopy, modales nuevos), `ROADMAP.md` (Fase 6).

---

## 17 · Checklist final

- [ ] Constantes vigentes documentadas con vencimiento.
- [ ] Avalancha y Bola de Nieve documentadas.
- [ ] Quiz de estrategia diseñado.
- [ ] Salud financiera (6 componentes) explicada.
- [ ] Logros listados.
- [ ] Catálogo de bancos vivo.
- [ ] Glosario de términos del usuario.
- [ ] 10 fases con estimación.
- [ ] Pasos detallados de ejemplo.
- [ ] Riesgos con mitigación.
- [ ] Ritual trimestral de actualización documentado.

---

*Próximo documento: [`ROADMAP.md`](./ROADMAP.md).*
