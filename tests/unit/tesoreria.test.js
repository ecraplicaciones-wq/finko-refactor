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
  calcularProyeccionFondo,
  totalBolsillos,
  platoLibre,
  bolsillosOlvidados,
  detectarBolsillosEnFuga,
  detectarIncoherenciaSaldos,
  calcularRebalanceoBolsillos,
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

// ─── detectarBolsillosEnFuga ─────────────────────────────────────────────────
//
// Distinto de bolsillosOlvidados: detecta bolsillos con actividad en los
// últimos N meses pero predominantemente retiros (neto negativo). Severidad
// 'alta' = saldo > 0 sin un solo abono. 'media' = abona pero retira más.
// 'baja' = ya quedó vacío.
//
// Hoy de referencia para todos los tests: '2026-04-27' → ventana default
// ['2026-04', '2026-03', '2026-02']. fechaCreado vieja → '2025-01-01' para
// que el filtro de antigüedad (default 3 meses) deje pasar al bolsillo.

describe('detectarBolsillosEnFuga()', () => {

  // Helper: bolsillo con valores por defecto razonables. Se sobreescriben con `over`.
  const mkBol = (over = {}) => ({
    id: 1,
    nombre: 'Viaje',
    monto: 500_000,
    icono: '✈️',
    fechaCreado: '2025-01-01',
    movimientos: [],
    ...over,
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → []', () => {
    it('bolsillos no array', () => {
      expect(detectarBolsillosEnFuga(null, '2026-04-27')).toEqual([]);
      expect(detectarBolsillosEnFuga(undefined, '2026-04-27')).toEqual([]);
      expect(detectarBolsillosEnFuga('foo', '2026-04-27')).toEqual([]);
      expect(detectarBolsillosEnFuga(42, '2026-04-27')).toEqual([]);
    });
    it('bolsillos array vacío', () => {
      expect(detectarBolsillosEnFuga([], '2026-04-27')).toEqual([]);
    });
    it('hoyISO no string', () => {
      expect(detectarBolsillosEnFuga([mkBol()], null)).toEqual([]);
      expect(detectarBolsillosEnFuga([mkBol()], 12345)).toEqual([]);
    });
    it('hoyISO con formato inválido', () => {
      expect(detectarBolsillosEnFuga([mkBol()], 'no-fecha')).toEqual([]);
      expect(detectarBolsillosEnFuga([mkBol()], '2026/04/27')).toEqual([]);
      expect(detectarBolsillosEnFuga([mkBol()], '04-2026')).toEqual([]);
    });
  });

  // ── BLOQUE: BOLSILLOS QUE NO ESTÁN EN FUGA ─────────────────────────────────
  describe('bolsillos que no están en fuga → []', () => {
    it('sin movimientos en la ventana', () => {
      const bols = [mkBol({
        movimientos: [{ tipo: 'retiro', fecha: '2025-10-15', monto: 50_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('solo abonos en la ventana → no es fuga', () => {
      const bols = [mkBol({
        movimientos: [{ tipo: 'abono', fecha: '2026-03-10', monto: 100_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('abonos == retiros (neto exactamente 0) → no es fuga', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'abono',  fecha: '2026-03-10', monto: 100_000 },
          { tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 },
        ],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('abonos > retiros (neto positivo) → no es fuga', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'abono',  fecha: '2026-03-10', monto: 200_000 },
          { tipo: 'retiro', fecha: '2026-04-05', monto: 50_000 },
        ],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('bolsillo con solo saldo_inicial dentro de la ventana → no es fuga', () => {
      const bols = [mkBol({
        movimientos: [{ tipo: 'saldo_inicial', fecha: '2026-02-10', monto: 500_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('movimientos viejos (fuera de ventana) ignorados → no es fuga', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'retiro', fecha: '2025-08-10', monto: 200_000 },
          { tipo: 'abono',  fecha: '2026-04-10', monto: 50_000 },
        ],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
  });

  // ── BLOQUE: ANTIGÜEDAD ─────────────────────────────────────────────────────
  describe('filtro de antigüedad', () => {
    it('bolsillo con fechaCreado hace 1 mes (< 3 default) → ignorado aunque haya fuga', () => {
      const bols = [mkBol({
        fechaCreado: '2026-03-15',
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-20', monto: 100_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('bolsillo con fechaCreado hace 3 meses exactos → se evalúa', () => {
      const bols = [mkBol({
        fechaCreado: '2026-01-15',
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-20', monto: 100_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toHaveLength(1);
    });
    it('antiguedadMinMeses = 0 → cualquier bolsillo se evalúa', () => {
      const bols = [mkBol({
        fechaCreado: '2026-04-01',
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-20', monto: 100_000 }],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27', { antiguedadMinMeses: 0 });
      expect(r).toHaveLength(1);
    });
    it('fechaCreado malformada → ignorado (defensive)', () => {
      const bols = [mkBol({
        fechaCreado: 'sin-fecha',
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-20', monto: 100_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('sin fechaCreado → no aplica filtro de antigüedad (se evalúa)', () => {
      const bols = [{
        id: 5, nombre: 'X', monto: 100_000,
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-20', monto: 100_000 }],
      }];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toHaveLength(1);
    });
  });

  // ── BLOQUE: SEVERIDAD ──────────────────────────────────────────────────────
  describe('severidad y sugerencia', () => {
    it("severidad 'alta' = saldo > 0 + abonado === 0 + retiros", () => {
      const bols = [mkBol({
        monto: 300_000,
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 200_000 }],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].severidad).toBe('alta');
      expect(r[0].sugerencia).toBe('replantear');
    });
    it("severidad 'media' = saldo > 0 + abonado > 0 pero retirado > abonado", () => {
      const bols = [mkBol({
        monto: 100_000,
        movimientos: [
          { tipo: 'abono',  fecha: '2026-03-10', monto: 50_000 },
          { tipo: 'retiro', fecha: '2026-04-10', monto: 150_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].severidad).toBe('media');
      expect(r[0].sugerencia).toBe('replantear');
    });
    it("severidad 'baja' = saldo === 0 → sugerencia 'cerrar'", () => {
      const bols = [mkBol({
        monto: 0,
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 200_000 }],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].severidad).toBe('baja');
      expect(r[0].sugerencia).toBe('cerrar');
    });
    it("saldo negativo (caso teórico) → severidad 'baja', cerrar", () => {
      const bols = [mkBol({
        monto: -1,
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].severidad).toBe('baja');
      expect(r[0].sugerencia).toBe('cerrar');
    });
  });

  // ── BLOQUE: VENTANA Y CONFIG ───────────────────────────────────────────────
  describe('config (mesesVentana, antiguedadMinMeses)', () => {
    it('mesesVentana = 1 → solo el mes actual considerado', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'retiro', fecha: '2026-03-15', monto: 100_000 }, // fuera con vent=1
          { tipo: 'abono',  fecha: '2026-04-10', monto: 200_000 }, // dentro
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27', { mesesVentana: 1 });
      expect(r).toEqual([]); // solo abonos dentro
    });
    it('mesesVentana = 6 → ventana mayor captura más historia', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'retiro', fecha: '2025-12-15', monto: 100_000 }, // fuera con vent=3
          { tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 },
        ],
      })];
      const r3 = detectarBolsillosEnFuga(bols, '2026-04-27', { mesesVentana: 3 });
      const r6 = detectarBolsillosEnFuga(bols, '2026-04-27', { mesesVentana: 6 });
      expect(r3[0].retiradoVentana).toBe(50_000);
      expect(r6[0].retiradoVentana).toBe(150_000);
    });
    it('mesesVentana inválido → fallback al default 3', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'retiro', fecha: '2026-02-10', monto: 100_000 },
          { tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27', { mesesVentana: 'tres' });
      expect(r[0].retiradoVentana).toBe(150_000);
    });
    it('mesesVentana <= 0 → fallback al default 3', () => {
      const bols = [mkBol({
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
      })];
      const r0 = detectarBolsillosEnFuga(bols, '2026-04-27', { mesesVentana: 0 });
      const rN = detectarBolsillosEnFuga(bols, '2026-04-27', { mesesVentana: -5 });
      expect(r0).toHaveLength(1);
      expect(rN).toHaveLength(1);
    });
    it('config null o no-objeto → defaults', () => {
      const bols = [mkBol({
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27', null)).toHaveLength(1);
      expect(detectarBolsillosEnFuga(bols, '2026-04-27', 'foo')).toHaveLength(1);
    });
    it('mesesVentana decimal → se trunca con floor', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'retiro', fecha: '2026-03-10', monto: 100_000 },
          { tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27', { mesesVentana: 2.9 });
      // floor(2.9) = 2 → ventana ['2026-04', '2026-03']
      expect(r[0].retiradoVentana).toBe(150_000);
    });
  });

  // ── BLOQUE: MOVIMIENTOS MALFORMADOS ────────────────────────────────────────
  describe('movimientos malformados', () => {
    it('movimientos no array → se ignora', () => {
      const bols = [mkBol({ movimientos: 'no soy array' })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('movimientos undefined → se ignora', () => {
      const bols = [mkBol({ movimientos: undefined })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')).toEqual([]);
    });
    it('items null/undefined dentro del array → se saltan', () => {
      const bols = [mkBol({
        movimientos: [
          null, undefined, 'string',
          { tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].retiradoVentana).toBe(100_000);
    });
    it('monto cero o negativo → ignorado', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'retiro', fecha: '2026-04-10', monto: 0 },
          { tipo: 'retiro', fecha: '2026-04-10', monto: -50_000 },
          { tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].retiradoVentana).toBe(50_000);
    });
    it('tipo desconocido → ignorado', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'misterioso', fecha: '2026-04-10', monto: 1_000_000 },
          { tipo: 'retiro',     fecha: '2026-04-10', monto: 50_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].retiradoVentana).toBe(50_000);
      expect(r[0].abonadoVentana).toBe(0);
    });
    it('fecha vacía o malformada → ignorado', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'retiro', fecha: '',           monto: 100_000 },
          { tipo: 'retiro', fecha: 'no-fecha',   monto: 100_000 },
          { tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].retiradoVentana).toBe(50_000);
    });
    it('saldo_inicial fuera de ventana no cuenta como abono', () => {
      const bols = [mkBol({
        movimientos: [
          { tipo: 'saldo_inicial', fecha: '2025-06-01', monto: 500_000 },
          { tipo: 'retiro',        fecha: '2026-04-10', monto: 100_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].abonadoVentana).toBe(0);
      expect(r[0].severidad).toBe('alta');
    });
  });

  // ── BLOQUE: ENTRIES BÁSICAS Y FORMA DEL RETORNO ────────────────────────────
  describe('forma del retorno', () => {
    it('campos esperados en cada entry', () => {
      const bols = [mkBol({
        id: 42,
        nombre: 'Viaje Diciembre',
        icono: '✈️',
        monto: 200_000,
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0]).toEqual({
        id: 42,
        nombre: 'Viaje Diciembre',
        icono: '✈️',
        saldoActual: 200_000,
        abonadoVentana: 0,
        retiradoVentana: 100_000,
        netoVentana: -100_000,
        severidad: 'alta',
        sugerencia: 'replantear',
        mesesVentana: 3,
      });
    });
    it("nombre vacío → 'Sin nombre'", () => {
      const bols = [mkBol({
        nombre: '',
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')[0].nombre).toBe('Sin nombre');
    });
    it("icono vacío → '🪙'", () => {
      const bols = [mkBol({
        icono: '',
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
      })];
      expect(detectarBolsillosEnFuga(bols, '2026-04-27')[0].icono).toBe('🪙');
    });
    it('monto no numérico → saldoActual 0, severidad baja', () => {
      const bols = [mkBol({
        monto: 'qué',
        movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].saldoActual).toBe(0);
      expect(r[0].severidad).toBe('baja');
    });
  });

  // ── BLOQUE: ORDENAMIENTO ───────────────────────────────────────────────────
  describe('ordenamiento', () => {
    it('alta antes que media antes que baja', () => {
      const bols = [
        mkBol({
          id: 1, nombre: 'Baja', monto: 0,
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }],
        }),
        mkBol({
          id: 2, nombre: 'Media', monto: 100_000,
          movimientos: [
            { tipo: 'abono',  fecha: '2026-03-10', monto: 50_000 },
            { tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 },
          ],
        }),
        mkBol({
          id: 3, nombre: 'Alta', monto: 100_000,
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }],
        }),
      ];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r.map(x => x.severidad)).toEqual(['alta', 'media', 'baja']);
    });
    it('mismo nivel: mayor pérdida primero', () => {
      const bols = [
        mkBol({
          id: 1, nombre: 'Pérdida chica', monto: 100_000,
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 30_000 }],
        }),
        mkBol({
          id: 2, nombre: 'Pérdida grande', monto: 100_000,
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 200_000 }],
        }),
      ];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].id).toBe(2);
      expect(r[1].id).toBe(1);
    });
    it('empate exacto → menor id primero (determinístico)', () => {
      const bols = [
        mkBol({
          id: 7, nombre: 'A', monto: 100_000,
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }],
        }),
        mkBol({
          id: 3, nombre: 'B', monto: 100_000,
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }],
        }),
      ];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r[0].id).toBe(3);
      expect(r[1].id).toBe(7);
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('bolsillo "Viaje" $500k abonado en 2025, 3 retiros recientes → fuga alta', () => {
      const bols = [mkBol({
        id: 100,
        nombre: 'Viaje Diciembre',
        monto: 350_000,
        fechaCreado: '2025-08-01',
        movimientos: [
          { tipo: 'saldo_inicial', fecha: '2025-08-01', monto: 500_000 },
          { tipo: 'retiro',        fecha: '2026-02-15', monto: 50_000 },
          { tipo: 'retiro',        fecha: '2026-03-10', monto: 50_000 },
          { tipo: 'retiro',        fecha: '2026-04-22', monto: 50_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('alta');
      expect(r[0].abonadoVentana).toBe(0);
      expect(r[0].retiradoVentana).toBe(150_000);
      expect(r[0].sugerencia).toBe('replantear');
    });
    it('mezcla de bolsillos sanos y en fuga → solo retorna los en fuga', () => {
      const bols = [
        mkBol({
          id: 1, nombre: 'Sano',
          movimientos: [{ tipo: 'abono', fecha: '2026-04-10', monto: 100_000 }],
        }),
        mkBol({
          id: 2, nombre: 'Fuga',
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 100_000 }],
        }),
        mkBol({
          id: 3, nombre: 'Sin actividad',
          movimientos: [{ tipo: 'abono', fecha: '2025-06-10', monto: 100_000 }],
        }),
      ];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(2);
    });
    it('bolsillo sin id → ignorado', () => {
      const bols = [
        { nombre: 'Anónimo', monto: 100_000, fechaCreado: '2025-01-01',
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }] },
        mkBol({
          id: 5, movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }],
        }),
      ];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(5);
    });
    it('bolsillo null/no-objeto en el array → ignorado', () => {
      const bols = [
        null, undefined, 'string', 42,
        mkBol({ id: 7, movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }] }),
      ];
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(7);
    });
    it('cruce de año en la ventana: hoy=2026-02-15, ventana=3 → ene2026, dic2025, nov2025', () => {
      const bols = [mkBol({
        fechaCreado: '2025-01-01',
        movimientos: [
          { tipo: 'retiro', fecha: '2025-12-10', monto: 50_000 },
          { tipo: 'retiro', fecha: '2026-01-10', monto: 50_000 },
          { tipo: 'retiro', fecha: '2026-02-05', monto: 50_000 },
        ],
      })];
      const r = detectarBolsillosEnFuga(bols, '2026-02-15');
      expect(r[0].retiradoVentana).toBe(150_000);
    });
    it('1000 bolsillos (stress) → orden estable y rápido', () => {
      const bols = [];
      for (let i = 0; i < 1000; i++) {
        bols.push(mkBol({
          id: i,
          monto: 100_000,
          fechaCreado: '2025-01-01',
          movimientos: [{ tipo: 'retiro', fecha: '2026-04-10', monto: 50_000 }],
        }));
      }
      const r = detectarBolsillosEnFuga(bols, '2026-04-27');
      expect(r).toHaveLength(1000);
      // todos severidad alta (saldo>0, abonado=0) → orden por id asc
      expect(r[0].id).toBe(0);
      expect(r[999].id).toBe(999);
    });
  });

});

// ─── detectarIncoherenciaSaldos ──────────────────────────────────────────────
//
// Validador preventivo de invariantes:
//   1. drift-banco       — saldos.banco != Σ cuentas[].saldo (cuando hay cuentas)
//   2. cuenta-negativa   — alguna cuenta con saldo < 0
//   3. banco-negativo    — saldos.banco < 0
//   4. efectivo-negativo — saldos.efectivo < 0
//
// Pure: sin S, sin DOM. Devuelve array (vacío = todo coherente).

describe('detectarIncoherenciaSaldos()', () => {

  // Helper: cuenta canónica.
  const C = (over = {}) => ({
    id: 1, nombre: 'Bancolombia', saldo: 100_000, banco: 'bancolombia', ...over,
  });

  // ── BLOQUE: TODO COHERENTE → [] ────────────────────────────────────────────
  describe('todo coherente → []', () => {
    it('sin cuentas, banco y efectivo en positivo', () => {
      const r = detectarIncoherenciaSaldos({ efectivo: 50_000, banco: 200_000 }, []);
      expect(r).toEqual([]);
    });
    it('cuentas con suma exactamente igual a saldos.banco', () => {
      const cuentas = [C({ id: 1, saldo: 100_000 }), C({ id: 2, saldo: 200_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 300_000 }, cuentas);
      expect(r).toEqual([]);
    });
    it('todo en cero', () => {
      expect(detectarIncoherenciaSaldos({ efectivo: 0, banco: 0 }, [])).toEqual([]);
    });
    it('saldos.banco = 0 con cuentas en 0', () => {
      const cuentas = [C({ id: 1, saldo: 0 }), C({ id: 2, saldo: 0 })];
      expect(detectarIncoherenciaSaldos({ efectivo: 0, banco: 0 }, cuentas)).toEqual([]);
    });
    it('drift menor al umbral default (1k) → coherente', () => {
      const cuentas = [C({ saldo: 100_500 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 100_000 }, cuentas);
      expect(r).toEqual([]);  // diff 500 < 1000
    });
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas', () => {
    it('saldos null → tratado como 0/0, no rompe', () => {
      const r = detectarIncoherenciaSaldos(null, []);
      expect(r).toEqual([]);
    });
    it('saldos array → tratado como inválido (0/0)', () => {
      const r = detectarIncoherenciaSaldos([1, 2, 3], []);
      expect(r).toEqual([]);
    });
    it('cuentas null → tratado como []', () => {
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 0 }, null);
      expect(r).toEqual([]);
    });
    it('saldos con valores no-numéricos → tratados como 0', () => {
      const r = detectarIncoherenciaSaldos({ efectivo: 'a', banco: 'b' }, []);
      expect(r).toEqual([]);
    });
  });

  // ── BLOQUE: DRIFT DE BANCO ─────────────────────────────────────────────────
  describe('drift de saldos.banco vs Σ cuentas', () => {
    it('saldos.banco mayor que suma → "sobra en saldos.banco"', () => {
      const cuentas = [C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 200_000 }, cuentas);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('drift-banco');
      expect(r[0].diferencia).toBe(100_000);
      expect(r[0].mensaje).toContain('sobra en saldos.banco');
    });
    it('suma mayor que saldos.banco → "sobra en cuentas"', () => {
      const cuentas = [C({ saldo: 200_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 50_000 }, cuentas);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('drift-banco');
      expect(r[0].diferencia).toBe(-150_000);
      expect(r[0].mensaje).toContain('sobra en cuentas');
    });
    it("severidad 'leve' (1k-9.9k)", () => {
      const cuentas = [C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 105_000 }, cuentas);
      expect(r[0].severidad).toBe('leve');
    });
    it("severidad 'moderada' (10k-99.9k)", () => {
      const cuentas = [C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 150_000 }, cuentas);
      expect(r[0].severidad).toBe('moderada');
    });
    it("severidad 'grave' (100k+)", () => {
      const cuentas = [C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 500_000 }, cuentas);
      expect(r[0].severidad).toBe('grave');
    });
    it('umbralPesos custom (0) → cualquier diferencia ≥ 0 cuenta', () => {
      // Con umbral=0, un drift de 1 peso ya es flag (toda diferencia >= 0)
      const cuentas = [C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 100_001 }, cuentas, { umbralPesos: 0 });
      expect(r).toHaveLength(1);
    });
    it('umbralPesos = 50_000 → drifts pequeños no aparecen', () => {
      const cuentas = [C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 110_000 }, cuentas, { umbralPesos: 50_000 });
      expect(r).toEqual([]);
    });
    it('umbralPesos inválido → fallback a 1000', () => {
      const cuentas = [C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 102_000 }, cuentas, { umbralPesos: 'a' });
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('leve');
    });
    it('drift no aplica si NO hay cuentas (saldos.banco es la verdad)', () => {
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 1_000_000 }, []);
      expect(r).toEqual([]);
    });
    it('cuenta sin saldo (undefined) tratada como 0', () => {
      const cuentas = [C({ saldo: undefined })];
      // Σ = 0, banco = 100k → drift de 100k → grave
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 100_000 }, cuentas);
      expect(r[0].severidad).toBe('grave');
      expect(r[0].sumaCuentas).toBe(0);
    });
  });

  // ── BLOQUE: NEGATIVOS ──────────────────────────────────────────────────────
  describe('saldos negativos', () => {
    it('efectivo negativo → grave', () => {
      const r = detectarIncoherenciaSaldos({ efectivo: -100, banco: 0 }, []);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('efectivo-negativo');
      expect(r[0].severidad).toBe('grave');
      expect(r[0].monto).toBe(-100);
    });
    it('banco negativo → grave', () => {
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: -500 }, []);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('banco-negativo');
      expect(r[0].severidad).toBe('grave');
    });
    it('cuenta con saldo negativo → grave + cuenta info', () => {
      const cuentas = [
        C({ id: 1, nombre: 'OK',     saldo: 100_000 }),
        C({ id: 2, nombre: 'Mala',   saldo: -50_000 }),
      ];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 50_000 }, cuentas);
      const cuentaNeg = r.find(x => x.tipo === 'cuenta-negativa');
      expect(cuentaNeg).toBeDefined();
      expect(cuentaNeg.severidad).toBe('grave');
      expect(cuentaNeg.cuenta).toEqual({ id: 2, nombre: 'Mala', saldo: -50_000 });
    });
    it('múltiples cuentas negativas → todas reportadas', () => {
      const cuentas = [
        C({ id: 1, saldo: -100 }),
        C({ id: 2, saldo: -200 }),
      ];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: -300 }, cuentas);
      const negs = r.filter(x => x.tipo === 'cuenta-negativa');
      expect(negs).toHaveLength(2);
    });
    it('cuenta sin nombre → "Cuenta sin nombre"', () => {
      const cuentas = [C({ nombre: '', saldo: -100 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: -100 }, cuentas);
      const cn = r.find(x => x.tipo === 'cuenta-negativa');
      expect(cn.cuenta.nombre).toBe('Cuenta sin nombre');
    });
  });

  // ── BLOQUE: CUENTAS MALFORMADAS ────────────────────────────────────────────
  describe('cuentas malformadas se ignoran', () => {
    it('null/undefined/no-objeto en el array', () => {
      const cuentas = [null, undefined, 'foo', 42, C({ saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 100_000 }, cuentas);
      expect(r).toEqual([]);
    });
    it('cuenta sin id → ignorada', () => {
      const cuentas = [{ nombre: 'X', saldo: -100 }, C({ id: 2, saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 100_000 }, cuentas);
      // solo se evalúa la cuenta 2 (sin negativos), Σ = 100k = banco → coherente
      expect(r).toEqual([]);
    });
    it('cuenta con saldo no-numérico tratada como 0 (no negativa)', () => {
      const cuentas = [C({ id: 1, saldo: 'a' }), C({ id: 2, saldo: 100_000 })];
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 100_000 }, cuentas);
      // Σ = 0 + 100k = 100k = banco → coherente. Saldo 'a' no es < 0.
      expect(r).toEqual([]);
    });
  });

  // ── BLOQUE: COMBINACIONES Y ORDENAMIENTO ───────────────────────────────────
  describe('múltiples issues simultáneos', () => {
    it('drift grave + cuenta negativa → ambos reportados', () => {
      const cuentas = [
        C({ id: 1, saldo: -50_000 }),
        C({ id: 2, saldo: 100_000 }),
      ];
      // Σ = 50k. banco = 500k → drift 450k (grave). Cuenta 1 negativa.
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 500_000 }, cuentas);
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(r.some(x => x.tipo === 'drift-banco')).toBe(true);
      expect(r.some(x => x.tipo === 'cuenta-negativa')).toBe(true);
    });
    it('orden: graves primero, drift antes que negativos del mismo nivel', () => {
      const cuentas = [
        C({ id: 1, saldo: -100 }),
        C({ id: 2, saldo: 100_000 }),
      ];
      const r = detectarIncoherenciaSaldos({ efectivo: -100, banco: 500_000 }, cuentas);
      // Todos grave → orden: drift-banco, cuenta-negativa, banco-negativo, efectivo-negativo
      const tipos = r.map(x => x.tipo);
      expect(tipos[0]).toBe('drift-banco');
      // efectivo-negativo viene último por tipoRank
      expect(tipos[tipos.length - 1]).toBe('efectivo-negativo');
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('usuario con 3 cuentas + banco genérico residual = drift', () => {
      const cuentas = [
        C({ id: 1, nombre: 'Bancolombia', saldo: 1_500_000 }),
        C({ id: 2, nombre: 'Davivienda',  saldo: 800_000 }),
        C({ id: 3, nombre: 'Nequi',       saldo: 200_000 }),
      ];
      // Σ = 2.5M. banco está en 2.6M (100k fantasma del banco genérico).
      const r = detectarIncoherenciaSaldos({ efectivo: 100_000, banco: 2_600_000 }, cuentas);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('drift-banco');
      expect(r[0].diferencia).toBe(100_000);
      expect(r[0].sumaCuentas).toBe(2_500_000);
      expect(r[0].bancoSaldos).toBe(2_600_000);
      expect(r[0].severidad).toBe('grave');
    });
    it('usuario coherente sin cuentas (caso simple)', () => {
      const r = detectarIncoherenciaSaldos({ efectivo: 200_000, banco: 1_500_000 }, []);
      expect(r).toEqual([]);
    });
    it('estado recién migrado (v5): cuentas + banco = 0 → coherente', () => {
      const cuentas = [C({ saldo: 1_000_000 })];
      // Migration v5 zeroes saldos.banco si era el doble — ahora cuentas=1M, banco=0
      // ESTO ES INCOHERENTE en términos del invariante saldos.banco === Σ.
      // El detector debe reportarlo (es un drift de 1M).
      const r = detectarIncoherenciaSaldos({ efectivo: 0, banco: 0 }, cuentas);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('drift-banco');
      expect(r[0].diferencia).toBe(-1_000_000);
    });
    it('100 cuentas (stress)', () => {
      const cuentas = Array.from({ length: 100 }, (_, i) =>
        C({ id: i + 1, saldo: 10_000 }));
      // Σ = 1M. banco = 1M → coherente
      const rOk = detectarIncoherenciaSaldos({ efectivo: 0, banco: 1_000_000 }, cuentas);
      expect(rOk).toEqual([]);
      // banco = 0 → drift -1M
      const rDrift = detectarIncoherenciaSaldos({ efectivo: 0, banco: 0 }, cuentas);
      expect(rDrift).toHaveLength(1);
      expect(rDrift[0].diferencia).toBe(-1_000_000);
    });
    it('no muta los inputs', () => {
      const saldos  = { efectivo: 0, banco: 200_000 };
      const cuentas = [C({ saldo: 100_000 })];
      const sOriginal = JSON.parse(JSON.stringify(saldos));
      const cOriginal = JSON.parse(JSON.stringify(cuentas));
      detectarIncoherenciaSaldos(saldos, cuentas);
      expect(saldos).toEqual(sOriginal);
      expect(cuentas).toEqual(cOriginal);
    });
  });

});

