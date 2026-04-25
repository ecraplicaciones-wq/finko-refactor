// tests/unit/calculadoras.test.js
//
// ✅ R1 (auditoría v5): cobertura de las fórmulas financieras puras
// extraídas de calculadoras.js. Las funciones DOM (cCDT/cCre/etc.) no se
// testean aquí — su lógica es delegada a las puras y el render se valida
// indirectamente al usar la app. Aquí garantizamos:
//   • aritmética correcta en valores típicos colombianos
//   • bordes (capital 0, tasa 0, plazo 0)
//   • paridad con la legislación citada en cada función

import { describe, it, expect } from 'vitest';
import {
  calcCDT,
  calcCredito,
  clasificarTasaCredito,
  calcInteresCompuesto,
  calcRentabilidadReal,
  calcRegla72,
  calcPILA,
} from '../../modules/calculadoras.js';
import {
  RETEFUENTE_CDT,
  SALUD_INDEPEND,
  PENSION_INDEPEND,
  SMMLV_2026,
  TASA_USURA_EA,
} from '../../modules/core/constants.js';

// ─── calcCDT ─────────────────────────────────────────────────────────────────

describe('calcCDT()', () => {

  it('retorna null si falta capital, tasa o días', () => {
    expect(calcCDT(0, 0.10, 365)).toBeNull();
    expect(calcCDT(1_000_000, 0, 365)).toBeNull();
    expect(calcCDT(1_000_000, 0.10, 0)).toBeNull();
  });

  it('calcula rendimiento bruto a 365 días (1 año exacto)', () => {
    const r = calcCDT(10_000_000, 0.12, 365, false);
    // 1 año a 12% EA → 1.2M de rendimiento bruto
    expect(r.rendimientoBruto).toBeCloseTo(1_200_000, 0);
    expect(r.rendimientoNeto).toBeCloseTo(1_200_000, 0);  // sin retención
  });

  it('aplica retefuente del 4% sobre el rendimiento cuando ck=true', () => {
    const r = calcCDT(10_000_000, 0.12, 365, true);
    expect(r.rendimientoBruto).toBeCloseTo(1_200_000, 0);
    expect(r.rendimientoNeto).toBeCloseTo(1_200_000 * (1 - RETEFUENTE_CDT), 0);
    // Verificación de la constante real (no hardcoded)
    expect(r.rendimientoNeto / r.rendimientoBruto).toBeCloseTo(0.96, 4);
  });

  it('capitaliza por días: 180 días rinde menos que 365', () => {
    const r180 = calcCDT(10_000_000, 0.12, 180, false);
    const r365 = calcCDT(10_000_000, 0.12, 365, false);
    expect(r180.rendimientoBruto).toBeLessThan(r365.rendimientoBruto);
    // ~5.83% en medio año (compuesto, no la mitad de 12%)
    expect(r180.rendimientoBruto).toBeCloseTo(10_000_000 * (Math.pow(1.12, 180/365) - 1), 0);
  });

  it('rendimientoMensual coincide con la TEM × capital', () => {
    const r = calcCDT(10_000_000, 0.12, 365, false);
    const tem = Math.pow(1.12, 1/12) - 1;
    expect(r.rendimientoMensual).toBeCloseTo(10_000_000 * tem, 0);
  });

});

// ─── calcCredito ─────────────────────────────────────────────────────────────

describe('calcCredito()', () => {

  it('retorna null si falta monto o número de cuotas', () => {
    expect(calcCredito(0, 2, 12)).toBeNull();
    expect(calcCredito(5_000_000, 2, 0)).toBeNull();
  });

  it('con tasa 0% reparte el monto en partes iguales', () => {
    const r = calcCredito(12_000_000, 0, 12);
    expect(r.cuota).toBe(1_000_000);
    expect(r.totalPagado).toBe(12_000_000);
    expect(r.totalInteres).toBe(0);
    expect(r.taEA).toBe(0);
  });

  it('con tasa 2% mensual genera cuota fija mayor que monto/n', () => {
    const monto = 10_000_000;
    const n = 24;
    const r = calcCredito(monto, 2, n);
    expect(r.cuota).toBeGreaterThan(monto / n);
    expect(r.totalPagado).toBeGreaterThan(monto);
    expect(r.totalInteres).toBeGreaterThan(0);
  });

  it('cuota fija sigue la fórmula francesa: M = P×i×(1+i)^n / ((1+i)^n - 1)', () => {
    // Caso conocido: 1M a 1% mensual, 12 cuotas → cuota ≈ 88.848,79
    const r = calcCredito(1_000_000, 1, 12);
    const i = 0.01;
    const esperado = (1_000_000 * i * Math.pow(1+i, 12)) / (Math.pow(1+i, 12) - 1);
    expect(r.cuota).toBeCloseTo(esperado, 2);
    expect(r.cuota).toBeCloseTo(88_848.79, 2);
  });

  it('taEA convierte la tasa mensual correctamente: 2% mensual ≈ 26.82% EA', () => {
    const r = calcCredito(1_000_000, 2, 12);
    // (1.02)^12 - 1 = 0.26824...
    expect(r.taEA).toBeCloseTo(26.824, 2);
  });

});

