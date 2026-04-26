// tests/unit/personales.test.js
//
// ✅ R3 (auditoría v5): cobertura del dominio "Me Deben" — préstamos hechos
// a amigos / familia. La sección espejo de compromisos: aquí TÚ prestaste.
//
//  • calcularPendientePersona — saldo aún sin cobrar.
//  • calcularDiasPrestamo     — antigüedad relativa a fecha o fechaLimite.
//  • clasificarAntiguedadPrestamo — reciente/mediano/viejo (cortes culturales).
//  • calcularResumenMeDeben   — agregado total prestado/cobrado/pendiente.
//  • ordenarMeDeben           — antiguo / reciente / monto.
//
// Las 5 son 100% puras (sin S, sin DOM). Tests directos.

import { describe, it, expect } from 'vitest';
import {
  calcularPendientePersona,
  calcularDiasPrestamo,
  clasificarAntiguedadPrestamo,
  calcularResumenMeDeben,
  ordenarMeDeben,
} from '../../modules/dominio/personales.js';

// ─── calcularPendientePersona ────────────────────────────────────────────────

describe('calcularPendientePersona()', () => {

  it('sin pagado: pendiente = monto', () => {
    expect(calcularPendientePersona({ monto: 100_000 })).toBe(100_000);
  });

  it('con pago parcial: pendiente = monto − pagado', () => {
    expect(calcularPendientePersona({ monto: 100_000, pagado: 30_000 })).toBe(70_000);
  });

  it('liquidado: pendiente = 0', () => {
    expect(calcularPendientePersona({ monto: 100_000, pagado: 100_000 })).toBe(0);
  });

  it('sobre-pagado (defensivo): pendiente nunca negativo', () => {
    expect(calcularPendientePersona({ monto: 100_000, pagado: 150_000 })).toBe(0);
  });

  it('sin monto retorna 0', () => {
    expect(calcularPendientePersona({})).toBe(0);
    expect(calcularPendientePersona(null)).toBe(0);
    expect(calcularPendientePersona(undefined)).toBe(0);
  });

  it('campos undefined se tratan como 0', () => {
    expect(calcularPendientePersona({ monto: 50_000, pagado: undefined })).toBe(50_000);
  });

});

// ─── calcularDiasPrestamo ─────────────────────────────────────────────────────

describe('calcularDiasPrestamo()', () => {

  it('sin fecha ni fechaLimite → 0', () => {
    expect(calcularDiasPrestamo({})).toBe(0);
    expect(calcularDiasPrestamo({ persona: 'Juan' })).toBe(0);
  });

  it('cuenta días desde fecha del préstamo si no hay fechaLimite', () => {
    const ref = new Date('2026-04-25T10:00:00');
    const p   = { fecha: '2026-04-15' };
    expect(calcularDiasPrestamo(p, ref)).toBe(10);
  });

  it('cuenta días desde fechaLimite si la hay', () => {
    // Pactó devolver el 20, hoy es 25 → 5 días "vencido"
    const ref = new Date('2026-04-25T10:00:00');
    const p   = { fecha: '2026-04-01', fechaLimite: '2026-04-20' };
    expect(calcularDiasPrestamo(p, ref)).toBe(5);
  });

  it('mismo día → 0 días', () => {
    const ref = new Date('2026-04-25T10:00:00');
    expect(calcularDiasPrestamo({ fecha: '2026-04-25' }, ref)).toBe(0);
  });

  it('días futuros (fecha posterior) → 0 (clamp)', () => {
    const ref = new Date('2026-04-25T10:00:00');
    expect(calcularDiasPrestamo({ fecha: '2026-05-10' }, ref)).toBe(0);
  });

  it('cruzar fin de mes funciona correctamente', () => {
    const ref = new Date('2026-05-05T10:00:00');
    const p   = { fecha: '2026-04-25' };
    expect(calcularDiasPrestamo(p, ref)).toBe(10);
  });

});

// ─── clasificarAntiguedadPrestamo ─────────────────────────────────────────────

describe('clasificarAntiguedadPrestamo()', () => {

  it('0–14 días → reciente', () => {
    expect(clasificarAntiguedadPrestamo(0)).toBe('reciente');
    expect(clasificarAntiguedadPrestamo(7)).toBe('reciente');
    expect(clasificarAntiguedadPrestamo(14)).toBe('reciente');
  });

  it('15–60 días → mediano', () => {
    expect(clasificarAntiguedadPrestamo(15)).toBe('mediano');
    expect(clasificarAntiguedadPrestamo(30)).toBe('mediano');
    expect(clasificarAntiguedadPrestamo(60)).toBe('mediano');
  });

  it('61+ días → viejo', () => {
    expect(clasificarAntiguedadPrestamo(61)).toBe('viejo');
    expect(clasificarAntiguedadPrestamo(180)).toBe('viejo');
    expect(clasificarAntiguedadPrestamo(365)).toBe('viejo');
  });

});

// ─── calcularResumenMeDeben ───────────────────────────────────────────────────

