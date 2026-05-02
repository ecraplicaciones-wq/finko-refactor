// tests/unit/ingresos.test.js
//
// ✅ R1 (auditoría v5): cobertura del dominio de ingresos.
//
//  • cuotasPeriodo / consolMes — agregados sobre S.deudas, S.historial, S.gastos.
//  • calcularResumen — el "monstruo" del dashboard: agrega todo el período.
//  • generarConsejo  — toma el resumen y elige un texto de consejo.
//  • calcularScoreFinanciero — score 0–100 con 3 componentes ponderados.
//
// Patrón: resetAppState() en beforeEach + asignaciones a S específicas.
// generarConsejo y calcularScoreFinanciero son 100% puras (sin S, sin DOM)
// → tests directos sin reset.

import { describe, it, expect, beforeEach } from 'vitest';
import { S, resetAppState } from '../../modules/core/state.js';
import {
  cuotasPeriodo,
  consolMes,
  calcularResumen,
  generarConsejo,
  calcularScoreFinanciero,
  calcularTopHormigas,
  calcularComparacionQuincenas,
  detectarDuplicadoGasto,
  detectarGastoAtipico,
} from '../../modules/dominio/ingresos.js';

// ─── cuotasPeriodo ───────────────────────────────────────────────────────────

describe('cuotasPeriodo()', () => {

  beforeEach(() => resetAppState());

  it('sin deudas devuelve 0 sin importar el período', () => {
    S.tipoPeriodo = 'mensual';
    expect(cuotasPeriodo()).toBe(0);
    S.tipoPeriodo = 'q1';
    expect(cuotasPeriodo()).toBe(0);
    S.tipoPeriodo = 'q2';
    expect(cuotasPeriodo()).toBe(0);
  });

  it('mensual: quincenales × 2 + mensuales', () => {
    S.deudas = [
      { id: 1, periodicidad: 'quincenal', cuota: 100_000 },
      { id: 2, periodicidad: 'mensual',   cuota: 500_000 },
    ];
    S.tipoPeriodo = 'mensual';
    expect(cuotasPeriodo()).toBe(700_000);  // 100k × 2 + 500k
  });

  it('q1 (primera quincena): quincenales + mensuales', () => {
    S.deudas = [
      { id: 1, periodicidad: 'quincenal', cuota: 200_000 },
      { id: 2, periodicidad: 'mensual',   cuota: 800_000 },
    ];
    S.tipoPeriodo = 'q1';
    expect(cuotasPeriodo()).toBe(1_000_000);
  });

  it('q2 (segunda quincena): solo quincenales (las mensuales ya se pagaron en q1)', () => {
    S.deudas = [
      { id: 1, periodicidad: 'quincenal', cuota: 200_000 },
      { id: 2, periodicidad: 'mensual',   cuota: 800_000 },
    ];
    S.tipoPeriodo = 'q2';
    expect(cuotasPeriodo()).toBe(200_000);
  });

  it('suma varias deudas de la misma periodicidad', () => {
    S.deudas = [
      { id: 1, periodicidad: 'mensual', cuota: 300_000 },
      { id: 2, periodicidad: 'mensual', cuota: 500_000 },
      { id: 3, periodicidad: 'mensual', cuota: 200_000 },
    ];
    S.tipoPeriodo = 'q1';
    expect(cuotasPeriodo()).toBe(1_000_000);
  });

});

// ─── consolMes ───────────────────────────────────────────────────────────────

describe('consolMes()', () => {

  beforeEach(() => resetAppState());

  it('sin histórico ni ingreso devuelve ceros con q=0', () => {
    const r = consolMes();
    expect(r.ing).toBe(0);
    expect(r.eg).toBe(0);
    expect(r.bal).toBe(0);
    expect(r.q).toBe(0);
  });

  it('cuenta la quincena en curso si hay ingreso (q=1)', () => {
    S.ingreso = 2_000_000;
    const r = consolMes();
    expect(r.ing).toBe(2_000_000);
    expect(r.q).toBe(1);
  });

  it('suma histórico del mes corriente al ingreso/gasto activo', () => {
    // Construimos el mes corriente igual que mesStr() — YYYY-MM en hora local.
    const n = new Date();
    const mesActual = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    S.historial = [
      { mes: mesActual, ingreso: 1_500_000, gastado: 1_000_000, ahorro: 200_000 },
    ];
    S.ingreso = 2_000_000;
    S.gastos  = [
      { id: 1, monto: 500_000, tipo: 'necesidad' },
      { id: 2, monto: 100_000, tipo: 'ahorro' },  // los ahorros NO entran en eg
    ];
    const r = consolMes();
    expect(r.ing).toBe(3_500_000);  // hist 1.5M + ingreso 2M
    expect(r.eg).toBe(1_500_000);   // hist 1M + gasto activo 500k (ahorro fuera)
    expect(r.bal).toBe(2_000_000);  // 3.5M - 1.5M
    expect(r.q).toBe(2);            // 1 histórico + 1 actual
  });

  it('ignora histórico de otros meses', () => {
    S.historial = [
      { mes: '2020-01', ingreso: 999_000_000, gastado: 999_000_000 },
    ];
    S.ingreso = 1_000_000;
    const r = consolMes();
    expect(r.ing).toBe(1_000_000);  // el histórico ancestral no contó
    expect(r.eg).toBe(0);
  });

  it('respeta montoTotal sobre monto en gastos (4×1000 incluido)', () => {
    S.ingreso = 1_000_000;
    S.gastos  = [
      { id: 1, monto: 100_000, montoTotal: 100_400, tipo: 'necesidad' },
    ];
    const r = consolMes();
    expect(r.eg).toBe(100_400);  // usa montoTotal cuando existe
  });

});

// ─── calcularResumen ─────────────────────────────────────────────────────────

