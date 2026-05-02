// tests/unit/compromisos.test.js
//
// ✅ R1 (auditoría v5): cobertura del dominio de compromisos (deudas).
//
//  • ordenarDeudas — estrategias avalancha y bola de nieve.
//  • calcularDiasMora — días desde la fecha límite del pago hasta hoy.
//  • clasificarMora — leve / media / grave / null según días.
//  • calcularTiempoRestanteDeuda — proyección meses/años para liquidar.
//  • clasificarCargaDeuda — semáforo cuotas/ingreso.
//
// Las 5 funciones son 100% puras (sin S, sin DOM). Tests directos.

import { describe, it, expect } from 'vitest';
import {
  ordenarDeudas,
  calcularDiasMora,
  clasificarMora,
  calcularTiempoRestanteDeuda,
  clasificarCargaDeuda,
  calcularCuotaSugerida,
  detectarDeudasDurmiendo,
  detectarFijosSinPagarEsteMes,
} from '../../modules/dominio/compromisos.js';

// ─── ordenarDeudas ───────────────────────────────────────────────────────────

describe('ordenarDeudas()', () => {

  const deudas = [
    { id: 1, nombre: 'Tarjeta Visa',       tasa: 28, total: 5_000_000, pagado: 0 },
    { id: 2, nombre: 'Crédito hipotecario', tasa: 12, total: 200_000_000, pagado: 50_000_000 },
    { id: 3, nombre: 'Préstamo amigo',      tasa: 0,  total: 500_000, pagado: 200_000 },
    { id: 4, nombre: 'Crédito libre',       tasa: 18, total: 10_000_000, pagado: 2_000_000 },
  ];

  it('avalancha ordena por tasa DESC (mayor tasa primero)', () => {
    const ordenadas = ordenarDeudas(deudas, 'avalancha');
    expect(ordenadas.map(d => d.id)).toEqual([1, 4, 2, 3]); // 28% → 18% → 12% → 0%
  });

  it('bola de nieve ordena por pendiente ASC (deudas chicas primero)', () => {
    const ordenadas = ordenarDeudas(deudas, 'bola');
    // Pendientes: t1=5M, t2=150M, t3=300k, t4=8M
    expect(ordenadas.map(d => d.id)).toEqual([3, 1, 4, 2]); // 300k → 5M → 8M → 150M
  });

  it('avalancha desempata por pendiente DESC cuando hay tasas iguales', () => {
    const empate = [
      { id: 1, tasa: 20, total: 1_000_000, pagado: 0 },        // pend 1M
      { id: 2, tasa: 20, total: 5_000_000, pagado: 1_000_000 }, // pend 4M
      { id: 3, tasa: 20, total: 2_000_000, pagado: 0 },        // pend 2M
    ];
    const ordenadas = ordenarDeudas(empate, 'avalancha');
    expect(ordenadas.map(d => d.id)).toEqual([2, 3, 1]); // 4M → 2M → 1M
  });

  it('bola desempata por tasa DESC cuando hay pendientes iguales', () => {
    const empate = [
      { id: 1, tasa: 10, total: 1_000_000, pagado: 0 },
      { id: 2, tasa: 30, total: 1_000_000, pagado: 0 },
      { id: 3, tasa: 20, total: 1_000_000, pagado: 0 },
    ];
    const ordenadas = ordenarDeudas(empate, 'bola');
    expect(ordenadas.map(d => d.id)).toEqual([2, 3, 1]); // 30% → 20% → 10%
  });

  it('default es avalancha si modo no se especifica', () => {
    const a = ordenarDeudas(deudas);
    const b = ordenarDeudas(deudas, 'avalancha');
    expect(a.map(d => d.id)).toEqual(b.map(d => d.id));
  });

  it('no muta el array original', () => {
    const original = [...deudas];
    ordenarDeudas(deudas, 'avalancha');
    expect(deudas).toEqual(original);
  });

  it('arrays vacíos / null devuelven array vacío', () => {
    expect(ordenarDeudas([], 'avalancha')).toEqual([]);
    expect(ordenarDeudas(null, 'bola')).toEqual([]);
    expect(ordenarDeudas(undefined)).toEqual([]);
  });

  it('una sola deuda devuelve la misma sola deuda', () => {
    const una = [{ id: 99, tasa: 15, total: 1_000_000, pagado: 0 }];
    expect(ordenarDeudas(una, 'avalancha')).toEqual(una);
    expect(ordenarDeudas(una, 'bola')).toEqual(una);
  });

});

// ─── calcularDiasMora ────────────────────────────────────────────────────────

describe('calcularDiasMora()', () => {

  it('devuelve 0 si la fecha límite aún no llegó', () => {
    const deuda = { id: 1, diaPago: 28, total: 1_000_000, pagado: 0, nombre: 'Tarjeta' };
    const fechaRef = new Date(2026, 3, 10); // 10 abril (antes del 28)
    expect(calcularDiasMora(deuda, fechaRef, [])).toBe(0);
  });

  it('cuenta los días desde la fecha límite cuando hay mora', () => {
    const deuda = { id: 1, diaPago: 5, total: 1_000_000, pagado: 0, nombre: 'Tarjeta' };
    const fechaRef = new Date(2026, 3, 15); // 15 abril (10 días después del 5)
    expect(calcularDiasMora(deuda, fechaRef, [])).toBe(10);
  });

  it('devuelve 0 si la deuda ya está pagada en el mes corriente', () => {
    const deuda = { id: 1, diaPago: 5, total: 1_000_000, pagado: 0, nombre: 'Tarjeta' };
    const fechaRef = new Date(2026, 3, 15);
    const gastos = [
      { cat: 'deudas', deudaId: 1, fecha: '2026-04-08', monto: 100_000, desc: 'Cuota' },
    ];
    expect(calcularDiasMora(deuda, fechaRef, gastos)).toBe(0);
  });

  it('matchea el pago por nombre cuando deudaId no está presente', () => {
    const deuda = { id: 1, diaPago: 5, total: 1_000_000, pagado: 0, nombre: 'Tarjeta Bancolombia' };
    const fechaRef = new Date(2026, 3, 15);
    const gastos = [
      { cat: 'deudas', fecha: '2026-04-10', monto: 100_000, desc: 'Pago tarjeta bancolombia' },
    ];
    expect(calcularDiasMora(deuda, fechaRef, gastos)).toBe(0);
  });

  it('ignora pagos del mes anterior', () => {
    const deuda = { id: 1, diaPago: 5, total: 1_000_000, pagado: 0, nombre: 'Tarjeta' };
    const fechaRef = new Date(2026, 3, 15); // abril
    const gastos = [
      { cat: 'deudas', deudaId: 1, fecha: '2026-03-10', monto: 100_000, desc: 'Cuota' },
    ];
    expect(calcularDiasMora(deuda, fechaRef, gastos)).toBe(10);  // mora sigue
  });

  it('devuelve 0 si la deuda ya está liquidada (pendiente <= 0)', () => {
    const deuda = { id: 1, diaPago: 5, total: 1_000_000, pagado: 1_000_000, nombre: 'Tarjeta' };
    const fechaRef = new Date(2026, 3, 15);
    expect(calcularDiasMora(deuda, fechaRef, [])).toBe(0);
  });

  it('clampea diaPago al último día del mes corriente (sin overflow)', () => {
    // febrero 2026 tiene 28 días. diaPago=30 → fechaLimite = 28 feb (no 2 mar).
    // Con fechaRef = 28 feb, hoyDate == fechaLimite → NO mora (no la pasamos).
    const deuda = { id: 1, diaPago: 30, total: 1_000_000, pagado: 0, nombre: 'X' };
    const fechaRef = new Date(2026, 1, 28);
    expect(calcularDiasMora(deuda, fechaRef, [])).toBe(0);
    // Sin el clamp, fechaLimite = 30 feb que JS interpreta como 2 marzo →
    // hoyDate (28 feb) sería ANTES → 0 también, pero por la razón equivocada.
    // El test crítico: con fechaRef = 1 marzo, ahora getMonth() es marzo, no
    // febrero — la fechaLimite se recalcula al 30 marzo, así que sigue 0.
    const fechaMar1 = new Date(2026, 2, 1);
    expect(calcularDiasMora(deuda, fechaMar1, [])).toBe(0);
  });

  it('default diaPago=1 si no está definido', () => {
    const deuda = { id: 1, total: 1_000_000, pagado: 0, nombre: 'X' };
    const fechaRef = new Date(2026, 3, 8); // 7 días después del 1 abril
    expect(calcularDiasMora(deuda, fechaRef, [])).toBe(7);
  });

  it('matcheo es case-insensitive y tolera tildes en el nombre', () => {
    const deuda = { id: 1, diaPago: 5, total: 1_000_000, pagado: 0, nombre: 'Crédito Vehículo' };
    const fechaRef = new Date(2026, 3, 15);
    const gastos = [
      { cat: 'deudas', fecha: '2026-04-08', monto: 100_000, desc: 'pago credito vehiculo' },
    ];
    expect(calcularDiasMora(deuda, fechaRef, gastos)).toBe(0);
  });

});

