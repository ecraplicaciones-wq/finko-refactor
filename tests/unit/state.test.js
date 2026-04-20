// tests/unit/state.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { S, resetAppState } from '../../modules/core/state.js';

describe('resetAppState()', () => {

  beforeEach(() => {
    resetAppState();
  });

  it('inicializa ingreso en 0', () => {
    expect(S.ingreso).toBe(0);
  });

  it('inicializa gastos como array vacío', () => {
    expect(Array.isArray(S.gastos)).toBe(true);
    expect(S.gastos).toHaveLength(0);
  });

  it('inicializa bolsillos como array vacío', () => {
    expect(Array.isArray(S.bolsillos)).toBe(true);
    expect(S.bolsillos).toHaveLength(0);
  });

  it('inicializa logros con estructura correcta', () => {
    expect(S.logros).toBeDefined();
    expect(Array.isArray(S.logros.desbloqueados)).toBe(true);
    expect(Array.isArray(S.logros.vistos)).toBe(true);
    expect(typeof S.logros.rachas).toBe('object');
  });

  it('limpia datos previos al resetear', () => {
    S.ingreso = 5_000_000;
    S.gastos  = [{ id: 1, monto: 50000 }];
    S.logros  = { desbloqueados: ['primer_gasto'], vistos: [], rachas: {} };

    resetAppState();

    expect(S.ingreso).toBe(0);
    expect(S.gastos).toHaveLength(0);
    expect(S.logros.desbloqueados).toHaveLength(0);
  });

  it('fondoEmergencia tiene objetivoMeses 6 y actual 0', () => {
    expect(S.fondoEmergencia.objetivoMeses).toBe(6);
    expect(S.fondoEmergencia.actual).toBe(0);
  });

});