// tests/unit/metas.test.js
//
// ✅ R1 (auditoría v5): cobertura del dominio de metas (objetivos + inversiones).
//
//  • calcularProgresoObjetivo — fase de ahorro.
//  • calcularProgresoEvento   — presupuesto consumido en eventos.
//  • calcularSimObjetivo      — ¿en cuánto tiempo llegamos a la meta?
//  • calcularAportePorFrecuencia — partir un faltante en aportes diarios/sem/etc.
//  • calcularRendimientoInversion — capital + rendimiento + signo + color.
//
// Todas son 100% puras (sin S, sin DOM). Tests directos.

import { describe, it, expect } from 'vitest';
import {
  calcularProgresoObjetivo,
  calcularProgresoEvento,
  calcularSimObjetivo,
  calcularAportePorFrecuencia,
  calcularRendimientoInversion,
} from '../../modules/dominio/metas.js';

// ─── calcularProgresoObjetivo ────────────────────────────────────────────────

describe('calcularProgresoObjetivo()', () => {

  it('sin objetivo → pct 0, no completado', () => {
    const r = calcularProgresoObjetivo({ ahorrado: 100_000, objetivoAhorro: 0 });
    expect(r.pct).toBe(0);
    expect(r.falta).toBe(0);
    expect(r.completado).toBe(false);
  });

  it('avance del 25% → color azul (a4)', () => {
    const r = calcularProgresoObjetivo({ ahorrado: 250_000, objetivoAhorro: 1_000_000 });
    expect(r.pct).toBe(25);
    expect(r.colorVar).toBe('var(--a4)');
    expect(r.falta).toBe(750_000);
  });

  it('avance del 60% → color amarillo (a2)', () => {
    const r = calcularProgresoObjetivo({ ahorrado: 600_000, objetivoAhorro: 1_000_000 });
    expect(r.pct).toBe(60);
    expect(r.colorVar).toBe('var(--a2)');
  });

  it('100% → completado, color verde (a1)', () => {
    const r = calcularProgresoObjetivo({ ahorrado: 1_000_000, objetivoAhorro: 1_000_000 });
    expect(r.pct).toBe(100);
    expect(r.completado).toBe(true);
    expect(r.colorVar).toBe('var(--a1)');
    expect(r.falta).toBe(0);
  });

  it('pct se capea al 100% aunque ahorrado > meta', () => {
    const r = calcularProgresoObjetivo({ ahorrado: 5_000_000, objetivoAhorro: 1_000_000 });
    expect(r.pct).toBe(100);
    expect(r.completado).toBe(true);
    expect(r.falta).toBe(0);
  });

  it('null/undefined no rompe', () => {
    expect(calcularProgresoObjetivo(null).pct).toBe(0);
    expect(calcularProgresoObjetivo({}).pct).toBe(0);
  });

  it('frontera 50% → todavía azul (>50 ya es amarillo)', () => {
    const r = calcularProgresoObjetivo({ ahorrado: 500_000, objetivoAhorro: 1_000_000 });
    expect(r.pct).toBe(50);
    expect(r.colorVar).toBe('var(--a4)');
  });

});

// ─── calcularProgresoEvento ──────────────────────────────────────────────────

describe('calcularProgresoEvento()', () => {

  it('sin presupuesto → pct 0, disponible 0', () => {
    const r = calcularProgresoEvento({ gastado: 100_000, presupuesto: 0 });
    expect(r.pct).toBe(0);
    expect(r.disponible).toBe(0);
    expect(r.excedido).toBe(false);
  });

  it('avance 50% → color verde (a1)', () => {
    const r = calcularProgresoEvento({ gastado: 500_000, presupuesto: 1_000_000 });
    expect(r.pct).toBe(50);
    expect(r.colorVar).toBe('var(--a1)');
    expect(r.disponible).toBe(500_000);
    expect(r.excedido).toBe(false);
  });

  it('avance 80% → color amarillo (a2)', () => {
    const r = calcularProgresoEvento({ gastado: 800_000, presupuesto: 1_000_000 });
    expect(r.pct).toBe(80);
    expect(r.colorVar).toBe('var(--a2)');
  });

  it('100% → excedido, color rojo (dan)', () => {
    const r = calcularProgresoEvento({ gastado: 1_000_000, presupuesto: 1_000_000 });
    expect(r.pct).toBe(100);
    expect(r.colorVar).toBe('var(--dan)');
    expect(r.excedido).toBe(true);
    expect(r.disponible).toBe(0);
  });

  it('gasto > presupuesto → pct capado, excedido true', () => {
    const r = calcularProgresoEvento({ gastado: 1_500_000, presupuesto: 1_000_000 });
    expect(r.pct).toBe(100);
    expect(r.excedido).toBe(true);
    expect(r.disponible).toBe(0);
  });

  it('frontera 75% → todavía verde (>75 ya es amarillo)', () => {
    const r = calcularProgresoEvento({ gastado: 750_000, presupuesto: 1_000_000 });
    expect(r.pct).toBe(75);
    expect(r.colorVar).toBe('var(--a1)');
  });

});