// ─── clasificarMora ──────────────────────────────────────────────────────────

describe('clasificarMora()', () => {

  it('0 días → null (sin mora)', () => {
    expect(clasificarMora(0)).toBeNull();
  });

  it('valor negativo → null (sin mora)', () => {
    expect(clasificarMora(-5)).toBeNull();
  });

  it('1–29 días → leve', () => {
    expect(clasificarMora(1)).toBe('leve');
    expect(clasificarMora(15)).toBe('leve');
    expect(clasificarMora(29)).toBe('leve');
  });

  it('30–89 días → media', () => {
    expect(clasificarMora(30)).toBe('media');
    expect(clasificarMora(60)).toBe('media');
    expect(clasificarMora(89)).toBe('media');
  });

  it('90+ días → grave', () => {
    expect(clasificarMora(90)).toBe('grave');
    expect(clasificarMora(180)).toBe('grave');
    expect(clasificarMora(365)).toBe('grave');
  });

});

// ─── calcularTiempoRestanteDeuda ─────────────────────────────────────────────

describe('calcularTiempoRestanteDeuda()', () => {

  it('pendiente <= 0 → liquidada', () => {
    const r = calcularTiempoRestanteDeuda(0, 100_000);
    expect(r.liquidada).toBe(true);
    expect(r.nivel).toBe('liquidada');
    expect(r.mesesRestantes).toBe(0);
  });

  it('1 cuota restante → nivel "final"', () => {
    const r = calcularTiempoRestanteDeuda(100_000, 100_000);
    expect(r.liquidada).toBe(false);
    expect(r.mesesRestantes).toBe(1);
    expect(r.nivel).toBe('final');
  });

  it('cuota mayor que pendiente todavía deja 1 mes (Math.ceil)', () => {
    const r = calcularTiempoRestanteDeuda(50_000, 100_000);
    expect(r.mesesRestantes).toBe(1);
    expect(r.nivel).toBe('final');
  });

  it('2–6 meses → nivel "corto"', () => {
    expect(calcularTiempoRestanteDeuda(200_000, 100_000).nivel).toBe('corto'); // 2
    expect(calcularTiempoRestanteDeuda(600_000, 100_000).nivel).toBe('corto'); // 6
  });

  it('7+ meses → nivel "largo"', () => {
    const r = calcularTiempoRestanteDeuda(700_000, 100_000);
    expect(r.mesesRestantes).toBe(7);
    expect(r.nivel).toBe('largo');
  });

  it('descompone en años + meses correctamente', () => {
    // 30 cuotas mensuales → 2 años, 6 meses
    const r = calcularTiempoRestanteDeuda(3_000_000, 100_000);
    expect(r.mesesRestantes).toBe(30);
    expect(r.anos).toBe(2);
    expect(r.mesesTras).toBe(6);
    expect(r.nivel).toBe('largo');
  });

  it('cuota = 0 → mesesRestantes Infinity (no se liquida nunca)', () => {
    const r = calcularTiempoRestanteDeuda(1_000_000, 0);
    expect(r.liquidada).toBe(false);
    expect(r.mesesRestantes).toBe(Infinity);
    expect(r.nivel).toBe('largo');
  });

  it('cuota negativa o NaN → trato igual que 0', () => {
    const r1 = calcularTiempoRestanteDeuda(1_000_000, -100);
    expect(r1.mesesRestantes).toBe(Infinity);
    const r2 = calcularTiempoRestanteDeuda(1_000_000, NaN);
    expect(r2.mesesRestantes).toBe(Infinity);
  });

  it('redondea hacia arriba con cuota fraccionaria', () => {
    // 1.000.000 / 333.000 = 3.003 → 4 meses (porque la última cuota cubre el resto)
    const r = calcularTiempoRestanteDeuda(1_000_000, 333_000);
    expect(r.mesesRestantes).toBe(4);
    expect(r.nivel).toBe('corto');
  });

});

// ─── clasificarCargaDeuda ────────────────────────────────────────────────────

describe('clasificarCargaDeuda()', () => {

  it('0% → cero', () => {
    const r = clasificarCargaDeuda(0);
    expect(r.nivel).toBe('cero');
    expect(r.emoji).toBe('✅');
  });

  it('1–40% → bien (manejable)', () => {
    expect(clasificarCargaDeuda(1).nivel).toBe('bien');
    expect(clasificarCargaDeuda(20).nivel).toBe('bien');
    expect(clasificarCargaDeuda(40).nivel).toBe('bien');
  });

  it('41–100% → alerta (sobre-endeudamiento)', () => {
    expect(clasificarCargaDeuda(41).nivel).toBe('alerta');
    expect(clasificarCargaDeuda(70).nivel).toBe('alerta');
    expect(clasificarCargaDeuda(100).nivel).toBe('alerta');
  });

  it('>100% → critico (cuotas superan ingreso)', () => {
    expect(clasificarCargaDeuda(101).nivel).toBe('critico');
    expect(clasificarCargaDeuda(150).nivel).toBe('critico');
  });

  it('emoji se ajusta al nivel', () => {
    expect(clasificarCargaDeuda(0).emoji).toBe('✅');
    expect(clasificarCargaDeuda(20).emoji).toBe('✅');
    expect(clasificarCargaDeuda(50).emoji).toBe('⚠️');
    expect(clasificarCargaDeuda(150).emoji).toBe('🚨');
  });

});

