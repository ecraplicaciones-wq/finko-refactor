// tests/unit/tesoreria.test.js
//
// ✅ R1 (auditoría v5): cobertura del dominio de tesorería.
//
//  • Lecturas puras sobre S (calcularFondoEmergencia, totalBolsillos,
//    platoLibre) — verificamos resultados sin tocar el DOM.
//  • Mutadoras de fondos (descontarFondo/reintegrarFondo, definidas en
//    infra/utils.js pero conceptualmente parte del dominio tesorería)
//    — preparamos S, ejecutamos, comprobamos mutación.
//
// Patrón: resetAppState() en beforeEach + asignaciones a S específicas
// del test. Sin DOM ni mocks de document.

import { describe, it, expect, beforeEach } from 'vitest';
import { S, resetAppState } from '../../modules/core/state.js';
import {
  calcularFondoEmergencia,
  totalBolsillos,
  platoLibre,
  bolsillosOlvidados,
} from '../../modules/dominio/tesoreria.js';
import {
  descontarFondo,
  reintegrarFondo,
} from '../../modules/infra/utils.js';

// ─── calcularFondoEmergencia ─────────────────────────────────────────────────

describe('calcularFondoEmergencia()', () => {

  beforeEach(() => {
    resetAppState();
    // updSaldo es expuesto en window por render.js — en tests no existe.
    // descontarFondo/reintegrarFondo lo llaman con ?.() así que el optional
    // chaining lo maneja, pero por claridad lo dejamos asignable.
    if (typeof window !== 'undefined') {
      window.updSaldo = window.updSaldo || (() => {});
    }
  });

  it('sin gastos fijos ni ingreso, la base es 0 → objetivo 0', () => {
    const r = calcularFondoEmergencia();
    expect(r.gastoMensualFijo).toBe(0);
    expect(r.montoObjetivoTotal).toBe(0);
    expect(r.faltaPorAhorrar).toBe(0);
    expect(r.porcentajeCompletado).toBe('0.0');
  });

  it('sin gastos fijos pero con ingreso usa ingreso × 60% como base', () => {
    S.ingreso = 4_000_000;
    const r = calcularFondoEmergencia();
    expect(r.gastoMensualFijo).toBe(2_400_000);  // 4M × 0.6
    expect(r.montoObjetivoTotal).toBe(2_400_000 * 6); // 6 meses default
  });

  it('con gastos fijos mensuales, suma sus montos', () => {
    S.gastosFijos = [
      { id: 1, monto: 800_000, periodicidad: 'mensual' },  // arriendo
      { id: 2, monto: 200_000, periodicidad: 'mensual' },  // servicios
    ];
    const r = calcularFondoEmergencia();
    expect(r.gastoMensualFijo).toBe(1_000_000);
    expect(r.montoObjetivoTotal).toBe(6_000_000);
  });

  it('los gastos quincenales se duplican para llevarlos a mensual', () => {
    S.gastosFijos = [
      { id: 1, monto: 500_000, periodicidad: 'quincenal' }, // 2 quincenas/mes
    ];
    const r = calcularFondoEmergencia();
    expect(r.gastoMensualFijo).toBe(1_000_000);
  });

  it('respeta objetivoMeses configurado por el usuario', () => {
    S.gastosFijos = [{ id: 1, monto: 1_000_000, periodicidad: 'mensual' }];
    S.fondoEmergencia.objetivoMeses = 3;
    const r = calcularFondoEmergencia();
    expect(r.montoObjetivoTotal).toBe(3_000_000);
  });

  it('porcentajeCompletado y mesesCubiertos al llegar al 100%', () => {
    S.gastosFijos = [{ id: 1, monto: 1_000_000, periodicidad: 'mensual' }];
    S.fondoEmergencia.actual = 6_000_000;
    const r = calcularFondoEmergencia();
    expect(r.porcentajeCompletado).toBe('100.0');
    expect(r.mesesCubiertos).toBe('6.0');
    expect(r.faltaPorAhorrar).toBe(0);
  });

  it('porcentajeCompletado se capa al 100% aunque actual > objetivo', () => {
    S.gastosFijos = [{ id: 1, monto: 1_000_000, periodicidad: 'mensual' }];
    S.fondoEmergencia.actual = 10_000_000;  // más del objetivo
    const r = calcularFondoEmergencia();
    expect(r.porcentajeCompletado).toBe('100.0');
    expect(r.faltaPorAhorrar).toBe(0);  // nunca negativo
  });

  it('mesesCubiertos refleja cuántos meses cubre el dinero actual', () => {
    S.gastosFijos = [{ id: 1, monto: 1_000_000, periodicidad: 'mensual' }];
    S.fondoEmergencia.actual = 2_500_000;
    const r = calcularFondoEmergencia();
    expect(r.mesesCubiertos).toBe('2.5');
  });

});

