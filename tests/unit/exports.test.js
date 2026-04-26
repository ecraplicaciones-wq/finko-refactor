// tests/unit/exports.test.js
//
// Cobertura del dominio "exports" — específicamente la pura
// `calcularEstadoBackup` que decide si mostrar el banner de respaldo
// en el dashboard.
//
// Sin S, sin DOM. Solo argumentos → resultado.

import { describe, it, expect } from 'vitest';
import { calcularEstadoBackup } from '../../modules/dominio/exports.js';

// ─── calcularEstadoBackup ────────────────────────────────────────────────────

describe('calcularEstadoBackup()', () => {

  // ── BLOQUE: SIN BACKUP PREVIO ──────────────────────────────────────────────
  describe('cuando nunca se ha hecho backup', () => {
    it('lastBackupAt null → estado "nunca", mostrar true', () => {
      const r = calcularEstadoBackup(null, '2026-04-26');
      expect(r.estado).toBe('nunca');
      expect(r.mostrar).toBe(true);
      expect(r.diasDesde).toBe(null);
    });

    it('lastBackupAt undefined → estado "nunca", mostrar true', () => {
      const r = calcularEstadoBackup(undefined, '2026-04-26');
      expect(r.estado).toBe('nunca');
      expect(r.mostrar).toBe(true);
    });

    it('lastBackupAt cadena vacía → estado "nunca", mostrar true', () => {
      const r = calcularEstadoBackup('', '2026-04-26');
      expect(r.estado).toBe('nunca');
      expect(r.mostrar).toBe(true);
    });

    it('umbralDias se refleja en la salida', () => {
      const r = calcularEstadoBackup(null, '2026-04-26', 7);
      expect(r.umbralDias).toBe(7);
    });
  });

  // ── BLOQUE: BACKUP RECIENTE ────────────────────────────────────────────────
  describe('cuando el último backup es reciente', () => {
    it('backup hoy → estado "reciente", diasDesde 0, mostrar false', () => {
      const r = calcularEstadoBackup('2026-04-26', '2026-04-26');
      expect(r.estado).toBe('reciente');
      expect(r.diasDesde).toBe(0);
      expect(r.mostrar).toBe(false);
    });

    it('backup hace 1 día → reciente, mostrar false', () => {
      const r = calcularEstadoBackup('2026-04-25', '2026-04-26');
      expect(r.estado).toBe('reciente');
      expect(r.diasDesde).toBe(1);
      expect(r.mostrar).toBe(false);
    });

    it('backup hace 29 días con umbral 30 → reciente', () => {
      const r = calcularEstadoBackup('2026-03-28', '2026-04-26');
      expect(r.estado).toBe('reciente');
      expect(r.diasDesde).toBe(29);
      expect(r.mostrar).toBe(false);
    });

    it('backup hace 6 días con umbral 7 → reciente', () => {
      const r = calcularEstadoBackup('2026-04-20', '2026-04-26', 7);
      expect(r.estado).toBe('reciente');
      expect(r.mostrar).toBe(false);
    });
  });

  // ── BLOQUE: BACKUP VENCIDO ─────────────────────────────────────────────────
  describe('cuando el último backup está vencido', () => {
    it('exactamente en el umbral (30 días) → vencido, mostrar true', () => {
      // Frontera inclusiva: día 30 ya cuenta como vencido.
      const r = calcularEstadoBackup('2026-03-27', '2026-04-26');
      expect(r.estado).toBe('vencido');
      expect(r.diasDesde).toBe(30);
      expect(r.mostrar).toBe(true);
    });

    it('hace 60 días → vencido con diasDesde correcto', () => {
      const r = calcularEstadoBackup('2026-02-25', '2026-04-26');
      expect(r.estado).toBe('vencido');
      expect(r.diasDesde).toBe(60);
      expect(r.mostrar).toBe(true);
    });

    it('hace 365 días → vencido (más de un año)', () => {
      const r = calcularEstadoBackup('2025-04-26', '2026-04-26');
      expect(r.estado).toBe('vencido');
      expect(r.mostrar).toBe(true);
      expect(r.diasDesde).toBeGreaterThanOrEqual(365);
    });

    it('umbral custom 7 días: backup hace 8 días → vencido', () => {
      const r = calcularEstadoBackup('2026-04-18', '2026-04-26', 7);
      expect(r.estado).toBe('vencido');
      expect(r.mostrar).toBe(true);
    });
  });

  // ── BLOQUE: BORDES Y ROBUSTEZ ──────────────────────────────────────────────
  describe('casos borde y errores', () => {
    it('lastBackupAt en el futuro (clock skew) → "futuro", no mostrar', () => {
      // El usuario cambió la fecha del sistema o importó un backup futuro.
      // No tiene sentido nudgearlo: no es información accionable.
      const r = calcularEstadoBackup('2026-04-30', '2026-04-26');
      expect(r.estado).toBe('futuro');
      expect(r.mostrar).toBe(false);
    });

    it('hoyISO falsy → mostrar false (sin info para decidir)', () => {
      // Sin fecha actual no podemos calcular nada — mejor no mostrar nada.
      const r = calcularEstadoBackup('2026-01-01', null);
      expect(r.mostrar).toBe(false);
    });

    it('lastBackupAt con formato basura → tratado como nunca, mostrar', () => {
      const r = calcularEstadoBackup('not-a-date', '2026-04-26');
      expect(r.estado).toBe('nunca');
      expect(r.mostrar).toBe(true);
    });

    it('hoyISO con formato basura → tratado como nunca', () => {
      const r = calcularEstadoBackup('2026-01-01', 'invalid');
      expect(r.estado).toBe('nunca');
      expect(r.mostrar).toBe(true);
    });

    it('umbralDias negativo o 0 → cae al default 30', () => {
      const r1 = calcularEstadoBackup('2026-04-20', '2026-04-26', 0);
      const r2 = calcularEstadoBackup('2026-04-20', '2026-04-26', -5);
      expect(r1.umbralDias).toBe(30);
      expect(r2.umbralDias).toBe(30);
    });

    it('diasDesde nunca pisa el umbral cuando hay datos válidos', () => {
      // Sanity: con backup hace 30d y umbral 30, debe ser vencido.
      const v = calcularEstadoBackup('2026-03-27', '2026-04-26', 30);
      // Y con 29d, reciente. Cubrimos ambos lados de la frontera arriba.
      const r = calcularEstadoBackup('2026-03-28', '2026-04-26', 30);
      expect(v.mostrar).toBe(true);
      expect(r.mostrar).toBe(false);
    });
  });

  // ── BLOQUE: VALOR DE RETORNO ───────────────────────────────────────────────
  describe('forma del objeto devuelto', () => {
    it('siempre incluye las cuatro claves esperadas', () => {
      const r = calcularEstadoBackup('2026-04-20', '2026-04-26');
      expect(r).toHaveProperty('estado');
      expect(r).toHaveProperty('diasDesde');
      expect(r).toHaveProperty('mostrar');
      expect(r).toHaveProperty('umbralDias');
    });

    it('diasDesde es number en estados con backup, null cuando no hay', () => {
      const conBackup = calcularEstadoBackup('2026-04-20', '2026-04-26');
      const sinBackup = calcularEstadoBackup(null, '2026-04-26');
      expect(typeof conBackup.diasDesde).toBe('number');
      expect(sinBackup.diasDesde).toBe(null);
    });
  });

});