// ─── calcularCuotaSugerida (I2 auditoría v5) ─────────────────────────────────

describe('calcularCuotaSugerida()', () => {

  it('inputs inválidos devuelven null', () => {
    expect(calcularCuotaSugerida()).toBeNull();
    expect(calcularCuotaSugerida({})).toBeNull();
    expect(calcularCuotaSugerida({ total: 0,           plazoMeses: 12 })).toBeNull();
    expect(calcularCuotaSugerida({ total: -1_000_000,  plazoMeses: 12 })).toBeNull();
    expect(calcularCuotaSugerida({ total: 1_000_000,   plazoMeses: 0  })).toBeNull();
    expect(calcularCuotaSugerida({ total: 1_000_000,   plazoMeses: -3 })).toBeNull();
  });

  it('sin tasa (0% E.A.): cuota = capital / n períodos', () => {
    const r = calcularCuotaSugerida({ total: 1_200_000, tasaEA: 0, plazoMeses: 12 });
    expect(r.cuota).toBe(100_000);             // 1.2M / 12
    expect(r.totalPagado).toBe(1_200_000);     // sin intereses
    expect(r.totalInteres).toBe(0);
    expect(r.nPeriodos).toBe(12);
    expect(r.tasaPeriodo).toBe(0);
  });

  it('tasaEA omitida = sin intereses', () => {
    const r = calcularCuotaSugerida({ total: 600_000, plazoMeses: 6 });
    expect(r.cuota).toBe(100_000);
    expect(r.totalInteres).toBe(0);
  });

  it('crédito 5M @ 24% E.A. a 12 meses → cuota ≈ 467.263', () => {
    // tm = (1.24)^(1/12) − 1 ≈ 0.018087 (1.8087%/mes)
    // cuota = 5M × tm × (1+tm)^12 / ((1+tm)^12 − 1)
    //       = 5M × 0.022428 / 0.24 ≈ 467_263
    const r = calcularCuotaSugerida({ total: 5_000_000, tasaEA: 24, plazoMeses: 12 });
    expect(Math.round(r.cuota)).toBe(467_263);
    // Total pagado ≈ 5.607M, interés ≈ 607.151
    expect(Math.round(r.totalPagado))  .toBe(5_607_151);
    expect(Math.round(r.totalInteres)) .toBe(607_151);
    expect(r.nPeriodos).toBe(12);
    expect(r.tasaPeriodo).toBeGreaterThan(0.018);
    expect(r.tasaPeriodo).toBeLessThan(0.019);
  });

  it('hipoteca 200M @ 12% E.A. a 240 meses (20 años)', () => {
    const r = calcularCuotaSugerida({ total: 200_000_000, tasaEA: 12, plazoMeses: 240 });
    // tm ≈ 0.949% mensual → cuota ≈ 2.135M
    expect(Math.round(r.cuota)).toBeGreaterThan(2_100_000);
    expect(Math.round(r.cuota)).toBeLessThan(2_200_000);
    expect(r.nPeriodos).toBe(240);
  });

  it('periodicidad quincenal duplica las cuotas y baja la tasa por período', () => {
    // Mismo capital, mismo plazo en MESES, pero cobra quincena → 24 cuotas/año
    const mensual   = calcularCuotaSugerida({ total: 5_000_000, tasaEA: 24, plazoMeses: 12, periodicidad: 'mensual' });
    const quincenal = calcularCuotaSugerida({ total: 5_000_000, tasaEA: 24, plazoMeses: 12, periodicidad: 'quincenal' });
    expect(quincenal.nPeriodos).toBe(24);  // 12 × 2
    expect(quincenal.tasaPeriodo).toBeLessThan(mensual.tasaPeriodo);
    // Cuota quincenal ligeramente MENOR que mensual/2: al pagar más seguido,
    // se amortiza más rápido y se paga un poco menos interés en total.
    expect(quincenal.cuota).toBeLessThan(mensual.cuota / 2);
    expect(quincenal.cuota).toBeGreaterThan(mensual.cuota / 2 - 5000);
    expect(quincenal.totalPagado).toBeLessThan(mensual.totalPagado);
  });

  it('quincenal sin tasa: cuota = capital / (plazoMeses × 2)', () => {
    const r = calcularCuotaSugerida({ total: 1_200_000, tasaEA: 0, plazoMeses: 12, periodicidad: 'quincenal' });
    expect(r.cuota).toBe(50_000);   // 1.2M / 24 quincenas
    expect(r.nPeriodos).toBe(24);
    expect(r.totalInteres).toBe(0);
  });

  it('tasa de usura colombiana (~26.96% E.A. 2026) genera cuota razonable', () => {
    const r = calcularCuotaSugerida({ total: 10_000_000, tasaEA: 26.96, plazoMeses: 24 });
    // Sanity check: cuota debe ser positiva, < capital, y > capital/n
    expect(r.cuota).toBeGreaterThan(10_000_000 / 24);  // hay intereses
    expect(r.cuota).toBeLessThan(10_000_000);
    expect(r.totalInteres).toBeGreaterThan(0);
  });

  it('tasa negativa se trata como 0 (defensivo)', () => {
    const r = calcularCuotaSugerida({ total: 1_200_000, tasaEA: -5, plazoMeses: 12 });
    expect(r.cuota).toBe(100_000);   // como si tasaEA = 0
    expect(r.totalInteres).toBe(0);
  });

  it('NaN o string en tasaEA se tratan como 0', () => {
    const rNaN = calcularCuotaSugerida({ total: 1_200_000, tasaEA: NaN,    plazoMeses: 12 });
    const rStr = calcularCuotaSugerida({ total: 1_200_000, tasaEA: 'abc',  plazoMeses: 12 });
    expect(rNaN.cuota).toBe(100_000);
    expect(rStr.cuota).toBe(100_000);
  });

  it('totalPagado siempre ≥ total prestado', () => {
    [0, 5, 12, 25, 35].forEach(tasa => {
      const r = calcularCuotaSugerida({ total: 1_000_000, tasaEA: tasa, plazoMeses: 12 });
      expect(r.totalPagado).toBeGreaterThanOrEqual(1_000_000 - 1);  // ε redondeo
      expect(r.totalInteres).toBeGreaterThanOrEqual(-1);
    });
  });

  it('a más plazo, mayor interés total (sentido financiero)', () => {
    const corto = calcularCuotaSugerida({ total: 5_000_000, tasaEA: 20, plazoMeses: 12 });
    const largo = calcularCuotaSugerida({ total: 5_000_000, tasaEA: 20, plazoMeses: 60 });
    expect(largo.totalInteres).toBeGreaterThan(corto.totalInteres);
    // Pero cuota menor a más plazo
    expect(largo.cuota).toBeLessThan(corto.cuota);
  });

  it('a más tasa, mayor cuota (manteniendo plazo)', () => {
    const baja = calcularCuotaSugerida({ total: 5_000_000, tasaEA: 12, plazoMeses: 12 });
    const alta = calcularCuotaSugerida({ total: 5_000_000, tasaEA: 30, plazoMeses: 12 });
    expect(alta.cuota).toBeGreaterThan(baja.cuota);
  });

});