// ─── calcularSimObjetivo ─────────────────────────────────────────────────────

describe('calcularSimObjetivo()', () => {

  it('aporte 0 → null (no se puede estimar)', () => {
    expect(calcularSimObjetivo({ aporte: 0, diasPer: 15, falta: 1_000_000 })).toBeNull();
  });

  it('falta 0 (meta cumplida) → null', () => {
    expect(calcularSimObjetivo({ aporte: 100_000, diasPer: 15, falta: 0 })).toBeNull();
  });

  it('aporte 100k quincenal, falta 1M → 10 quincenas (5 meses)', () => {
    const r = calcularSimObjetivo({ aporte: 100_000, diasPer: 15, falta: 1_000_000 });
    expect(r.periodos).toBe(10);
    expect(r.diasTotal).toBe(150);
    expect(r.frecNombre).toBe('quincena');
    expect(r.tiempoStr).toMatch(/5 meses/);
  });

  it('aporte semanal nombra "semana"', () => {
    const r = calcularSimObjetivo({ aporte: 50_000, diasPer: 7, falta: 200_000 });
    expect(r.frecNombre).toBe('semana');
    expect(r.periodos).toBe(4);
    expect(r.diasTotal).toBe(28);
    expect(r.tiempoStr).toMatch(/28 días/);
  });

  it('aporte diario nombra "día"', () => {
    const r = calcularSimObjetivo({ aporte: 10_000, diasPer: 1, falta: 25_000 });
    expect(r.frecNombre).toBe('día');
    expect(r.periodos).toBe(3);
    expect(r.diasTotal).toBe(3);
    expect(r.tiempoStr).toMatch(/3 días/);
  });

  it('aporte mensual nombra "mes"', () => {
    const r = calcularSimObjetivo({ aporte: 500_000, diasPer: 30, falta: 2_000_000 });
    expect(r.frecNombre).toBe('mes');
    expect(r.periodos).toBe(4);
    expect(r.diasTotal).toBe(120);
    expect(r.tiempoStr).toMatch(/4 meses/);
  });

  it('descompone años + meses si supera 365 días', () => {
    // 24 quincenas × 15 días = 360 días → todavía meses (12 meses)
    const r360 = calcularSimObjetivo({ aporte: 100_000, diasPer: 15, falta: 2_400_000 });
    expect(r360.diasTotal).toBe(360);
    expect(r360.tiempoStr).toMatch(/12 meses/);

    // 25 quincenas × 15 días = 375 días → 1 año (no hay meses sobrantes >= 30)
    const r375 = calcularSimObjetivo({ aporte: 100_000, diasPer: 15, falta: 2_500_000 });
    expect(r375.diasTotal).toBe(375);
    expect(r375.tiempoStr).toMatch(/^1 año/);
  });

  it('aporte fraccionario redondea hacia arriba el nº de períodos', () => {
    // falta 1M, aporte 333k → 1M/333k = 3.003 → 4 períodos (cubre el resto)
    const r = calcularSimObjetivo({ aporte: 333_000, diasPer: 15, falta: 1_000_000 });
    expect(r.periodos).toBe(4);
  });

  it('diasPer no estándar (10) cae a "período" como nombre genérico', () => {
    const r = calcularSimObjetivo({ aporte: 100_000, diasPer: 10, falta: 500_000 });
    expect(r.frecNombre).toBe('período');
    expect(r.periodos).toBe(5);
    expect(r.diasTotal).toBe(50);
  });

  it('diasPer faltante o 0 cae al default 15', () => {
    const r = calcularSimObjetivo({ aporte: 100_000, diasPer: 0, falta: 200_000 });
    expect(r.diasTotal).toBe(2 * 15);
    expect(r.frecNombre).toBe('quincena');
  });

});