// ─── calcularRebalanceoBolsillos ─────────────────────────────────────────────
//
// Detector + plan de auto-fix para sobre-asignación de bolsillos: cuando
// Σ bolsillos[].monto > saldo real (efectivo + banco). Reduce cada bolsillo
// proporcionalmente al saldo real disponible. Pure: sin S, sin DOM.

describe('calcularRebalanceoBolsillos()', () => {

  // Helper: bolsillo mínimo válido.
  const B = (over = {}) => ({
    id: 1, nombre: 'Viaje', monto: 100_000, icono: '✈️', ...over,
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → null', () => {
    it('saldos null/no-objeto', () => {
      expect(calcularRebalanceoBolsillos(null, [B()])).toBe(null);
      expect(calcularRebalanceoBolsillos('foo', [B()])).toBe(null);
      expect(calcularRebalanceoBolsillos([1], [B()])).toBe(null);
    });
    it('bolsillos no array', () => {
      expect(calcularRebalanceoBolsillos({}, null)).toBe(null);
      expect(calcularRebalanceoBolsillos({}, 'foo')).toBe(null);
    });
    it('bolsillos vacío', () => {
      expect(calcularRebalanceoBolsillos({ efectivo: 0, banco: 100_000 }, [])).toBe(null);
    });
    it('bolsillos válidos cero (todos malformados o monto≤0)', () => {
      const b = [
        null, undefined, 'foo', { id: 1, monto: 0 }, { monto: 100 },
      ];
      expect(calcularRebalanceoBolsillos({ efectivo: 0, banco: 0 }, b)).toBe(null);
    });
  });

  // ── BLOQUE: NO HAY SOBRE-ASIGNACIÓN → null ─────────────────────────────────
  describe('estados coherentes → null', () => {
    it('Σ bolsillos < saldo real', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 1_000_000 },
        [B({ monto: 300_000 }), B({ id: 2, monto: 400_000 })]
      );
      expect(r).toBe(null);
    });
    it('Σ bolsillos === saldo real (borde)', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 700_000 },
        [B({ monto: 300_000 }), B({ id: 2, monto: 400_000 })]
      );
      expect(r).toBe(null);
    });
    it('saldo real cero pero también bolsillos cero', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 0 },
        [B({ monto: 0 })]
      );
      expect(r).toBe(null);
    });
  });

  // ── BLOQUE: SOBRE-ASIGNACIÓN BÁSICA ────────────────────────────────────────
  describe('sobre-asignación básica', () => {
    it('Σ bolsillos > saldo real → calcula plan', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 80_000 },
        [B({ monto: 100_000 })]
      );
      expect(r).not.toBe(null);
      expect(r.saldoReal).toBe(80_000);
      expect(r.sumBolActual).toBe(100_000);
      expect(r.exceso).toBe(20_000);
      expect(r.ajustes).toHaveLength(1);
      expect(r.ajustes[0].montoNuevo).toBe(80_000);
      expect(r.ajustes[0].reduccion).toBe(20_000);
    });
    it('reducción proporcional con 2 bolsillos iguales', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 100_000 },
        [B({ id: 1, monto: 100_000 }), B({ id: 2, monto: 100_000 })]
      );
      expect(r.ajustes.find(a => a.id === 1).montoNuevo).toBe(50_000);
      expect(r.ajustes.find(a => a.id === 2).montoNuevo).toBe(50_000);
    });
    it('reducción proporcional con 2 bolsillos desiguales', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 300_000 },
        [B({ id: 1, monto: 200_000 }), B({ id: 2, monto: 400_000 })]
      );
      expect(r.ajustes.find(a => a.id === 1).montoNuevo).toBe(100_000);
      expect(r.ajustes.find(a => a.id === 2).montoNuevo).toBe(200_000);
    });
    it('saldo real combinando efectivo + banco', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 30_000, banco: 70_000 },
        [B({ monto: 200_000 })]
      );
      expect(r.saldoReal).toBe(100_000);
      expect(r.ajustes[0].montoNuevo).toBe(100_000);
    });
    it('saldo real cero → todos los bolsillos a cero', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 0 },
        [B({ id: 1, monto: 100_000 }), B({ id: 2, monto: 200_000 })]
      );
      expect(r.saldoReal).toBe(0);
      expect(r.ajustes.every(a => a.montoNuevo === 0)).toBe(true);
      expect(r.exceso).toBe(300_000);
    });
  });

  // ── BLOQUE: REDONDEO ───────────────────────────────────────────────────────
  describe('residuo de redondeo', () => {
    it('Σ ajustes.montoNuevo === saldoReal (sin pesos perdidos)', () => {
      // saldoReal=50k, sumBol=150k. factor=1/3. floor cada uno → suma 49998. +2.
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [
          B({ id: 1, monto: 50_000 }),
          B({ id: 2, monto: 50_000 }),
          B({ id: 3, monto: 50_000 }),
        ]
      );
      const suma = r.ajustes.reduce((s, a) => s + a.montoNuevo, 0);
      expect(suma).toBe(50_000);
    });
    it('residuo va al bolsillo con mayor montoActual', () => {
      // saldoReal=11k, sumBol=33k. factor=1/3.
      // 10k→3333, 11k→3666, 12k→3999. Suma=10998. Falta 2 → al de 12k.
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 11_000 },
        [
          B({ id: 1, monto: 10_000 }),
          B({ id: 2, monto: 11_000 }),
          B({ id: 3, monto: 12_000 }),
        ]
      );
      const suma = r.ajustes.reduce((s, a) => s + a.montoNuevo, 0);
      expect(suma).toBe(11_000);
      expect(r.ajustes.find(a => a.id === 3).montoNuevo).toBe(4001);
    });
    it('reducción del más grande refleja el ajuste de redondeo', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 11_000 },
        [
          B({ id: 1, monto: 10_000 }),
          B({ id: 2, monto: 11_000 }),
          B({ id: 3, monto: 12_000 }),
        ]
      );
      expect(r.ajustes.find(a => a.id === 3).reduccion).toBe(7999);
    });
  });

  // ── BLOQUE: BOLSILLOS MALFORMADOS ──────────────────────────────────────────
  describe('bolsillos malformados se ignoran', () => {
    it('null/undefined/no-objeto en el array', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [null, undefined, 'foo', 42, B({ id: 5, monto: 100_000 })]
      );
      expect(r.ajustes).toHaveLength(1);
      expect(r.ajustes[0].id).toBe(5);
    });
    it('id ausente o ≤ 0', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [
          { ...B(), id: undefined, monto: 100_000 },
          { ...B(), id: 0, monto: 100_000 },
          { ...B(), id: -1, monto: 100_000 },
          B({ id: 5, monto: 100_000 }),
        ]
      );
      expect(r.ajustes).toHaveLength(1);
    });
    it('monto cero o negativo se ignora', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [
          B({ id: 1, monto: 0 }),
          B({ id: 2, monto: -100 }),
          B({ id: 3, monto: 100_000 }),
        ]
      );
      expect(r.ajustes).toHaveLength(1);
      expect(r.ajustes[0].id).toBe(3);
    });
    it('monto no numérico se ignora', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [
          B({ id: 1, monto: 'foo' }),
          B({ id: 2, monto: 100_000 }),
        ]
      );
      expect(r.ajustes).toHaveLength(1);
      expect(r.ajustes[0].id).toBe(2);
    });
  });

  // ── BLOQUE: ORDENAMIENTO ───────────────────────────────────────────────────
  describe('ordenamiento de ajustes', () => {
    it('mayor reducción primero', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 100_000 },
        [
          B({ id: 1, monto: 50_000 }),
          B({ id: 2, monto: 100_000 }),
          B({ id: 3, monto: 50_000 }),
        ]
      );
      expect(r.ajustes[0].id).toBe(2);
    });
    it('empate → menor id primero (determinístico)', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 100_000 },
        [
          B({ id: 7, monto: 100_000 }),
          B({ id: 3, monto: 100_000 }),
        ]
      );
      expect(r.ajustes[0].id).toBe(3);
      expect(r.ajustes[1].id).toBe(7);
    });
  });

  // ── BLOQUE: FORMA DEL RETORNO ──────────────────────────────────────────────
  describe('forma del retorno', () => {
    it('campos esperados en cada ajuste', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [B({ id: 42, nombre: 'Viaje', icono: '✈️', monto: 100_000 })]
      );
      expect(r.ajustes[0]).toEqual({
        id: 42,
        nombre: 'Viaje',
        icono: '✈️',
        montoActual: 100_000,
        montoNuevo: 50_000,
        reduccion: 50_000,
      });
    });
    it("nombre vacío → 'Sin nombre'", () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [B({ nombre: '', monto: 100_000 })]
      );
      expect(r.ajustes[0].nombre).toBe('Sin nombre');
    });
    it("icono vacío → '🪙'", () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [B({ icono: '', monto: 100_000 })]
      );
      expect(r.ajustes[0].icono).toBe('🪙');
    });
    it('campos top-level: saldoReal, sumBolActual, exceso, ajustes', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [B({ monto: 100_000 })]
      );
      expect(r).toHaveProperty('saldoReal');
      expect(r).toHaveProperty('sumBolActual');
      expect(r).toHaveProperty('exceso');
      expect(r).toHaveProperty('ajustes');
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('escenario post-eliminar-cuenta: bolsillos quedaron por encima', () => {
      const r = calcularRebalanceoBolsillos(
        { efectivo: 200_000, banco: 600_000 },  // 800k total
        [
          B({ id: 1, nombre: 'Viaje', monto: 500_000 }),
          B({ id: 2, nombre: 'Casa',  monto: 400_000 }),
          B({ id: 3, nombre: 'Fondo', monto: 300_000 }),
        ]
      );
      expect(r.saldoReal).toBe(800_000);
      expect(r.sumBolActual).toBe(1_200_000);
      expect(r.exceso).toBe(400_000);
      const suma = r.ajustes.reduce((s, a) => s + a.montoNuevo, 0);
      expect(suma).toBe(800_000);
      // factor = 800/1200 ≈ 0.6667 → 500k → 333333 (floor) o 333334 (con residuo)
      expect(r.ajustes.find(a => a.id === 1).montoNuevo).toBeCloseTo(333_333, -1);
    });
    it('idempotente: tras aplicar el plan, calcular vuelve null', () => {
      const r1 = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        [B({ monto: 100_000 })]
      );
      const bolsillosAplicados = [B({ id: 1, monto: r1.ajustes[0].montoNuevo })];
      const r2 = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: 50_000 },
        bolsillosAplicados
      );
      expect(r2).toBe(null);
    });
    it('100 bolsillos (stress)', () => {
      const bolsillos = [];
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        const m = 10_000 + i * 100;
        bolsillos.push(B({ id: i + 1, monto: m }));
        sum += m;
      }
      const r = calcularRebalanceoBolsillos(
        { efectivo: 0, banco: Math.floor(sum / 2) },
        bolsillos
      );
      expect(r).not.toBe(null);
      const sumNueva = r.ajustes.reduce((s, a) => s + a.montoNuevo, 0);
      expect(sumNueva).toBe(Math.floor(sum / 2));
    });
    it('no muta los inputs', () => {
      const saldos    = { efectivo: 0, banco: 50_000 };
      const bolsillos = [B({ monto: 100_000 })];
      const sOriginal = JSON.parse(JSON.stringify(saldos));
      const bOriginal = JSON.parse(JSON.stringify(bolsillos));
      calcularRebalanceoBolsillos(saldos, bolsillos);
      expect(saldos).toEqual(sOriginal);
      expect(bolsillos).toEqual(bOriginal);
    });
  });

});