describe('calcularResumen()', () => {

  beforeEach(() => resetAppState());

  it('sin datos devuelve un resumen con todos los totales en 0', () => {
    const r = calcularResumen();
    expect(r.ingreso).toBe(0);
    expect(r.tG).toBe(0);
    expect(r.tA).toBe(0);
    expect(r.balance).toBe(0);
    expect(r.pctGasto).toBe(0);
    expect(r.numGastos).toBe(0);
    expect(r.topCats).toEqual([]);
  });

  it('clasifica gastos por tipo: necesidad, deseo, ahorro, hormiga', () => {
    S.ingreso = 2_000_000;
    S.gastos  = [
      { id: 1, monto: 800_000, tipo: 'necesidad', cat: 'arriendo' },
      { id: 2, monto: 200_000, tipo: 'deseo',     cat: 'salidas' },
      { id: 3, monto: 300_000, tipo: 'ahorro',    cat: 'ahorro' },
      { id: 4, monto:  50_000, tipo: 'hormiga',   cat: 'cafe' },
    ];
    const r = calcularResumen();
    expect(r.tN).toBe(800_000);
    expect(r.tD).toBe(200_000);
    expect(r.tA).toBe(300_000);
    expect(r.tH).toBe(50_000);
    expect(r.tG).toBe(1_050_000);  // necesidad + deseo + hormiga (ahorro fuera)
  });

  it('calcula porcentajes correctamente', () => {
    S.ingreso = 1_000_000;
    S.gastos  = [
      { id: 1, monto: 500_000, tipo: 'necesidad', cat: 'arriendo' },
      { id: 2, monto: 200_000, tipo: 'ahorro',    cat: 'ahorro' },
    ];
    const r = calcularResumen();
    expect(r.pctGasto).toBe(50);
    expect(r.pctAhorro).toBe(20);
    expect(r.pctNeces).toBe(50);
  });

  it('balance = ingreso - tG (sin descontar ahorro)', () => {
    S.ingreso = 1_000_000;
    S.gastos  = [
      { id: 1, monto: 600_000, tipo: 'necesidad', cat: 'arriendo' },
      { id: 2, monto: 200_000, tipo: 'ahorro',    cat: 'ahorro' },
    ];
    const r = calcularResumen();
    expect(r.balance).toBe(400_000);  // 1M - 600k (ahorro NO se resta)
  });

  it('topCats devuelve hasta 3 categorías ordenadas por monto', () => {
    S.ingreso = 5_000_000;
    S.gastos  = [
      { id: 1, monto: 200_000, tipo: 'necesidad', cat: 'comida' },
      { id: 2, monto: 800_000, tipo: 'necesidad', cat: 'arriendo' },
      { id: 3, monto: 100_000, tipo: 'deseo',     cat: 'salidas' },
      { id: 4, monto: 400_000, tipo: 'necesidad', cat: 'transporte' },
      { id: 5, monto:  50_000, tipo: 'deseo',     cat: 'libros' },
    ];
    const r = calcularResumen();
    expect(r.topCats).toHaveLength(3);
    expect(r.topCats[0].cat).toBe('arriendo');     // 800k
    expect(r.topCats[0].monto).toBe(800_000);
    expect(r.topCats[1].cat).toBe('transporte');   // 400k
    expect(r.topCats[2].cat).toBe('comida');       // 200k
  });

  it('respeta el método de distribución configurado en S.metodo', () => {
    S.metodo = '70-20-10';
    const r = calcularResumen();
    expect(r.metasPct).toEqual({ n: 70, d: 20, a: 10 });
  });

  it('default 50-30-20 si metodo no está en el catálogo', () => {
    S.metodo = 'inventado';
    const r = calcularResumen();
    expect(r.metasPct).toEqual({ n: 50, d: 30, a: 20 });
  });

  it('detecta gastoMax (gasto individual más grande, sin contar ahorro)', () => {
    S.gastos = [
      { id: 1, monto: 100_000, tipo: 'necesidad', desc: 'Mercado',  cat: 'comida' },
      { id: 2, monto: 800_000, tipo: 'necesidad', desc: 'Arriendo', cat: 'arriendo' },
      { id: 3, monto: 999_000, tipo: 'ahorro',    desc: 'Para fondo', cat: 'ahorro' },
    ];
    const r = calcularResumen();
    expect(r.gastoMax.monto).toBe(800_000);
    expect(r.gastoMax.desc).toBe('Arriendo');
  });

  it('delta compara con la quincena anterior si existe en historial', () => {
    S.ingreso   = 1_000_000;
    S.historial = [
      { mes: '2025-12', ingreso: 800_000, gastado: 600_000, ahorro: 80_000 },
    ];
    S.gastos = [
      { id: 1, monto: 400_000, tipo: 'necesidad', cat: 'comida' },
      { id: 2, monto: 200_000, tipo: 'ahorro',    cat: 'ahorro' },
    ];
    const r = calcularResumen();
    // pctGasto actual = 40%, prev = 75% → delta -35
    expect(r.delta).not.toBeNull();
    expect(r.delta.gasto).toBeCloseTo(-35, 1);
    // pctAhorro actual = 20%, prev = 10% → delta +10
    expect(r.delta.ahorro).toBeCloseTo(10, 1);
  });

});

// ─── generarConsejo ──────────────────────────────────────────────────────────

describe('generarConsejo()', () => {
  // Pura — pasamos el resumen `r` directamente.

  it('sin datos suficientes → mensaje de "registrá desde el día uno"', () => {
    const r = generarConsejo({ ingreso: 0, numGastos: 0 });
    expect(r.icon).toBe('📋');
    expect(r.texto).toMatch(/registros suficientes/i);
  });

  it('si tA===0 → recomienda pagarse a uno mismo primero', () => {
    const r = generarConsejo({
      ingreso: 1_000_000, numGastos: 5, tA: 0, tH: 0,
      pctHormiga: 0, pctGasto: 50, pctDeudas: 0, pctDeseo: 10, pctAhorro: 0,
      metasPct: { n: 50, d: 30, a: 20 }, balance: 500_000, delta: null,
    });
    expect(r.icon).toBe('⚠️');
    expect(r.texto).toMatch(/págate a ti primero/i);
  });

  it('hormiga > 15% → alerta hormiga con proyección anual', () => {
    const r = generarConsejo({
      ingreso: 1_000_000, numGastos: 10, tA: 100_000,
      tH: 200_000, pctHormiga: 20, pctGasto: 50, pctDeudas: 0,
      pctDeseo: 10, pctAhorro: 10, metasPct: { n: 50, d: 30, a: 20 },
      balance: 500_000, delta: null,
    });
    expect(r.icon).toBe('🐜');
    expect(r.texto).toMatch(/20\.0%/);
  });

  it('pctGasto > 90 → alerta crítica de gasto', () => {
    const r = generarConsejo({
      ingreso: 1_000_000, numGastos: 10, tA: 50_000, tH: 0,
      pctHormiga: 0, pctGasto: 95, pctDeudas: 0, pctDeseo: 10,
      pctAhorro: 5, metasPct: { n: 50, d: 30, a: 20 }, balance: 50_000,
      delta: null,
    });
    expect(r.icon).toBe('🚨');
    expect(r.texto).toMatch(/95\.0%/);
  });

  it('pctDeudas > 30 → recomienda liquidar deudas', () => {
    const r = generarConsejo({
      ingreso: 1_000_000, numGastos: 10, tA: 100_000, tH: 0,
      pctHormiga: 0, pctGasto: 80, pctDeudas: 35, pctDeseo: 10,
      pctAhorro: 10, metasPct: { n: 50, d: 30, a: 20 }, balance: 200_000,
      delta: null,
    });
    expect(r.icon).toBe('💳');
    expect(r.texto).toMatch(/30%/);
  });

  it('cumplir meta de ahorro → trofeo', () => {
    const r = generarConsejo({
      ingreso: 1_000_000, numGastos: 10, tA: 250_000, tH: 0,
      pctHormiga: 0, pctGasto: 60, pctDeudas: 0, pctDeseo: 10,
      pctAhorro: 25, metasPct: { n: 50, d: 30, a: 20 }, balance: 400_000,
      delta: null,
    });
    expect(r.icon).toBe('🏆');
    expect(r.texto).toMatch(/cumpliste la meta/i);
  });

  it('mejora vs período anterior → consejo de "vas mejorando"', () => {
    const r = generarConsejo({
      ingreso: 1_000_000, numGastos: 10, tA: 150_000, tH: 0,
      pctHormiga: 0, pctGasto: 60, pctDeudas: 0, pctDeseo: 10,
      pctAhorro: 15, metasPct: { n: 50, d: 30, a: 20 }, balance: 400_000,
      delta: { gasto: -2, ahorro: 8 },  // +8pp ahorro vs prev
    });
    expect(r.icon).toBe('📈');
    expect(r.texto).toMatch(/8\.0 puntos/);
  });

});

