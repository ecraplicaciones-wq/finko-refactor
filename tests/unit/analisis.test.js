// tests/unit/analisis.test.js
//
// ✅ R1 (auditoría v5): cobertura del dominio de análisis.
//
//  • calcDistribucionReal — agregado de gastos por tipo + % del ingreso.
//  • calcularRachaHormiga — días consecutivos sin gastos hormiga.
//  • calcularRachaAhorro  — quincenas consecutivas con ahorro positivo.
//
// calcDistribucionReal lee S → tests con resetAppState + asignaciones.
// Las dos puras de racha reciben sus inputs como parámetros → tests directos.

import { describe, it, expect, beforeEach } from 'vitest';
import { S, resetAppState } from '../../modules/core/state.js';
import {
  calcDistribucionReal,
  calcularRachaHormiga,
  calcularRachaAhorro,
} from '../../modules/dominio/analisis.js';

// ─── calcDistribucionReal ────────────────────────────────────────────────────

describe('calcDistribucionReal()', () => {

  beforeEach(() => resetAppState());

  it('sin datos retorna distribución en 0', () => {
    const r = calcDistribucionReal();
    expect(r.necesidades.monto).toBe(0);
    expect(r.deseos.monto).toBe(0);
    expect(r.ahorro.monto).toBe(0);
    expect(r.total).toBe(0);
  });

  it('clasifica por tipo y calcula porcentajes sobre el ingreso', () => {
    S.ingreso = 2_000_000;
    S.gastos = [
      { id: 1, monto: 800_000, tipo: 'necesidad' },  // 40%
      { id: 2, monto: 200_000, tipo: 'deseo' },      // 10%
      { id: 3, monto: 400_000, tipo: 'ahorro' },     // 20%
    ];
    const r = calcDistribucionReal();
    expect(r.necesidades.monto).toBe(800_000);
    expect(r.necesidades.pct).toBe(40);
    expect(r.deseos.monto).toBe(200_000);
    expect(r.deseos.pct).toBe(10);
    expect(r.ahorro.monto).toBe(400_000);
    expect(r.ahorro.pct).toBe(20);
  });

  it('agrupa "deseo" + "hormiga" como deseos', () => {
    S.ingreso = 1_000_000;
    S.gastos = [
      { id: 1, monto: 100_000, tipo: 'deseo' },
      { id: 2, monto: 50_000,  tipo: 'hormiga' },
      { id: 3, monto: 30_000,  tipo: 'necesidad', hormiga: true }, // marcada hormiga
    ];
    const r = calcDistribucionReal();
    // hormigas (50k + 30k) + deseo (100k) = 180k → 18%
    expect(r.deseos.monto).toBe(180_000);
    expect(r.deseos.pct).toBe(18);
  });

  it('respeta montoTotal sobre monto cuando existe (4×1000 ya aplicado)', () => {
    S.ingreso = 1_000_000;
    S.gastos = [
      { id: 1, monto: 100_000, montoTotal: 100_400, tipo: 'necesidad' },
    ];
    const r = calcDistribucionReal();
    expect(r.necesidades.monto).toBe(100_400);
  });

  it('ahorro usa monto sin 4×1000 (no aplica a transferencias)', () => {
    // En ahorro siempre se ignora montoTotal por convención del módulo.
    S.ingreso = 1_000_000;
    S.gastos = [
      { id: 1, monto: 200_000, montoTotal: 200_800, tipo: 'ahorro' },
    ];
    const r = calcDistribucionReal();
    expect(r.ahorro.monto).toBe(200_000);  // monto, no montoTotal
  });

  it('total = necesidades + deseos + hormiga (ahorro fuera)', () => {
    S.ingreso = 1_000_000;
    S.gastos = [
      { id: 1, monto: 300_000, tipo: 'necesidad' },
      { id: 2, monto: 200_000, tipo: 'deseo' },
      { id: 3, monto: 100_000, tipo: 'hormiga' },
      { id: 4, monto: 200_000, tipo: 'ahorro' },
    ];
    const r = calcDistribucionReal();
    expect(r.total).toBe(600_000);  // 300k + 200k + 100k (ahorro fuera)
  });

  it('ingreso 0 sin romperse (usa 1 para no dividir por 0)', () => {
    S.ingreso = 0;
    S.gastos = [{ id: 1, monto: 100_000, tipo: 'necesidad' }];
    const r = calcDistribucionReal();
    expect(r.necesidades.monto).toBe(100_000);
    // pct será un número grande/raro pero no Infinity ni NaN
    expect(Number.isFinite(r.necesidades.pct)).toBe(true);
  });

});

// ─── calcularRachaHormiga ────────────────────────────────────────────────────