// ─── calcularProyeccionFondo ──────────────────────────────────────────────────
// Tanda 22: proyecta cuántos meses faltan para completar el fondo de
// emergencia al ritmo de ahorro mensual estimado. Función pura — no lee S,
// no toca DOM.

describe('calcularProyeccionFondo()', () => {

  const hoy = '2026-05-10';

  // ── input inválido ────────────────────────────────────────────────────────
  describe('input inválido', () => {
    it('sin argumentos → null', () => {
      expect(calcularProyeccionFondo()).toBeNull();
    });
    it('hoyISO faltante → null', () => {
      expect(calcularProyeccionFondo({ faltaPorAhorrar: 1_000_000, ahorroMensualEstimado: 200_000 })).toBeNull();
    });
    it('hoyISO malformado → null', () => {
      expect(calcularProyeccionFondo({ faltaPorAhorrar: 500_000, ahorroMensualEstimado: 100_000, hoyISO: 'no-fecha' })).toBeNull();
    });
  });

  // ── meta ya alcanzada ─────────────────────────────────────────────────────
  describe('meta ya alcanzada', () => {
    it('faltaPorAhorrar = 0 → yaCompletado true, mesesFaltantes 0', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 0, ahorroMensualEstimado: 200_000, hoyISO: hoy });
      expect(r.yaCompletado).toBe(true);
      expect(r.mesesFaltantes).toBe(0);
      expect(r.fechaEstimada).toBeNull();
    });
    it('faltaPorAhorrar negativo (sobre-ahorro) → yaCompletado true', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: -500_000, ahorroMensualEstimado: 200_000, hoyISO: hoy });
      expect(r.yaCompletado).toBe(true);
    });
  });

  // ── sin ritmo de ahorro ───────────────────────────────────────────────────
  describe('sin ritmo de ahorro', () => {
    it('ahorroMensualEstimado = 0 → mesesFaltantes null', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 1_000_000, ahorroMensualEstimado: 0, hoyISO: hoy });
      expect(r.yaCompletado).toBe(false);
      expect(r.mesesFaltantes).toBeNull();
      expect(r.fechaEstimada).toBeNull();
    });
    it('ahorroMensualEstimado negativo → mesesFaltantes null', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 1_000_000, ahorroMensualEstimado: -100_000, hoyISO: hoy });
      expect(r.mesesFaltantes).toBeNull();
    });
  });

  // ── cálculo de meses ──────────────────────────────────────────────────────
  describe('cálculo de meses', () => {
    it('falta 1_200_000, ahorro 400_000/mes → 3 meses', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 1_200_000, ahorroMensualEstimado: 400_000, hoyISO: hoy });
      expect(r.mesesFaltantes).toBe(3);
    });
    it('redondea hacia arriba (ceil): falta 1_000_001, ahorro 500_000 → 3 meses', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 1_000_001, ahorroMensualEstimado: 500_000, hoyISO: hoy });
      expect(r.mesesFaltantes).toBe(3);
    });
    it('falta exacta: 1_000_000, ahorro 500_000 → 2 meses', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 1_000_000, ahorroMensualEstimado: 500_000, hoyISO: hoy });
      expect(r.mesesFaltantes).toBe(2);
    });
    it('falta muy grande, ahorro pequeño → muchos meses (no lanza)', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 100_000_000, ahorroMensualEstimado: 100_000, hoyISO: hoy });
      expect(r.mesesFaltantes).toBe(1000);
    });
  });

  // ── fecha estimada ────────────────────────────────────────────────────────
  describe('fecha estimada', () => {
    it('3 meses desde mayo 2026 → 2026-08', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 1_200_000, ahorroMensualEstimado: 400_000, hoyISO: '2026-05-10' });
      expect(r.fechaEstimada).toBe('2026-08');
    });
    it('cruce de año: 5 meses desde noviembre 2026 → 2027-04', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 1_000_000, ahorroMensualEstimado: 200_000, hoyISO: '2026-11-01' });
      expect(r.fechaEstimada).toBe('2027-04');
    });
    it('1 mes desde diciembre 2026 → 2027-01', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 500_000, ahorroMensualEstimado: 500_000, hoyISO: '2026-12-01' });
      expect(r.fechaEstimada).toBe('2027-01');
    });
    it('formato fechaEstimada es YYYY-MM (2 dígitos para el mes)', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 500_000, ahorroMensualEstimado: 500_000, hoyISO: '2026-01-01' });
      expect(r.fechaEstimada).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  // ── estructura del output ─────────────────────────────────────────────────
  describe('estructura del output', () => {
    it('ahorroMensualUsado refleja el valor recibido', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: 500_000, ahorroMensualEstimado: 300_000, hoyISO: hoy });
      expect(r.ahorroMensualUsado).toBe(300_000);
    });
    it('determinismo: misma entrada → mismo output', () => {
      const params = { faltaPorAhorrar: 800_000, ahorroMensualEstimado: 200_000, hoyISO: hoy };
      expect(calcularProyeccionFondo(params)).toEqual(calcularProyeccionFondo(params));
    });
    it('strings numéricos se convierten correctamente', () => {
      const r = calcularProyeccionFondo({ faltaPorAhorrar: '600000', ahorroMensualEstimado: '200000', hoyISO: hoy });
      expect(r.mesesFaltantes).toBe(3);
    });
  });

});
