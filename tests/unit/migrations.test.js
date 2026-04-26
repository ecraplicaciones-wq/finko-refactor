// tests/unit/migrations.test.js
import { describe, it, expect } from 'vitest';
import { CURRENT_VERSION } from '../../modules/core/storage.js';

// Simulamos la función _migrar replicando la lógica de storage.js
function _migrar(data, fromVersion) {
  let v = fromVersion || 0;
  const d = data;

  // ── v0 / v1 → v2: agregar gastosFijos y pagosAgendados ───────────────────
  if (v < 2) {
    if (!Array.isArray(d.gastosFijos))    d.gastosFijos    = [];
    if (!Array.isArray(d.pagosAgendados)) d.pagosAgendados = [];
    v = 2;
  }

  // ── v2 → v3: agregar inversiones y fondoEmergencia ────────────────────────
  if (v < 3) {
    if (!Array.isArray(d.inversiones))  d.inversiones = [];
    if (!d.fondoEmergencia || typeof d.fondoEmergencia !== 'object') {
      d.fondoEmergencia = { objetivoMeses: 6, actual: 0 };
    }
    // Normalizar deudas viejas: asegurar campo pagado numérico
    if (Array.isArray(d.deudas)) {
      d.deudas.forEach(deu => {
        if (typeof deu.pagado !== 'number') deu.pagado = 0;
        if (typeof deu.cuota  !== 'number') deu.cuota  = 0;
        if (typeof deu.total  !== 'number') deu.total  = 0;
      });
    }
    v = 3;
  }

  // ── v3 → v4: agregar bolsillos y logros ───────────────────────────────────
  if (v < 4) {
    if (!Array.isArray(d.bolsillos)) d.bolsillos = [];
    if (!d.logros || typeof d.logros !== 'object') {
      d.logros = { desbloqueados: [], vistos: [], rachas: {} };
    }
    // Normalizar gastos viejos: asegurar campos booleanos y deudaId
    if (Array.isArray(d.gastos)) {
      d.gastos.forEach(g => {
        if (typeof g.hormiga    !== 'boolean') g.hormiga    = g.tipo === 'hormiga';
        if (typeof g.cuatroXMil !== 'boolean') g.cuatroXMil = false;
        if (g.deudaId === undefined)           g.deudaId    = null;
      });
    }
    v = 4;
  }

  // ── v4 → v5: resetear saldos.banco si coincide con totalCtas ───────────────
  if (v < 5) {
    if (Array.isArray(d.cuentas) && d.cuentas.length > 0 && d.saldos) {
      const totalCtas = d.cuentas.reduce((s, c) => s + (c.saldo || 0), 0);
      if (Math.abs((d.saldos.banco || 0) - totalCtas) < 1) {
        d.saldos.banco = 0;
      }
    }
    v = 5;
  }

  // ── v5 → v6: agregar meDeben (R3 — préstamos a terceros) ──────────────────
  if (v < 6) {
    if (!Array.isArray(d.meDeben)) d.meDeben = [];
    v = 6;
  }

  // ── v6 → v7: agregar lastBackupAt (banner de respaldo cada 30 días) ──────
  if (v < 7) {
    if (typeof d.lastBackupAt === 'undefined') d.lastBackupAt = null;
    v = 7;
  }

  d._version = CURRENT_VERSION;
  return d;
}