// ─── detectarDeudasDurmiendo ─────────────────────────────────────────────────
//
// Detector de deudas vivas (pendiente > 0) sin pago en N+ meses. Distinto de
// calcularDiasMora (atraso del mes corriente): este detecta abandono prolongado.
//
// Fuente del último pago en orden de prioridad:
//   1. deuda.fechaUltimoPago     — preferido (set por confPagarCuota).
//   2. gastos[deudaId === d.id]  — fallback (solo dura hasta cerrarQ).
//   3. id como Date.now()        — último recurso (fecha de creación).

describe('detectarDeudasDurmiendo()', () => {

  // Helper para una deuda canónica. Por defecto: viva, con fechaUltimoPago vieja.
  // id = 1700000000000 es ms del epoch (~2023-11-14) — bien atrás respecto al
  // hoyISO que usaremos por defecto ('2026-04-27').
  const D = (over = {}) => ({
    id: 1_700_000_000_000,
    nombre: 'Tarjeta',
    total: 1_000_000,
    pagado: 0,
    cuota: 100_000,
    tipo: 'credito',
    fechaUltimoPago: '2025-11-01',
    ...over,
  });

  const HOY = '2026-04-27';

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → []', () => {
    it('deudas no array', () => {
      expect(detectarDeudasDurmiendo(null, [], HOY)).toEqual([]);
      expect(detectarDeudasDurmiendo(undefined, [], HOY)).toEqual([]);
      expect(detectarDeudasDurmiendo('foo', [], HOY)).toEqual([]);
    });
    it('deudas array vacío', () => {
      expect(detectarDeudasDurmiendo([], [], HOY)).toEqual([]);
    });
    it('hoyISO no string', () => {
      expect(detectarDeudasDurmiendo([D()], [], null)).toEqual([]);
      expect(detectarDeudasDurmiendo([D()], [], 12345)).toEqual([]);
    });
    it('hoyISO sin formato YYYY-MM-DD completo', () => {
      expect(detectarDeudasDurmiendo([D()], [], '2026-04')).toEqual([]);
      expect(detectarDeudasDurmiendo([D()], [], 'no-fecha')).toEqual([]);
    });
    it('gastos no array → tratado como vacío (no rompe)', () => {
      const r = detectarDeudasDurmiendo([D()], null, HOY);
      expect(r).toHaveLength(1);
    });
  });

  // ── BLOQUE: DEUDAS QUE NO ESTÁN DURMIENDO ──────────────────────────────────
  describe('deudas que no son durmiendo → no aparecen', () => {
    it('deuda ya liquidada (pendiente <= 0)', () => {
      const deudas = [D({ total: 500_000, pagado: 500_000 })];
      expect(detectarDeudasDurmiendo(deudas, [], HOY)).toEqual([]);
    });
    it('deuda sobre-pagada (pagado > total)', () => {
      const deudas = [D({ total: 500_000, pagado: 600_000 })];
      expect(detectarDeudasDurmiendo(deudas, [], HOY)).toEqual([]);
    });
    it('pago reciente (1 mes atrás) — bajo el umbral default', () => {
      const deudas = [D({ fechaUltimoPago: '2026-03-27' })];   // 31 días → 1 mes
      expect(detectarDeudasDurmiendo(deudas, [], HOY)).toEqual([]);
    });
    it('pago de hoy → 0 días, no es durmiendo', () => {
      const deudas = [D({ fechaUltimoPago: HOY })];
      expect(detectarDeudasDurmiendo(deudas, [], HOY)).toEqual([]);
    });
  });

  // ── BLOQUE: FUENTE DE ULTIMO PAGO ──────────────────────────────────────────
  describe('fuente del último pago', () => {
    it("prioriza 'fechaUltimoPago' sobre gastos", () => {
      const d = D({ id: 999, fechaUltimoPago: '2025-10-01' });
      const gastos = [{ deudaId: 999, fecha: '2026-04-15', monto: 100_000 }];
      const r = detectarDeudasDurmiendo([d], gastos, HOY);
      expect(r[0].fuenteUltimoPago).toBe('fechaUltimoPago');
      expect(r[0].ultimoPago).toBe('2025-10-01');
    });
    it("cae a 'gasto' si la deuda no tiene fechaUltimoPago", () => {
      const d = D({ id: 999, fechaUltimoPago: undefined });
      const gastos = [
        { deudaId: 999, fecha: '2025-12-15' },
        { deudaId: 999, fecha: '2025-10-10' },
      ];
      const r = detectarDeudasDurmiendo([d], gastos, HOY);
      expect(r[0].fuenteUltimoPago).toBe('gasto');
      expect(r[0].ultimoPago).toBe('2025-12-15');  // el más reciente
    });
    it('ignora gastos con deudaId distinto', () => {
      const d = D({ id: 999, fechaUltimoPago: undefined });
      const gastos = [{ deudaId: 1, fecha: '2026-04-20' }];
      const r = detectarDeudasDurmiendo([d], gastos, HOY);
      // Sin fechaUltimoPago y sin gasto del 999 → cae a creación (id muy viejo)
      expect(r[0].fuenteUltimoPago).toBe('creacion');
    });
    it("ignora gastos con deudaId null o ausente", () => {
      const d = D({ id: 999, fechaUltimoPago: undefined });
      const gastos = [
        { deudaId: null,    fecha: '2026-04-20' },
        { fecha: '2026-04-20' },
      ];
      const r = detectarDeudasDurmiendo([d], gastos, HOY);
      expect(r[0].fuenteUltimoPago).toBe('creacion');
    });
    it("cae a 'creacion' si no hay fechaUltimoPago ni gasto", () => {
      // id = 1577836800000 → 2020-01-01 UTC
      const d = D({ id: 1_577_836_800_000, fechaUltimoPago: undefined });
      const r = detectarDeudasDurmiendo([d], [], HOY);
      expect(r[0].fuenteUltimoPago).toBe('creacion');
      expect(r[0].ultimoPago).toBe('2020-01-01');
    });
    it('fechaUltimoPago malformada → cae al fallback', () => {
      const d = D({ id: 999, fechaUltimoPago: '2025/10/01' });  // formato inválido
      const gastos = [{ deudaId: 999, fecha: '2025-12-15' }];
      const r = detectarDeudasDurmiendo([d], gastos, HOY);
      expect(r[0].fuenteUltimoPago).toBe('gasto');
      expect(r[0].ultimoPago).toBe('2025-12-15');
    });
    it('fechaUltimoPago con tiempo (ISO completo) se acepta y se trunca', () => {
      const d = D({ fechaUltimoPago: '2025-10-01T15:30:00Z' });
      const r = detectarDeudasDurmiendo([d], [], HOY);
      expect(r[0].ultimoPago).toBe('2025-10-01');
    });
  });

  // ── BLOQUE: SEVERIDAD ──────────────────────────────────────────────────────
  describe('severidad por meses sin pago', () => {
    it("severidad 'baja' = 2 meses", () => {
      const d = D({ fechaUltimoPago: '2026-02-15' });   // ~71 días → 2 meses
      expect(detectarDeudasDurmiendo([d], [], HOY)[0].severidad).toBe('baja');
    });
    it("severidad 'media' = 3-5 meses", () => {
      const d3 = D({ fechaUltimoPago: '2026-01-10' });  // ~107 días → 3 meses
      const d5 = D({ fechaUltimoPago: '2025-11-15' });  // ~163 días → 5 meses
      expect(detectarDeudasDurmiendo([d3], [], HOY)[0].severidad).toBe('media');
      expect(detectarDeudasDurmiendo([d5], [], HOY)[0].severidad).toBe('media');
    });
    it("severidad 'alta' = 6+ meses", () => {
      const d6 = D({ fechaUltimoPago: '2025-10-15' });  // ~6 meses
      const d12 = D({ fechaUltimoPago: '2025-04-01' }); // ~12 meses
      expect(detectarDeudasDurmiendo([d6],  [], HOY)[0].severidad).toBe('alta');
      expect(detectarDeudasDurmiendo([d12], [], HOY)[0].severidad).toBe('alta');
    });
  });

  // ── BLOQUE: SUGERENCIA ─────────────────────────────────────────────────────
  describe('sugerencia liquidar/retomar', () => {
    it("'liquidar' cuando pendiente <= cuota (un pago la cierra)", () => {
      const d = D({ total: 100_000, pagado: 50_000, cuota: 60_000 });  // pend=50k <= 60k
      expect(detectarDeudasDurmiendo([d], [], HOY)[0].sugerencia).toBe('liquidar');
    });
    it("'liquidar' cuando pendiente == cuota exactamente", () => {
      const d = D({ total: 100_000, pagado: 0, cuota: 100_000 });
      expect(detectarDeudasDurmiendo([d], [], HOY)[0].sugerencia).toBe('liquidar');
    });
    it("'retomar' cuando pendiente > cuota (varios pagos)", () => {
      const d = D({ total: 1_000_000, pagado: 0, cuota: 100_000 });
      expect(detectarDeudasDurmiendo([d], [], HOY)[0].sugerencia).toBe('retomar');
    });
    it("'retomar' cuando cuota es 0 (deuda sin cuota definida)", () => {
      const d = D({ total: 100_000, pagado: 0, cuota: 0 });
      expect(detectarDeudasDurmiendo([d], [], HOY)[0].sugerencia).toBe('retomar');
    });
  });

  // ── BLOQUE: CONFIG mesesUmbral ─────────────────────────────────────────────
  describe('config mesesUmbral', () => {
    it('umbral = 1 → captura deudas con 1+ mes sin pago', () => {
      const d = D({ fechaUltimoPago: '2026-03-15' });   // ~43 días → 1 mes
      expect(detectarDeudasDurmiendo([d], [], HOY)).toEqual([]);
      expect(detectarDeudasDurmiendo([d], [], HOY, { mesesUmbral: 1 })).toHaveLength(1);
    });
    it('umbral = 6 → solo captura las muy abandonadas', () => {
      const d3  = D({ fechaUltimoPago: '2026-01-10' });
      const d6  = D({ fechaUltimoPago: '2025-10-10' });
      const r3 = detectarDeudasDurmiendo([d3], [], HOY, { mesesUmbral: 6 });
      const r6 = detectarDeudasDurmiendo([d6], [], HOY, { mesesUmbral: 6 });
      expect(r3).toEqual([]);
      expect(r6).toHaveLength(1);
    });
    it('umbral inválido → fallback al default 2', () => {
      const d = D({ fechaUltimoPago: '2026-01-10' });   // 3 meses
      expect(detectarDeudasDurmiendo([d], [], HOY, { mesesUmbral: 'tres' })).toHaveLength(1);
      expect(detectarDeudasDurmiendo([d], [], HOY, { mesesUmbral: 0 })).toHaveLength(1);
      expect(detectarDeudasDurmiendo([d], [], HOY, { mesesUmbral: -5 })).toHaveLength(1);
    });
    it('config null o no-objeto → defaults', () => {
      const d = D({ fechaUltimoPago: '2026-01-10' });
      expect(detectarDeudasDurmiendo([d], [], HOY, null)).toHaveLength(1);
      expect(detectarDeudasDurmiendo([d], [], HOY, 'foo')).toHaveLength(1);
    });
    it('umbral decimal se trunca con floor', () => {
      const d = D({ fechaUltimoPago: '2026-01-10' });   // ~3 meses
      // floor(3.9) = 3 → con 3 meses pasa
      expect(detectarDeudasDurmiendo([d], [], HOY, { mesesUmbral: 3.9 })).toHaveLength(1);
      // floor(4.1) = 4 → con 3 meses no pasa
      expect(detectarDeudasDurmiendo([d], [], HOY, { mesesUmbral: 4.1 })).toEqual([]);
    });
  });

  // ── BLOQUE: DEUDAS MALFORMADAS ─────────────────────────────────────────────
  describe('deudas malformadas se ignoran', () => {
    it('null/undefined/no-objeto en el array', () => {
      const d = D();
      const deudas = [null, undefined, 'foo', 42, d];
      expect(detectarDeudasDurmiendo(deudas, [], HOY)).toHaveLength(1);
    });
    it('id ausente o no numérico', () => {
      const deudas = [
        { ...D(), id: undefined },
        { ...D(), id: 'string' },
        { ...D(), id: -1 },
        { ...D(), id: 0 },
      ];
      expect(detectarDeudasDurmiendo(deudas, [], HOY)).toEqual([]);
    });
    it('total/pagado no numéricos → tratados como 0 → liquidada (pendiente=0)', () => {
      const d = D({ total: 'a', pagado: 'b' });
      expect(detectarDeudasDurmiendo([d], [], HOY)).toEqual([]);
    });
  });

  // ── BLOQUE: ORDENAMIENTO ───────────────────────────────────────────────────
  describe('ordenamiento', () => {
    it('alta antes que media antes que baja', () => {
      const deudas = [
        D({ id: 1, nombre: 'Baja',  fechaUltimoPago: '2026-02-15' }),
        D({ id: 2, nombre: 'Alta',  fechaUltimoPago: '2025-09-01' }),
        D({ id: 3, nombre: 'Media', fechaUltimoPago: '2026-01-10' }),
      ];
      const r = detectarDeudasDurmiendo(deudas, [], HOY);
      expect(r.map(x => x.severidad)).toEqual(['alta', 'media', 'baja']);
    });
    it('mismo nivel: mayor pendiente primero', () => {
      const deudas = [
        D({ id: 1, total: 200_000, pagado: 0, fechaUltimoPago: '2026-02-15' }),
        D({ id: 2, total: 1_000_000, pagado: 0, fechaUltimoPago: '2026-02-15' }),
      ];
      const r = detectarDeudasDurmiendo(deudas, [], HOY);
      expect(r[0].id).toBe(2);
      expect(r[1].id).toBe(1);
    });
    it('empate exacto → menor id primero (determinístico)', () => {
      const deudas = [
        D({ id: 7, total: 500_000, pagado: 0, fechaUltimoPago: '2026-02-15' }),
        D({ id: 3, total: 500_000, pagado: 0, fechaUltimoPago: '2026-02-15' }),
      ];
      const r = detectarDeudasDurmiendo(deudas, [], HOY);
      expect(r[0].id).toBe(3);
      expect(r[1].id).toBe(7);
    });
  });

  // ── BLOQUE: FORMA DEL RETORNO ──────────────────────────────────────────────
  describe('forma del retorno', () => {
    it('campos esperados', () => {
      const d = D({
        id: 42, nombre: 'Tarjeta Bancolombia', tipo: 'credito',
        total: 500_000, pagado: 100_000, cuota: 50_000,
        fechaUltimoPago: '2026-01-10',
      });
      const r = detectarDeudasDurmiendo([d], [], HOY);
      expect(r[0]).toEqual(expect.objectContaining({
        id: 42,
        nombre: 'Tarjeta Bancolombia',
        tipo: 'credito',
        totalPendiente: 400_000,
        cuota: 50_000,
        ultimoPago: '2026-01-10',
        fuenteUltimoPago: 'fechaUltimoPago',
        severidad: 'media',
        sugerencia: 'retomar',
      }));
      expect(r[0].diasSinPago).toBeGreaterThanOrEqual(100);
      expect(r[0].mesesSinPago).toBe(3);
    });
    it("nombre vacío → 'Sin nombre'", () => {
      const d = D({ nombre: '', fechaUltimoPago: '2026-01-10' });
      expect(detectarDeudasDurmiendo([d], [], HOY)[0].nombre).toBe('Sin nombre');
    });
    it("tipo vacío → 'otro'", () => {
      const d = D({ tipo: undefined, fechaUltimoPago: '2026-01-10' });
      expect(detectarDeudasDurmiendo([d], [], HOY)[0].tipo).toBe('otro');
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('1 deuda de tarjeta abandonada hace 8 meses', () => {
      const d = D({
        id: 1, nombre: 'Tarjeta Davivienda',
        total: 3_000_000, pagado: 800_000, cuota: 200_000,
        tipo: 'credito',
        fechaUltimoPago: '2025-08-15',
      });
      const r = detectarDeudasDurmiendo([d], [], HOY);
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('alta');
      expect(r[0].sugerencia).toBe('retomar');
      expect(r[0].totalPendiente).toBe(2_200_000);
      expect(r[0].mesesSinPago).toBeGreaterThanOrEqual(8);
    });
    it('mezcla: 1 al día + 1 durmiendo + 1 liquidada → solo la durmiendo', () => {
      const deudas = [
        D({ id: 1, nombre: 'Al día',     fechaUltimoPago: HOY }),
        D({ id: 2, nombre: 'Durmiendo',  fechaUltimoPago: '2026-01-10' }),
        D({ id: 3, nombre: 'Liquidada',  total: 100_000, pagado: 100_000 }),
      ];
      const r = detectarDeudasDurmiendo(deudas, [], HOY);
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(2);
    });
    it('deuda con fechaUltimoPago pero gasto más reciente → usa fechaUltimoPago', () => {
      // Esto refleja el contrato: fechaUltimoPago es la fuente de verdad.
      // Si está, ignoramos los gastos (que pueden ser de otros pagos parciales
      // o registros manuales que no actualizaron fechaUltimoPago).
      const d = D({ id: 1, fechaUltimoPago: '2025-08-01' });
      const gastos = [{ deudaId: 1, fecha: '2026-04-20', monto: 50_000 }];
      const r = detectarDeudasDurmiendo([d], gastos, HOY);
      expect(r[0].fuenteUltimoPago).toBe('fechaUltimoPago');
      expect(r[0].ultimoPago).toBe('2025-08-01');
    });
    it('500 deudas (stress) → procesa rápido', () => {
      const deudas = [];
      for (let i = 0; i < 500; i++) {
        deudas.push(D({ id: i + 1, nombre: `Deuda ${i}`, fechaUltimoPago: '2025-12-01' }));
      }
      const r = detectarDeudasDurmiendo(deudas, [], HOY);
      expect(r).toHaveLength(500);
      // todas mismo nivel + mismo pendiente → orden por id asc
      expect(r[0].id).toBe(1);
      expect(r[499].id).toBe(500);
    });
    it('no muta los inputs', () => {
      const deudas = [D({ fechaUltimoPago: '2026-01-10' })];
      const gastos = [{ deudaId: 999, fecha: '2026-04-20' }];
      const dOriginal = JSON.parse(JSON.stringify(deudas));
      const gOriginal = JSON.parse(JSON.stringify(gastos));
      detectarDeudasDurmiendo(deudas, gastos, HOY);
      expect(deudas).toEqual(dOriginal);
      expect(gastos).toEqual(gOriginal);
    });
  });

});

