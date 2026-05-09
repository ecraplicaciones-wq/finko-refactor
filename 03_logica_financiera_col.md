# 03 · Lógica Financiera Colombiana — Plano de Ejecución

> **Auditor:** Senior Full-Stack Architect + Mentor Financiero
> **Fecha:** 2026-05-06
> **Alcance:** ley colombiana aplicada, tratamiento de datos, estrategias de pago de deudas (Avalancha y Bola de Nieve), ingresos extra (prima/cesantías), tasas, retenciones, GMF, UVT, mora, reportes a centrales.
> **Premisa:** explicar bien, sin tecnicismos, usando lenguaje colombiano. Y que el código ya implementado sea la fuente de verdad — esto es **documentación de lo que hay + lo que falta refinar**.

---

## 0 · TL;DR — Qué tan correcto está hoy

| Tema | Estado | Veredicto |
|---|:---:|---|
| SMMLV 2026 ($1.750.905) | ✅ | Hardcoded con caducidad 2026-12-31 |
| UVT 2026 ($52.374) | ✅ | Hardcoded con caducidad |
| Tasa de usura E.A. (24.36%) | ⚠️ | Hardcoded **trimestral** — falta automatizar |
| GMF 4×1000 + exención 350 UVT | ✅ | Aplicado correctamente |
| Retención CDT 4% / Ahorro 7% | ✅ | Aplicado en calculadoras |
| Salud independ. 12.5% / Pensión 16% | ✅ | Constantes correctas |
| Prima legal (junio/diciembre) | 🟡 | Hay alerta + calculadora; falta integrar a flujo de caja anual |
| Cesantías + intereses 12% | 🟡 | Hay alerta; falta calculadora dedicada |
| Estrategia Avalancha | ✅ | `ordenarDeudas(deudas, 'avalancha')` — pura, testeada |
| Estrategia Bola de Nieve | ✅ | `ordenarDeudas(deudas, 'bola')` — pura, testeada |
| Mora ≥90 días + Datacrédito | 🟡 | Detectado por `clasificarMora` pero **falta CTA legal explícito** |
| Periodo de cobro Quincena 1/Quincena 2 | ✅ | `S.tipoPeriodo: 'q1'|'q2'` con validación auto |
| Tope DIAN para declarar (1.400 UVT) | ✅ | Constante presente |
| Privacidad (datos solo en device) | ✅ | LocalStorage + manifesto explícito |

> **Lectura corta:** los pilares financieros están sólidos. Lo que falta es **conectar lo aislado** (calculadora de prima → dashboard, cesantías → fondo emergencia, usura → bloqueo de registro de deuda con tasa ilegal).

---

## 1 · Constantes vivas — la base regulatoria

### 1.1 Catálogo actual (`modules/core/constants.js`)

```js
export const SMMLV_2026        = 1_750_905;   // Decreto 0159 - MinTrabajo
export const UVT_2026          = 52_374;      // Resolución DIAN 000238 dic-2025
export const TOPE_DIAN_UVT     = 1_400;       // Art. 594 E.T.
export const TOPE_DIAN         = TOPE_DIAN_UVT * UVT_2026; // $73.323.600
export const TASA_USURA_EA     = 24.36;       // Q1-2026 - Superfinanciera ⚠️ TRIMESTRAL
export const GMF_TASA          = 0.004;       // 4×1000 = 0.4% - Art. 872 E.T.
export const GMF_EXENTO_UVT    = 350;         // Art. 879 E.T.
export const GMF_EXENTO_MONTO  = GMF_EXENTO_UVT * UVT_2026; // $18.330.900
export const SALUD_INDEPEND    = 0.125;       // 12.5% - Art. 204 Ley 100/1993
export const PENSION_INDEPEND  = 0.16;        // 16%   - Art. 18 Ley 100/1993
export const RETEFUENTE_CDT    = 0.04;        // 4%    - Art. 395 E.T. + Decreto 2418/2013
export const RETEFUENTE_AHORRO = 0.07;        // 7%    - Art. 395 E.T.
```

### 1.2 Lo que está bien

✅ **Cada valor tiene su fuente legal** comentada (decreto/artículo).
✅ **Función `verificarVigenciaConstantes()`** alerta en consola cuando faltan ≤ 60 días para que las constantes caduquen (`VENCEN_EN = '2026-12-31'`).
✅ **Inyección automática en HTML** vía `data-const="CLAVE"` → un sólo lugar para mostrar valores.

### 1.3 Lo que falta refinar

#### Auto-actualización de `TASA_USURA_EA` (trimestral)

**Problema:** la tasa de usura cambia **cada trimestre** (Resolución de la Superfinanciera). Hardcodear 24.36% es correcto para Q1-2026 pero seguro queda obsoleta antes de junio. La función `verificarVigenciaConstantes` solo avisa de `VENCEN_EN` anual.

**Propuesta:**