// ─── totalBolsillos ──────────────────────────────────────────────────────────

describe('totalBolsillos()', () => {

  beforeEach(() => resetAppState());

  it('devuelve 0 si no hay bolsillos', () => {
    expect(totalBolsillos()).toBe(0);
  });

  it('suma los montos de todos los bolsillos', () => {
    S.bolsillos = [
      { id: 1, monto: 500_000 },
      { id: 2, monto: 1_200_000 },
      { id: 3, monto: 300_000 },
    ];
    expect(totalBolsillos()).toBe(2_000_000);
  });

  it('ignora montos null/undefined sin romperse', () => {
    S.bolsillos = [
      { id: 1, monto: 500_000 },
      { id: 2, monto: null },
      { id: 3 /* sin monto */ },
    ];
    expect(totalBolsillos()).toBe(500_000);
  });

  it('inicializa bolsillos como array vacío si no existía', () => {
    delete S.bolsillos;
    expect(totalBolsillos()).toBe(0);
    expect(Array.isArray(S.bolsillos)).toBe(true);
  });

});

// ─── platoLibre ──────────────────────────────────────────────────────────────

describe('platoLibre()', () => {

  beforeEach(() => resetAppState());

  it('sin saldos ni bolsillos retorna 0', () => {
    expect(platoLibre()).toBe(0);
  });

  it('saldo total - bolsillos cuando hay margen', () => {
    S.saldos = { efectivo: 1_000_000, banco: 4_000_000 };
    S.bolsillos = [{ id: 1, monto: 1_500_000 }];
    expect(platoLibre()).toBe(3_500_000);  // 5M - 1.5M
  });

  it('clamp en 0 si los bolsillos superan el saldo real', () => {
    S.saldos = { efectivo: 100_000, banco: 200_000 };
    S.bolsillos = [{ id: 1, monto: 1_000_000 }];
    expect(platoLibre()).toBe(0);  // nunca negativo
  });

  it('todo el saldo es libre cuando no hay bolsillos', () => {
    S.saldos = { efectivo: 500_000, banco: 1_500_000 };
    expect(platoLibre()).toBe(2_000_000);
  });

});

// ─── descontarFondo / reintegrarFondo (desde infra/utils.js) ─────────────────

describe('descontarFondo()', () => {

  beforeEach(() => {
    resetAppState();
    if (typeof window !== 'undefined') {
      window.updSaldo = window.updSaldo || (() => {});
    }
  });

  it('descuenta de S.saldos.efectivo cuando fondo === "efectivo"', () => {
    S.saldos.efectivo = 500_000;
    descontarFondo('efectivo', 100_000);
    expect(S.saldos.efectivo).toBe(400_000);
  });

  it('no baja el efectivo de 0 (Math.max protege contra negativos)', () => {
    S.saldos.efectivo = 50_000;
    descontarFondo('efectivo', 100_000);
    expect(S.saldos.efectivo).toBe(0);
  });

  it('descuenta de la cuenta específica con fondo "cuenta_<id>"', () => {
    S.cuentas = [
      { id: 1, banco: 'bancolombia', nombre: 'Ahorros', icono: '🏦', saldo: 1_000_000 },
      { id: 2, banco: 'davivienda',  nombre: 'Sueldo',  icono: '🏦', saldo: 500_000 },
    ];
    S.saldos.banco = 1_500_000;
    descontarFondo('cuenta_1', 200_000);
    expect(S.cuentas[0].saldo).toBe(800_000);
    expect(S.cuentas[1].saldo).toBe(500_000);  // no se toca
    expect(S.saldos.banco).toBe(1_300_000);    // recalculado
  });

  it('si la cuenta_<id> referida no existe, hace fallback al banco genérico', () => {
    S.cuentas    = [{ id: 1, saldo: 1_000_000 }];
    S.saldos.banco = 1_000_000;
    descontarFondo('cuenta_999', 200_000);  // id que no existe
    expect(S.saldos.banco).toBe(800_000);   // fallback aplicado
    expect(S.cuentas[0].saldo).toBe(1_000_000);  // intacto
  });

  it('descuenta del banco genérico para cualquier otro fondo', () => {
    S.saldos.banco = 1_000_000;
    descontarFondo('banco', 250_000);
    expect(S.saldos.banco).toBe(750_000);
  });

  it('protege contra saldos negativos en cuentas también', () => {
    S.cuentas = [{ id: 1, saldo: 100_000 }];
    S.saldos.banco = 100_000;
    descontarFondo('cuenta_1', 500_000);  // intentar sacar más
    expect(S.cuentas[0].saldo).toBe(0);
    expect(S.saldos.banco).toBe(0);
  });

});

