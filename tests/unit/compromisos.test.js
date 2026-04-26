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