```js
// constants.js — agregar
export const USURA_TRIMESTRES_2026 = {
  '2026-Q1': 24.36,
  '2026-Q2': 25.12,   // se actualiza al publicarse oficialmente
  '2026-Q3': null,    // null = aún no publicada
  '2026-Q4': null,
};

export function tasaUsuraVigente(hoyDate = new Date()) {
  const año = hoyDate.getFullYear();
  const q   = Math.ceil((hoyDate.getMonth() + 1) / 3);
  const key = `${año}-Q${q}`;
  return USURA_TRIMESTRES_2026[key] ?? TASA_USURA_EA;  // fallback al hardcoded
}

// verificarVigenciaConstantes adicional:
export function verificarVigenciaUsura() {
  const hoy = new Date();
  const q   = Math.ceil((hoy.getMonth() + 1) / 3);
  const key = `${hoy.getFullYear()}-Q${q}`;
  if (USURA_TRIMESTRES_2026[key] == null) {
    console.warn(`⚠️ Finko Pro: Falta cargar la tasa de usura del trimestre ${key}. Usando última conocida (${TASA_USURA_EA}% E.A.).`);
  }
}
```

**Beneficio:** la app sigue funcionando con la última tasa conocida (no se rompe), pero **deja un rastro claro en consola** para que se actualice. Documentar en `CONTRIBUTING.md` el ritual trimestral de actualizar este array.

#### Año automático en SMMLV/UVT

Mismo problema: `SMMLV_2026` quedará obsoleto en enero 2027. Sugerencia mínima:

```js
export const SMMLV_POR_AÑO = {
  2024: 1_300_000,
  2025: 1_423_500,
  2026: 1_750_905,
  // 2027: ???   ← se llena al publicarse el decreto en diciembre
};
export const UVT_POR_AÑO = {
  2024: 47_065,
  2025: 49_799,
  2026: 52_374,
};
export function smmlvVigente(año = new Date().getFullYear()) {
  return SMMLV_POR_AÑO[año] ?? SMMLV_POR_AÑO[Math.max(...Object.keys(SMMLV_POR_AÑO).map(Number))];
}
export function uvtVigente(año = new Date().getFullYear()) {
  return UVT_POR_AÑO[año] ?? UVT_POR_AÑO[Math.max(...Object.keys(UVT_POR_AÑO).map(Number))];
}
```

> Esta es una de las **deudas técnicas con menor costo de implementación y mayor impacto** en mantenimiento.

---

## 2 · Estrategia Avalancha — la financieramente más eficiente

### 2.1 Definición

> **Pagás todas las cuotas mínimas + un extra (la "bala") en la deuda con la TASA DE INTERÉS más alta.**
>
> Cuando esa se liquida, transferís toda la "bala" + esa cuota mínima vieja a la deuda con la siguiente tasa más alta. Y así.

**Por qué funciona en plata:** los intereses se calculan sobre el saldo. Atacar la tasa más alta primero **minimiza el total pagado en intereses** durante toda la vida de las deudas.

**Por qué falla emocionalmente para algunos:** las deudas con tasa alta suelen ser las más grandes (tarjetas con saldo gordo). Toma meses ver progreso → frustración → abandono.

### 2.2 Implementación técnica (ya en código)

```js
// modules/dominio/compromisos.js:39
export function ordenarDeudas(deudas, modo = 'avalancha') {
  const copia = [...(deudas || [])];
  if (modo === 'bola') {
    copia.sort((a, b) => {
      const dSaldo = ((a.total ?? 0) - (a.pagado ?? 0)) - ((b.total ?? 0) - (b.pagado ?? 0));
      if (dSaldo !== 0) return dSaldo;
      return (b.tasa || 0) - (a.tasa || 0);
    });
  } else {
    // AVALANCHA
    copia.sort((a, b) => {
      const dTasa = (b.tasa || 0) - (a.tasa || 0);
      if (dTasa !== 0) return dTasa;
      return ((b.total ?? 0) - (b.pagado ?? 0)) - ((a.total ?? 0) - (a.pagado ?? 0));
    });
  }
  return copia;
}
```

✅ **Pura, sin DOM, testeada.**
✅ **Desempate inteligente:** si dos deudas tienen la misma tasa, gana la de saldo mayor.

### 2.3 Lo que falta — la "bala" explícita

Hoy `ordenarDeudas` solo **ordena la lista**. El usuario ve en qué orden atacar pero **no tiene una sugerencia de cuánto extra pagar este mes**. Propuesta:

```js
// compromisos.js — añadir
/**
 * Pure: dado un excedente disponible (capacidad de pago extra), calcula
 * cómo distribuirlo según la estrategia.
 *
 * @param {Array} deudas — ordenadas según `ordenarDeudas`
 * @param {number} excedente — pesos disponibles para "bala"
 * @returns {{
 *   asignaciones: Array<{deudaId, cuotaMinima, balaSugerida}>,
 *   liquidacionEstimada: Array<{deudaId, mesesRestantes}>,
 *   ahorroIntereses: number
 * }}
 */
export function planAtaqueDeuda(deudas, excedente, modo = 'avalancha') {
  const ordenadas = ordenarDeudas(deudas, modo);
  // ... la primera de la lista recibe TODO el excedente como bala
  // ... las siguientes solo cuota mínima hasta liquidar la primera
  // ... cálculo de intereses ahorrados vs pago mínimo plano
}
```