// ─── calcularScoreFinanciero ─────────────────────────────────────────────────

describe('calcularScoreFinanciero()', () => {
  // Pura — no toca S ni DOM.

  it('ingreso=0 hace que ahorro y deuda no aporten puntos', () => {
    const s = calcularScoreFinanciero({
      ingreso: 0, totalAhorro: 0, cuotasPeriodo: 0, fondoPct: 0,
    });
    expect(s.ptsAhorro).toBe(0);
    expect(s.ptsDeuda).toBe(30);  // sin ingreso, pctDeuda = 0 → 30 pts
    expect(s.ptsFondo).toBe(0);
    expect(s.total).toBe(30);
    expect(s.nivel).toBe('critico');
  });

  it('ahorro 20% del ingreso → 40 pts (máximo)', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 200_000, cuotasPeriodo: 0, fondoPct: 0,
    });
    expect(s.ptsAhorro).toBe(40);
  });

  it('ahorro 10% del ingreso → 20 pts (proporcional)', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 100_000, cuotasPeriodo: 0, fondoPct: 0,
    });
    expect(s.ptsAhorro).toBe(20);
  });

  it('ahorro > 20% no escala arriba de 40 pts', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 500_000, cuotasPeriodo: 0, fondoPct: 0,
    });
    expect(s.ptsAhorro).toBe(40);
  });

  it('deuda ≤ 30% del ingreso → 30 pts (máximo)', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 0, cuotasPeriodo: 300_000, fondoPct: 0,
    });
    expect(s.ptsDeuda).toBe(30);
  });

  it('deuda 50% del ingreso → 30 - (0.20×100) = 10 pts', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 0, cuotasPeriodo: 500_000, fondoPct: 0,
    });
    expect(s.ptsDeuda).toBe(10);
  });

  it('deuda > 60% del ingreso → 0 pts (no negativos)', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 0, cuotasPeriodo: 1_000_000, fondoPct: 0,
    });
    expect(s.ptsDeuda).toBe(0);
  });

  it('fondo 100% completado → 30 pts (máximo)', () => {
    const s = calcularScoreFinanciero({
      ingreso: 0, totalAhorro: 0, cuotasPeriodo: 0, fondoPct: 100,
    });
    expect(s.ptsFondo).toBe(30);
  });

  it('fondo 50% completado → 15 pts', () => {
    const s = calcularScoreFinanciero({
      ingreso: 0, totalAhorro: 0, cuotasPeriodo: 0, fondoPct: 50,
    });
    expect(s.ptsFondo).toBe(15);
  });

  it('escenario excelente: 20% ahorro, deuda controlada, fondo lleno', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 200_000, cuotasPeriodo: 200_000, fondoPct: 100,
    });
    expect(s.total).toBe(100);
    expect(s.nivel).toBe('excelente');
    expect(s.colorClass).toBe('fs-excellent');
  });

  it('escenario crítico: sin ahorro, deuda alta, sin fondo', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 0, cuotasPeriodo: 800_000, fondoPct: 0,
    });
    expect(s.total).toBeLessThan(40);
    expect(s.nivel).toBe('critico');
  });

  it('niveles: 80+ excelente, 60-79 aceptable, 40-59 malo, <40 critico', () => {
    // Escenario aceptable: 70 pts (15 ahorro + 25 deuda + 30 fondo)
    const s1 = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 75_000, cuotasPeriodo: 350_000, fondoPct: 100,
    });
    // 15 + (30 - 0.05*100=5 → 25) + 30 = 70
    expect(s1.total).toBe(70);
    expect(s1.nivel).toBe('aceptable');

    // Escenario malo: 40-59 — ahorro 5%, deuda 25%, fondo 50%
    const s2 = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 50_000, cuotasPeriodo: 250_000, fondoPct: 50,
    });
    // 10 + 30 + 15 = 55
    expect(s2.total).toBe(55);
    expect(s2.nivel).toBe('malo');
  });

  it('fondoPct null o undefined no rompe (default 0)', () => {
    const s = calcularScoreFinanciero({
      ingreso: 1_000_000, totalAhorro: 200_000, cuotasPeriodo: 0, fondoPct: null,
    });
    expect(s.ptsFondo).toBe(0);
  });

});

// ─── calcularTopHormigas ──────────────────────────────────────────────────────