describe('calcularRachaHormiga()', () => {

  it('array vacío → 0', () => {
    expect(calcularRachaHormiga([])).toBe(0);
    expect(calcularRachaHormiga(null)).toBe(0);
    expect(calcularRachaHormiga(undefined)).toBe(0);
  });

  it('último día tuvo hormiga → racha 0', () => {
    const gastos = [
      { fecha: '2026-04-25', monto: 30_000, tipo: 'hormiga' },
    ];
    expect(calcularRachaHormiga(gastos)).toBe(0);
  });

  it('día con marca explícita g.hormiga=true rompe la racha', () => {
    const gastos = [
      { fecha: '2026-04-25', monto: 30_000, tipo: 'deseo', hormiga: true },
    ];
    expect(calcularRachaHormiga(gastos)).toBe(0);
  });

  it('3 días sin hormiga seguidos → racha 3', () => {
    const gastos = [
      { fecha: '2026-04-23', monto: 100_000, tipo: 'necesidad' },
      { fecha: '2026-04-24', monto: 50_000,  tipo: 'deseo' },
      { fecha: '2026-04-25', monto: 80_000,  tipo: 'necesidad' },
    ];
    expect(calcularRachaHormiga(gastos)).toBe(3);
  });

  it('hormiga rompe la racha en el día más reciente', () => {
    const gastos = [
      { fecha: '2026-04-23', monto: 100_000, tipo: 'necesidad' },
      { fecha: '2026-04-24', monto: 50_000,  tipo: 'deseo' },
      { fecha: '2026-04-25', monto: 5_000,   tipo: 'hormiga' },
    ];
    expect(calcularRachaHormiga(gastos)).toBe(0);
  });

  it('hormiga en día intermedio corta la racha desde ese punto hacia atrás', () => {
    const gastos = [
      { fecha: '2026-04-22', monto: 100_000, tipo: 'necesidad' },
      { fecha: '2026-04-23', monto: 5_000,   tipo: 'hormiga' },
      { fecha: '2026-04-24', monto: 50_000,  tipo: 'deseo' },
      { fecha: '2026-04-25', monto: 80_000,  tipo: 'necesidad' },
    ];
    // Desde el 25 hacia atrás: 25 (sin) → 24 (sin) → 23 (HORMIGA) → break
    expect(calcularRachaHormiga(gastos)).toBe(2);
  });

  it('múltiples gastos el mismo día: cualquier hormiga marca el día', () => {
    const gastos = [
      { fecha: '2026-04-25', monto: 100_000, tipo: 'necesidad' },
      { fecha: '2026-04-25', monto: 5_000,   tipo: 'hormiga' },
    ];
    expect(calcularRachaHormiga(gastos)).toBe(0);
  });

  it('día limpio sin nada hormiga aunque haya múltiples gastos', () => {
    const gastos = [
      { fecha: '2026-04-25', monto: 100_000, tipo: 'necesidad' },
      { fecha: '2026-04-25', monto: 50_000,  tipo: 'deseo' },
      { fecha: '2026-04-25', monto: 80_000,  tipo: 'ahorro' },
    ];
    expect(calcularRachaHormiga(gastos)).toBe(1);
  });

  it('orden de inserción no importa (se ordena por fecha DESC internamente)', () => {
    const gastosDesordenados = [
      { fecha: '2026-04-25', monto: 80_000, tipo: 'necesidad' },
      { fecha: '2026-04-23', monto: 100_000, tipo: 'necesidad' },
      { fecha: '2026-04-24', monto: 50_000, tipo: 'deseo' },
    ];
    expect(calcularRachaHormiga(gastosDesordenados)).toBe(3);
  });

});

// ─── calcularRachaAhorro ─────────────────────────────────────────────────────

describe('calcularRachaAhorro()', () => {

  it('historial vacío y sin ahorro actual → 0', () => {
    expect(calcularRachaAhorro([], 0)).toBe(0);
    expect(calcularRachaAhorro(null, 0)).toBe(0);
  });

  it('historial vacío + ahorro actual > 0 → 1 (la quincena en curso)', () => {
    expect(calcularRachaAhorro([], 100_000)).toBe(1);
  });

  it('3 quincenas consecutivas con ahorro + actual > 0 → 4', () => {
    const hist = [
      { id: 3, ahorro: 100_000 },
      { id: 2, ahorro: 200_000 },
      { id: 1, ahorro: 50_000 },
    ];
    expect(calcularRachaAhorro(hist, 75_000)).toBe(4);
  });

  it('quincena con ahorro 0 corta la racha', () => {
    const hist = [
      { id: 3, ahorro: 100_000 },
      { id: 2, ahorro: 0 },          // ← corta aquí
      { id: 1, ahorro: 200_000 },    // (no se cuenta porque vino antes del corte)
    ];
    expect(calcularRachaAhorro(hist, 50_000)).toBe(2);  // actual + 1 (id=3) → break id=2
  });

  it('orden por id (timestamp) DESC: lo más reciente primero', () => {
    // Si pasamos historial desordenado, internamente se ordena DESC.
    const hist = [
      { id: 1, ahorro: 0 },           // antiguo, NO corta porque no llega
      { id: 3, ahorro: 100_000 },     // más reciente
      { id: 2, ahorro: 50_000 },
    ];
    expect(calcularRachaAhorro(hist, 200_000)).toBe(3);  // actual + id=3 + id=2 → break id=1
  });

  it('ahorro actual 0 no suma el período en curso', () => {
    const hist = [
      { id: 2, ahorro: 100_000 },
      { id: 1, ahorro: 50_000 },
    ];
    expect(calcularRachaAhorro(hist, 0)).toBe(2);
  });

  it('ahorro undefined o null en historial cuenta como 0', () => {
    const hist = [
      { id: 3, ahorro: 100_000 },
      { id: 2 /* sin ahorro */ },
      { id: 1, ahorro: 200_000 },
    ];
    expect(calcularRachaAhorro(hist, 0)).toBe(1);  // solo id=3 → break id=2
  });

  it('no muta el historial original', () => {
    const hist = [
      { id: 1, ahorro: 100_000 },
      { id: 3, ahorro: 200_000 },
      { id: 2, ahorro: 50_000 },
    ];
    const original = [...hist];
    calcularRachaAhorro(hist, 100_000);
    expect(hist).toEqual(original);  // sin reordenar in-place
  });

});