**Donde aparece en UI:**
- Card del Dashboard: "🎯 Tu próxima victoria: pagá $80.000 extra a la **Tarjeta Falabella** (28.5% E.A.). Si lo hacés 3 meses seguidos, la liquidás 8 meses antes."
- Modal de detalle de deuda: gráfico de "amortización vs avalancha vs bola".

### 2.4 Cobertura legal — la usura

Hoy existe `clasificarTasaCredito(taEA, usura)` en `calculadoras.js:65`:

```js
export function clasificarTasaCredito(taEA, usura) {
  if (taEA > usura) return 'usura';
  // ...
}
```

✅ Y en `compromisos.js:1404` aparece el aviso:

```js
const avisoUsura = (tasaEA > TASA_USURA_EA)
  ? `<div style="margin-top:6px;color:var(--dan);font-weight:700;">
       🚨 ¡Ojo! Esa tasa supera la usura legal en Colombia (${TASA_USURA_EA}% E.A.). 
       Es ilegal cobrarte tanto.</div>`
  : '';
```

**Acción pendiente:** **bloquear el registro** de una deuda con `tasa > TASA_USURA_EA` con un mensaje educativo + acciones:

> **🚨 Esta tasa es ilegal en Colombia.**
>
> Cobrar más de **24.36% E.A.** es delito (Art. 305 Código Penal — pena de 2 a 5 años).
>
> **Qué podés hacer:**
> 1. Pedile al prestamista la **tabla de amortización** firmada.
> 2. Reportá a la **Superfinanciera** ([www.superfinanciera.gov.co](https://www.superfinanciera.gov.co)) o a la **DEFENSORÍA del consumidor financiero**.
> 3. Si es un préstamo informal "gota a gota", denunciá al **CTI o Fiscalía** — cobrar usura está penado.
>
> [Registrar igual a 24.36% (legal)] [Cancelar]

Esto **eleva la app de "calculadora" a "aliado del consumidor"**.

---

## 3 · Estrategia Bola de Nieve — la motivacionalmente eficiente

### 3.1 Definición

> **Ordenás las deudas por SALDO de menor a mayor.**
> Pagás cuotas mínimas + bala en la **más chica**. Cuando la liquidás, esa victoria emocional + toda la cuota liberada se va contra la siguiente.

**Por qué funciona emocionalmente:** ves resultados rápido (primer mes podés liquidar la deudita de $200k de un cuñado), eso te da fuerza para seguir.

**Costo:** terminás pagando más intereses totales que con Avalancha (porque tasas altas siguen corriendo más tiempo).

### 3.2 Cuándo recomendar cada estrategia

| Perfil del usuario | Estrategia recomendada | Razón |
|---|---|---|
| **Disciplinado, le importa el dinero óptimo** | 🏔️ **Avalancha** | Menor pago total |
| **Ha intentado pagar deudas y se ha frustrado** | ❄️ **Bola de Nieve** | Necesita victorias emocionales |
| **Tiene 1-2 deudas grandes y muchas chicas (<10% del total)** | Híbrido: bola para las chicas, avalancha para las grandes | Combina momentum con eficiencia |
| **Tiene deudas con tasa <8% E.A.** (créditos hipotecarios, educativos subsidiados) | Avalancha — pero **pagar mínimo, no acelerar** | El dinero rinde más invertido en CDT al 12% E.A. |

**Sugerencia UI:** un quiz corto al primer click en la sección Compromisos:

> "Antes de elegir tu plan: ¿qué te pasa con las deudas?
> ⚪ Las quiero liquidar lo más rápido y barato → **Avalancha**
> ⚪ Cada vez que arranco me canso → **Bola de Nieve**
> ⚪ No sé / mejor explicáme → [Ver guía]"

### 3.3 Algoritmo bola — verificación

✅ **Implementado** correctamente en `ordenarDeudas('bola')`. Tests cubren:
- Saldo igual → desempate por tasa DESC.
- Deuda totalmente pagada → último.
- Lista vacía → array vacío.

---

## 4 · Cuota sugerida — sistema francés

### 4.1 Implementación

```js
// modules/dominio/compromisos.js:192
export function calcularCuotaSugerida({ total, tasaEA = 0, plazoMeses, periodicidad = 'mensual' } = {}) {
  if (!total || total <= 0)            return null;
  if (!plazoMeses || plazoMeses <= 0)  return null;

  const ea = Math.max(0, +tasaEA || 0) / 100;
  const periodosPorAno = periodicidad === 'quincenal' ? 24 : 12;
  const nPeriodos      = periodicidad === 'quincenal' ? plazoMeses * 2 : plazoMeses;
  const i              = ea > 0 ? Math.pow(1 + ea, 1 / periodosPorAno) - 1 : 0;
  // cuota = C × i × (1+i)^n / ((1+i)^n − 1)
  // ...
}
```

### 4.2 Lo que está bien

✅ **Conversión rigurosa E.A. → tasa periódica:** `(1 + EA)^(1/12) − 1` (no la simplificación errónea `EA/12`).
✅ **Soporte quincenal** (clave en CO): `(1 + EA)^(1/24) − 1`.
✅ **Caso `tasaEA = 0`** (préstamos familiares sin interés) → cuota = capital / n.

### 4.3 Lo que se puede agregar

**Tabla de amortización generable** (para mostrar en modal "Detalle deuda"):

```js
export function generarTablaAmortizacion(params) {
  const { cuota, tasaPeriodo, nPeriodos } = calcularCuotaSugerida(params);
  let saldo = params.total;
  const filas = [];
  for (let p = 1; p <= nPeriodos; p++) {
    const interes = saldo * tasaPeriodo;
    const abonoCapital = cuota - interes;
    saldo -= abonoCapital;
    filas.push({ periodo: p, cuota, interes, abonoCapital, saldoFinal: Math.max(0, saldo) });
  }
  return filas;
}
```

**UI:** en el modal de detalle, un botón "📊 Ver desglose mes a mes" que abre la tabla con scroll. Educativo + transparente.

---

## 5 · Mora — alertas legales colombianas

### 5.1 Marco legal

| Días de mora | Consecuencia | Ley/Decreto |
|---:|---|---|
| 1-29 | Recordatorio del acreedor | Costumbre |
| 30+ | Posible **reporte negativo a Datacrédito/CIFIN** previo aviso | Ley 1266/2008 Art. 12-13 |
| 60-90 | Cargos de cobranza, llamadas más insistentes | Decreto 2841/2014 |
| 90+ | Ya debe haber sido reportado a centrales (con permanencia hasta el doble del tiempo de mora) | Ley 1266/2008 |
| 180+ | Posible **demanda judicial**; el saldo se vuelve "cartera vencida" | Código G. Procesal |

### 5.2 Implementación actual (`compromisos.js`)

```js
// modules/dominio/compromisos.js:104
export function clasificarMora(dias) {
  if (!dias || dias <= 0) return null;
  if (dias < 30) return 'leve';
  if (dias < 90) return 'media';
  return 'grave';
}

// :69
export function calcularDiasMora(deuda, fechaRef = new Date(), gastos = []) {
  // calcula contra deuda.diaPago, considerando ya pagado del mes
}
```

✅ **Tres niveles**, ✅ alineados con la ley.

### 5.3 Falta — el aviso preventivo

**Hoy:** alerta cuando ya hay mora.
**Falta:** alerta **antes** de que pase a centrales.

```js
// detectores/atrasos.js (post R1)
export function detectarMoraInminente(deudas, hoyDate = new Date()) {
  // Buscar deudas con diaPago + 25 ≤ hoy < diaPago + 30
  // Esas están a 5 días o menos de ser reportadas a Datacrédito
  return deudas.filter(d => {
    const dias = calcularDiasMora(d, hoyDate);
    return dias >= 25 && dias < 30;
  }).map(d => ({
    id: d.id,
    nombre: d.nombre,
    diasParaReporte: 30 - calcularDiasMora(d, hoyDate),
    saldo: (d.total || 0) - (d.pagado || 0),
    cuotaMin: d.cuota,
  }));
}
```

**UI:** banner rojo prioritario:

> 🚨 **Tu deuda "Tarjeta CMR" está a 3 días de ser reportada a Datacrédito.**
>
> Si pagás antes del **15 de mayo**, evitás el reporte negativo (te perseguiría hasta el **2030**).
>
> Lo mínimo a pagar: **$185.450**.
>
> [Pagar ya] [Ver consejo] [No molestar este mes]

### 5.4 Educación — qué dice Datacrédito

Modal informativo, accesible desde cualquier mora:

> 📚 **¿Qué es un reporte negativo?**
>
> Cuando un banco/almacén te reporta a una central de riesgo (Datacrédito, CIFIN), tu "score crediticio" baja. Esto se traduce en:
>
> - 🚫 No te aprueban créditos
> - 💸 Si te los aprueban, con tasas más altas
> - 🏠 Te pueden negar arriendos (algunos arrendadores consultan)
> - 💼 Algunos empleos lo consultan también
>
> **¿Cuánto tiempo te persigue?**
> El reporte se mantiene **el doble del tiempo que duró la mora**, contado desde que pagaste.
>
> Ejemplo: 6 meses en mora + pagás → 12 meses de reporte después.
> Mínimo legal: 1 año (Ley 1266 Art. 13).
>
> **¿Cómo me limpio?**
> 1. Pagá la deuda (o llegá a acuerdo).
> 2. Pedí al acreedor que te envíe **carta de paz y salvo**.
> 3. Verificá tu reporte gratis en [www.datacredito.com.co](https://www.datacredito.com.co) (1 vez al mes).

---

## 6 · GMF (4×1000) — gravamen siempre presente

### 6.1 Implementación

```js
// constants.js
export const GMF_TASA          = 0.004;       // 4×1000 = 0.4%
export const GMF_EXENTO_UVT    = 350;         // Art. 879 E.T.
export const GMF_EXENTO_MONTO  = GMF_EXENTO_UVT * UVT_2026; // $18.330.900

// uso en compromisos.js:668
montoTotal = fx ? Math.round(mo * (1 + GMF_TASA)) : mo;
```

✅ Tasa correcta.
✅ Exención mensual de 350 UVT por **una sola cuenta** (Art. 879 E.T.).
✅ Toggle por gasto: cada movimiento puede ser `cuatroXMil: true|false`.
✅ Mensaje educativo en `ingresos.js:236`:

> "💡 **Dato que te sirve:** En Colombia podés marcar **una cuenta** como exenta del 4×1000. Los primeros $18.330.900/mes (350 UVT) no pagan ese descuento (Art. 879 E.T.). Pregúntale a tu banco, ¡es tu derecho!"

### 6.2 Lo que falta refinar

**Acumulado mensual exento** — hoy el flag es por gasto, sin acumulado mensual. Si la cuenta marcada como exenta acumula >350 UVT en el mes, el resto sí paga GMF.

**Propuesta:**

```js
// tesoreria.js (post R4)
S.cuentas.push({
  // ... campos existentes ...
  cuentaExentaGMF: false,  // boolean — solo UNA cuenta puede tenerlo en true
  acumuladoExentoMes: 0,   // suma de retiros del mes
  mesAcumulado: 'YYYY-MM',
});

// Helper
export function calcularGMFSobreRetiro(cuenta, monto, hoyMes) {
  if (!cuenta.cuentaExentaGMF) return monto * GMF_TASA;
  // Resetear acumulado si cambió de mes
  const acum = (cuenta.mesAcumulado === hoyMes) ? cuenta.acumuladoExentoMes : 0;
  const espacioExento = Math.max(0, GMF_EXENTO_MONTO - acum);
  const montoExento = Math.min(monto, espacioExento);
  const montoGravado = monto - montoExento;
  return montoGravado * GMF_TASA;
}
```

**UI:** en el modal "Editar cuenta" → checkbox "✅ Esta es mi cuenta exenta del 4×1000". Solo una cuenta puede tener el flag (validación al marcar).

---

## 7 · Prima legal — el ingreso extraordinario semestral

### 7.1 Marco legal

> **Prima de servicios** = 1 mes de salario al año, pagada en **dos partes**: 15 días en junio (a más tardar el 30) y 15 días en diciembre (a más tardar el 20).
>
> Base: Código Sustantivo del Trabajo, Art. 306-308.
> Aplica a: empleados con contrato laboral (no a contratistas / prestación de servicios).

**Cálculo:**
- Si trabajaste todo el semestre: 1 quincena.
- Si trabajaste menos: proporcional → `(salario × días_trabajados) / 360`.
- Comisiones se incluyen.

### 7.2 Implementación actual

✅ **Calculadora dedicada** en `calculadoras.js:545+` (`calcPrima`, `guardarPrima`).
✅ **Alerta estacional** en `ingresos.js:895`:

```js
al.push(`<div class="al alg" style="...">🎉 ¡Es época de Prima/Bono! Si recibiste este dinero extra, regístralo aquí para simular su distribución inteligente.</div>`);
```

✅ **No suma a `S.ingreso`** (decisión correcta — la prima es extraordinaria, no debe inflar el % de ahorro promedio).

### 7.3 Lo que falta — distribución sugerida

Cuando el usuario registra una prima, ofrecer **distribución inteligente** (default que el usuario puede aceptar o ajustar):

| Destino | % sugerido | Justificación |
|---|---:|---|
| Fondo de emergencia | 30% | "Si te queda corta, llegás a 6 meses de cobertura más rápido." |
| Pago extra a deuda con tasa más alta | 25% | "Liquidar tarjeta = 5× más rentable que ahorrar al 12%." |
| Bolsillos de objetivos pendientes | 20% | "Adelantás el viaje, la moto, la matrícula." |
| Inversión (CDT, FIC) | 15% | "Plata que no necesitás en 3-6 meses, que rinda." |
| Disfrute consciente | 10% | "Algo concreto, no en hormigas. Una salida con la familia, un libro." |

UI:

> 🎉 **¡Llegó la prima — $895.450!**
>
> ¿Cómo la repartimos? Acá una sugerencia que te deja arriba:
>
> 🛡️ Fondo emergencia ............... $268.635 (30%)
> 💳 Pago extra "Tarjeta Falabella" ... $223.862 (25%)
> 🎯 Bolsillo "Viaje fin de año" ...... $179.090 (20%)
> 📈 Inversión (CDT 6 meses al 11%) ... $134.317 (15%)
> 🎊 Para disfrutar ................... $89.545 (10%)
>
> [Aplicar esta distribución] [Personalizar]

Esto es **donde la app pasa de ser tracker a ser coach**.

### 7.4 Recordatorio anticipado

Hoy la alerta sale al detectar fechas-clave dentro de mes 6 y 12. Mejorable:

```js
// detectores/calendario.js
export function detectarPrimaProxima(hoyDate = new Date()) {
  const m = hoyDate.getMonth() + 1;
  const d = hoyDate.getDate();
  if (m === 6  && d <= 30) return { prima: 'junio',     diasFaltan: 30 - d };
  if (m === 12 && d <= 20) return { prima: 'diciembre', diasFaltan: 20 - d };
  // Adelanto: 30 días antes
  if (m === 5)              return { prima: 'junio',     diasFaltan: 30 - d + 30 };
  if (m === 11)             return { prima: 'diciembre', diasFaltan: 20 - d + 30 };
  return null;
}
```

UI: 30 días antes de cada prima → banner azul:

> "💰 En **17 días** te llega la prima. ¿Ya pensaste qué hacer con ella?
> Hacé el plan ahora y evitás que se gaste sin sentido."
>
> [Hacer plan de prima] [Recordame en 1 semana]

---

## 8 · Cesantías — el "13.º mes" colombiano

### 8.1 Marco legal

> **Cesantías** = 1 mes de salario al año, **consignadas a un fondo** (Porvenir, Colfondos, Protección, Skandia) antes del **14 de febrero**.
>
> **Intereses sobre cesantías** = 12% anual sobre el saldo de cesantías acumulado, pagados al trabajador antes del **31 de enero**.
>
> Base: Ley 50/1990, Decreto 116/1976.

**Reglas de retiro de cesantías** (importantes):
- ✅ Educación (universidad propia o de hijos)
- ✅ Compra/mejora/liberación de vivienda
- ✅ Desempleo (cierre laboral)
- ❌ Otros usos → tienen que esperar al cierre laboral

### 8.2 Implementación actual

✅ **Alerta estacional** en `ingresos.js:907-910`:

```js
// Enero — intereses
al.push(`<strong>Intereses sobre cesantías:</strong> Antes del <strong>31 de enero</strong>, tu empleador debe pagarte el 12% sobre tus cesantías. Verifica que el depósito haya llegado a tu cuenta.`);

// Febrero — consignación
al.push(`<strong>Consignación de cesantías:</strong> Antes del <strong>14 de febrero</strong>, tu empleador debe consignar tus cesantías al fondo (Porvenir, Colfondos, Protección, Skandia).`);
```

### 8.3 Lo que falta — calculadora dedicada

```js
// calculadoras.js — añadir
/**
 * Cesantías acumuladas + intereses al cierre del año.
 *
 * @param {object} p
 * @param {number} p.salarioMensual
 * @param {number} p.diasTrabajadosAño — 0..360
 * @returns {{
 *   cesantias: number,           // base
 *   intereses: number,           // 12% sobre cesantías
 *   totalAcceso: number,         // intereses (te llegan a cuenta)
 *   queda_en_fondo: number,      // cesantías propiamente dichas
 * }}
 */
export function calcularCesantias({ salarioMensual, diasTrabajadosAño }) {
  if (!salarioMensual || !diasTrabajadosAño) return null;
  const cesantias = (salarioMensual * diasTrabajadosAño) / 360;
  const intereses = cesantias * 0.12 * (diasTrabajadosAño / 360);
  return {
    cesantias,
    intereses,
    totalAcceso: intereses,
    queda_en_fondo: cesantias,
  };
}
```

**UI:** dentro del Plan, botón "📅 Mis cesantías de este año".

### 8.4 Educación — usos correctos

Mensaje educativo cuando el usuario lo abre por primera vez:

> 💼 **Tus cesantías son plata que ya ganaste.**
>
> Pero ojo: están "atrapadas" en un fondo (Porvenir, Colfondos…). Solo las podés sacar para:
>
> 1. **Educación** — tuya o de tus hijos (matrícula, libros).
> 2. **Vivienda** — comprar, mejorar o pagar el saldo de tu casa.
> 3. **Si te quedás sin trabajo** — quedan disponibles automáticamente.
>
> Para cualquier otro uso, **toca esperar a que cambies de empleo o se cierre tu contrato**.
>
> 💡 **Dato:** los intereses (12% del saldo) sí te los pagan **a tu cuenta corriente** en enero. Esa plata sí es de libre disposición.

---

## 9 · Inversiones simples — que el usuario entienda

### 9.1 CDT — el primer paso de muchos

**Implementado** en `calculadoras.js`:
- Tasa E.A. ingresable.
- Plazo en días/meses.
- Retención del 4% sobre intereses (`RETEFUENTE_CDT`).
- Comparación con la usura como banda contextual.

**Falta:** **comparación entre alternativas** (CDT vs ahorro vs FIC). Mensaje educativo:

> 💡 **¿Qué te conviene?**
>
> Si querés rendir tu plata, comparemos:
>
> | Producto | Tasa típica E.A. | Liquidez | Retención |
> |---|---:|---|---|
> | Cuenta de ahorros | 0.5 - 4% | Inmediata | 7% |
> | CDT 90 días | 9 - 11% | Bloqueado | 4% |
> | CDT 360 días | 11 - 13% | Bloqueado | 4% |
> | FIC conservador | 8 - 11% | 1-3 días | Variable |
> | Bonos del gobierno | 10 - 13% | 1-2 días | Variable |
>
> **Regla rápida:**
> - Plata para emergencias → cuenta de ahorros (ojo a la inflación).
> - Plata que no usás en 3-6 meses → CDT.
> - Plata que no usás en 1+ año → FIC + bonos (pero con asesor).

### 9.2 Inflación — la enemiga silenciosa

**Implementado** `cInf` en `calculadoras.js`. Mensaje sugerido:

> 📉 **Tu plata pierde valor mientras duerme.**
>
> Si hoy tenés **$1.000.000** en una cuenta sin rendimiento, en 1 año (con inflación 6%) **te alcanzará para comprar lo que hoy vale $943.000**.
>
> Es como si te estuvieran cobrando $57.000 al año por mantenerla quieta.
>
> 💡 **Solución:** si la podés mover a un CDT al 11%, ese mismo millón se vuelve $1.110.000. Le ganás a la inflación + $50.000 reales.

### 9.3 Regla del 72 — heurística simple

`cR72` en `calculadoras.js`. Mensaje:

> ⚡ **¿En cuánto se duplica mi plata?**
>
> Regla del 72: dividí 72 entre la tasa anual.
>
> - CDT al 12% → en **6 años** la duplicás
> - Acción al 18% → en **4 años**
> - FIC al 9% → en **8 años**
>
> No es exacto, pero te da una intuición sin saber finanzas.

---

## 10 · Tope DIAN para declarar — alerta tributaria

### 10.1 Marco legal

> Si tus ingresos brutos del año exceden **1.400 UVT** (Art. 594 del E.T.), debes declarar renta. Para 2026: **$73.323.600**.
>
> Otros umbrales:
> - Patrimonio bruto al 31-dic > 4.500 UVT ($235.683.000).
> - Compras o consumos > 1.400 UVT ($73.323.600).
> - Consignaciones bancarias > 1.400 UVT ($73.323.600).

### 10.2 Implementación actual

✅ Constante `TOPE_DIAN` calculada.
🟡 No hay detector que alerte cuando los ingresos del año del usuario se acercan al umbral.

### 10.3 Detector propuesto

```js
// detectores/tributario.js
export function detectarUmbralDIAN(ingresoAnualEstimado) {
  const ratio = ingresoAnualEstimado / TOPE_DIAN;
  if (ratio >= 0.95) return { nivel: 'critico', faltan: TOPE_DIAN - ingresoAnualEstimado };
  if (ratio >= 0.80) return { nivel: 'alerta',  faltan: TOPE_DIAN - ingresoAnualEstimado };
  if (ratio >= 0.60) return { nivel: 'info',    faltan: TOPE_DIAN - ingresoAnualEstimado };
  return null;
}
```

**UI:** en el dashboard, cuando aplique:

> 📑 **Vas en $61.420.000 acumulados este año (84% del tope DIAN).**
>
> Si superás los **$73.323.600**, tendrás que **declarar renta** el año que viene.
>
> 💡 **Empezá a guardar facturas/soportes ahora** — vas a necesitarlos.
>
> [Ver guía rápida de qué guardar] [Disable este aviso]

---

## 11 · Personas independientes — salud y pensión

### 11.1 Marco legal

> **Independientes con ingresos > 1 SMMLV/mes** deben aportar al SGSSS:
>
> - **Salud:** 12.5% sobre el 40% del ingreso bruto (IBC).
> - **Pensión:** 16% sobre el mismo IBC.
>
> Base: Ley 1753/2015 Art. 135, Art. 204 Ley 100/1993.

### 11.2 Implementación actual

✅ Constantes `SALUD_INDEPEND = 0.125` y `PENSION_INDEPEND = 0.16`.
✅ Función `cPila` (calculadora de aportes) en `calculadoras.js`.

### 11.3 Falta

**Recordatorio recurrente** para usuarios independientes:

> 💼 **¿Vas como independiente?**
>
> No te olvides aportar a salud y pensión cada mes (ojo, antes del **día 15-20** según último dígito de cédula).
>
> En tu IBC de **$2.800.000**:
> - Salud (12.5%): **$350.000**
> - Pensión (16%): **$448.000**
> - **Total mensual: $798.000**
>
> [Calcular mi PILA] [Marcar pagado este mes]

UI: agregar un toggle en el perfil → "Soy independiente / mixto / empleado". Si selecciona "independiente" o "mixto", se activa el detector mensual.

---

## 12 · Tratamiento de datos — privacidad

### 12.1 Estado actual — bandera roja para empezar

| Ámbito | Estado |
|---|:---:|
| Datos del usuario salen del dispositivo | ❌ Nunca |
| Telemetría / analytics | ❌ No hay |
| Cuentas / login | ❌ No hay |
| Servidores backend | ❌ No hay |
| Backup automático en la nube | ❌ No hay |
| Persistencia | ✅ Solo `localStorage` |
| Recuperación | ✅ 3 snapshots rotativos + slot de undo |

> **Mensaje ya implementado** (manifest, alerta offline, onboarding propuesto):
> "Todo se queda en este celular. Nada se sube a internet."

### 12.2 Esto es una **ventaja competitiva** — comunicarla mejor

A nivel UX/marketing:

- En el onboarding: línea explícita "🔒 Sin login. Sin cuentas. Sin servidores. Tu plata es tuya, los datos también."
- En el footer del Dashboard: chip discreto "🔒 100% local" que al hover/tap muestre "Tus datos no salen de este dispositivo."
- En el menú "Más": botón "🔒 ¿Cómo se guardan mis datos?" con explicación de localStorage + snapshots + undo.

### 12.3 Riesgos a comunicar honestamente

**Tres cosas que pueden borrar los datos del usuario:**

1. Limpiar caché/datos del navegador.
2. Reinstalar el app o cambiar de dispositivo.
3. Modo incógnito (no persiste).

**Mitigaciones existentes:**
- Banner "Exportá un backup" cada 30 días sin uso.
- Snapshots rotativos resucitan tras corrupción.
- Undo de 1 paso en operaciones destructivas.

**Falta:**
- Importar desde backup automático al instalar en nuevo dispositivo (vía PWA share-target o subida manual del JSON).
- Opcional: backup automático a Google Drive / iCloud (con consentimiento explícito). **Pero esto rompe la promesa "100% local"** — tradeoff a discutir con el usuario final.

---

## 13 · Otros temas locales — checklist rápido

| Tema | Implementado | Ubicación |
|---|:---:|---|
| Quincena 1 (1-15) y Quincena 2 (16-31) | ✅ | `S.tipoPeriodo`, `validarTipoPeriodo` |
| Cierre quincena (`cerrarQ`) | ✅ | `ingresos.js` |
| Bancos colombianos (Nequi, Daviplata, Bancolombia, BBVA…) | ✅ | `BANCOS_CO` (17 bancos + "otro") |
| Préstamos personales informales (familia/amigos) | ✅ | "Me Deben" — sección R3 |
| Suscripciones recurrentes | ✅ | Gastos fijos con periodicidad |
| Día festivos / lunes festivo | ❌ | No considerado en agenda — bajo impacto |
| Salario mínimo integral (10 SMMLV + 30%) | 🟡 | No diferenciado |
| Subsidio familiar (caja compensación) | ❌ | Roadmap futuro |
| Auxilio de transporte (CO) | ❌ | Roadmap futuro |
| Régimen simple de tributación | ❌ | Solo si Finko llega a cubrir nano-emprendedores |

---

## 14 · Tabla maestra — lógica financiera

| # | Acción | Esfuerzo | Impacto | Riesgo |
|---|---|:---:|:---:|:---:|
| F1 | Auto-actualización trimestral de `TASA_USURA_EA` (array por trimestre) | 1 h | Medio | 🟢 |
| F2 | Helper `smmlvVigente(año)` y `uvtVigente(año)` | 30 min | Bajo (cuando llegue 2027) | 🟢 |
| F3 | `planAtaqueDeuda` (asigna "bala" según estrategia) | 3 h | Alto | 🟡 |
| F4 | Bloquear registro de deuda con tasa > usura + mensaje legal | 1 h | Alto | 🟢 |
| F5 | Detector `detectarMoraInminente` (5 días antes de Datacrédito) | 2 h | Alto | 🟡 |
| F6 | Modal educativo "¿Qué es Datacrédito?" | 1 h | Medio | 🟢 |
| F7 | GMF: acumulado mensual de cuenta exenta + helper `calcularGMFSobreRetiro` | 2 h | Medio | 🟡 |
| F8 | Distribución sugerida de prima al registrarla | 2 h | Alto | 🟢 |
| F9 | Recordatorio prima 30 días antes (mayo y noviembre) | 1 h | Alto | 🟢 |
| F10 | Calculadora de cesantías + intereses + educación de usos | 2 h | Medio | 🟢 |
| F11 | Comparativa CDT/FIC/ahorro/bonos (modal educativo) | 1.5 h | Medio | 🟢 |
| F12 | Detector umbral DIAN (>80% de 1400 UVT) | 1 h | Medio | 🟢 |
| F13 | Recordatorio mensual aportes salud+pensión (toggle "soy independiente") | 2 h | Medio | 🟡 |
| F14 | Tabla de amortización en modal de deuda | 2 h | Medio | 🟢 |
| F15 | Onboarding del primer cierre de quincena (`cerrarQ`) — explicación paso a paso | 1.5 h | Alto | 🟡 |

> Total: **~24 h**. Todas las acciones se pueden hacer **sin tocar el motor de cálculo existente** — son agregados puros + UI.

---

## 15 · Cierre

Finko Pro hoy ya implementa **8 de las 12 reglas duras** de finanzas personales colombianas:

✅ Quincenas correctas
✅ Avalancha + Bola de Nieve puras y testeadas
✅ Cuota sugerida con sistema francés
✅ Mora clasificada por umbrales legales
✅ GMF con exención por cuenta
✅ Tasa de usura como límite/aviso
✅ Prima registrada como ingreso extraordinario
✅ Cesantías como alertas estacionales

Falta:

⚠️ Distribución sugerida de la prima (no del registro, sino del **destino**)
⚠️ Detector preventivo "antes de Datacrédito"
⚠️ Calculadora dedicada de cesantías
⚠️ Bloqueo legal explícito de deudas con tasa de usura
⚠️ Detector de umbral DIAN
⚠️ Auto-actualización trimestral de la tasa de usura

Con esos 6 movimientos (~15 horas), Finko pasa de **calculadora + tracker** a **coach financiero personal** alineado con la legislación colombiana.

— *Fin del Plano 03 · Próximo: [04_roadmap_ejecucion.md](04_roadmap_ejecucion.md)*