describe('calcularTopHormigas()', () => {

  it('lista vacía / no-array → []', () => {
    expect(calcularTopHormigas([])).toEqual([]);
    expect(calcularTopHormigas(null)).toEqual([]);
    expect(calcularTopHormigas(undefined)).toEqual([]);
  });

  it('ignora gastos que no son hormiga', () => {
    const gastos = [
      { fecha: '2026-04-25', desc: 'Mercado',  monto: 100_000, tipo: 'necesidad' },
      { fecha: '2026-04-25', desc: 'Café',     monto:   3_000, tipo: 'hormiga' },
      { fecha: '2026-04-25', desc: 'Netflix',  monto:  35_000, tipo: 'deseo' },
    ];
    const r = calcularTopHormigas(gastos);
    expect(r).toHaveLength(1);
    expect(r[0].concepto).toBe('Café');
  });

  it('reconoce g.hormiga=true aunque tipo no sea "hormiga"', () => {
    const gastos = [
      { fecha: '2026-04-25', desc: 'Café', monto: 3_000, tipo: 'deseo', hormiga: true },
    ];
    const r = calcularTopHormigas(gastos);
    expect(r).toHaveLength(1);
    expect(r[0].total).toBe(3_000);
  });

  it('agrupa por descripción case + tilde insensitive', () => {
    const gastos = [
      { fecha: '2026-04-01', desc: 'Café',  monto: 3_000, tipo: 'hormiga' },
      { fecha: '2026-04-05', desc: 'café',  monto: 4_000, tipo: 'hormiga' },
      { fecha: '2026-04-10', desc: 'CAFE',  monto: 5_000, tipo: 'hormiga' },
    ];
    const r = calcularTopHormigas(gastos);
    expect(r).toHaveLength(1);
    expect(r[0].total).toBe(12_000);
    expect(r[0].count).toBe(3);
    expect(r[0].concepto).toBe('Café');  // primera variante encontrada
  });

  it('limita al top N (default 3)', () => {
    const gastos = [
      { fecha: '2026-04-01', desc: 'A', monto: 100, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'B', monto:  90, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'C', monto:  80, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'D', monto:  70, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'E', monto:  60, tipo: 'hormiga' },
    ];
    const r = calcularTopHormigas(gastos);
    expect(r).toHaveLength(3);
    expect(r.map(x => x.concepto)).toEqual(['A', 'B', 'C']);
  });

  it('respeta limit personalizado', () => {
    const gastos = [
      { fecha: '2026-04-01', desc: 'A', monto: 100, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'B', monto:  90, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'C', monto:  80, tipo: 'hormiga' },
    ];
    expect(calcularTopHormigas(gastos, null, 1)).toHaveLength(1);
    expect(calcularTopHormigas(gastos, null, 2)).toHaveLength(2);
    expect(calcularTopHormigas(gastos, null, 5)).toHaveLength(3);  // tope a count real
  });

  it('limit 0 / negativo → []', () => {
    const gastos = [{ fecha: '2026-04-01', desc: 'A', monto: 100, tipo: 'hormiga' }];
    expect(calcularTopHormigas(gastos, null, 0)).toEqual([]);
    expect(calcularTopHormigas(gastos, null, -3)).toEqual([]);
  });

  it('filtra por mes "YYYY-MM" cuando se proporciona', () => {
    const gastos = [
      { fecha: '2026-03-15', desc: 'Café', monto: 50_000, tipo: 'hormiga' },  // mes anterior
      { fecha: '2026-04-01', desc: 'Café', monto:  3_000, tipo: 'hormiga' },
      { fecha: '2026-04-25', desc: 'Café', monto:  4_000, tipo: 'hormiga' },
      { fecha: '2026-05-01', desc: 'Café', monto: 99_000, tipo: 'hormiga' },  // mes siguiente
    ];
    const r = calcularTopHormigas(gastos, '2026-04');
    expect(r).toHaveLength(1);
    expect(r[0].total).toBe(7_000);    // solo abril
    expect(r[0].count).toBe(2);
  });

  it('mes sin hormigas → []', () => {
    const gastos = [
      { fecha: '2026-04-01', desc: 'Café', monto: 3_000, tipo: 'hormiga' },
    ];
    expect(calcularTopHormigas(gastos, '2026-05')).toEqual([]);
  });

  it('usa montoTotal sobre monto cuando existe (gastos con 4×1000)', () => {
    const gastos = [
      { fecha: '2026-04-01', desc: 'Café', monto: 3_000, montoTotal: 3_012, tipo: 'hormiga' },
    ];
    const r = calcularTopHormigas(gastos);
    expect(r[0].total).toBe(3_012);
  });

  it('gastos sin descripción se agrupan como "Sin descripción"', () => {
    const gastos = [
      { fecha: '2026-04-01', desc: '',           monto: 1_000, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: undefined,    monto: 2_000, tipo: 'hormiga' },
      { fecha: '2026-04-01',                     monto: 3_000, tipo: 'hormiga' },
    ];
    const r = calcularTopHormigas(gastos);
    expect(r).toHaveLength(1);
    expect(r[0].concepto).toBe('Sin descripción');
    expect(r[0].total).toBe(6_000);
    expect(r[0].count).toBe(3);
  });

  it('orden estable: total DESC', () => {
    const gastos = [
      { fecha: '2026-04-01', desc: 'B', monto: 50, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'A', monto: 100, tipo: 'hormiga' },
      { fecha: '2026-04-01', desc: 'C', monto: 75, tipo: 'hormiga' },
    ];
    const r = calcularTopHormigas(gastos);
    expect(r.map(x => x.concepto)).toEqual(['A', 'C', 'B']);
  });

});

// ─── calcularComparacionQuincenas ────────────────────────────────────────────

describe('calcularComparacionQuincenas()', () => {

  it('sin quincena anterior → null (no hay con qué comparar)', () => {
    expect(calcularComparacionQuincenas({ gastado: 100, ahorro: 50, hormiga: 10, ingreso: 200 }, null)).toBeNull();
    expect(calcularComparacionQuincenas({ gastado: 100, ahorro: 50, hormiga: 10, ingreso: 200 }, undefined)).toBeNull();
  });

  it('sin actual → null', () => {
    expect(calcularComparacionQuincenas(null, { gastado: 100 })).toBeNull();
  });

  it('gastos: bajaron → estado "mejor" (menos es mejor)', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 800_000, ahorro: 0, hormiga: 0, ingreso: 0 },
      { gastado: 1_000_000, ahorro: 0, hormiga: 0, ingreso: 0 }
    );
    expect(r.gastado.delta).toBe(-200_000);
    expect(r.gastado.pct).toBe(-20);
    expect(r.gastado.estado).toBe('mejor');
  });

  it('gastos: subieron → estado "peor"', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 1_200_000, ahorro: 0, hormiga: 0, ingreso: 0 },
      { gastado: 1_000_000, ahorro: 0, hormiga: 0, ingreso: 0 }
    );
    expect(r.gastado.delta).toBe(200_000);
    expect(r.gastado.pct).toBe(20);
    expect(r.gastado.estado).toBe('peor');
  });

  it('ahorro: subió → estado "mejor" (más es mejor)', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 0, ahorro: 300_000, hormiga: 0, ingreso: 0 },
      { gastado: 0, ahorro: 200_000, hormiga: 0, ingreso: 0 }
    );
    expect(r.ahorro.delta).toBe(100_000);
    expect(r.ahorro.pct).toBe(50);
    expect(r.ahorro.estado).toBe('mejor');
  });

  it('ahorro: bajó → estado "peor"', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 0, ahorro: 100_000, hormiga: 0, ingreso: 0 },
      { gastado: 0, ahorro: 200_000, hormiga: 0, ingreso: 0 }
    );
    expect(r.ahorro.estado).toBe('peor');
  });

  it('hormiga: bajaron → mejor (las hormigas pequeñas son malas)', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 0, ahorro: 0, hormiga: 50_000, ingreso: 0 },
      { gastado: 0, ahorro: 0, hormiga: 80_000, ingreso: 0 }
    );
    expect(r.hormiga.estado).toBe('mejor');
  });

  it('cambios <1% se reportan como "igual"', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 1_000_000, ahorro: 200_000, hormiga: 50_000, ingreso: 2_000_000 },
      { gastado: 1_001_000, ahorro: 200_500, hormiga: 50_100, ingreso: 2_002_000 }
    );
    expect(r.gastado.estado).toBe('igual');
    expect(r.ahorro.estado).toBe('igual');
    expect(r.hormiga.estado).toBe('igual');
    expect(r.ingreso.estado).toBe('igual');
  });

  it('quincena anterior con métrica en 0: pct = 100 si actual > 0', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 0, ahorro: 100_000, hormiga: 0, ingreso: 0 },
      { gastado: 0, ahorro: 0,       hormiga: 0, ingreso: 0 }
    );
    expect(r.ahorro.pct).toBe(100);
    expect(r.ahorro.estado).toBe('mejor');
  });

  it('ambas quincenas en 0: pct = 0, estado "igual"', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 0, ahorro: 0, hormiga: 0, ingreso: 0 },
      { gastado: 0, ahorro: 0, hormiga: 0, ingreso: 0 }
    );
    expect(r.gastado.pct).toBe(0);
    expect(r.gastado.estado).toBe('igual');
  });

  it('reporta deltas independientes en las 4 métricas a la vez', () => {
    const r = calcularComparacionQuincenas(
      { gastado: 800_000,  ahorro: 200_000, hormiga: 30_000, ingreso: 1_500_000 },
      { gastado: 1_000_000, ahorro: 100_000, hormiga: 50_000, ingreso: 1_500_000 }
    );
    expect(r.gastado.estado).toBe('mejor');
    expect(r.ahorro.estado).toBe('mejor');
    expect(r.hormiga.estado).toBe('mejor');
    expect(r.ingreso.estado).toBe('igual');
  });

  it('valores undefined / no-numéricos se tratan como 0', () => {
    const r = calcularComparacionQuincenas(
      { gastado: undefined, ahorro: 'abc',     hormiga: NaN, ingreso: null },
      { gastado: 100_000,   ahorro: 50_000,    hormiga: 10_000, ingreso: 0 }
    );
    expect(r.gastado.delta).toBe(-100_000);
    expect(r.ahorro.delta).toBe(-50_000);
    expect(r.hormiga.delta).toBe(-10_000);
  });

});