describe('calcularResumenMeDeben()', () => {

  it('sin préstamos → todo en 0', () => {
    const r = calcularResumenMeDeben([]);
    expect(r.totalPrestado).toBe(0);
    expect(r.totalCobrado).toBe(0);
    expect(r.totalPendiente).toBe(0);
    expect(r.activos).toBe(0);
    expect(r.liquidados).toBe(0);
    expect(r.pctCobrado).toBe(0);
  });

  it('null / undefined / no-array → todo en 0', () => {
    expect(calcularResumenMeDeben(null).totalPrestado).toBe(0);
    expect(calcularResumenMeDeben(undefined).totalPrestado).toBe(0);
    expect(calcularResumenMeDeben('xxx').totalPrestado).toBe(0);
  });

  it('suma préstamos sin pagos → todo pendiente', () => {
    const lista = [
      { id: 1, persona: 'María', monto: 100_000 },
      { id: 2, persona: 'Carlos', monto: 50_000 },
    ];
    const r = calcularResumenMeDeben(lista);
    expect(r.totalPrestado).toBe(150_000);
    expect(r.totalCobrado).toBe(0);
    expect(r.totalPendiente).toBe(150_000);
    expect(r.activos).toBe(2);
    expect(r.liquidados).toBe(0);
    expect(r.pctCobrado).toBe(0);
  });

  it('separa activos de liquidados', () => {
    const lista = [
      { id: 1, persona: 'A', monto: 100_000, pagado: 100_000 },  // liquidado
      { id: 2, persona: 'B', monto: 100_000, pagado: 30_000  },  // activo parcial
      { id: 3, persona: 'C', monto: 100_000, pagado: 0       },  // activo
    ];
    const r = calcularResumenMeDeben(lista);
    expect(r.liquidados).toBe(1);
    expect(r.activos).toBe(2);
    expect(r.totalPrestado).toBe(300_000);
    expect(r.totalCobrado).toBe(130_000);
    expect(r.totalPendiente).toBe(170_000);
    expect(r.pctCobrado).toBe(43);  // round(130k/300k * 100)
  });

  it('clamp pagado > monto (defensivo): no se cuenta extra', () => {
    const lista = [
      { id: 1, persona: 'X', monto: 100_000, pagado: 200_000 },  // sobre-pago
    ];
    const r = calcularResumenMeDeben(lista);
    expect(r.totalCobrado).toBe(100_000);   // clamped
    expect(r.totalPendiente).toBe(0);
    expect(r.liquidados).toBe(1);
  });

  it('préstamo con monto 0 se ignora en activos/liquidados', () => {
    const lista = [
      { id: 1, persona: 'X', monto: 0, pagado: 0 },
      { id: 2, persona: 'Y', monto: 50_000, pagado: 0 },
    ];
    const r = calcularResumenMeDeben(lista);
    expect(r.activos).toBe(1);
    expect(r.liquidados).toBe(0);
    expect(r.totalPrestado).toBe(50_000);
  });

  it('pctCobrado al 100% cuando todo está pagado', () => {
    const lista = [
      { id: 1, monto: 100_000, pagado: 100_000 },
      { id: 2, monto: 50_000,  pagado: 50_000  },
    ];
    expect(calcularResumenMeDeben(lista).pctCobrado).toBe(100);
  });

});

// ─── ordenarMeDeben ───────────────────────────────────────────────────────────

describe('ordenarMeDeben()', () => {

  const lista = [
    { id: 1, persona: 'A', fecha: '2026-04-20', monto: 100_000, pagado: 50_000 },  // pendiente 50k
    { id: 2, persona: 'B', fecha: '2026-01-10', monto: 200_000, pagado: 0       }, // pendiente 200k (más viejo)
    { id: 3, persona: 'C', fecha: '2026-04-25', monto: 30_000,  pagado: 0       }, // pendiente 30k (más nuevo)
  ];

  it('default es "antiguo" (fecha ASC)', () => {
    const r = ordenarMeDeben(lista);
    expect(r.map(x => x.persona)).toEqual(['B', 'A', 'C']);
  });

  it('"reciente" ordena fecha DESC', () => {
    const r = ordenarMeDeben(lista, 'reciente');
    expect(r.map(x => x.persona)).toEqual(['C', 'A', 'B']);
  });

  it('"monto" ordena por pendiente DESC', () => {
    const r = ordenarMeDeben(lista, 'monto');
    expect(r.map(x => x.persona)).toEqual(['B', 'A', 'C']);  // 200k > 50k > 30k
  });

  it('no muta el array original', () => {
    const original = [...lista];
    ordenarMeDeben(lista, 'reciente');
    expect(lista).toEqual(original);
  });

  it('arrays vacíos / null devuelven array vacío', () => {
    expect(ordenarMeDeben([])).toEqual([]);
    expect(ordenarMeDeben(null)).toEqual([]);
    expect(ordenarMeDeben(undefined)).toEqual([]);
  });

  it('una sola entrada se devuelve como está', () => {
    const una = [{ id: 1, persona: 'X', fecha: '2026-04-20', monto: 100_000 }];
    expect(ordenarMeDeben(una)).toEqual(una);
  });

  it('"monto" considera pagados parciales (pendiente, no monto)', () => {
    const lista2 = [
      { id: 1, persona: 'A', fecha: '2026-01-01', monto: 1_000_000, pagado: 950_000 },  // pendiente 50k
      { id: 2, persona: 'B', fecha: '2026-01-01', monto:   100_000, pagado:  0       }, // pendiente 100k
    ];
    const r = ordenarMeDeben(lista2, 'monto');
    expect(r.map(x => x.persona)).toEqual(['B', 'A']);
  });

});