describe('reintegrarFondo()', () => {

  beforeEach(() => {
    resetAppState();
    if (typeof window !== 'undefined') {
      window.updSaldo = window.updSaldo || (() => {});
    }
  });

  it('suma a S.saldos.efectivo', () => {
    S.saldos.efectivo = 200_000;
    reintegrarFondo('efectivo', 50_000);
    expect(S.saldos.efectivo).toBe(250_000);
  });

  it('reintegra a la cuenta específica y recalcula el banco', () => {
    S.cuentas = [
      { id: 1, saldo: 100_000 },
      { id: 2, saldo: 200_000 },
    ];
    S.saldos.banco = 300_000;
    reintegrarFondo('cuenta_2', 100_000);
    expect(S.cuentas[1].saldo).toBe(300_000);
    expect(S.saldos.banco).toBe(400_000);  // 100 + 300 recalculado
  });

  it('si la cuenta no existe reintegra al banco genérico', () => {
    S.cuentas    = [{ id: 1, saldo: 100_000 }];
    S.saldos.banco = 100_000;
    reintegrarFondo('cuenta_999', 50_000);
    expect(S.saldos.banco).toBe(150_000);
    expect(S.cuentas[0].saldo).toBe(100_000);
  });

  it('reintegra al banco genérico para cualquier otro fondo', () => {
    S.saldos.banco = 500_000;
    reintegrarFondo('banco', 100_000);
    expect(S.saldos.banco).toBe(600_000);
  });

  it('descontar + reintegrar del mismo monto deja el saldo igual', () => {
    S.saldos.banco = 1_000_000;
    descontarFondo('banco', 250_000);
    reintegrarFondo('banco', 250_000);
    expect(S.saldos.banco).toBe(1_000_000);
  });

});

// ─── bolsillosOlvidados ──────────────────────────────────────────────────────