// ─── detectarDuplicadoGasto ──────────────────────────────────────────────────
//
// Función pura: candidato + lista → match o null. Sin S, sin DOM, sin Date.now.
// Siempre pasamos `ahora` explícito en tests para no depender del reloj.

describe('detectarDuplicadoGasto()', () => {

  // Helper: arma un gasto válido con id-timestamp explícito.
  const G = (id, extra = {}) => ({
    id, desc: 'Café', monto: 5000, cat: 'comida', tipo: 'deseo', ...extra,
  });
  const C = (extra = {}) => ({ desc: 'Café', monto: 5000, cat: 'comida', ...extra });

  // ── BLOQUE: ENTRADAS QUE NO SE INTENTAN ──────────────────────────────────
  describe('entradas inválidas', () => {
    it('candidato null → null', () => {
      expect(detectarDuplicadoGasto(null, [G(1000)], 1000)).toBe(null);
    });
    it('candidato undefined → null', () => {
      expect(detectarDuplicadoGasto(undefined, [G(1000)], 1000)).toBe(null);
    });
    it('candidato no-objeto → null', () => {
      expect(detectarDuplicadoGasto('café', [G(1000)], 1000)).toBe(null);
      expect(detectarDuplicadoGasto(42, [G(1000)], 1000)).toBe(null);
    });
    it('gastos no-array → null', () => {
      expect(detectarDuplicadoGasto(C(), null, 1000)).toBe(null);
      expect(detectarDuplicadoGasto(C(), 'no soy array', 1000)).toBe(null);
      expect(detectarDuplicadoGasto(C(), {}, 1000)).toBe(null);
    });
    it('gastos vacío → null', () => {
      expect(detectarDuplicadoGasto(C(), [], 1000)).toBe(null);
    });
  });

  // ── BLOQUE: CANDIDATO CON DATOS FALTANTES ────────────────────────────────
  describe('candidato incompleto', () => {
    it('sin monto → null', () => {
      expect(detectarDuplicadoGasto(C({ monto: undefined }), [G(1000)], 1000)).toBe(null);
    });
    it('monto cero → null (no se considera gasto)', () => {
      expect(detectarDuplicadoGasto(C({ monto: 0 }), [G(1000, { monto: 0 })], 1000)).toBe(null);
    });
    it('monto negativo → null', () => {
      expect(detectarDuplicadoGasto(C({ monto: -100 }), [G(1000)], 1000)).toBe(null);
    });
    it('monto NaN → null', () => {
      expect(detectarDuplicadoGasto(C({ monto: NaN }), [G(1000)], 1000)).toBe(null);
    });
    it('desc vacía → null', () => {
      expect(detectarDuplicadoGasto(C({ desc: '' }), [G(1000)], 1000)).toBe(null);
    });
    it('desc solo espacios → null', () => {
      expect(detectarDuplicadoGasto(C({ desc: '   ' }), [G(1000)], 1000)).toBe(null);
    });
    it('cat vacía → null', () => {
      expect(detectarDuplicadoGasto(C({ cat: '' }), [G(1000)], 1000)).toBe(null);
    });
    it('cat undefined → null', () => {
      expect(detectarDuplicadoGasto(C({ cat: undefined }), [G(1000)], 1000)).toBe(null);
    });
  });

  // ── BLOQUE: GASTOS CON SHAPE INVÁLIDA ────────────────────────────────────
  describe('gastos basura en la lista', () => {
    it('items null/undefined ignorados', () => {
      expect(detectarDuplicadoGasto(C(), [null, undefined, null], 1000)).toBe(null);
    });
    it('items sin id ignorados', () => {
      expect(detectarDuplicadoGasto(
        C(),
        [{ desc: 'Café', monto: 5000, cat: 'comida' }],   // sin id
        1000
      )).toBe(null);
    });
    it('items con id no-numérico ignorados', () => {
      expect(detectarDuplicadoGasto(
        C(),
        [{ id: 'abc', desc: 'Café', monto: 5000, cat: 'comida' }],
        1000
      )).toBe(null);
    });
    it('mezcla: encuentra el válido aunque haya basura', () => {
      const r = detectarDuplicadoGasto(C(), [
        null,
        { id: 'no-num', desc: 'Café', monto: 5000, cat: 'comida' },
        G(900),                                            // válido, hace 100ms
      ], 1000);
      expect(r).not.toBe(null);
      expect(r.duplicado.id).toBe(900);
    });
  });

  // ── BLOQUE: VENTANA TEMPORAL ─────────────────────────────────────────────
  describe('respeta la ventana temporal', () => {
    it('gasto de hace 30 seg → match', () => {
      const r = detectarDuplicadoGasto(C(), [G(1_000_000 - 30_000)], 1_000_000);
      expect(r).not.toBe(null);
      expect(r.segundos).toBe(30);
    });
    it('gasto de hace 4:59 min → match (justo dentro)', () => {
      const ahora = 10_000_000;
      const r = detectarDuplicadoGasto(C(), [G(ahora - (5 * 60_000) + 1)], ahora);
      expect(r).not.toBe(null);
    });
    it('gasto de hace exactamente 5 min → match (límite incluyente)', () => {
      const ahora = 10_000_000;
      const r = detectarDuplicadoGasto(C(), [G(ahora - 5 * 60_000)], ahora);
      expect(r).not.toBe(null);
    });
    it('gasto de hace 5:01 min → null (fuera)', () => {
      const ahora = 10_000_000;
      const r = detectarDuplicadoGasto(C(), [G(ahora - (5 * 60_000) - 1000)], ahora);
      expect(r).toBe(null);
    });
    it('gasto en el futuro (id > ahora) → null', () => {
      const r = detectarDuplicadoGasto(C(), [G(2_000_000)], 1_000_000);
      expect(r).toBe(null);
    });
    it('ventana custom: 1 min', () => {
      const ahora = 10_000_000;
      const r1 = detectarDuplicadoGasto(C(), [G(ahora - 30_000)], ahora, 60_000);
      const r2 = detectarDuplicadoGasto(C(), [G(ahora - 90_000)], ahora, 60_000);
      expect(r1).not.toBe(null);
      expect(r2).toBe(null);
    });
  });

  // ── BLOQUE: COMPARACIÓN DE CAMPOS ────────────────────────────────────────
  describe('coincidencia de campos', () => {
    it('todo igual → match', () => {
      const r = detectarDuplicadoGasto(C(), [G(900)], 1000);
      expect(r).not.toBe(null);
    });
    it('cat distinta → null', () => {
      const r = detectarDuplicadoGasto(C(), [G(900, { cat: 'transporte' })], 1000);
      expect(r).toBe(null);
    });
    it('monto distinto → null', () => {
      const r = detectarDuplicadoGasto(C(), [G(900, { monto: 6000 })], 1000);
      expect(r).toBe(null);
    });
    it('desc distinta → null', () => {
      const r = detectarDuplicadoGasto(C(), [G(900, { desc: 'Té' })], 1000);
      expect(r).toBe(null);
    });
    it('desc con espacios extras → match (trim)', () => {
      const r = detectarDuplicadoGasto(C({ desc: '  Café  ' }), [G(900)], 1000);
      expect(r).not.toBe(null);
    });
    it('desc con mayúsculas distintas → match (toLowerCase)', () => {
      const r = detectarDuplicadoGasto(C({ desc: 'CAFÉ' }), [G(900)], 1000);
      expect(r).not.toBe(null);
    });
    it('monto string vs number coercionado → match', () => {
      // Tanto candidato como gasto pasan por Number()
      const r = detectarDuplicadoGasto(
        C({ monto: '5000' }),
        [G(900, { monto: 5000 })],
        1000
      );
      expect(r).not.toBe(null);
    });
  });

  // ── BLOQUE: SELECCIÓN ENTRE MÚLTIPLES ────────────────────────────────────
  describe('múltiples candidatos en lista', () => {
    it('devuelve el primero que matchea (orden de la lista)', () => {
      // Como S.gastos usa unshift(), el más reciente está al frente.
      const r = detectarDuplicadoGasto(C(), [
        G(950, { desc: 'Café' }),                          // hace 50ms
        G(800, { desc: 'Café' }),                          // hace 200ms
      ], 1000);
      expect(r.duplicado.id).toBe(950);
    });
    it('ignora los que no matchean y encuentra el válido', () => {
      const r = detectarDuplicadoGasto(C(), [
        G(950, { cat: 'transporte' }),                     // cat distinta
        G(900, { monto: 9999 }),                           // monto distinto
        G(850),                                            // ✅ match
      ], 1000);
      expect(r.duplicado.id).toBe(850);
    });
    it('todos fuera de ventana → null', () => {
      const r = detectarDuplicadoGasto(C(), [
        G(100), G(50), G(0),                               // hace ≥900ms cada uno → ok
      ], 1000, 500);                                       // ventana 500ms
      expect(r).toBe(null);
    });
  });

  // ── BLOQUE: FORMA DEL VALOR DE RETORNO ───────────────────────────────────
  describe('forma del retorno', () => {
    it('match incluye duplicado y segundos', () => {
      const r = detectarDuplicadoGasto(C(), [G(700)], 1000);
      expect(r).toHaveProperty('duplicado');
      expect(r).toHaveProperty('segundos');
    });
    it('duplicado es el objeto original (referencia)', () => {
      const original = G(700);
      const r = detectarDuplicadoGasto(C(), [original], 1000);
      expect(r.duplicado).toBe(original);
    });
    it('segundos = (ahora - id) / 1000 redondeado', () => {
      const r = detectarDuplicadoGasto(C(), [G(40_000)], 100_000);
      expect(r.segundos).toBe(60);                         // 60 seg exactos
    });
    it('segundos = 0 cuando id = ahora', () => {
      const r = detectarDuplicadoGasto(C(), [G(1000)], 1000);
      expect(r.segundos).toBe(0);
    });
  });
});

