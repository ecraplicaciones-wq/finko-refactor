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
  detectarObjetivosSinProgreso,
  detectarInversionesSinActualizar,
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

// ─── detectarObjetivosSinProgreso ────────────────────────────────────────────
//
// Detecta objetivos vivos (ahorrado < objetivoAhorro) sin aportes hace N+ meses.
// Fuente del último aporte (orden):
//   1. obj.fechaUltimoAporte (preferido)
//   2. gastos[metaId === obj.id, tipo === 'ahorro'] más reciente
//   3. obj.id (Date.now ms) como creación

describe('detectarObjetivosSinProgreso()', () => {

  // Helper: objetivo canónico. Por defecto: viva (no completado), con
  // fechaUltimoAporte vieja. id ms ~2023-11-14.
  const O = (over = {}) => ({
    id: 1_700_000_000_000,
    nombre: 'Viaje',
    tipo: 'ahorro',
    icono: '✈️',
    objetivoAhorro: 1_000_000,
    ahorrado: 200_000,
    fechaUltimoAporte: '2025-11-01',
    ...over,
  });

  const HOY = '2026-04-27';

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → []', () => {
    it('objetivos no array', () => {
      expect(detectarObjetivosSinProgreso(null, [], HOY)).toEqual([]);
      expect(detectarObjetivosSinProgreso(undefined, [], HOY)).toEqual([]);
      expect(detectarObjetivosSinProgreso('foo', [], HOY)).toEqual([]);
    });
    it('objetivos vacío', () => {
      expect(detectarObjetivosSinProgreso([], [], HOY)).toEqual([]);
    });
    it('hoyISO no string o malformada', () => {
      expect(detectarObjetivosSinProgreso([O()], [], null)).toEqual([]);
      expect(detectarObjetivosSinProgreso([O()], [], '2026-04')).toEqual([]);
      expect(detectarObjetivosSinProgreso([O()], [], 'no-fecha')).toEqual([]);
    });
    it('gastos no array → tratado como vacío', () => {
      const r = detectarObjetivosSinProgreso([O()], null, HOY);
      expect(r).toHaveLength(1);
    });
  });

  // ── BLOQUE: NO SE FLAGGEA ──────────────────────────────────────────────────
  describe('objetivos que no son "sin progreso" → no aparecen', () => {
    it('objetivo completado (ahorrado >= meta)', () => {
      const objs = [O({ ahorrado: 1_000_000, objetivoAhorro: 1_000_000 })];
      expect(detectarObjetivosSinProgreso(objs, [], HOY)).toEqual([]);
    });
    it('objetivo sobre-ahorrado (ahorrado > meta)', () => {
      const objs = [O({ ahorrado: 1_500_000, objetivoAhorro: 1_000_000 })];
      expect(detectarObjetivosSinProgreso(objs, [], HOY)).toEqual([]);
    });
    it('objetivoAhorro <= 0 → ignorado (no se puede juzgar)', () => {
      const objs = [O({ objetivoAhorro: 0 })];
      expect(detectarObjetivosSinProgreso(objs, [], HOY)).toEqual([]);
    });
    it('aporte reciente (1 mes atrás) → bajo umbral default 2', () => {
      const objs = [O({ fechaUltimoAporte: '2026-03-27' })];   // 31 días → 1 mes
      expect(detectarObjetivosSinProgreso(objs, [], HOY)).toEqual([]);
    });
    it('aporte de hoy → no es sin progreso', () => {
      const objs = [O({ fechaUltimoAporte: HOY })];
      expect(detectarObjetivosSinProgreso(objs, [], HOY)).toEqual([]);
    });
  });

  // ── BLOQUE: FUENTE DEL ÚLTIMO APORTE ───────────────────────────────────────
  describe('fuente del último aporte', () => {
    it("prioriza 'fechaUltimoAporte' sobre gastos", () => {
      const o = O({ id: 999, fechaUltimoAporte: '2025-10-01' });
      const gastos = [{ metaId: 999, tipo: 'ahorro', fecha: '2026-04-15' }];
      const r = detectarObjetivosSinProgreso([o], gastos, HOY);
      expect(r[0].fuenteUltimoAporte).toBe('fechaUltimoAporte');
      expect(r[0].ultimoAporte).toBe('2025-10-01');
    });
    it("cae a 'gasto' si no hay fechaUltimoAporte", () => {
      const o = O({ id: 999, fechaUltimoAporte: undefined });
      const gastos = [
        { metaId: 999, tipo: 'ahorro', fecha: '2025-12-15' },
        { metaId: 999, tipo: 'ahorro', fecha: '2025-10-10' },
      ];
      const r = detectarObjetivosSinProgreso([o], gastos, HOY);
      expect(r[0].fuenteUltimoAporte).toBe('gasto');
      expect(r[0].ultimoAporte).toBe('2025-12-15');  // el más reciente
    });
    it("ignora gastos tipo distinto de 'ahorro' (los gastos de evento son retiros)", () => {
      const o = O({ id: 999, fechaUltimoAporte: undefined });
      const gastos = [
        { metaId: 999, tipo: 'deseo', fecha: '2026-04-20' },
        { metaId: 999, tipo: 'necesidad', fecha: '2026-04-25' },
      ];
      const r = detectarObjetivosSinProgreso([o], gastos, HOY);
      expect(r[0].fuenteUltimoAporte).toBe('creacion');
    });
    it('ignora gastos con metaId distinto', () => {
      const o = O({ id: 999, fechaUltimoAporte: undefined });
      const gastos = [{ metaId: 1, tipo: 'ahorro', fecha: '2026-04-20' }];
      const r = detectarObjetivosSinProgreso([o], gastos, HOY);
      expect(r[0].fuenteUltimoAporte).toBe('creacion');
    });
    it('ignora gastos con metaId null o vacío', () => {
      const o = O({ id: 999, fechaUltimoAporte: undefined });
      const gastos = [
        { metaId: null, tipo: 'ahorro', fecha: '2026-04-20' },
        { metaId: '',   tipo: 'ahorro', fecha: '2026-04-20' },
        { tipo: 'ahorro', fecha: '2026-04-20' },
      ];
      const r = detectarObjetivosSinProgreso([o], gastos, HOY);
      expect(r[0].fuenteUltimoAporte).toBe('creacion');
    });
    it("metaId como string '999' coincide con id 999 (coerción defensiva)", () => {
      const o = O({ id: 999, fechaUltimoAporte: undefined });
      const gastos = [{ metaId: '999', tipo: 'ahorro', fecha: '2025-12-15' }];
      const r = detectarObjetivosSinProgreso([o], gastos, HOY);
      expect(r[0].fuenteUltimoAporte).toBe('gasto');
      expect(r[0].ultimoAporte).toBe('2025-12-15');
    });
    it("cae a 'creacion' si no hay fechaUltimoAporte ni gasto", () => {
      // id ms = 1_577_836_800_000 → 2020-01-01 UTC
      const o = O({ id: 1_577_836_800_000, fechaUltimoAporte: undefined });
      const r = detectarObjetivosSinProgreso([o], [], HOY);
      expect(r[0].fuenteUltimoAporte).toBe('creacion');
      expect(r[0].ultimoAporte).toBe('2020-01-01');
    });
    it('fechaUltimoAporte malformada → cae al fallback', () => {
      const o = O({ id: 999, fechaUltimoAporte: '2025/10/01' });
      const gastos = [{ metaId: 999, tipo: 'ahorro', fecha: '2025-12-15' }];
      const r = detectarObjetivosSinProgreso([o], gastos, HOY);
      expect(r[0].fuenteUltimoAporte).toBe('gasto');
    });
  });

  // ── BLOQUE: SEVERIDAD ──────────────────────────────────────────────────────
  describe('severidad por meses sin aporte', () => {
    it("severidad 'baja' (2 meses)", () => {
      const o = O({ fechaUltimoAporte: '2026-02-15' });
      expect(detectarObjetivosSinProgreso([o], [], HOY)[0].severidad).toBe('baja');
    });
    it("severidad 'media' (3-5 meses)", () => {
      const o3 = O({ fechaUltimoAporte: '2026-01-10' });
      const o5 = O({ fechaUltimoAporte: '2025-11-15' });
      expect(detectarObjetivosSinProgreso([o3], [], HOY)[0].severidad).toBe('media');
      expect(detectarObjetivosSinProgreso([o5], [], HOY)[0].severidad).toBe('media');
    });
    it("severidad 'alta' (6+ meses)", () => {
      const o6 = O({ fechaUltimoAporte: '2025-10-15' });
      const o12 = O({ fechaUltimoAporte: '2025-04-01' });
      expect(detectarObjetivosSinProgreso([o6],  [], HOY)[0].severidad).toBe('alta');
      expect(detectarObjetivosSinProgreso([o12], [], HOY)[0].severidad).toBe('alta');
    });
  });

  // ── BLOQUE: SUGERENCIA ─────────────────────────────────────────────────────
  describe('sugerencia eliminar/replantear', () => {
    it("'eliminar' cuando ahorrado === 0 (nunca empezó)", () => {
      const o = O({ ahorrado: 0, fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY)[0].sugerencia).toBe('eliminar');
    });
    it("'replantear' cuando ahorrado > 0 (hay progreso pero estancado)", () => {
      const o = O({ ahorrado: 100_000, fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY)[0].sugerencia).toBe('replantear');
    });
    it("ahorrado negativo (caso teórico) → 'eliminar'", () => {
      const o = O({ ahorrado: -1, fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY)[0].sugerencia).toBe('eliminar');
    });
  });

  // ── BLOQUE: CONFIG mesesUmbral ─────────────────────────────────────────────
  describe('config mesesUmbral', () => {
    it('umbral = 1 → captura aportes con 1+ mes', () => {
      const o = O({ fechaUltimoAporte: '2026-03-15' });   // ~43 días → 1 mes
      expect(detectarObjetivosSinProgreso([o], [], HOY)).toEqual([]);
      expect(detectarObjetivosSinProgreso([o], [], HOY, { mesesUmbral: 1 })).toHaveLength(1);
    });
    it('umbral = 6 → solo abandono extremo', () => {
      const o3 = O({ fechaUltimoAporte: '2026-01-10' });
      const o6 = O({ fechaUltimoAporte: '2025-10-10' });
      expect(detectarObjetivosSinProgreso([o3], [], HOY, { mesesUmbral: 6 })).toEqual([]);
      expect(detectarObjetivosSinProgreso([o6], [], HOY, { mesesUmbral: 6 })).toHaveLength(1);
    });
    it('umbral inválido → fallback al default 2', () => {
      const o = O({ fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY, { mesesUmbral: 'tres' })).toHaveLength(1);
      expect(detectarObjetivosSinProgreso([o], [], HOY, { mesesUmbral: 0 })).toHaveLength(1);
      expect(detectarObjetivosSinProgreso([o], [], HOY, { mesesUmbral: -5 })).toHaveLength(1);
    });
    it('config null o no-objeto → defaults', () => {
      const o = O({ fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY, null)).toHaveLength(1);
      expect(detectarObjetivosSinProgreso([o], [], HOY, 'foo')).toHaveLength(1);
    });
  });

  // ── BLOQUE: OBJETIVOS MALFORMADOS ──────────────────────────────────────────
  describe('objetivos malformados se ignoran', () => {
    it('null/undefined/no-objeto', () => {
      const o = O();
      const objs = [null, undefined, 'foo', 42, o];
      expect(detectarObjetivosSinProgreso(objs, [], HOY)).toHaveLength(1);
    });
    it('id ausente, no numérico, o ≤ 0', () => {
      const objs = [
        { ...O(), id: undefined },
        { ...O(), id: 'string' },
        { ...O(), id: 0 },
        { ...O(), id: -1 },
      ];
      expect(detectarObjetivosSinProgreso(objs, [], HOY)).toEqual([]);
    });
    it('objetivoAhorro/ahorrado no numéricos → tratados como 0', () => {
      const o = O({ objetivoAhorro: 'a', ahorrado: 'b' });
      // meta=0 → continue → []
      expect(detectarObjetivosSinProgreso([o], [], HOY)).toEqual([]);
    });
  });

  // ── BLOQUE: ORDENAMIENTO ───────────────────────────────────────────────────
  describe('ordenamiento', () => {
    it('alta antes que media antes que baja', () => {
      const objs = [
        O({ id: 1, nombre: 'Baja',  fechaUltimoAporte: '2026-02-15' }),
        O({ id: 2, nombre: 'Alta',  fechaUltimoAporte: '2025-09-01' }),
        O({ id: 3, nombre: 'Media', fechaUltimoAporte: '2026-01-10' }),
      ];
      const r = detectarObjetivosSinProgreso(objs, [], HOY);
      expect(r.map(x => x.severidad)).toEqual(['alta', 'media', 'baja']);
    });
    it('mismo nivel: mayor faltante primero', () => {
      const objs = [
        O({ id: 1, ahorrado: 100_000, objetivoAhorro: 200_000, fechaUltimoAporte: '2026-02-15' }),
        O({ id: 2, ahorrado: 100_000, objetivoAhorro: 1_000_000, fechaUltimoAporte: '2026-02-15' }),
      ];
      const r = detectarObjetivosSinProgreso(objs, [], HOY);
      expect(r[0].id).toBe(2);  // faltante 900k > 100k
      expect(r[1].id).toBe(1);
    });
    it('empate exacto → menor id primero (determinístico)', () => {
      const objs = [
        O({ id: 7, ahorrado: 200_000, objetivoAhorro: 1_000_000, fechaUltimoAporte: '2026-02-15' }),
        O({ id: 3, ahorrado: 200_000, objetivoAhorro: 1_000_000, fechaUltimoAporte: '2026-02-15' }),
      ];
      const r = detectarObjetivosSinProgreso(objs, [], HOY);
      expect(r[0].id).toBe(3);
      expect(r[1].id).toBe(7);
    });
  });

  // ── BLOQUE: FORMA DEL RETORNO ──────────────────────────────────────────────
  describe('forma del retorno', () => {
    it('campos esperados', () => {
      const o = O({
        id: 42, nombre: 'Viaje Diciembre', tipo: 'ahorro', icono: '✈️',
        objetivoAhorro: 1_000_000, ahorrado: 250_000,
        fechaUltimoAporte: '2026-01-10',
      });
      const r = detectarObjetivosSinProgreso([o], [], HOY);
      expect(r[0]).toEqual(expect.objectContaining({
        id: 42,
        nombre: 'Viaje Diciembre',
        tipo: 'ahorro',
        icono: '✈️',
        objetivoAhorro: 1_000_000,
        ahorrado: 250_000,
        faltante: 750_000,
        pctProgreso: 25,
        ultimoAporte: '2026-01-10',
        fuenteUltimoAporte: 'fechaUltimoAporte',
        severidad: 'media',
        sugerencia: 'replantear',
      }));
      expect(r[0].diasSinAporte).toBeGreaterThanOrEqual(100);
      expect(r[0].mesesSinAporte).toBe(3);
    });
    it("nombre vacío → 'Sin nombre'", () => {
      const o = O({ nombre: '', fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY)[0].nombre).toBe('Sin nombre');
    });
    it("tipo vacío → 'ahorro'", () => {
      const o = O({ tipo: undefined, fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY)[0].tipo).toBe('ahorro');
    });
    it("icono vacío → '🎯'", () => {
      const o = O({ icono: '', fechaUltimoAporte: '2026-01-10' });
      expect(detectarObjetivosSinProgreso([o], [], HOY)[0].icono).toBe('🎯');
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('objetivo abandonado hace 8 meses con 25% progreso', () => {
      const o = O({
        id: 1, nombre: 'Casa', tipo: 'ahorro',
        objetivoAhorro: 50_000_000, ahorrado: 12_500_000,
        fechaUltimoAporte: '2025-08-15',
      });
      const r = detectarObjetivosSinProgreso([o], [], HOY);
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('alta');
      expect(r[0].sugerencia).toBe('replantear');
      expect(r[0].faltante).toBe(37_500_000);
      expect(r[0].pctProgreso).toBe(25);
      expect(r[0].mesesSinAporte).toBeGreaterThanOrEqual(8);
    });
    it('mezcla: 1 activo + 1 abandonado + 1 completado → solo el abandonado', () => {
      const objs = [
        O({ id: 1, nombre: 'Activo',     ahorrado: 200_000, fechaUltimoAporte: HOY }),
        O({ id: 2, nombre: 'Abandonado', ahorrado: 200_000, fechaUltimoAporte: '2026-01-10' }),
        O({ id: 3, nombre: 'Completado', ahorrado: 1_000_000, objetivoAhorro: 1_000_000 }),
      ];
      const r = detectarObjetivosSinProgreso(objs, [], HOY);
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(2);
    });
    it("usa gastos como fuente cuando S.gastos preserva los aportes pre-cerrarQ", () => {
      // Caso típico post v15+ pero pre obj.fechaUltimoAporte:
      // el usuario tiene un objetivo viejo sin fechaUltimoAporte set, pero
      // S.gastos sigue conteniendo aportes recientes.
      const o = O({ id: 1, fechaUltimoAporte: undefined });
      const gastos = [{ metaId: 1, tipo: 'ahorro', fecha: '2026-04-10' }];
      expect(detectarObjetivosSinProgreso([o], gastos, HOY)).toEqual([]);  // no hay abandono
    });
    it('100 objetivos (stress) → orden estable', () => {
      const objs = [];
      for (let i = 0; i < 100; i++) {
        objs.push(O({ id: i + 1, fechaUltimoAporte: '2025-12-01' }));
      }
      const r = detectarObjetivosSinProgreso(objs, [], HOY);
      expect(r).toHaveLength(100);
      expect(r[0].id).toBe(1);    // todos mismo nivel + mismo faltante → id asc
      expect(r[99].id).toBe(100);
    });
    it('no muta los inputs', () => {
      const objs = [O({ fechaUltimoAporte: '2026-01-10' })];
      const gastos = [{ metaId: 999, tipo: 'ahorro', fecha: '2026-04-20' }];
      const oOriginal = JSON.parse(JSON.stringify(objs));
      const gOriginal = JSON.parse(JSON.stringify(gastos));
      detectarObjetivosSinProgreso(objs, gastos, HOY);
      expect(objs).toEqual(oOriginal);
      expect(gastos).toEqual(gOriginal);
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// detectarInversionesSinActualizar() — Tanda 17
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure: detecta inversiones sin actualización hace N+ meses. Función pura que
// retorna array de inversiones que necesitan revisión, ordenadas por severidad.

describe('detectarInversionesSinActualizar()', () => {
  const HOY = '2026-05-02';  // Hoy es 2 de mayo de 2026

  // Helper para crear inversión con defaults
  const Inv = (overrides = {}) => ({
    id: Date.now(),
    nombre: 'Mi inversión',
    plataforma: 'Mi banco',
    capital: 1_000_000,
    rendimiento: 50_000,
    tasa: 5.5,
    ...overrides,
  });

  describe('casos normales', () => {
    it('sin inversiones → array vacío', () => {
      const r = detectarInversionesSinActualizar([], HOY);
      expect(r).toEqual([]);
    });
    it('sin inversiones pero array null → array vacío', () => {
      const r = detectarInversionesSinActualizar(null, HOY);
      expect(r).toEqual([]);
    });
    it('inversiones recientes (<2 meses) → array vacío', () => {
      const inv = [
        Inv({ id: new Date('2026-04-20').getTime(), nombre: 'Reciente' }),
        Inv({ id: new Date('2026-03-20').getTime(), nombre: 'Hace 6 semanas' }),
      ];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toEqual([]);
    });
    it('una inversión sin actualizar 3+ meses → retorna severidad=media', () => {
      // Feb 2 to May 2 = 89 days = 2.96 months (baja). Use Jan 30 for 3+ months
      const inv = [Inv({ id: new Date('2026-01-30').getTime(), nombre: 'CDT' })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('media');
      expect(r[0].mesesSinActualizar).toBeGreaterThanOrEqual(3);
    });
    it('una inversión sin actualizar 6+ meses → severidad=alta', () => {
      const inv = [Inv({ id: new Date('2025-10-15').getTime(), nombre: 'Viejo' })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('alta');
      expect(r[0].mesesSinActualizar).toBeGreaterThanOrEqual(6);
    });
  });

  describe('cálculo de días y meses', () => {
    it('id → YYYY-MM-DD conversion correcto', () => {
      const ms = new Date('2026-01-30').getTime();  // Use date that meets umbral
      const inv = [Inv({ id: ms })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].ultimaActualizacion).toBe('2026-01-30');
    });
    it('diasSinActualizar = diferencia exacta en días', () => {
      const inv = [Inv({ id: new Date('2026-01-30').getTime() })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      // 2 de mayo - 30 de enero = 92 días
      expect(r[0].diasSinActualizar).toBe(92);
    });
    it('mesesSinActualizar = floor(días/30)', () => {
      const inv = [Inv({ id: new Date('2026-01-30').getTime() })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      // 2 de mayo - 30 de enero = 92 días = floor(92/30) = 3 meses
      expect(r[0].mesesSinActualizar).toBe(3);
    });
    it('campo fechaUltimaActualizacion explícito tiene prioridad sobre id', () => {
      const inv = [Inv({
        id: new Date('2020-01-01').getTime(),  // Muy viejo
        fechaUltimaActualizacion: '2026-01-30',  // Suficientemente viejo para pasar umbral
      })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].ultimaActualizacion).toBe('2026-01-30');
      expect(r[0].diasSinActualizar).toBe(92);
    });
  });

  describe('severidades', () => {
    it('2-2.99 meses → severidad=baja', () => {
      const inv = [Inv({ id: new Date('2026-03-03').getTime() })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('baja');
    });
    it('3-5.99 meses → severidad=media', () => {
      const inv = [Inv({ id: new Date('2026-01-20').getTime() })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('media');
    });
    it('6+ meses → severidad=alta', () => {
      const inv = [Inv({ id: new Date('2025-10-30').getTime() })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('alta');
    });
    it('config.mesesUmbral custom (umbral=1)', () => {
      const inv = [Inv({ id: new Date('2026-03-20').getTime() })];
      // March 20 to May 2 = 43 days = 1.43 months
      // Sin custom: ~1.43 meses → no aparece (< 2). Con umbral=1: aparece (>= 1)
      const r = detectarInversionesSinActualizar(inv, HOY, { mesesUmbral: 1 });
      expect(r).toHaveLength(1);
      expect(r[0].severidad).toBe('baja');  // 1.43 is still < 3, so baja
    });
  });

  describe('sugerencias', () => {
    it('capital > 10M → sugerencia=actualizar', () => {
      const inv = [Inv({ id: new Date('2026-01-01').getTime(), capital: 15_000_000 })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r[0].sugerencia).toBe('actualizar');
    });
    it('capital ≤ 10M → sugerencia=revisar', () => {
      const inv = [Inv({ id: new Date('2026-01-01').getTime(), capital: 5_000_000 })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r[0].sugerencia).toBe('revisar');
    });
    it('capital = 10M exacto → sugerencia=revisar (umbral exclusivo)', () => {
      const inv = [Inv({ id: new Date('2026-01-01').getTime(), capital: 10_000_000 })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r[0].sugerencia).toBe('revisar');
    });
  });

  describe('robustez', () => {
    it('inversiones null → []', () => {
      const r = detectarInversionesSinActualizar(null, HOY);
      expect(r).toEqual([]);
    });
    it('inversiones no-array → []', () => {
      const r = detectarInversionesSinActualizar('no-array', HOY);
      expect(r).toEqual([]);
    });
    it('inversión sin id → ignorada', () => {
      const inv = [Inv({ id: undefined })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toEqual([]);
    });
    it('inversión con id<=0 → ignorada', () => {
      const inv = [Inv({ id: 0 }), Inv({ id: -999 })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toEqual([]);
    });
    it('hoyISO formato inválido → []', () => {
      const inv = [Inv()];
      const r = detectarInversionesSinActualizar(inv, 'no-fecha');
      expect(r).toEqual([]);
    });
    it('rendimiento negativo (pérdida) → igual cálculo, no afecta severidad', () => {
      const inv = [Inv({ id: new Date('2026-01-01').getTime(), rendimiento: -50_000 })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].rendimiento).toBe(-50_000);
      expect(r[0].severidad).toBe('media');  // Severidad por edad, no por signo
    });
    it('capital null → tratado como 0', () => {
      const inv = [Inv({ id: new Date('2026-01-01').getTime(), capital: null })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r[0].capital).toBe(0);
      expect(r[0].sugerencia).toBe('revisar');  // 0 ≤ 10M
    });
  });

  describe('ordenamiento', () => {
    it('varias inversiones: ordenadas por severidad DESC, meses DESC', () => {
      const inv = [
        Inv({ id: 1, nombre: 'Baja',   fechaUltimaActualizacion: '2026-03-30' }),  // ~1 mes (baja, sin umbral)
        Inv({ id: 2, nombre: 'Media1', fechaUltimaActualizacion: '2026-02-01' }),  // ~3 meses (media, vieja)
        Inv({ id: 3, nombre: 'Media2', fechaUltimaActualizacion: '2026-02-15' }),  // ~2.5 meses (media, nueva)
        Inv({ id: 4, nombre: 'Alta',   fechaUltimaActualizacion: '2025-11-01' }),  // ~6 meses (alta)
      ];
      const r = detectarInversionesSinActualizar(inv, HOY, { mesesUmbral: 1 });
      // Orden: Alta (1), Media1 (por ser más vieja), Media2, Baja
      expect(r[0].nombre).toBe('Alta');      // severidad alta
      expect(r[1].nombre).toBe('Media1');    // severidad media, más vieja
      expect(r[2].nombre).toBe('Media2');    // severidad media, más nueva
      expect(r[3].nombre).toBe('Baja');      // severidad baja
    });
    it('mismo nivel + mismo mes → determinístico por id', () => {
      const inv = [
        Inv({ id: 100, fechaUltimaActualizacion: '2026-02-02' }),
        Inv({ id: 1,   fechaUltimaActualizacion: '2026-02-02' }),
        Inv({ id: 50,  fechaUltimaActualizacion: '2026-02-02' }),
      ];
      const r = detectarInversionesSinActualizar(inv, HOY);
      // Mismo nivel y mes → orden por id asc
      expect(r[0].id).toBe(1);
      expect(r[1].id).toBe(50);
      expect(r[2].id).toBe(100);
    });
  });

  describe('mensajes', () => {
    it('mensaje siempre es string no vacío', () => {
      const inv = [Inv({ id: new Date('2026-01-01').getTime() })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(typeof r[0].mensaje).toBe('string');
      expect(r[0].mensaje.length).toBeGreaterThan(0);
    });
    it('mensaje incluye "X meses sin actualizar"', () => {
      const inv = [Inv({ id: new Date('2025-11-01').getTime() })];
      const r = detectarInversionesSinActualizar(inv, HOY);
      expect(r).toHaveLength(1);
      expect(r[0].mensaje).toMatch(/Sin actualizar hace \d+ meses/);
    });
  });

  describe('determinismo y mutación', () => {
    it('misma entrada → mismo output', () => {
      const inv = [Inv({ id: new Date('2026-02-02').getTime(), nombre: 'Test' })];
      const a = detectarInversionesSinActualizar(inv, HOY);
      const b = detectarInversionesSinActualizar(inv, HOY);
      expect(a).toEqual(b);
    });
    it('no muta los inputs', () => {
      const inv = [Inv({ id: new Date('2026-01-01').getTime() })];
      const original = JSON.parse(JSON.stringify(inv));
      detectarInversionesSinActualizar(inv, HOY);
      expect(inv).toEqual(original);
    });
  });

});