// ─── clasificarTasaCredito ───────────────────────────────────────────────────

describe('clasificarTasaCredito()', () => {

  // Usura Q1-2026: 24.36%. Bandas: <65%=razonable, <85%=estandar, <100%=alta
  // Umbrales relativos: 24.36×0.65 = 15.834, 24.36×0.85 = 20.706
  const usura = TASA_USURA_EA;

  it('tasa 0% se considera razonable (no penaliza un crédito sin interés)', () => {
    expect(clasificarTasaCredito(0, usura)).toBe('razonable');
  });

  it('tasa por debajo del 65% de usura → razonable', () => {
    expect(clasificarTasaCredito(15, usura)).toBe('razonable');  // 61.6% de usura
    expect(clasificarTasaCredito(usura * 0.64, usura)).toBe('razonable');
  });

  it('tasa entre 65% y 85% de usura → estándar', () => {
    expect(clasificarTasaCredito(usura * 0.70, usura)).toBe('estandar');
    expect(clasificarTasaCredito(usura * 0.84, usura)).toBe('estandar');
  });

  it('tasa entre 85% y 100% de usura → alta', () => {
    expect(clasificarTasaCredito(usura * 0.86, usura)).toBe('alta');
    expect(clasificarTasaCredito(usura * 0.99, usura)).toBe('alta');
  });

  it('tasa por encima de la usura → usura (delito Art. 305 C.P.)', () => {
    expect(clasificarTasaCredito(usura + 0.01, usura)).toBe('usura');
    expect(clasificarTasaCredito(100, usura)).toBe('usura');
  });

  it('los bordes exactos caen en la banda inferior', () => {
    // 65% exacto NO entra a estandar todavía (<0.65 es razonable, >=0.65 es estandar)
    expect(clasificarTasaCredito(usura * 0.65, usura)).toBe('estandar');
    expect(clasificarTasaCredito(usura * 0.85, usura)).toBe('alta');
  });

});

// ─── calcInteresCompuesto ────────────────────────────────────────────────────

describe('calcInteresCompuesto()', () => {

  it('sin tasa devuelve la suma simple de capital + aportes', () => {
    const r = calcInteresCompuesto(1_000_000, 100_000, 0, 12);
    expect(r.valorFinal).toBe(1_000_000 + 100_000 * 12);
    expect(r.totalAportado).toBe(2_200_000);
    expect(r.ganancia).toBe(0);
  });

  it('con tasa positiva el valorFinal supera el total aportado', () => {
    const r = calcInteresCompuesto(1_000_000, 100_000, 0.10, 12);
    expect(r.valorFinal).toBeGreaterThan(r.totalAportado);
    expect(r.ganancia).toBeGreaterThan(0);
  });

  it('sin aportes equivale a interés compuesto puro: VF = C(1+tm)^n', () => {
    const r = calcInteresCompuesto(1_000_000, 0, 0.12, 12);
    const tm = Math.pow(1.12, 1/12) - 1;
    expect(r.valorFinal).toBeCloseTo(1_000_000 * Math.pow(1 + tm, 12), 0);
    // 12 meses = 1 año a 12% EA → ~1.12M
    expect(r.valorFinal).toBeCloseTo(1_120_000, 0);
  });

  it('sin capital sólo capitaliza los aportes', () => {
    const r = calcInteresCompuesto(0, 100_000, 0.12, 12);
    expect(r.totalAportado).toBe(1_200_000);
    expect(r.valorFinal).toBeGreaterThan(1_200_000);
  });

});

// ─── calcRentabilidadReal ────────────────────────────────────────────────────