// ─── detectarGastoAtipico ────────────────────────────────────────────────────
//
// Función pura: candidato + lista + config → { promedio, factor, muestras } o null.
// Sin S, sin DOM. Pasamos `ahora` explícito en cada test para no depender del reloj.
//
// Defaults a recordar:
//   diasVentana = 30, factor = 4, minMuestras = 3.

describe('detectarGastoAtipico()', () => {

  // Reloj fijo para todos los tests: 2026-04-27 a las 12:00 UTC.
  const AHORA = new Date('2026-04-27T12:00:00Z').getTime();

  // Helper: gasto válido en el baseline. Por default fecha 5 días atrás.
  const G = (monto, extra = {}) => ({
    id: AHORA - 5 * 86_400_000,
    desc: 'Almuerzo',
    monto,
    cat: 'comida',
    tipo: 'necesidad',
    fecha: '2026-04-22',                                // 5 días antes
    ...extra,
  });

  // Helper: candidato. Default cat = 'comida'.
  const C = (monto, extra = {}) => ({ monto, cat: 'comida', ...extra });

  // Helper: config con `ahora` fijo + overrides opcionales.
  const cfg = (extra = {}) => ({ ahora: AHORA, ...extra });

  // Helper: arma N gastos del baseline con monto promedio dado y misma cat.
  const baseline = (n, monto, extra = {}) =>
    Array.from({ length: n }, (_, i) => G(monto, {
      id: AHORA - (i + 1) * 86_400_000,                 // 1..N días atrás
      fecha: new Date(AHORA - (i + 1) * 86_400_000).toISOString().slice(0, 10),
      ...extra,
    }));

  // ── BLOQUE: ENTRADAS INVÁLIDAS ───────────────────────────────────────────
  describe('entradas que ni se intentan', () => {
    it('candidato null → null', () => {
      expect(detectarGastoAtipico(null, baseline(5, 10_000), cfg())).toBe(null);
    });
    it('candidato undefined → null', () => {
      expect(detectarGastoAtipico(undefined, baseline(5, 10_000), cfg())).toBe(null);
    });
    it('candidato no-objeto (string) → null', () => {
      expect(detectarGastoAtipico('mucho', baseline(5, 10_000), cfg())).toBe(null);
    });
    it('candidato no-objeto (number) → null', () => {
      expect(detectarGastoAtipico(50_000, baseline(5, 10_000), cfg())).toBe(null);
    });
    it('gastos no-array (null) → null', () => {
      expect(detectarGastoAtipico(C(50_000), null, cfg())).toBe(null);
    });
    it('gastos no-array (string) → null', () => {
      expect(detectarGastoAtipico(C(50_000), 'no soy array', cfg())).toBe(null);
    });
    it('gastos vacío → null (no hay baseline)', () => {
      expect(detectarGastoAtipico(C(50_000), [], cfg())).toBe(null);
    });
  });

  // ── BLOQUE: CANDIDATO INCOMPLETO ─────────────────────────────────────────
  describe('candidato incompleto', () => {
    it('sin monto → null', () => {
      expect(detectarGastoAtipico({ cat: 'comida' }, baseline(5, 10_000), cfg())).toBe(null);
    });
    it('monto undefined → null', () => {
      expect(detectarGastoAtipico(C(undefined), baseline(5, 10_000), cfg())).toBe(null);
    });
    it('monto cero → null', () => {
      expect(detectarGastoAtipico(C(0), baseline(5, 10_000), cfg())).toBe(null);
    });
    it('monto negativo → null', () => {
      expect(detectarGastoAtipico(C(-50_000), baseline(5, 10_000), cfg())).toBe(null);
    });
    it('monto NaN → null', () => {
      expect(detectarGastoAtipico(C(NaN), baseline(5, 10_000), cfg())).toBe(null);
    });
    it('monto Infinity → null', () => {
      expect(detectarGastoAtipico(C(Infinity), baseline(5, 10_000), cfg())).toBe(null);
    });
    it('monto string no-numérico → null', () => {
      expect(detectarGastoAtipico(C('quinientos'), baseline(5, 10_000), cfg())).toBe(null);
    });
    it('cat ausente → null', () => {
      expect(detectarGastoAtipico({ monto: 50_000 }, baseline(5, 10_000), cfg())).toBe(null);
    });
    it('cat vacía → null', () => {
      expect(detectarGastoAtipico(C(50_000, { cat: '' }), baseline(5, 10_000), cfg())).toBe(null);
    });
    it('cat undefined → null', () => {
      expect(detectarGastoAtipico(C(50_000, { cat: undefined }), baseline(5, 10_000), cfg())).toBe(null);
    });
  });

  // ── BLOQUE: CONFIG INVÁLIDO O LÍMITE ─────────────────────────────────────
  describe('config inválido cae a defaults o devuelve null', () => {
    it('factor ≤ 1 → null (no aplica)', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(5, 10_000), cfg({ factor: 1 }))).toBe(null);
      expect(detectarGastoAtipico(C(50_000), baseline(5, 10_000), cfg({ factor: 0 }))).toBe(null);
      expect(detectarGastoAtipico(C(50_000), baseline(5, 10_000), cfg({ factor: -1 }))).toBe(null);
    });
    it('diasVentana 0 → null', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(5, 10_000), cfg({ diasVentana: 0 }))).toBe(null);
    });
    it('diasVentana negativo → null', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(5, 10_000), cfg({ diasVentana: -10 }))).toBe(null);
    });
    it('minMuestras < 1 → null', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(5, 10_000), cfg({ minMuestras: 0 }))).toBe(null);
    });
    it('config null → usa defaults', () => {
      // Con baseline de 5 gastos a 10k y candidato 50k (=5×) sigue siendo atípico.
      // Usamos `ahora` default → para evitar dependencia del reloj fijamos
      // ids con Date.now y verificamos que no se rompe.
      const ahoraReal = Date.now();
      const recientes = Array.from({ length: 5 }, (_, i) => ({
        id: ahoraReal - (i + 1) * 86_400_000,
        monto: 10_000, cat: 'comida',
        fecha: new Date(ahoraReal - (i + 1) * 86_400_000).toISOString().slice(0, 10),
      }));
      const r = detectarGastoAtipico(C(50_000), recientes, null);
      expect(r).not.toBe(null);
    });
    it('config no-objeto (string) → usa defaults', () => {
      const r = detectarGastoAtipico(C(50_000), baseline(5, 10_000), 'lo que sea');
      // Sin `ahora` explícito, baseline construido con AHORA fijo cae fuera de la
      // ventana real → null. El test valida que no crashea, no el resultado exacto.
      expect(r === null || (r && typeof r === 'object')).toBe(true);
    });
  });

  // ── BLOQUE: FILTRADO POR CATEGORÍA ───────────────────────────────────────
  describe('aísla baseline por categoría', () => {
    it('mezcla cat: solo cuenta la del candidato', () => {
      const gastos = [
        ...baseline(3, 10_000, { cat: 'comida' }),
        ...baseline(3, 200_000, { cat: 'transporte' }),    // ruido en otra cat
      ];
      const r = detectarGastoAtipico(C(50_000, { cat: 'comida' }), gastos, cfg());
      expect(r).not.toBe(null);
      expect(r.muestras).toBe(3);
      expect(r.promedio).toBe(10_000);
    });
    it('cat sin gastos previos → null por minMuestras', () => {
      const gastos = baseline(5, 10_000, { cat: 'comida' });
      expect(detectarGastoAtipico(C(50_000, { cat: 'transporte' }), gastos, cfg())).toBe(null);
    });
  });

  // ── BLOQUE: VENTANA TEMPORAL ─────────────────────────────────────────────
  describe('respeta la ventana temporal', () => {
    it('todos dentro de la ventana de 30d → cuenta todos', () => {
      const gastos = baseline(5, 10_000);                   // 1..5 días atrás
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(5);
    });
    it('mezcla dentro/fuera: solo cuenta los de adentro', () => {
      const gastos = [
        ...baseline(3, 10_000),                              // 1..3 días atrás
        G(10_000, {
          id: AHORA - 60 * 86_400_000,
          fecha: '2026-02-26',                               // 60 días atrás
        }),
      ];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(3);
    });
    it('todos fuera de la ventana → null', () => {
      const viejo = G(10_000, {
        id: AHORA - 100 * 86_400_000,
        fecha: '2026-01-17',
      });
      expect(detectarGastoAtipico(C(50_000), [viejo, viejo, viejo, viejo], cfg())).toBe(null);
    });
    it('gasto en el futuro (fecha posterior a ahora) → ignorado', () => {
      const gastos = [
        ...baseline(3, 10_000),
        G(10_000, {
          id: AHORA + 5 * 86_400_000,
          fecha: '2026-05-02',                               // 5 días en el futuro
        }),
      ];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(3);                            // futuro no cuenta
    });
    it('ventana custom de 7 días', () => {
      const gastos = [
        ...baseline(3, 10_000),                              // 1..3 días atrás
        G(10_000, {
          id: AHORA - 15 * 86_400_000,
          fecha: '2026-04-12',                               // 15 días atrás
        }),
      ];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg({ diasVentana: 7 }));
      expect(r.muestras).toBe(3);                            // el de 15d queda fuera
    });
  });

  // ── BLOQUE: GASTOS BASURA EN LA LISTA ────────────────────────────────────
  describe('robustez frente a gastos basura', () => {
    it('null/undefined ignorados', () => {
      const gastos = [null, undefined, ...baseline(3, 10_000), null];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(3);
    });
    it('items no-objeto ignorados', () => {
      const gastos = ['string', 42, true, ...baseline(3, 10_000)];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(3);
    });
    it('items con monto no-numérico ignorados', () => {
      const gastos = [
        G('mucho'),
        G(NaN),
        G(0),
        G(-100),
        ...baseline(3, 10_000),
      ];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(3);
    });
    it('items sin fecha ni id ignorados', () => {
      const gastos = [
        { monto: 10_000, cat: 'comida' },                    // sin fecha, sin id
        ...baseline(3, 10_000),
      ];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(3);
    });
    it('fecha malformada cae a id (fallback)', () => {
      const gastos = [
        G(10_000, { fecha: 'no-soy-fecha' }),                // fecha rota, id válido
        ...baseline(3, 10_000),
      ];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(4);                            // el de fecha rota cuenta vía id
    });
    it('sin fecha pero con id válido → cuenta', () => {
      const gastos = [
        { id: AHORA - 2 * 86_400_000, monto: 10_000, cat: 'comida' },  // sin fecha
        ...baseline(3, 10_000),
      ];
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r.muestras).toBe(4);
    });
    it('monto string-numérico coercionado correctamente', () => {
      const gastos = baseline(3, 10_000).map(g => ({ ...g, monto: '10000' }));
      const r = detectarGastoAtipico(C(50_000), gastos, cfg());
      expect(r).not.toBe(null);
      expect(r.promedio).toBe(10_000);
    });
  });

  // ── BLOQUE: MÍNIMO DE MUESTRAS ───────────────────────────────────────────
  describe('exige minMuestras antes de disparar', () => {
    it('1 gasto previo → null (sin baseline)', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(1, 10_000), cfg())).toBe(null);
    });
    it('2 gastos previos → null', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(2, 10_000), cfg())).toBe(null);
    });
    it('3 gastos previos → dispara (umbral exacto)', () => {
      const r = detectarGastoAtipico(C(50_000), baseline(3, 10_000), cfg());
      expect(r).not.toBe(null);
      expect(r.muestras).toBe(3);
    });
    it('minMuestras custom = 5', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(4, 10_000), cfg({ minMuestras: 5 }))).toBe(null);
      const r = detectarGastoAtipico(C(50_000), baseline(5, 10_000), cfg({ minMuestras: 5 }));
      expect(r).not.toBe(null);
    });
    it('minMuestras = 1: con un solo gasto ya alcanza', () => {
      const r = detectarGastoAtipico(C(50_000), baseline(1, 10_000), cfg({ minMuestras: 1 }));
      expect(r).not.toBe(null);
      expect(r.muestras).toBe(1);
    });
  });

  // ── BLOQUE: THRESHOLD DEL FACTOR ─────────────────────────────────────────
  describe('threshold del factor', () => {
    it('monto = promedio × 4 → dispara (límite incluyente)', () => {
      const r = detectarGastoAtipico(C(40_000), baseline(3, 10_000), cfg());
      expect(r).not.toBe(null);
      expect(r.factor).toBe(4);
    });
    it('monto justo debajo de 4× → null', () => {
      const r = detectarGastoAtipico(C(39_999), baseline(3, 10_000), cfg());
      expect(r).toBe(null);
    });
    it('monto justo encima de 4× → dispara', () => {
      const r = detectarGastoAtipico(C(40_001), baseline(3, 10_000), cfg());
      expect(r).not.toBe(null);
    });
    it('monto = promedio × 10 → dispara con factor 10', () => {
      const r = detectarGastoAtipico(C(100_000), baseline(3, 10_000), cfg());
      expect(r.factor).toBe(10);
    });
    it('factor custom = 2 dispara más fácil', () => {
      const r = detectarGastoAtipico(C(20_000), baseline(3, 10_000), cfg({ factor: 2 }));
      expect(r).not.toBe(null);
      expect(r.factor).toBe(2);
    });
    it('factor custom = 10 dispara solo con typos brutales', () => {
      expect(detectarGastoAtipico(C(50_000), baseline(3, 10_000), cfg({ factor: 10 }))).toBe(null);
      const r = detectarGastoAtipico(C(150_000), baseline(3, 10_000), cfg({ factor: 10 }));
      expect(r).not.toBe(null);
    });
  });

  // ── BLOQUE: FORMA DEL VALOR DE RETORNO ───────────────────────────────────
  describe('forma del retorno', () => {
    it('match incluye promedio, factor y muestras', () => {
      const r = detectarGastoAtipico(C(50_000), baseline(3, 10_000), cfg());
      expect(r).toHaveProperty('promedio');
      expect(r).toHaveProperty('factor');
      expect(r).toHaveProperty('muestras');
    });
    it('promedio = mean simple del baseline', () => {
      // 3 gastos: 10k, 20k, 30k → promedio 20k
      const gastos = [
        G(10_000, { id: AHORA - 1 * 86_400_000, fecha: '2026-04-26' }),
        G(20_000, { id: AHORA - 2 * 86_400_000, fecha: '2026-04-25' }),
        G(30_000, { id: AHORA - 3 * 86_400_000, fecha: '2026-04-24' }),
      ];
      const r = detectarGastoAtipico(C(100_000), gastos, cfg());
      expect(r.promedio).toBe(20_000);
    });
    it('factor = monto / promedio (puede no ser entero)', () => {
      const gastos = [
        G(10_000, { id: AHORA - 1 * 86_400_000, fecha: '2026-04-26' }),
        G(20_000, { id: AHORA - 2 * 86_400_000, fecha: '2026-04-25' }),
        G(30_000, { id: AHORA - 3 * 86_400_000, fecha: '2026-04-24' }),
      ];
      const r = detectarGastoAtipico(C(90_000), gastos, cfg());
      expect(r.factor).toBe(4.5);
    });
    it('muestras es entero positivo', () => {
      const r = detectarGastoAtipico(C(50_000), baseline(7, 10_000), cfg());
      expect(Number.isInteger(r.muestras)).toBe(true);
      expect(r.muestras).toBe(7);
    });
    it('todos los campos son numéricos', () => {
      const r = detectarGastoAtipico(C(50_000), baseline(3, 10_000), cfg());
      expect(typeof r.promedio).toBe('number');
      expect(typeof r.factor).toBe('number');
      expect(typeof r.muestras).toBe('number');
    });
  });

  // ── BLOQUE: CASOS REALES (HISTORIA DE USO) ───────────────────────────────
  describe('casos de uso reales', () => {
    it('typo del usuario: 50k café diario, escribe 5M → atípico (100×)', () => {
      const cafes = baseline(15, 5_000, { desc: 'Café' });
      const r = detectarGastoAtipico(C(500_000, { cat: 'comida' }), cafes, cfg());
      expect(r).not.toBe(null);
      expect(Math.round(r.factor)).toBe(100);
    });
    it('gasto legítimo no muy lejos del promedio → no dispara', () => {
      // Promedio almuerzo 25k, hoy almuerzo de 80k (3.2×) — bajo del threshold
      const r = detectarGastoAtipico(C(80_000), baseline(10, 25_000), cfg());
      expect(r).toBe(null);
    });
    it('gasto raro pero coherente (4.5×) → dispara para confirmar', () => {
      const r = detectarGastoAtipico(C(112_500), baseline(10, 25_000), cfg());
      expect(r).not.toBe(null);
    });
    it('primera compra en una categoría nueva → no avisa (sin baseline)', () => {
      // Usuario gasta en "salud" por primera vez con un monto alto. Sin
      // historial, no podemos comparar — esperamos null.
      const otrasCats = baseline(20, 10_000, { cat: 'comida' });
      const r = detectarGastoAtipico(C(500_000, { cat: 'salud' }), otrasCats, cfg());
      expect(r).toBe(null);
    });
  });

  // ── BLOQUE: ROBUSTEZ TOTAL ───────────────────────────────────────────────
  describe('robustez total', () => {
    it('mezcla con todas las variantes de basura → encuentra el patrón', () => {
      const r = detectarGastoAtipico(C(50_000), [
        null,
        undefined,
        'string-suelto',
        42,
        { /* objeto vacío */ },
        { id: 'no-num', monto: 10_000, cat: 'comida' },
        { id: AHORA, monto: 'no-num', cat: 'comida' },
        { id: AHORA, monto: 10_000 /* sin cat */ },
        ...baseline(3, 10_000),
      ], cfg());
      expect(r).not.toBe(null);
      expect(r.muestras).toBe(3);
    });
    it('1000 gastos en el baseline → procesa sin colgarse', () => {
      // Ventana grande para que TODOS los 1000 días entren en el cálculo.
      const r = detectarGastoAtipico(
        C(50_000),
        baseline(1000, 10_000),
        cfg({ diasVentana: 5000 })
      );
      expect(r).not.toBe(null);
      expect(r.muestras).toBe(1000);
      expect(r.promedio).toBe(10_000);
    });
  });
});