// ─── calcularAportePorFrecuencia ─────────────────────────────────────────────

describe('calcularAportePorFrecuencia()', () => {

  it('falta 0 → todos los aportes son 0', () => {
    const r = calcularAportePorFrecuencia(0, 30);
    expect(r).toEqual({ diario: 0, semanal: 0, quincenal: 0, mensual: 0 });
  });

  it('diasRestantes 0 → todos los aportes son 0', () => {
    const r = calcularAportePorFrecuencia(1_000_000, 0);
    expect(r).toEqual({ diario: 0, semanal: 0, quincenal: 0, mensual: 0 });
  });

  it('falta 1M en 30 días → diario 1M/30, semanal 1M/(30/7), quincenal 1M/2, mensual 1M', () => {
    const r = calcularAportePorFrecuencia(1_000_000, 30);
    expect(r.diario).toBeCloseTo(33_333.33, 2);
    expect(r.semanal).toBeCloseTo(233_333.33, 2);
    expect(r.quincenal).toBeCloseTo(500_000, 2);
    expect(r.mensual).toBe(1_000_000);
  });

  it('falta 600k en 90 días → mensual 200k', () => {
    const r = calcularAportePorFrecuencia(600_000, 90);
    expect(r.mensual).toBe(200_000);
  });

  it('diasRestantes < frecuencia → al menos 1 período (no divide por 0)', () => {
    // 5 días restantes y mensual (30 días) → 5/30 = 0.166, max(1, 0.166)=1
    const r = calcularAportePorFrecuencia(100_000, 5);
    expect(r.mensual).toBe(100_000);  // todo de un solo aporte mensual
  });

});

// ─── calcularRendimientoInversion ────────────────────────────────────────────

describe('calcularRendimientoInversion()', () => {

  it('rendimiento positivo → signo "+", color verde (a1)', () => {
    const r = calcularRendimientoInversion({ capital: 1_000_000, rendimiento: 50_000 });
    expect(r.valorTotal).toBe(1_050_000);
    expect(r.pct).toBe(5);
    expect(r.signo).toBe('+');
    expect(r.colorVar).toBe('var(--a1)');
    expect(r.positivo).toBe(true);
  });

  it('rendimiento 0 → todavía cuenta como positivo (signo "+")', () => {
    const r = calcularRendimientoInversion({ capital: 1_000_000, rendimiento: 0 });
    expect(r.valorTotal).toBe(1_000_000);
    expect(r.pct).toBe(0);
    expect(r.positivo).toBe(true);
    expect(r.signo).toBe('+');
  });

  it('rendimiento negativo → signo "" (vacío), color rojo (dan)', () => {
    const r = calcularRendimientoInversion({ capital: 1_000_000, rendimiento: -100_000 });
    expect(r.valorTotal).toBe(900_000);
    expect(r.pct).toBe(-10);
    expect(r.signo).toBe('');  // el "-" ya está en el número
    expect(r.colorVar).toBe('var(--dan)');
    expect(r.positivo).toBe(false);
  });

  it('capital 0 → pct 0 (no divide por cero)', () => {
    const r = calcularRendimientoInversion({ capital: 0, rendimiento: 100_000 });
    expect(r.pct).toBe(0);
    expect(r.valorTotal).toBe(100_000);
  });

  it('null/undefined → totales en 0', () => {
    const r = calcularRendimientoInversion(null);
    expect(r.valorTotal).toBe(0);
    expect(r.pct).toBe(0);
    expect(r.positivo).toBe(true);
  });

  it('rendimiento alto sobre capital pequeño → pct grande positivo', () => {
    // Capital 100k, rendimiento 250k → 250% (caso real con cripto/acciones)
    const r = calcularRendimientoInversion({ capital: 100_000, rendimiento: 250_000 });
    expect(r.pct).toBe(250);
    expect(r.positivo).toBe(true);
    expect(r.valorTotal).toBe(350_000);
  });

});