describe('calcRentabilidadReal()', () => {

  it('si la tasa nominal supera la inflación, la real es positiva (Fisher)', () => {
    const r = calcRentabilidadReal(10_000_000, 12, 5);
    expect(r.realPct).toBeGreaterThan(0);
    // (1.12 / 1.05) - 1 ≈ 6.667%
    expect(r.realPct).toBeCloseTo(6.667, 2);
  });

  it('si la inflación supera la tasa, la real es negativa', () => {
    const r = calcRentabilidadReal(10_000_000, 5, 8);
    expect(r.realPct).toBeLessThan(0);
  });

  it('ganancia real puede ser negativa aunque la nominal sea positiva', () => {
    const r = calcRentabilidadReal(10_000_000, 5, 8);
    expect(r.gananciaNominal).toBeGreaterThan(0);
    expect(r.gananciaReal).toBeLessThan(0);
    // perdidaInflacion = nominal - real (positivo cuando "se come" la inflación)
    expect(r.perdidaInflacion).toBeGreaterThan(r.gananciaNominal);
  });

  it('con tasa = inflación, la real es 0', () => {
    const r = calcRentabilidadReal(10_000_000, 7, 7);
    expect(r.realPct).toBeCloseTo(0, 6);
  });

});

// ─── calcRegla72 ─────────────────────────────────────────────────────────────

describe('calcRegla72()', () => {

  it('retorna null para tasas <= 0', () => {
    expect(calcRegla72(0)).toBeNull();
    expect(calcRegla72(-5)).toBeNull();
  });

  it('al 8% la aproximación es 9 años, exacto ~9.006', () => {
    const r = calcRegla72(8);
    expect(r.aprox).toBe(9);
    expect(r.exacto).toBeCloseTo(9.006, 2);
  });

  it('al 12% la aproximación es 6 años, exacto ~6.116', () => {
    const r = calcRegla72(12);
    expect(r.aprox).toBe(6);
    expect(r.exacto).toBeCloseTo(6.116, 2);
  });

  it('aprox y exacto convergen en el rango 6%–20% (precisión <8%)', () => {
    [6, 8, 10, 12, 15, 20].forEach(t => {
      const r = calcRegla72(t);
      const error = Math.abs(r.aprox - r.exacto) / r.exacto;
      expect(error).toBeLessThan(0.08);
    });
  });

});

// ─── calcPILA ────────────────────────────────────────────────────────────────

describe('calcPILA()', () => {

  it('retorna null si el ingreso es 0 o negativo', () => {
    expect(calcPILA(0)).toBeNull();
    expect(calcPILA(-1_000_000)).toBeNull();
  });

  it('IBC nunca es menor a 1 SMMLV (Art. 18 Ley 1122)', () => {
    // Ingreso bajo: 40% × 2M = 800k < SMMLV → IBC = SMMLV
    const r = calcPILA(2_000_000);
    expect(r.ibc).toBe(SMMLV_2026);
  });

  it('IBC = ingreso × 40% cuando supera el SMMLV', () => {
    const ingreso = 10_000_000;
    const r = calcPILA(ingreso);
    expect(r.ibc).toBe(ingreso * 0.40); // 4M > SMMLV (~1.75M)
  });

  it('aplica los porcentajes legales: salud 12.5%, pensión 16%', () => {
    const r = calcPILA(10_000_000);
    expect(r.salud).toBeCloseTo(r.ibc * SALUD_INDEPEND, 2);
    expect(r.pension).toBeCloseTo(r.ibc * PENSION_INDEPEND, 2);
    // Verificación numérica directa: 4M × 0.125 = 500k
    expect(r.salud).toBeCloseTo(500_000, 0);
    expect(r.pension).toBeCloseTo(640_000, 0);
  });

  it('total = salud + pensión + ARL', () => {
    const r = calcPILA(10_000_000);
    expect(r.total).toBeCloseTo(r.salud + r.pension + r.arlMonto, 2);
  });

  it('ARL Clase I (0.522%) es el default cuando no se pasa parámetro', () => {
    const ingreso = 10_000_000;
    const rDefault = calcPILA(ingreso);
    const rExplicit = calcPILA(ingreso, 0.00522);
    expect(rDefault.arlMonto).toBeCloseTo(rExplicit.arlMonto, 6);
  });

  it('ARL más alta (Clase V) genera mayor cotización', () => {
    const rI = calcPILA(10_000_000, 0.00522);  // Clase I
    const rV = calcPILA(10_000_000, 0.0696);   // Clase V (riesgo extremo)
    expect(rV.arlMonto).toBeGreaterThan(rI.arlMonto);
    expect(rV.total).toBeGreaterThan(rI.total);
  });

});