describe('Migraciones de schema', () => {

  describe('v3 → v4', () => {
    it('agrega bolsillos array vacío', () => {
      const v3Data = { _version: 3, gastos: [] };
      const migrado = _migrar(v3Data, 3);
      expect(Array.isArray(migrado.bolsillos)).toBe(true);
      expect(migrado.bolsillos).toEqual([]);
    });

    it('agrega logros object con estructura', () => {
      const v3Data = { _version: 3 };
      const migrado = _migrar(v3Data, 3);
      expect(migrado.logros).toEqual({
        desbloqueados: [],
        vistos: [],
        rachas: {}
      });
    });

    it('normaliza gastos: agrega hormiga y cuatroXMil como booleano', () => {
      const v3Data = {
        _version: 3,
        gastos: [
          { tipo: 'hormiga', monto: 100 },
          { tipo: 'fijo', monto: 50, deudaId: 'id1' }
        ]
      };
      const migrado = _migrar(v3Data, 3);
      expect(migrado.gastos[0].hormiga).toBe(true);
      expect(migrado.gastos[0].cuatroXMil).toBe(false);
      expect(migrado.gastos[1].hormiga).toBe(false);
      expect(migrado.gastos[1].deudaId).toBe('id1');
    });

    it('asigna deudaId = null a gastos que no lo tienen', () => {
      const v3Data = {
        _version: 3,
        gastos: [{ tipo: 'normal', monto: 100 }]
      };
      const migrado = _migrar(v3Data, 3);
      expect(migrado.gastos[0].deudaId).toBe(null);
    });

    it('es idempotente: aplicar dos veces da el mismo resultado', () => {
      const v3Data = { _version: 3, gastos: [{ tipo: 'hormiga' }] };
      const migrado1 = _migrar(v3Data, 3);
      const migrado2 = _migrar({ ...migrado1 }, 4);
      expect(migrado2.bolsillos).toEqual(migrado1.bolsillos);
      expect(migrado2.logros).toEqual(migrado1.logros);
    });
  });

  describe('v4 → v5', () => {
    it('resetea saldos.banco a 0 si coincide con sum(cuentas.saldo)', () => {
      const v4Data = {
        _version: 4,
        cuentas: [
          { id: 'cta1', saldo: 500 },
          { id: 'cta2', saldo: 300 }
        ],
        saldos: { banco: 800 } // 500 + 300 = 800
      };
      const migrado = _migrar(v4Data, 4);
      expect(migrado.saldos.banco).toBe(0);
    });

    it('no toca saldos.banco si hay diferencia > 1', () => {
      const v4Data = {
        _version: 4,
        cuentas: [
          { id: 'cta1', saldo: 500 }
        ],
        saldos: { banco: 600 } // Diferencia = 100 (> 1)
      };
      const migrado = _migrar(v4Data, 4);
      expect(migrado.saldos.banco).toBe(600); // Sin cambios
    });

    it('maneja cuentas sin campo saldo', () => {
      const v4Data = {
        _version: 4,
        cuentas: [
          { id: 'cta1' }, // Sin saldo
          { id: 'cta2', saldo: 0 }
        ],
        saldos: { banco: 0 }
      };
      const migrado = _migrar(v4Data, 4);
      expect(migrado.saldos.banco).toBe(0);
    });
  });

  describe('v5 → v6', () => {
    it('agrega meDeben array vacío si no existe', () => {
      const v5Data = { _version: 5 };
      const migrado = _migrar(v5Data, 5);
      expect(Array.isArray(migrado.meDeben)).toBe(true);
      expect(migrado.meDeben).toEqual([]);
    });

    it('preserva meDeben preexistente sin pisar', () => {
      const v5Data = {
        _version: 5,
        meDeben: [
          { id: 1, persona: 'María', monto: 50_000, fecha: '2026-04-20' }
        ]
      };
      const migrado = _migrar(v5Data, 5);
      expect(migrado.meDeben).toHaveLength(1);
      expect(migrado.meDeben[0].persona).toBe('María');
    });

    it('reemplaza meDeben no-array con array vacío', () => {
      const v5Data = { _version: 5, meDeben: 'broken' };
      const migrado = _migrar(v5Data, 5);
      expect(Array.isArray(migrado.meDeben)).toBe(true);
      expect(migrado.meDeben).toEqual([]);
    });

    it('es idempotente: aplicar dos veces da el mismo resultado', () => {
      const v5Data = { _version: 5, meDeben: [{ id: 1, persona: 'X' }] };
      const m1 = _migrar(v5Data, 5);
      const m2 = _migrar({ ...m1, _version: 6 }, 6);
      expect(m2.meDeben).toEqual(m1.meDeben);
    });
  });

  describe('v6 → v7', () => {
    it('agrega lastBackupAt = null cuando no existe el campo', () => {
      const v6Data = { _version: 6 };
      const migrado = _migrar(v6Data, 6);
      expect(migrado.lastBackupAt).toBe(null);
      expect('lastBackupAt' in migrado).toBe(true);
    });

    it('preserva lastBackupAt preexistente sin pisarlo', () => {
      const v6Data = { _version: 6, lastBackupAt: '2026-04-10' };
      const migrado = _migrar(v6Data, 6);
      expect(migrado.lastBackupAt).toBe('2026-04-10');
    });

    it('preserva lastBackupAt explícitamente null sin sobreescribir', () => {
      // null ≠ undefined: si el usuario lo guardó como null, lo respetamos.
      const v6Data = { _version: 6, lastBackupAt: null };
      const migrado = _migrar(v6Data, 6);
      expect(migrado.lastBackupAt).toBe(null);
    });

    it('es idempotente: aplicar dos veces da el mismo resultado', () => {
      const v6Data = { _version: 6 };
      const m1 = _migrar(v6Data, 6);
      const m2 = _migrar({ ...m1, _version: 7 }, 7);
      expect(m2.lastBackupAt).toBe(m1.lastBackupAt);
    });
  });

  describe('legacy (sin _version) → CURRENT_VERSION', () => {
    it('migra estado sin _version desde v0 hasta CURRENT_VERSION', () => {
      const legacyData = {
        gastos: [{ tipo: 'normal', monto: 100 }],
        deudas: [{ id: 'd1', pagado: '50' }] // pagado como string
      };
      const migrado = _migrar(legacyData, undefined);

      // Verificar que llegó a versión actual
      expect(migrado._version).toBe(CURRENT_VERSION);

      // Verificar que se agregaron todos los campos intermedios
      expect(Array.isArray(migrado.gastosFijos)).toBe(true);
      expect(Array.isArray(migrado.pagosAgendados)).toBe(true);
      expect(Array.isArray(migrado.inversiones)).toBe(true);
      expect(migrado.fondoEmergencia).toEqual({
        objetivoMeses: 6,
        actual: 0
      });
      expect(Array.isArray(migrado.bolsillos)).toBe(true);
      expect(Array.isArray(migrado.meDeben)).toBe(true);
      expect(migrado.lastBackupAt).toBe(null);
      expect(migrado.logros).toEqual({
        desbloqueados: [],
        vistos: [],
        rachas: {}
      });

      // Verificar normalización de deudas
      expect(migrado.deudas[0].pagado).toBe(0); // Se normalizó de string a número
    });

    it('normalizando gastos en transición de legacy', () => {
      const legacyData = {
        gastos: [
          { tipo: 'hormiga', monto: 50 },
          { tipo: 'normal', monto: 100 }
        ]
      };
      const migrado = _migrar(legacyData, undefined);

      expect(migrado.gastos[0].hormiga).toBe(true);
      expect(migrado.gastos[1].hormiga).toBe(false);
      expect(migrado.gastos[0].deudaId).toBe(null);
      expect(migrado.gastos[1].deudaId).toBe(null);
    });
  });

});