describe('bolsillosOlvidados()', () => {

  // Helper: un bolsillo con la forma esperada por la app real
  const mkBol = (over = {}) => ({
    id: 1,
    nombre: 'Test',
    monto: 100_000,
    icono: '🪙',
    fechaCreado: '2026-01-01',
    movimientos: [],
    ...over,
  });

  it('retorna [] cuando no hay bolsillos', () => {
    expect(bolsillosOlvidados([], '2026-04-26')).toEqual([]);
  });

  it('retorna [] cuando bolsillos no es array', () => {
    expect(bolsillosOlvidados(null, '2026-04-26')).toEqual([]);
    expect(bolsillosOlvidados(undefined, '2026-04-26')).toEqual([]);
  });

  it('retorna [] cuando hoyISO es falsy', () => {
    const bols = [mkBol({ fechaCreado: '2026-01-01' })];
    expect(bolsillosOlvidados(bols, '')).toEqual([]);
    expect(bolsillosOlvidados(bols, null)).toEqual([]);
  });

  it('retorna [] cuando hoyISO tiene formato inválido', () => {
    const bols = [mkBol({ fechaCreado: '2026-01-01' })];
    expect(bolsillosOlvidados(bols, 'no-fecha')).toEqual([]);
  });

  it('bolsillo con abono ayer → no olvidado', () => {
    const bols = [mkBol({
      movimientos: [{ tipo: 'abono', fecha: '2026-04-25', monto: 50_000 }],
    })];
    expect(bolsillosOlvidados(bols, '2026-04-26', 15)).toEqual([]);
  });

  it('bolsillo con último abono hace 16 días → olvidado', () => {
    const bols = [mkBol({
      id: 7,
      nombre: 'Vacaciones',
      movimientos: [{ tipo: 'abono', fecha: '2026-04-10', monto: 50_000 }],
    })];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(7);
    expect(r[0].diasSinAporte).toBe(16);
    expect(r[0].ultimoAporte).toBe('2026-04-10');
  });

  it('toma el más reciente entre varios abonos', () => {
    const bols = [mkBol({
      movimientos: [
        { tipo: 'abono', fecha: '2026-01-15', monto: 10_000 },
        { tipo: 'abono', fecha: '2026-04-20', monto: 50_000 }, // el más nuevo
        { tipo: 'abono', fecha: '2026-02-10', monto: 30_000 },
      ],
    })];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r).toEqual([]); // el último abono fue hace 6 días → no olvidado
  });

  it('saldo_inicial cuenta como aporte (no se considera olvidado)', () => {
    const bols = [mkBol({
      fechaCreado: '2026-01-01',
      movimientos: [
        { tipo: 'saldo_inicial', fecha: '2026-04-20', monto: 100_000 },
      ],
    })];
    expect(bolsillosOlvidados(bols, '2026-04-26', 15)).toEqual([]);
  });

  it('retiros NO cuentan como aporte: con solo retiros recientes sigue olvidado', () => {
    const bols = [mkBol({
      fechaCreado: '2026-01-01',
      movimientos: [
        { tipo: 'abono',  fecha: '2026-01-05', monto: 100_000 }, // hace ~111d
        { tipo: 'retiro', fecha: '2026-04-20', monto: 30_000 },  // reciente, ignorado
      ],
    })];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r).toHaveLength(1);
    expect(r[0].ultimoAporte).toBe('2026-01-05');
    expect(r[0].diasSinAporte).toBeGreaterThanOrEqual(100);
  });

  it('sin movimientos pero con fechaCreado vieja → olvidado desde la creación', () => {
    const bols = [mkBol({
      id: 3,
      nombre: 'Recién creado y abandonado',
      monto: 0,
      fechaCreado: '2026-04-01',
      movimientos: [],
    })];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(3);
    expect(r[0].diasSinAporte).toBe(25);
    expect(r[0].ultimoAporte).toBe('2026-04-01');
  });

  it('sin fechaCreado y sin movimientos → no se incluye (no hay con qué juzgar)', () => {
    const bols = [{ id: 99, nombre: 'Huérfano', monto: 0 }];
    expect(bolsillosOlvidados(bols, '2026-04-26', 15)).toEqual([]);
  });

  it('umbral custom 7 → más estricto', () => {
    const bols = [mkBol({
      id: 1,
      movimientos: [{ tipo: 'abono', fecha: '2026-04-18', monto: 10_000 }], // hace 8d
    })];
    const dias15 = bolsillosOlvidados(bols, '2026-04-26', 15);
    const dias7  = bolsillosOlvidados(bols, '2026-04-26', 7);
    expect(dias15).toEqual([]); // 8 < 15
    expect(dias7).toHaveLength(1); // 8 >= 7
  });

  it('múltiples olvidados se ordenan por diasSinAporte DESC', () => {
    const bols = [
      mkBol({
        id: 1, nombre: 'Reciente olvidado',
        movimientos: [{ tipo: 'abono', fecha: '2026-04-09', monto: 10 }], // 17d
      }),
      mkBol({
        id: 2, nombre: 'Más viejo',
        movimientos: [{ tipo: 'abono', fecha: '2026-01-15', monto: 10 }], // ~101d
      }),
      mkBol({
        id: 3, nombre: 'Antiquísimo',
        movimientos: [{ tipo: 'abono', fecha: '2025-12-01', monto: 10 }], // ~146d
      }),
    ];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r.map(x => x.id)).toEqual([3, 2, 1]); // del más olvidado al menos
    expect(r[0].diasSinAporte).toBeGreaterThan(r[1].diasSinAporte);
    expect(r[1].diasSinAporte).toBeGreaterThan(r[2].diasSinAporte);
  });

  it('mezcla recientes y olvidados: solo devuelve los olvidados', () => {
    const bols = [
      mkBol({
        id: 1, nombre: 'Activo',
        movimientos: [{ tipo: 'abono', fecha: '2026-04-25', monto: 10 }],
      }),
      mkBol({
        id: 2, nombre: 'Abandonado',
        movimientos: [{ tipo: 'abono', fecha: '2026-03-01', monto: 10 }],
      }),
    ];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(2);
  });

  it('forma del objeto devuelto incluye los campos del UI', () => {
    const bols = [mkBol({
      id: 42,
      nombre: 'Viaje',
      monto: 250_000,
      icono: '✈️',
      fechaCreado: '2026-01-01',
      movimientos: [],
    })];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r[0]).toMatchObject({
      id: 42,
      nombre: 'Viaje',
      icono: '✈️',
      monto: 250_000,
      ultimoAporte: '2026-01-01',
    });
    expect(typeof r[0].diasSinAporte).toBe('number');
  });

  it('bolsillo sin nombre / sin icono recibe defaults razonables', () => {
    const bols = [{
      id: 1,
      monto: 0,
      fechaCreado: '2026-01-01',
      movimientos: [],
    }];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r[0].nombre).toBe('Sin nombre');
    expect(r[0].icono).toBe('🪙');
  });

  it('item null/undefined dentro del array no rompe el cálculo', () => {
    const bols = [
      null,
      undefined,
      mkBol({ id: 1, fechaCreado: '2026-01-01', movimientos: [] }),
    ];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(1);
  });

  it('movimientos con fecha vacía o tipo desconocido se ignoran', () => {
    const bols = [mkBol({
      id: 1,
      fechaCreado: '2026-01-01',
      movimientos: [
        { tipo: 'abono', fecha: '' },             // sin fecha → ignorado
        { tipo: 'misterioso', fecha: '2026-04-25' }, // tipo desconocido
        null,                                       // robusto
      ],
    })];
    const r = bolsillosOlvidados(bols, '2026-04-26', 15);
    expect(r).toHaveLength(1);
    expect(r[0].ultimoAporte).toBe('2026-01-01'); // cae al fechaCreado
  });

});