// ─── detectarFijosSinPagarEsteMes ────────────────────────────────────────────
//
// Detecta gastos fijos cuyo día de pago YA pasó este mes y no han sido
// marcados como pagados en `pagadoEn`. Para quincenales: 2 pagos esperados al
// mes (día y día+15 con clamp al fin de mes).

describe('detectarFijosSinPagarEsteMes()', () => {

  // Helper canónico. Defaults: mensual, día 5, monto 800k, sin pagos.
  const F = (over = {}) => ({
    id: 1,
    nombre: 'Arriendo',
    cat: 'vivienda',
    dia: 5,
    periodicidad: 'mensual',
    monto: 800_000,
    montoTotal: 800_000,
    fondo: 'banco',
    pagadoEn: [],
    ...over,
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → []', () => {
    it('gastosFijos no array', () => {
      expect(detectarFijosSinPagarEsteMes(null, '2026-04-15')).toEqual([]);
      expect(detectarFijosSinPagarEsteMes(undefined, '2026-04-15')).toEqual([]);
      expect(detectarFijosSinPagarEsteMes('foo', '2026-04-15')).toEqual([]);
    });
    it('gastosFijos array vacío', () => {
      expect(detectarFijosSinPagarEsteMes([], '2026-04-15')).toEqual([]);
    });
    it('hoyISO no string', () => {
      expect(detectarFijosSinPagarEsteMes([F()], null)).toEqual([]);
      expect(detectarFijosSinPagarEsteMes([F()], 12345)).toEqual([]);
    });
    it('hoyISO sin formato YYYY-MM-DD completo', () => {
      expect(detectarFijosSinPagarEsteMes([F()], '2026-04')).toEqual([]);
      expect(detectarFijosSinPagarEsteMes([F()], 'no-fecha')).toEqual([]);
    });
    it('hoyISO con mes/día fuera de rango', () => {
      expect(detectarFijosSinPagarEsteMes([F()], '2026-13-15')).toEqual([]);
      expect(detectarFijosSinPagarEsteMes([F()], '2026-04-32')).toEqual([]);
      expect(detectarFijosSinPagarEsteMes([F()], '2026-04-00')).toEqual([]);
    });
  });

  // ── BLOQUE: NO ATRASADOS ───────────────────────────────────────────────────
  describe('fijos que no están atrasados → no aparecen', () => {
    it('día de pago todavía no llega (hoy < dia)', () => {
      const fx = F({ dia: 25 });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-15')).toEqual([]);
    });
    it('ya pagado este mes (mes en pagadoEn)', () => {
      const fx = F({ dia: 5, pagadoEn: ['2026-04'] });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-15')).toEqual([]);
    });
    it('quincenal con los 2 pagos del mes hechos', () => {
      const fx = F({ periodicidad: 'quincenal', dia: 5, pagadoEn: ['2026-04', '2026-04'] });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-25')).toEqual([]);
    });
    it('pagos de otro mes en pagadoEn no cuentan', () => {
      const fx = F({ dia: 5, pagadoEn: ['2026-03', '2026-02'] });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-15');
      expect(r).toHaveLength(1);
      expect(r[0].pagosRealizados).toBe(0);
    });
  });

  // ── BLOQUE: MENSUALES ──────────────────────────────────────────────────────
  describe('mensuales atrasados', () => {
    it('día exacto del vencimiento (hoy === dia) → flag con 0 días atraso', () => {
      const fx = F({ dia: 15 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-15');
      expect(r).toHaveLength(1);
      expect(r[0].diasAtraso).toBe(0);
      expect(r[0].severidad).toBe('leve');
      expect(r[0].tipoFalta).toBe('mensual');
    });
    it('1 día atrasado', () => {
      const fx = F({ dia: 5 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-06');
      expect(r[0].diasAtraso).toBe(1);
      expect(r[0].severidad).toBe('leve');
    });
    it('5 días atrasado → severidad moderada', () => {
      const fx = F({ dia: 5 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-10');
      expect(r[0].diasAtraso).toBe(5);
      expect(r[0].severidad).toBe('moderada');
    });
    it('15 días atrasado → severidad urgente', () => {
      const fx = F({ dia: 5 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-20');
      expect(r[0].diasAtraso).toBe(15);
      expect(r[0].severidad).toBe('urgente');
    });
    it('umbralDiasAtraso = 3 → ignora atrasos <3', () => {
      const fx = F({ dia: 5 });
      const r2d = detectarFijosSinPagarEsteMes([fx], '2026-04-07', { umbralDiasAtraso: 3 });
      const r5d = detectarFijosSinPagarEsteMes([fx], '2026-04-10', { umbralDiasAtraso: 3 });
      expect(r2d).toEqual([]);
      expect(r5d).toHaveLength(1);
    });
    it('día clamp al último del mes (febrero, dia=31 → 28)', () => {
      const fx = F({ dia: 31 });
      // Feb 2026 tiene 28 días. dia clampea a 28. hoy=2026-02-27 → no atrasado.
      // hoy=2026-02-28 → atrasado 0 días.
      expect(detectarFijosSinPagarEsteMes([fx], '2026-02-27')).toEqual([]);
      const r = detectarFijosSinPagarEsteMes([fx], '2026-02-28');
      expect(r).toHaveLength(1);
      expect(r[0].diaEsperado).toBe(28);
      expect(r[0].dia).toBe(31);
    });
  });

  // ── BLOQUE: QUINCENALES ────────────────────────────────────────────────────
  describe('quincenales (2 pagos al mes)', () => {
    it('antes del Q1 → no atrasado', () => {
      const fx = F({ periodicidad: 'quincenal', dia: 5 });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-03')).toEqual([]);
    });
    it("entre Q1 y Q2 sin pagos → atrasado del Q1 ('quincenal-q1')", () => {
      const fx = F({ periodicidad: 'quincenal', dia: 5 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-10');
      expect(r).toHaveLength(1);
      expect(r[0].pagosEsperados).toBe(1);
      expect(r[0].pagosRealizados).toBe(0);
      expect(r[0].tipoFalta).toBe('quincenal-q1');
    });
    it("entre Q1 y Q2 con 1 pago → no atrasado", () => {
      const fx = F({ periodicidad: 'quincenal', dia: 5, pagadoEn: ['2026-04'] });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-10')).toEqual([]);
    });
    it("después del Q2 sin pagos → 'quincenal-ambos'", () => {
      const fx = F({ periodicidad: 'quincenal', dia: 5 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-25');
      expect(r[0].pagosEsperados).toBe(2);
      expect(r[0].pagosRealizados).toBe(0);
      expect(r[0].tipoFalta).toBe('quincenal-ambos');
    });
    it("después del Q2 con 1 pago → 'quincenal-q2' (le falta el segundo)", () => {
      const fx = F({ periodicidad: 'quincenal', dia: 5, pagadoEn: ['2026-04'] });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-25');
      expect(r[0].pagosEsperados).toBe(2);
      expect(r[0].pagosRealizados).toBe(1);
      expect(r[0].tipoFalta).toBe('quincenal-q2');
    });
    it('Q2 clampea al último día del mes (dia=20, mes 30 días → Q2=30 no 35)', () => {
      const fx = F({ periodicidad: 'quincenal', dia: 20 });
      // Junio tiene 30 días. Q2 = min(35, 30) = 30. hoy=2026-06-30 → atrasado.
      const r = detectarFijosSinPagarEsteMes([fx], '2026-06-30');
      expect(r[0].diaEsperado).toBe(30);
      expect(r[0].pagosEsperados).toBe(2);
      expect(r[0].diasAtraso).toBe(0);
    });
  });

  // ── BLOQUE: FIJOS MALFORMADOS ──────────────────────────────────────────────
  describe('fijos malformados se ignoran', () => {
    it('null/undefined/no-objeto en el array', () => {
      const fxs = [null, undefined, 'foo', 42, F({ id: 99, dia: 5 })];
      const r = detectarFijosSinPagarEsteMes(fxs, '2026-04-15');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(99);
    });
    it('id ausente, no numérico, o ≤0', () => {
      const fxs = [
        { ...F(), id: undefined },
        { ...F(), id: 'string' },
        { ...F(), id: 0 },
        { ...F(), id: -1 },
      ];
      expect(detectarFijosSinPagarEsteMes(fxs, '2026-04-15')).toEqual([]);
    });
    it('dia fuera de rango (0, 32, negativo)', () => {
      const fxs = [
        F({ id: 1, dia: 0 }),
        F({ id: 2, dia: 32 }),
        F({ id: 3, dia: -5 }),
      ];
      // dia=0 → Number(0)||1 → 1 → válido (clampea a último del mes funcionando)
      // dia=32 → fuera de [1,31] → continue
      // dia=-5 → Number(-5)||1 → -5 → fuera de [1,31] → continue (Number(-5) is -5 which is truthy)
      const r = detectarFijosSinPagarEsteMes(fxs, '2026-04-15');
      expect(r.map(x => x.id)).toEqual([1]);
    });
    it('pagadoEn no array → tratado como sin pagos', () => {
      const fx = F({ pagadoEn: 'no soy array', dia: 5 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-10');
      expect(r).toHaveLength(1);
      expect(r[0].pagosRealizados).toBe(0);
    });
    it('periodicidad desconocida → tratada como mensual', () => {
      const fx = F({ periodicidad: 'anual', dia: 5 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-10');
      expect(r[0].periodicidad).toBe('mensual');
    });
  });

  // ── BLOQUE: ORDENAMIENTO ───────────────────────────────────────────────────
  describe('ordenamiento', () => {
    it('urgente → moderada → leve', () => {
      const fxs = [
        F({ id: 1, nombre: 'Leve',     dia: 14 }),  // hoy=2026-04-15 → 1d → leve
        F({ id: 2, nombre: 'Urgente',  dia: 1  }),  // 14d → urgente
        F({ id: 3, nombre: 'Moderada', dia: 10 }),  // 5d → moderada
      ];
      const r = detectarFijosSinPagarEsteMes(fxs, '2026-04-15');
      expect(r.map(x => x.severidad)).toEqual(['urgente', 'moderada', 'leve']);
    });
    it('mismo nivel: mayor monto primero', () => {
      const fxs = [
        F({ id: 1, monto: 100_000, montoTotal: 100_000, dia: 5 }),
        F({ id: 2, monto: 800_000, montoTotal: 800_000, dia: 5 }),
      ];
      const r = detectarFijosSinPagarEsteMes(fxs, '2026-04-08');
      expect(r[0].id).toBe(2);
      expect(r[1].id).toBe(1);
    });
    it('empate en severidad y monto → menor id primero', () => {
      const fxs = [
        F({ id: 7, monto: 500_000, montoTotal: 500_000, dia: 5 }),
        F({ id: 3, monto: 500_000, montoTotal: 500_000, dia: 5 }),
      ];
      const r = detectarFijosSinPagarEsteMes(fxs, '2026-04-08');
      expect(r[0].id).toBe(3);
      expect(r[1].id).toBe(7);
    });
  });

  // ── BLOQUE: FORMA DEL RETORNO ──────────────────────────────────────────────
  describe('forma del retorno', () => {
    it('campos esperados', () => {
      const fx = F({
        id: 42, nombre: 'Internet', cat: 'servicios',
        dia: 5, monto: 80_000, montoTotal: 80_320, fondo: 'cuenta_1',
      });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-12');
      expect(r[0]).toEqual({
        id: 42,
        nombre: 'Internet',
        cat: 'servicios',
        dia: 5,
        periodicidad: 'mensual',
        monto: 80_000,
        montoTotal: 80_320,
        fondo: 'cuenta_1',
        diaEsperado: 5,
        diasAtraso: 7,
        pagosEsperados: 1,
        pagosRealizados: 0,
        severidad: 'moderada',
        tipoFalta: 'mensual',
      });
    });
    it("nombre vacío → 'Sin nombre'", () => {
      const fx = F({ nombre: '', dia: 5 });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-08')[0].nombre).toBe('Sin nombre');
    });
    it("cat vacía → 'otros'", () => {
      const fx = F({ cat: undefined, dia: 5 });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-08')[0].cat).toBe('otros');
    });
    it('montoTotal undefined → cae al monto', () => {
      const fx = F({ monto: 50_000, montoTotal: undefined, dia: 5 });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-04-08')[0].montoTotal).toBe(50_000);
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('arriendo del 1 sin pagar el 20 → urgente', () => {
      const fx = F({ id: 1, nombre: 'Arriendo', dia: 1, monto: 1_500_000, montoTotal: 1_500_000 });
      const r = detectarFijosSinPagarEsteMes([fx], '2026-04-20');
      expect(r[0].severidad).toBe('urgente');
      expect(r[0].diasAtraso).toBe(19);
    });
    it('mezcla: pagado + atrasado + futuro → solo el atrasado', () => {
      const fxs = [
        F({ id: 1, nombre: 'Arriendo',  dia: 1, pagadoEn: ['2026-04'] }),  // pagado
        F({ id: 2, nombre: 'Internet',  dia: 10, pagadoEn: [] }),          // atrasado
        F({ id: 3, nombre: 'Netflix',   dia: 25, pagadoEn: [] }),          // futuro
      ];
      const r = detectarFijosSinPagarEsteMes(fxs, '2026-04-15');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(2);
    });
    it('500 fijos (stress) → orden estable', () => {
      const fxs = [];
      for (let i = 0; i < 500; i++) {
        fxs.push(F({ id: i + 1, dia: 1, monto: 100_000, montoTotal: 100_000 }));
      }
      const r = detectarFijosSinPagarEsteMes(fxs, '2026-04-15');
      expect(r).toHaveLength(500);
      // todos urgente + mismo monto → orden por id asc
      expect(r[0].id).toBe(1);
      expect(r[499].id).toBe(500);
    });
    it('no muta los inputs', () => {
      const fxs = [F({ pagadoEn: ['2026-03'], dia: 5 })];
      const original = JSON.parse(JSON.stringify(fxs));
      detectarFijosSinPagarEsteMes(fxs, '2026-04-15');
      expect(fxs).toEqual(original);
    });
    it('cruce de mes: hoy=2026-05-02, fijo dia=30 abril → no aparece (ya pasamos a otro mes)', () => {
      // El detector usa el mes de hoyISO. Si hoy=mayo, mira pagadoEn de mayo,
      // no de abril. dia=30 mayo, día 2 → todavía no llega.
      const fx = F({ dia: 30 });
      expect(detectarFijosSinPagarEsteMes([fx], '2026-05-02')).toEqual([]);
    });
  });

});

