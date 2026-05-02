// tests/unit/storage.test.js
//
// Cobertura de la función pura `seleccionarMejorSnapshot` —
// la que decide cuál de los 3 snapshots rotativos usar como fallback
// cuando el JSON principal de localStorage está corrupto.
//
// Sin DOM, sin localStorage. Solo argumentos → resultado.

import { describe, it, expect } from 'vitest';
import {
  seleccionarMejorSnapshot,
  compactarHistorial,
  crearSnapshotUndo,
  validarSnapshotUndo,
  shouldFireUndoShortcut,
  normalizarObjetivos,
  UNDO_TTL_MS,
} from '../../modules/core/storage.js';

// Helper: arma un JSON serializado con los arrays mínimos para shape válida.
const validJson = (extra = {}) =>
  JSON.stringify({ gastos: [], cuentas: [], deudas: [], bolsillos: [], ...extra });

// ─── seleccionarMejorSnapshot ────────────────────────────────────────────────

describe('seleccionarMejorSnapshot()', () => {

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas que ni se intentan', () => {
    it('null → null', () => {
      expect(seleccionarMejorSnapshot(null)).toBe(null);
    });
    it('undefined → null', () => {
      expect(seleccionarMejorSnapshot(undefined)).toBe(null);
    });
    it('string → null', () => {
      expect(seleccionarMejorSnapshot('not an array')).toBe(null);
    });
    it('número → null', () => {
      expect(seleccionarMejorSnapshot(42)).toBe(null);
    });
    it('objeto plano → null', () => {
      expect(seleccionarMejorSnapshot({ json: validJson(), ts: 1 })).toBe(null);
    });
    it('array vacío → null', () => {
      expect(seleccionarMejorSnapshot([])).toBe(null);
    });
  });

  // ── BLOQUE: CANDIDATOS BASURA ──────────────────────────────────────────────
  describe('todos los candidatos son basura', () => {
    it('array de nulls → null', () => {
      expect(seleccionarMejorSnapshot([null, null, null])).toBe(null);
    });
    it('array de undefineds → null', () => {
      expect(seleccionarMejorSnapshot([undefined, undefined])).toBe(null);
    });
    it('candidatos sin campo json → null', () => {
      expect(seleccionarMejorSnapshot([{ ts: 1 }, { ts: 2 }])).toBe(null);
    });
    it('candidatos con json no-string → null', () => {
      expect(seleccionarMejorSnapshot([
        { json: 42, ts: 1 },
        { json: {}, ts: 2 },
      ])).toBe(null);
    });
    it('candidatos con json vacío → null', () => {
      expect(seleccionarMejorSnapshot([{ json: '', ts: 1 }])).toBe(null);
    });
    it('candidatos con JSON inválido → null', () => {
      expect(seleccionarMejorSnapshot([
        { json: 'not json', ts: 1 },
        { json: '{broken', ts: 2 },
      ])).toBe(null);
    });
    it('JSON válido pero null como root → null', () => {
      expect(seleccionarMejorSnapshot([{ json: 'null', ts: 1 }])).toBe(null);
    });
    it('JSON válido pero array como root → null', () => {
      expect(seleccionarMejorSnapshot([{ json: '[]', ts: 1 }])).toBe(null);
    });
    it('JSON válido pero string como root → null', () => {
      expect(seleccionarMejorSnapshot([{ json: '"hola"', ts: 1 }])).toBe(null);
    });
  });

  // ── BLOQUE: SHAPE MÍNIMA ───────────────────────────────────────────────────
  describe('validación de shape mínima', () => {
    it('objeto vacío {} → null (sin shape)', () => {
      expect(seleccionarMejorSnapshot([{ json: '{}', ts: 1 }])).toBe(null);
    });
    it('objeto sin arrays de dominio → null', () => {
      const json = JSON.stringify({ saldos: {}, _version: 7 });
      expect(seleccionarMejorSnapshot([{ json, ts: 1 }])).toBe(null);
    });
    it('campos como string en lugar de array → null', () => {
      const json = JSON.stringify({ gastos: 'no soy array', cuentas: 'tampoco' });
      expect(seleccionarMejorSnapshot([{ json, ts: 1 }])).toBe(null);
    });
    it('solo `gastos: []` → válido', () => {
      const json = JSON.stringify({ gastos: [] });
      expect(seleccionarMejorSnapshot([{ json, ts: 5 }])).not.toBe(null);
    });
    it('solo `cuentas: []` → válido', () => {
      const json = JSON.stringify({ cuentas: [] });
      expect(seleccionarMejorSnapshot([{ json, ts: 5 }])).not.toBe(null);
    });
    it('solo `deudas: []` → válido', () => {
      const json = JSON.stringify({ deudas: [] });
      expect(seleccionarMejorSnapshot([{ json, ts: 5 }])).not.toBe(null);
    });
    it('solo `bolsillos: []` → válido', () => {
      const json = JSON.stringify({ bolsillos: [] });
      expect(seleccionarMejorSnapshot([{ json, ts: 5 }])).not.toBe(null);
    });
    it('todos los arrays presentes → válido', () => {
      expect(seleccionarMejorSnapshot([{ json: validJson(), ts: 5 }])).not.toBe(null);
    });
  });

  // ── BLOQUE: SELECCIÓN POR TIMESTAMP ────────────────────────────────────────
  describe('selección entre múltiples válidos', () => {
    it('un solo candidato válido → ese', () => {
      const json = validJson();
      const r = seleccionarMejorSnapshot([{ json, ts: 100 }]);
      expect(r).not.toBe(null);
      expect(r.json).toBe(json);
      expect(r.ts).toBe(100);
    });

    it('dos válidos → el de mayor ts', () => {
      const a = validJson({ marker: 'A' });
      const b = validJson({ marker: 'B' });
      const r = seleccionarMejorSnapshot([
        { json: a, ts: 50 },
        { json: b, ts: 200 },
      ]);
      expect(r.parsed.marker).toBe('B');
      expect(r.ts).toBe(200);
    });

    it('tres válidos → el de mayor ts', () => {
      const a = validJson({ marker: 'A' });
      const b = validJson({ marker: 'B' });
      const c = validJson({ marker: 'C' });
      const r = seleccionarMejorSnapshot([
        { json: c, ts: 300 },
        { json: a, ts: 100 },
        { json: b, ts: 200 },
      ]);
      expect(r.parsed.marker).toBe('C');
    });

    it('inválidos junto a válidos → ignora los inválidos', () => {
      const buenoViejo   = validJson({ marker: 'old' });
      const buenoNuevo   = validJson({ marker: 'new' });
      const r = seleccionarMejorSnapshot([
        { json: 'basura',     ts: 999 },           // no parsea pero ts altísimo
        { json: '[]',         ts: 999 },           // root array
        { json: buenoViejo,   ts: 100 },
        { json: null,         ts: 999 },
        { json: buenoNuevo,   ts: 200 },
      ]);
      expect(r.parsed.marker).toBe('new');
      expect(r.ts).toBe(200);
    });

    it('ts ausente → tratado como 0', () => {
      const sin = validJson({ marker: 'sin-ts' });
      const con = validJson({ marker: 'con-ts' });
      const r = seleccionarMejorSnapshot([
        { json: sin },              // sin ts
        { json: con, ts: 1 },
      ]);
      expect(r.parsed.marker).toBe('con-ts');
    });

    it('ts no-numérico → tratado como 0', () => {
      const r = seleccionarMejorSnapshot([
        { json: validJson({ marker: 'A' }), ts: 'no-numero' },
        { json: validJson({ marker: 'B' }), ts: 5 },
      ]);
      expect(r.parsed.marker).toBe('B');
    });

    it('mismo ts → devuelve el primer válido encontrado', () => {
      const a = validJson({ marker: 'A' });
      const b = validJson({ marker: 'B' });
      const r = seleccionarMejorSnapshot([
        { json: a, ts: 100 },
        { json: b, ts: 100 },
      ]);
      expect(r.parsed.marker).toBe('A');
    });

    it('ts negativo → válido pero menor que 0', () => {
      const reciente = validJson({ marker: 'reciente' });
      const negativo = validJson({ marker: 'negativo' });
      const r = seleccionarMejorSnapshot([
        { json: negativo, ts: -1000 },
        { json: reciente, ts: 5 },
      ]);
      expect(r.parsed.marker).toBe('reciente');
    });
  });

  // ── BLOQUE: FORMA DEL VALOR DE RETORNO ─────────────────────────────────────
  describe('forma del objeto devuelto', () => {
    it('siempre incluye json, parsed, ts', () => {
      const r = seleccionarMejorSnapshot([{ json: validJson(), ts: 42 }]);
      expect(r).toHaveProperty('json');
      expect(r).toHaveProperty('parsed');
      expect(r).toHaveProperty('ts');
    });

    it('json es el string original sin alterar', () => {
      const original = validJson({ marker: 'original' });
      const r = seleccionarMejorSnapshot([{ json: original, ts: 1 }]);
      expect(r.json).toBe(original);
    });

    it('parsed es el objeto parseado', () => {
      const r = seleccionarMejorSnapshot([
        { json: validJson({ marker: 'parseme', extra: 7 }), ts: 1 },
      ]);
      expect(r.parsed.marker).toBe('parseme');
      expect(r.parsed.extra).toBe(7);
      expect(Array.isArray(r.parsed.gastos)).toBe(true);
    });

    it('ts es number', () => {
      const r = seleccionarMejorSnapshot([{ json: validJson(), ts: 99 }]);
      expect(typeof r.ts).toBe('number');
      expect(r.ts).toBe(99);
    });
  });

  // ── BLOQUE: ROBUSTEZ ───────────────────────────────────────────────────────
  describe('robustez frente a entradas raras', () => {
    it('mezcla con todas las variantes inválidas → encuentra el único válido', () => {
      const bueno = validJson({ marker: 'el bueno' });
      const r = seleccionarMejorSnapshot([
        null,
        undefined,
        { json: '' },
        { json: 'json basura', ts: 1 },
        { json: '{}', ts: 999 },                  // sin shape
        { json: 'null', ts: 999 },                // root null
        { json: '[]', ts: 999 },                  // root array
        { json: 'true', ts: 999 },                // root bool
        { json: bueno, ts: 50 },
      ]);
      expect(r).not.toBe(null);
      expect(r.parsed.marker).toBe('el bueno');
    });

    it('json muy largo (~100KB) → procesa sin trabarse', () => {
      const grande = validJson({ blob: 'x'.repeat(100_000) });
      const r = seleccionarMejorSnapshot([{ json: grande, ts: 1 }]);
      expect(r).not.toBe(null);
      expect(r.parsed.blob.length).toBe(100_000);
    });
  });

});

// ─── compactarHistorial ──────────────────────────────────────────────────────
//
// Compactación inteligente: fusiona los entries quincenales viejos del mismo
// mes en un único entry mensual. Los últimos N quincenales (default 6) quedan
// intactos para preservar las comparativas Q-vs-Q.

// Helper: arma un quincenal canónico. id determinístico para que los tests no
// dependan de Date.now().
const Q = (mes, q, extra = {}) => ({
  id: parseInt(mes.replace('-', '') + (q === 1 ? '01' : '02'), 10),
  periodo: `Q${q} ${mes}`,
  mes,
  ingreso: 1_000_000,
  gastado: 800_000,
  ahorro:  200_000,
  hormiga: 50_000,
  catMap: { comida: 300_000, transporte: 200_000 },
  ...extra,
});

describe('compactarHistorial()', () => {

  // ── BLOQUE: ENTRADAS INVÁLIDAS ───────────────────────────────────────────
  describe('entradas inválidas', () => {
    it('null → null', () => {
      expect(compactarHistorial(null)).toBe(null);
    });
    it('undefined → null', () => {
      expect(compactarHistorial(undefined)).toBe(null);
    });
    it('string → null', () => {
      expect(compactarHistorial('historial')).toBe(null);
    });
    it('número → null', () => {
      expect(compactarHistorial(42)).toBe(null);
    });
    it('objeto plano → null', () => {
      expect(compactarHistorial({ length: 0 })).toBe(null);
    });
    it('boolean → null', () => {
      expect(compactarHistorial(true)).toBe(null);
    });
  });

  // ── BLOQUE: CONFIG INVÁLIDO O LÍMITE ─────────────────────────────────────
  describe('config inválido o límite', () => {
    it('quincenalesProtegidos negativo → null', () => {
      expect(compactarHistorial([], { quincenalesProtegidos: -1 })).toBe(null);
    });
    it('quincenalesProtegidos NaN → usa default 6', () => {
      const hist = Array.from({ length: 8 }, (_, i) => Q('2026-04', 1, { id: i }));
      const r = compactarHistorial(hist, { quincenalesProtegidos: NaN });
      // 6 protegidos, 2 viejos del mismo mes → fusión a 1
      expect(r.despues).toBe(7);
    });
    it('quincenalesProtegidos = 0 → todo se considera viejo', () => {
      const hist = [Q('2026-04', 1), Q('2026-04', 2)];
      const r = compactarHistorial(hist, { quincenalesProtegidos: 0 });
      expect(r.despues).toBe(1);
      expect(r.compactado[0].compactado).toBe('mes');
      expect(r.compactado[0].n).toBe(2);
    });
    it('config = null → usa default', () => {
      const hist = Array.from({ length: 7 }, (_, i) => Q('2026-04', 1, { id: i }));
      const r = compactarHistorial(hist, null);
      expect(r).not.toBe(null);
      expect(r.despues).toBeLessThanOrEqual(hist.length);
    });
    it('config string → usa default', () => {
      const hist = Array.from({ length: 7 }, (_, i) => Q('2026-04', 1, { id: i }));
      const r = compactarHistorial(hist, 'invalido');
      expect(r).not.toBe(null);
    });
  });

  // ── BLOQUE: CASOS TRIVIALES ──────────────────────────────────────────────
  describe('casos triviales', () => {
    it('historial vacío → compactado vacío, reduccion 0', () => {
      const r = compactarHistorial([]);
      expect(r.compactado).toEqual([]);
      expect(r.antes).toBe(0);
      expect(r.despues).toBe(0);
      expect(r.reduccion).toBe(0);
      expect(r.mesesAgregados).toBe(0);
    });
    it('todos los entries dentro de la zona protegida → no compacta nada', () => {
      const hist = [Q('2026-04', 2), Q('2026-04', 1), Q('2026-03', 2)];
      const r = compactarHistorial(hist, { quincenalesProtegidos: 6 });
      expect(r.despues).toBe(3);
      expect(r.reduccion).toBe(0);
      expect(r.mesesAgregados).toBe(0);
      expect(r.compactado).toEqual(hist);
    });
    it('historial = exactamente N protegidos → no toca nada', () => {
      const hist = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: i }));
      const r = compactarHistorial(hist, { quincenalesProtegidos: 6 });
      expect(r.despues).toBe(6);
      expect(r.reduccion).toBe(0);
    });
    it('historial copiado, no es la misma referencia', () => {
      const hist = [Q('2026-04', 1)];
      const r = compactarHistorial(hist);
      expect(r.compactado).not.toBe(hist);
    });
  });

  // ── BLOQUE: COMPACTACIÓN BÁSICA ──────────────────────────────────────────
  describe('compactación básica', () => {
    it('dos quincenales del mismo mes viejo → 1 entry mensual', () => {
      // 6 protegidos + 2 quincenales viejos del mismo mes → 6 + 1 = 7
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const viejos     = [Q('2025-12', 2), Q('2025-12', 1)];
      const r = compactarHistorial([...protegidos, ...viejos], { quincenalesProtegidos: 6 });
      expect(r.despues).toBe(7);
      expect(r.mesesAgregados).toBe(1);
      expect(r.reduccion).toBe(1);
    });
    it('tres meses viejos × 2 quincenales = 3 entries mensuales', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const viejos = [
        Q('2025-12', 2), Q('2025-12', 1),
        Q('2025-11', 2), Q('2025-11', 1),
        Q('2025-10', 2), Q('2025-10', 1),
      ];
      const r = compactarHistorial([...protegidos, ...viejos]);
      expect(r.despues).toBe(9);          // 6 + 3
      expect(r.mesesAgregados).toBe(3);
      expect(r.reduccion).toBe(3);        // 6 viejos → 3 mensuales
    });
    it('mes viejo con un solo quincenal → se preserva tal cual (no fusión)', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const viejos = [Q('2025-12', 2)];   // un solo quincenal en zona vieja
      const r = compactarHistorial([...protegidos, ...viejos]);
      expect(r.mesesAgregados).toBe(0);   // nada que fusionar
      expect(r.reduccion).toBe(0);
      expect(r.compactado[6].periodo).toBe('Q2 2025-12');
      expect(r.compactado[6].compactado).toBeUndefined();
    });
    it('compactado tiene flag explícito y conteo n', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const viejos = [Q('2025-12', 2), Q('2025-12', 1)];
      const r = compactarHistorial([...protegidos, ...viejos]);
      const agg = r.compactado[6];
      expect(agg.compactado).toBe('mes');
      expect(agg.n).toBe(2);
      expect(agg.mes).toBe('2025-12');
      expect(agg.periodo).toBe('Dic/2025');
    });
  });

  // ── BLOQUE: PRESERVACIÓN DE TOTALES ──────────────────────────────────────
  describe('preservación de totales', () => {
    it('suma exacta de ingreso, gastado, ahorro, hormiga', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const a = Q('2025-12', 1, { ingreso: 1_500_000, gastado: 1_200_000, ahorro: 300_000, hormiga: 80_000 });
      const b = Q('2025-12', 2, { ingreso: 2_000_000, gastado: 1_700_000, ahorro: 300_000, hormiga: 60_000 });
      const r = compactarHistorial([...protegidos, a, b]);
      const agg = r.compactado[6];
      expect(agg.ingreso).toBe(3_500_000);
      expect(agg.gastado).toBe(2_900_000);
      expect(agg.ahorro).toBe(600_000);
      expect(agg.hormiga).toBe(140_000);
    });
    it('suma de catMap por categoría', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const a = Q('2025-12', 1, { catMap: { comida: 300_000, transporte: 200_000 } });
      const b = Q('2025-12', 2, { catMap: { comida: 400_000, ocio: 100_000 } });
      const r = compactarHistorial([...protegidos, a, b]);
      const agg = r.compactado[6];
      expect(agg.catMap).toEqual({
        comida:     700_000,
        transporte: 200_000,
        ocio:       100_000,
      });
    });
    it('id del agregado = max id de los originales', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const a = Q('2025-12', 1, { id: 100 });
      const b = Q('2025-12', 2, { id: 999 });
      const r = compactarHistorial([...protegidos, a, b]);
      expect(r.compactado[6].id).toBe(999);
    });
    it('categorías ausentes en uno de los entries no rompen la fusión', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const a = Q('2025-12', 1, { catMap: { comida: 100_000 } });
      const b = Q('2025-12', 2, { catMap: undefined });
      const r = compactarHistorial([...protegidos, a, b]);
      expect(r.compactado[6].catMap).toEqual({ comida: 100_000 });
    });
    it('valores numéricos no-finitos en sumas no contaminan totales', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const a = Q('2025-12', 1, { ingreso: 1_000_000 });
      const b = Q('2025-12', 2, { ingreso: NaN });
      const r = compactarHistorial([...protegidos, a, b]);
      expect(r.compactado[6].ingreso).toBe(1_000_000);
    });
  });

  // ── BLOQUE: ENTRIES CORRUPTOS EN LA ZONA VIEJA ────────────────────────────
  describe('entries corruptos en la zona vieja', () => {
    it('null en el array → se ignora', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const r = compactarHistorial([...protegidos, null, Q('2025-12', 1), Q('2025-12', 2)]);
      expect(r.mesesAgregados).toBe(1);
      expect(r.compactado.length).toBe(7);
    });
    it('undefined en el array → se ignora', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const r = compactarHistorial([...protegidos, undefined, Q('2025-12', 1), Q('2025-12', 2)]);
      expect(r.compactado.length).toBe(7);
    });
    it('mes inválido (formato) → entry preservado al final', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const malformado = Q('2025-12', 1, { mes: 'fecha rara' });
      const r = compactarHistorial([...protegidos, malformado]);
      // No se puede agregar; se preserva al final
      expect(r.compactado.includes(malformado)).toBe(true);
      expect(r.mesesAgregados).toBe(0);
    });
    it('mes ausente → entry preservado al final', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const sinMes = Q('2025-12', 1, { mes: undefined });
      const r = compactarHistorial([...protegidos, sinMes]);
      expect(r.compactado.includes(sinMes)).toBe(true);
    });
    it('mes formato YYYY-M (1 dígito) → tratado como inválido', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const malo = Q('2025-12', 1, { mes: '2025-9' });
      const r = compactarHistorial([...protegidos, malo]);
      expect(r.compactado.includes(malo)).toBe(true);
    });
  });

  // ── BLOQUE: ORDENAMIENTO ─────────────────────────────────────────────────
  describe('ordenamiento', () => {
    it('los protegidos quedan al principio en su orden original', () => {
      const protegidos = [
        Q('2026-04', 2, { id: 999 }),
        Q('2026-04', 1, { id: 888 }),
        Q('2026-03', 2, { id: 777 }),
        Q('2026-03', 1, { id: 666 }),
        Q('2026-02', 2, { id: 555 }),
        Q('2026-02', 1, { id: 444 }),
      ];
      const r = compactarHistorial([...protegidos, Q('2025-12', 1), Q('2025-12', 2)]);
      expect(r.compactado.slice(0, 6)).toEqual(protegidos);
    });
    it('compactos quedan ordenados por mes descendente', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const r = compactarHistorial([
        ...protegidos,
        Q('2024-06', 1), Q('2024-06', 2),
        Q('2025-12', 1), Q('2025-12', 2),
        Q('2025-03', 1), Q('2025-03', 2),
      ]);
      const meses = r.compactado.slice(6).map(c => c.mes);
      expect(meses).toEqual(['2025-12', '2025-03', '2024-06']);
    });
    it('entries sin mes quedan al final, después de los compactos', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const sinMes = Q('2024-06', 1, { mes: 'mal-formato' });
      const r = compactarHistorial([
        ...protegidos,
        Q('2025-12', 1), Q('2025-12', 2),
        sinMes,
      ]);
      expect(r.compactado[r.compactado.length - 1]).toBe(sinMes);
    });
  });

  // ── BLOQUE: FORMA DEL RETORNO ────────────────────────────────────────────
  describe('forma del retorno', () => {
    it('retorna keys exactas: compactado, antes, despues, reduccion, mesesAgregados', () => {
      const r = compactarHistorial([]);
      expect(Object.keys(r).sort()).toEqual(['antes', 'compactado', 'despues', 'mesesAgregados', 'reduccion']);
    });
    it('compactado es un Array', () => {
      const r = compactarHistorial([]);
      expect(Array.isArray(r.compactado)).toBe(true);
    });
    it('antes + reduccion = despues+ reduccion (consistencia)', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const r = compactarHistorial([...protegidos, Q('2025-12', 1), Q('2025-12', 2)]);
      expect(r.antes - r.reduccion).toBe(r.despues);
    });
    it('mesesAgregados <= reduccion', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const r = compactarHistorial([
        ...protegidos,
        Q('2025-12', 1), Q('2025-12', 2),
        Q('2025-11', 1), Q('2025-11', 2),
      ]);
      expect(r.mesesAgregados).toBeLessThanOrEqual(r.reduccion);
    });
  });

  // ── BLOQUE: LABEL DE MESES ───────────────────────────────────────────────
  describe('label del período compactado', () => {
    it('Enero 2025 → Ene/2025', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const r = compactarHistorial([...protegidos, Q('2025-01', 1), Q('2025-01', 2)]);
      expect(r.compactado[6].periodo).toBe('Ene/2025');
    });
    it('Diciembre 2024 → Dic/2024', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const r = compactarHistorial([...protegidos, Q('2024-12', 1), Q('2024-12', 2)]);
      expect(r.compactado[6].periodo).toBe('Dic/2024');
    });
    it('mes inválido (13) en grupo válido por regex pero mes inexistente', () => {
      // El regex /^\d{4}-\d{2}$/ acepta "2025-13". El _labelMesCompacto lo rechaza
      // y devuelve el string original.
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const a = Q('2025-12', 1, { mes: '2025-13' });
      const b = Q('2025-12', 2, { mes: '2025-13' });
      const r = compactarHistorial([...protegidos, a, b]);
      expect(r.compactado[6].periodo).toBe('2025-13');
    });
  });

  // ── BLOQUE: CASOS REALES Y ROBUSTEZ ──────────────────────────────────────
  describe('casos reales y robustez', () => {
    it('historial de 2 años (48 quincenales) reduce drásticamente con default', () => {
      const hist = [];
      // 2 años × 12 meses × 2 quincenales = 48
      for (let anio = 2026; anio >= 2025; anio--) {
        for (let m = 12; m >= 1; m--) {
          const mes = `${anio}-${String(m).padStart(2, '0')}`;
          hist.push(Q(mes, 2, { id: anio * 10000 + m * 100 + 2 }));
          hist.push(Q(mes, 1, { id: anio * 10000 + m * 100 + 1 }));
        }
      }
      const r = compactarHistorial(hist, { quincenalesProtegidos: 6 });
      // 6 protegidos + (48 - 6 = 42 viejos / 2 por mes = 21 meses) = 27
      expect(r.despues).toBe(27);
      expect(r.mesesAgregados).toBe(21);
      expect(r.reduccion).toBe(21);
    });
    it('historial vacío post-reset', () => {
      const r = compactarHistorial([]);
      expect(r.despues).toBe(0);
    });
    it('idempotente: compactar dos veces no cambia nada la segunda vez', () => {
      const protegidos = Array.from({ length: 6 }, (_, i) => Q('2026-04', 1, { id: 1000 + i }));
      const hist = [...protegidos, Q('2025-12', 1), Q('2025-12', 2), Q('2025-11', 1), Q('2025-11', 2)];
      const r1 = compactarHistorial(hist);
      const r2 = compactarHistorial(r1.compactado);
      expect(r2.reduccion).toBe(0);
      expect(r2.despues).toBe(r1.despues);
    });
    it('historial de 1000 entries (stress)', () => {
      const hist = [];
      for (let i = 0; i < 1000; i++) {
        const mes = `2020-${String((i % 12) + 1).padStart(2, '0')}`;
        hist.push(Q(mes, 1, { id: i }));
      }
      const r = compactarHistorial(hist, { quincenalesProtegidos: 6 });
      expect(r).not.toBe(null);
      expect(r.despues).toBeLessThan(hist.length);
    });
  });

});

// ─── crearSnapshotUndo / validarSnapshotUndo ─────────────────────────────────
//
// Cobertura de las dos funciones puras del sistema de undo de 1 paso.
// `crearSnapshotUndo` empaqueta `S → { json, label, ts }` aplicando defensas;
// `validarSnapshotUndo` verifica shape + parseabilidad + frescura (TTL).
// Sin localStorage, sin Date.now() — todo argumento explícito.

describe('crearSnapshotUndo()', () => {

  // ── BLOQUE: STATE INVÁLIDO ─────────────────────────────────────────────────
  describe('state inválido → null', () => {
    it('null', () => {
      expect(crearSnapshotUndo(null, 'Reset', 1_000_000)).toBe(null);
    });
    it('undefined', () => {
      expect(crearSnapshotUndo(undefined, 'Reset', 1_000_000)).toBe(null);
    });
    it('string', () => {
      expect(crearSnapshotUndo('foo', 'Reset', 1_000_000)).toBe(null);
    });
    it('número', () => {
      expect(crearSnapshotUndo(42, 'Reset', 1_000_000)).toBe(null);
    });
    it('array', () => {
      expect(crearSnapshotUndo([1, 2, 3], 'Reset', 1_000_000)).toBe(null);
    });
    it('objeto vacío {} → null (no tiene sentido undo de nada)', () => {
      expect(crearSnapshotUndo({}, 'Reset', 1_000_000)).toBe(null);
    });
  });

  // ── BLOQUE: LABEL INVÁLIDO ─────────────────────────────────────────────────
  describe('label inválido → null', () => {
    const state = { gastos: [{ id: 1 }] };
    it('label null', () => {
      expect(crearSnapshotUndo(state, null, 1_000_000)).toBe(null);
    });
    it('label undefined', () => {
      expect(crearSnapshotUndo(state, undefined, 1_000_000)).toBe(null);
    });
    it('label vacío', () => {
      expect(crearSnapshotUndo(state, '', 1_000_000)).toBe(null);
    });
    it('label numérico (no string)', () => {
      expect(crearSnapshotUndo(state, 123, 1_000_000)).toBe(null);
    });
  });

  // ── BLOQUE: TS INVÁLIDO ────────────────────────────────────────────────────
  describe('timestamp inválido → null', () => {
    const state = { gastos: [{ id: 1 }] };
    it('ts no número', () => {
      expect(crearSnapshotUndo(state, 'Reset', 'hoy')).toBe(null);
    });
    it('ts NaN', () => {
      expect(crearSnapshotUndo(state, 'Reset', NaN)).toBe(null);
    });
    it('ts cero', () => {
      expect(crearSnapshotUndo(state, 'Reset', 0)).toBe(null);
    });
    it('ts negativo', () => {
      expect(crearSnapshotUndo(state, 'Reset', -1)).toBe(null);
    });
    it('ts Infinity', () => {
      expect(crearSnapshotUndo(state, 'Reset', Infinity)).toBe(null);
    });
  });

  // ── BLOQUE: STATE NO SERIALIZABLE ──────────────────────────────────────────
  describe('JSON.stringify falla → null', () => {
    it('referencia circular → null', () => {
      const state = { gastos: [] };
      state.self = state;
      expect(crearSnapshotUndo(state, 'Reset', 1_000_000)).toBe(null);
    });
    it('BigInt en alguna prop → null', () => {
      const state = { gastos: [], n: BigInt(1) };
      expect(crearSnapshotUndo(state, 'Reset', 1_000_000)).toBe(null);
    });
  });

  // ── BLOQUE: HAPPY PATH ─────────────────────────────────────────────────────
  describe('happy path', () => {
    it('state mínimo + label + ts → snapshot completo', () => {
      const state = { gastos: [{ id: 1, monto: 5000 }] };
      const r = crearSnapshotUndo(state, 'Reset de quincena', 1_700_000_000_000);
      expect(r).not.toBe(null);
      expect(r.label).toBe('Reset de quincena');
      expect(r.ts).toBe(1_700_000_000_000);
      expect(typeof r.json).toBe('string');
      expect(JSON.parse(r.json)).toEqual(state);
    });
    it('state grande con todos los arrays de S', () => {
      const state = {
        gastos: [{ id: 1 }],
        cuentas: [{ id: 1, saldo: 100 }],
        deudas: [{ id: 1, total: 500 }],
        bolsillos: [{ id: 1 }],
        objetivos: [], historial: [], gastosFijos: [], pagosAgendados: [],
        inversiones: [], meDeben: [],
        saldos: { efectivo: 100, banco: 200 },
        ingreso: 1_000_000,
      };
      const r = crearSnapshotUndo(state, 'Importación', 1_700_000_000_000);
      expect(r.json.length).toBeGreaterThan(0);
      expect(JSON.parse(r.json).gastos).toEqual(state.gastos);
    });
    it('ts en string numérico se acepta (Number.isFinite(+ts))', () => {
      const r = crearSnapshotUndo({ gastos: [] }, 'Reset', '1700000000000');
      expect(r).not.toBe(null);
      expect(r.ts).toBe(1_700_000_000_000);
    });
    it('label con caracteres especiales se preserva', () => {
      const r = crearSnapshotUndo({ gastos: [] }, '↺ Reset 100% — ¿deshacer?', 1_000_000);
      expect(r.label).toBe('↺ Reset 100% — ¿deshacer?');
    });
  });

});

describe('validarSnapshotUndo()', () => {

  // Helper para armar un snapshot recién hecho. Por defecto trae shape válida.
  const mkSnap = (extra = {}) => ({
    json:  JSON.stringify({ gastos: [], ingreso: 1000 }),
    label: 'Reset de quincena',
    ts:    1_700_000_000_000,
    ...extra,
  });

  // ── BLOQUE: SHAPE INVÁLIDA ─────────────────────────────────────────────────
  describe('shape inválida → false', () => {
    it('null', () => {
      expect(validarSnapshotUndo(null, 1_700_000_000_000)).toBe(false);
    });
    it('undefined', () => {
      expect(validarSnapshotUndo(undefined, 1_700_000_000_000)).toBe(false);
    });
    it('string', () => {
      expect(validarSnapshotUndo('snap', 1_700_000_000_000)).toBe(false);
    });
    it('array', () => {
      expect(validarSnapshotUndo([1, 2, 3], 1_700_000_000_000)).toBe(false);
    });
    it('json no string', () => {
      expect(validarSnapshotUndo(mkSnap({ json: 123 }), 1_700_000_000_000)).toBe(false);
    });
    it('json vacío', () => {
      expect(validarSnapshotUndo(mkSnap({ json: '' }), 1_700_000_000_000)).toBe(false);
    });
    it('label vacío', () => {
      expect(validarSnapshotUndo(mkSnap({ label: '' }), 1_700_000_000_000)).toBe(false);
    });
    it('label no string', () => {
      expect(validarSnapshotUndo(mkSnap({ label: 42 }), 1_700_000_000_000)).toBe(false);
    });
    it('ts cero', () => {
      expect(validarSnapshotUndo(mkSnap({ ts: 0 }), 1_700_000_000_000)).toBe(false);
    });
    it('ts negativo', () => {
      expect(validarSnapshotUndo(mkSnap({ ts: -100 }), 1_700_000_000_000)).toBe(false);
    });
    it('ts NaN', () => {
      expect(validarSnapshotUndo(mkSnap({ ts: NaN }), 1_700_000_000_000)).toBe(false);
    });
  });

  // ── BLOQUE: NOW INVÁLIDO ───────────────────────────────────────────────────
  describe('nowMs inválido → false', () => {
    it('nowMs no número', () => {
      expect(validarSnapshotUndo(mkSnap(), 'ahora')).toBe(false);
    });
    it('nowMs NaN', () => {
      expect(validarSnapshotUndo(mkSnap(), NaN)).toBe(false);
    });
    it('nowMs Infinity', () => {
      expect(validarSnapshotUndo(mkSnap(), Infinity)).toBe(false);
    });
  });

  // ── BLOQUE: TTL ────────────────────────────────────────────────────────────
  describe('cómputo de TTL', () => {
    it('snap recién creado (delta 0) → válido', () => {
      const ts = 1_700_000_000_000;
      expect(validarSnapshotUndo(mkSnap({ ts }), ts)).toBe(true);
    });
    it('snap creado hace 5 min → válido (dentro del default 10 min)', () => {
      const ts = 1_700_000_000_000;
      const now = ts + 5 * 60 * 1000;
      expect(validarSnapshotUndo(mkSnap({ ts }), now)).toBe(true);
    });
    it('snap exactamente en el borde del TTL (delta = TTL) → válido', () => {
      const ts = 1_700_000_000_000;
      const now = ts + UNDO_TTL_MS;
      expect(validarSnapshotUndo(mkSnap({ ts }), now)).toBe(true);
    });
    it('snap apenas pasado el TTL (delta = TTL+1) → caducado', () => {
      const ts = 1_700_000_000_000;
      const now = ts + UNDO_TTL_MS + 1;
      expect(validarSnapshotUndo(mkSnap({ ts }), now)).toBe(false);
    });
    it('snap muy viejo (24h) → caducado', () => {
      const ts = 1_700_000_000_000;
      const now = ts + 24 * 60 * 60 * 1000;
      expect(validarSnapshotUndo(mkSnap({ ts }), now)).toBe(false);
    });
    it('snap con ts en el futuro (clock skew) → válido (no invalidamos)', () => {
      const now = 1_700_000_000_000;
      const ts  = now + 60_000;
      expect(validarSnapshotUndo(mkSnap({ ts }), now)).toBe(true);
    });
    it('TTL custom respetado: ttlMs=1000 invalida snap de hace 2s', () => {
      const ts  = 1_700_000_000_000;
      const now = ts + 2000;
      expect(validarSnapshotUndo(mkSnap({ ts }), now, 1000)).toBe(false);
    });
    it('TTL custom respetado: ttlMs=10000 mantiene válido snap de hace 2s', () => {
      const ts  = 1_700_000_000_000;
      const now = ts + 2000;
      expect(validarSnapshotUndo(mkSnap({ ts }), now, 10_000)).toBe(true);
    });
    it('ttlMs inválido → fallback al default UNDO_TTL_MS', () => {
      const ts  = 1_700_000_000_000;
      const now = ts + 5 * 60 * 1000;  // dentro de 10 min default
      expect(validarSnapshotUndo(mkSnap({ ts }), now, 'no')).toBe(true);
    });
    it('ttlMs negativo → fallback al default UNDO_TTL_MS', () => {
      const ts  = 1_700_000_000_000;
      const now = ts + 5 * 60 * 1000;
      expect(validarSnapshotUndo(mkSnap({ ts }), now, -1)).toBe(true);
    });
  });

  // ── BLOQUE: JSON CORRUPTO ──────────────────────────────────────────────────
  describe('json no parseable o shape no objeto → false', () => {
    it('json malformado', () => {
      expect(validarSnapshotUndo(mkSnap({ json: '{not json' }), 1_700_000_000_000)).toBe(false);
    });
    it('json parseable a array', () => {
      expect(validarSnapshotUndo(mkSnap({ json: '[1,2,3]' }), 1_700_000_000_000)).toBe(false);
    });
    it('json parseable a string', () => {
      expect(validarSnapshotUndo(mkSnap({ json: '"hola"' }), 1_700_000_000_000)).toBe(false);
    });
    it('json parseable a número', () => {
      expect(validarSnapshotUndo(mkSnap({ json: '42' }), 1_700_000_000_000)).toBe(false);
    });
    it('json parseable a null', () => {
      expect(validarSnapshotUndo(mkSnap({ json: 'null' }), 1_700_000_000_000)).toBe(false);
    });
    it('json parseable a objeto vacío {} → válido (objeto plano cuenta)', () => {
      expect(validarSnapshotUndo(mkSnap({ json: '{}' }), 1_700_000_000_000)).toBe(true);
    });
  });

  // ── BLOQUE: HAPPY PATH ─────────────────────────────────────────────────────
  describe('happy path', () => {
    it('snap completo con state grande', () => {
      const json = JSON.stringify({
        gastos: [{ id: 1 }], deudas: [], cuentas: [], bolsillos: [],
        saldos: { efectivo: 100, banco: 200 }, ingreso: 1_000_000,
      });
      const ts  = 1_700_000_000_000;
      const now = ts + 60_000;
      expect(validarSnapshotUndo({ json, label: 'Reset', ts }, now)).toBe(true);
    });
    it('snap creado por crearSnapshotUndo() valida bien', () => {
      const ts = 1_700_000_000_000;
      const snap = crearSnapshotUndo({ gastos: [{ id: 1 }], ingreso: 5000 }, 'Test', ts);
      expect(validarSnapshotUndo(snap, ts + 1000)).toBe(true);
    });
  });

});

// ─── shouldFireUndoShortcut ──────────────────────────────────────────────────
//
// Pure helper que decide si Ctrl+Z (o Cmd+Z) dispara el undo. Aísla toda la
// lógica de guards del listener real para poder testear cada condición sin
// montar un DOM de prueba ni eventos de teclado.

describe('shouldFireUndoShortcut()', () => {

  // Helper: contexto base que dispara (Ctrl+z, target div, sin modal).
  const ctx = (over = {}) => ({
    key: 'z',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    targetTag: 'DIV',
    targetIsContentEditable: false,
    modalOpen: false,
    ...over,
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('contexto inválido → false', () => {
    it('null', () => {
      expect(shouldFireUndoShortcut(null)).toBe(false);
    });
    it('undefined', () => {
      expect(shouldFireUndoShortcut(undefined)).toBe(false);
    });
    it('string o número', () => {
      expect(shouldFireUndoShortcut('z')).toBe(false);
      expect(shouldFireUndoShortcut(42)).toBe(false);
    });
    it('array', () => {
      expect(shouldFireUndoShortcut(['z'])).toBe(false);
    });
  });

  // ── BLOQUE: TECLA ──────────────────────────────────────────────────────────
  describe('tecla', () => {
    it("'z' minúscula → true", () => {
      expect(shouldFireUndoShortcut(ctx({ key: 'z' }))).toBe(true);
    });
    it("'Z' mayúscula (caps lock) → true (case insensitive)", () => {
      expect(shouldFireUndoShortcut(ctx({ key: 'Z' }))).toBe(true);
    });
    it("otra tecla → false", () => {
      expect(shouldFireUndoShortcut(ctx({ key: 'a' }))).toBe(false);
      expect(shouldFireUndoShortcut(ctx({ key: 'y' }))).toBe(false);
      expect(shouldFireUndoShortcut(ctx({ key: 'Enter' }))).toBe(false);
    });
    it("key vacío o no string → false", () => {
      expect(shouldFireUndoShortcut(ctx({ key: '' }))).toBe(false);
      expect(shouldFireUndoShortcut(ctx({ key: undefined }))).toBe(false);
      expect(shouldFireUndoShortcut(ctx({ key: 90 }))).toBe(false); // keyCode no aplica
    });
  });

  // ── BLOQUE: MODIFICADORES ──────────────────────────────────────────────────
  describe('modificadores', () => {
    it('Ctrl+Z (Windows/Linux) → true', () => {
      expect(shouldFireUndoShortcut(ctx({ ctrlKey: true, metaKey: false }))).toBe(true);
    });
    it('Cmd+Z (Mac) → true', () => {
      expect(shouldFireUndoShortcut(ctx({ ctrlKey: false, metaKey: true }))).toBe(true);
    });
    it('z solo, sin modificador → false', () => {
      expect(shouldFireUndoShortcut(ctx({ ctrlKey: false, metaKey: false }))).toBe(false);
    });
    it('Shift+Ctrl+Z (redo) → false', () => {
      expect(shouldFireUndoShortcut(ctx({ shiftKey: true }))).toBe(false);
    });
    it('Shift+Cmd+Z (redo Mac) → false', () => {
      expect(shouldFireUndoShortcut(ctx({ ctrlKey: false, metaKey: true, shiftKey: true }))).toBe(false);
    });
    it('Alt+Ctrl+Z (combo raro) → true (no nos preocupa Alt)', () => {
      // Alt no se contempla en los guards; solo Shift es bloqueante por la
      // colisión con redo. Si en el futuro hay un atajo Alt+Ctrl+Z, ajustar.
      expect(shouldFireUndoShortcut({ ...ctx(), altKey: true })).toBe(true);
    });
  });

  // ── BLOQUE: TARGET EDITABLE ────────────────────────────────────────────────
  describe('target editable bloquea', () => {
    it("INPUT → false (preserva undo nativo del campo)", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'INPUT' }))).toBe(false);
    });
    it("TEXTAREA → false", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'TEXTAREA' }))).toBe(false);
    });
    it("SELECT → false", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'SELECT' }))).toBe(false);
    });
    it("input minúscula también bloquea (case insensitive)", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'input' }))).toBe(false);
    });
    it("contenteditable bloquea aunque tag sea DIV", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'DIV', targetIsContentEditable: true }))).toBe(false);
    });
    it("BUTTON → true (no es campo de texto)", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'BUTTON' }))).toBe(true);
    });
    it("BODY → true", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'BODY' }))).toBe(true);
    });
    it("targetTag undefined → tratado como no-editable (true)", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: undefined }))).toBe(true);
    });
  });

  // ── BLOQUE: MODAL ABIERTO ──────────────────────────────────────────────────
  describe('modal abierto bloquea', () => {
    it("modalOpen: true → false", () => {
      expect(shouldFireUndoShortcut(ctx({ modalOpen: true }))).toBe(false);
    });
    it("modalOpen: false → true", () => {
      expect(shouldFireUndoShortcut(ctx({ modalOpen: false }))).toBe(true);
    });
    it("modalOpen ausente → tratado como false (true)", () => {
      const c = ctx();
      delete c.modalOpen;
      expect(shouldFireUndoShortcut(c)).toBe(true);
    });
  });

  // ── BLOQUE: COMBINACIONES ──────────────────────────────────────────────────
  describe('combinaciones realistas', () => {
    it("usuario tipea 'z' en un input sin Ctrl → false (key sin modifier)", () => {
      expect(shouldFireUndoShortcut(ctx({
        targetTag: 'INPUT', ctrlKey: false, metaKey: false,
      }))).toBe(false);
    });
    it("usuario tipea Ctrl+Z mientras edita el campo nombre → false (input)", () => {
      expect(shouldFireUndoShortcut(ctx({ targetTag: 'INPUT' }))).toBe(false);
    });
    it("usuario presiona Ctrl+Z viendo el dashboard sin modal → true", () => {
      expect(shouldFireUndoShortcut(ctx())).toBe(true);
    });
    it("usuario presiona Ctrl+Z con modal abierto → false (no romper contexto)", () => {
      expect(shouldFireUndoShortcut(ctx({ modalOpen: true }))).toBe(false);
    });
    it("Ctrl+Shift+Z viendo el dashboard → false (es redo, no undo)", () => {
      expect(shouldFireUndoShortcut(ctx({ shiftKey: true }))).toBe(false);
    });
  });

});

// ─── normalizarObjetivos ────────────────────────────────────────────────────
//
// Normalización defensiva de objetivos en loadData(). Corrige inconsistencias
// silenciosamente: ahorrado > objetivo, gastos negativos, NaN, tipos inválidos, etc.

// Helper: construye un objetivo mínimo con overrides.
const Obj = (overrides = {}) => ({
  id: Date.now(),
  nombre: 'Objetivo test',
  tipo: 'ahorro',
  icono: '🎯',
  fecha: '',
  objetivoAhorro: 1_000_000,
  ahorrado: 0,
  presupuesto: 0,
  gastado: 0,
  gastos: [],
  ...overrides,
});

describe('normalizarObjetivos()', () => {

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas', () => {
    it('null → []', () => {
      expect(normalizarObjetivos(null)).toEqual([]);
    });
    it('undefined → []', () => {
      expect(normalizarObjetivos(undefined)).toEqual([]);
    });
    it('no-array (string) → []', () => {
      expect(normalizarObjetivos('no soy array')).toEqual([]);
    });
    it('no-array (número) → []', () => {
      expect(normalizarObjetivos(42)).toEqual([]);
    });
    it('no-array (objeto) → []', () => {
      expect(normalizarObjetivos({ length: 1 })).toEqual([]);
    });
    it('array vacío → []', () => {
      expect(normalizarObjetivos([])).toEqual([]);
    });
  });

  // ── BLOQUE: NORMALIZACIÓN DE TIPOS ─────────────────────────────────────────
  describe('normalización de tipos', () => {
    it('tipo=ahorro → presupuesto y gastado → 0', () => {
      const r = normalizarObjetivos([Obj({ tipo: 'ahorro', presupuesto: 50000, gastado: 10000 })]);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('ahorro');
      expect(r[0].presupuesto).toBe(0);
      expect(r[0].gastado).toBe(0);
    });
    it('tipo=evento → ahorrado → 0', () => {
      const r = normalizarObjetivos([Obj({ tipo: 'evento', ahorrado: 500000 })]);
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('evento');
      expect(r[0].ahorrado).toBe(0);
    });
    it('tipo inválido → fallback ahorro', () => {
      const r = normalizarObjetivos([Obj({ tipo: 'invalid' })]);
      expect(r[0].tipo).toBe('ahorro');
    });
    it('tipo no-string → fallback ahorro', () => {
      const r = normalizarObjetivos([Obj({ tipo: 123 })]);
      expect(r[0].tipo).toBe('ahorro');
    });
  });

  // ── BLOQUE: VALIDACIÓN DE MONTOS ───────────────────────────────────────────
  describe('validación de montos', () => {
    it('ahorrado > objetivoAhorro → capeado a objetivo', () => {
      const r = normalizarObjetivos([Obj({ ahorrado: 5_000_000, objetivoAhorro: 2_000_000 })]);
      expect(r[0].ahorrado).toBe(2_000_000);
    });
    it('ahorrado < 0 → 0', () => {
      const r = normalizarObjetivos([Obj({ ahorrado: -100_000 })]);
      expect(r[0].ahorrado).toBe(0);
    });
    it('objetivoAhorro < 0 → 0', () => {
      const r = normalizarObjetivos([Obj({ objetivoAhorro: -500_000 })]);
      expect(r[0].objetivoAhorro).toBe(0);
    });
    it('gastado < 0 (evento) → 0', () => {
      const r = normalizarObjetivos([Obj({ tipo: 'evento', gastado: -100_000 })]);
      expect(r[0].gastado).toBe(0);
    });
    it('presupuesto < 0 (evento) → 0', () => {
      const r = normalizarObjetivos([Obj({ tipo: 'evento', presupuesto: -100_000 })]);
      expect(r[0].presupuesto).toBe(0);
    });
    it('gastado > presupuesto (evento) → permitido', () => {
      const r = normalizarObjetivos([Obj({ tipo: 'evento', presupuesto: 100_000, gastado: 150_000 })]);
      expect(r[0].gastado).toBe(150_000);
      expect(r[0].presupuesto).toBe(100_000);
    });
  });

  // ── BLOQUE: CAMPOS STRING ──────────────────────────────────────────────────
  describe('campos string', () => {
    it('nombre vacío → "Sin nombre"', () => {
      const r = normalizarObjetivos([Obj({ nombre: '' })]);
      expect(r[0].nombre).toBe('Sin nombre');
    });
    it('nombre null → "Sin nombre"', () => {
      const r = normalizarObjetivos([Obj({ nombre: null })]);
      expect(r[0].nombre).toBe('Sin nombre');
    });
    it('nombre con espacios → trimmed', () => {
      const r = normalizarObjetivos([Obj({ nombre: '  Viaje a Tokyo  ' })]);
      expect(r[0].nombre).toBe('Viaje a Tokyo');
    });
    it('icono vacío → "🎯"', () => {
      const r = normalizarObjetivos([Obj({ icono: '' })]);
      expect(r[0].icono).toBe('🎯');
    });
    it('icono null → "🎯"', () => {
      const r = normalizarObjetivos([Obj({ icono: null })]);
      expect(r[0].icono).toBe('🎯');
    });
    it('icono no-emoji → permitido (keep as-is)', () => {
      const r = normalizarObjetivos([Obj({ icono: '★' })]);
      expect(r[0].icono).toBe('★');
    });
  });

  // ── BLOQUE: ID Y FECHA ─────────────────────────────────────────────────────
  describe('id y fechas', () => {
    it('id válido → preservado', () => {
      const r = normalizarObjetivos([Obj({ id: 12345 })]);
      expect(r[0].id).toBe(12345);
    });
    it('id null → Date.now() como fallback', () => {
      const before = Date.now();
      const r = normalizarObjetivos([Obj({ id: null })]);
      const after = Date.now();
      expect(r[0].id).toBeGreaterThanOrEqual(before);
      expect(r[0].id).toBeLessThanOrEqual(after);
    });
    it('id undefined → Date.now() como fallback', () => {
      const before = Date.now();
      const r = normalizarObjetivos([Obj({ id: undefined })]);
      const after = Date.now();
      expect(r[0].id).toBeGreaterThanOrEqual(before);
    });
    it('id string numérico → Math.floor()', () => {
      const r = normalizarObjetivos([Obj({ id: '12345.7' })]);
      expect(r[0].id).toBe(12345);
    });
    it('fechaUltimoAporte válida → preservada', () => {
      const r = normalizarObjetivos([Obj({ fechaUltimoAporte: '2026-05-02' })]);
      expect(r[0].fechaUltimoAporte).toBe('2026-05-02');
    });
    it('fechaUltimoAporte formato inválido → undefined', () => {
      const r = normalizarObjetivos([Obj({ fechaUltimoAporte: 'no-es-fecha' })]);
      expect(r[0].fechaUltimoAporte).toBeUndefined();
    });
    it('fechaUltimoAporte null → undefined', () => {
      const r = normalizarObjetivos([Obj({ fechaUltimoAporte: null })]);
      expect(r[0].fechaUltimoAporte).toBeUndefined();
    });
  });

  // ── BLOQUE: ARRAYS ─────────────────────────────────────────────────────────
  describe('arrays', () => {
    it('gastos null → []', () => {
      const r = normalizarObjetivos([Obj({ gastos: null })]);
      expect(r[0].gastos).toEqual([]);
    });
    it('gastos no-array → []', () => {
      const r = normalizarObjetivos([Obj({ gastos: 'no soy array' })]);
      expect(r[0].gastos).toEqual([]);
    });
    it('gastos array válido → preservado', () => {
      const gastos = [{ id: 1, monto: 50000 }, { id: 2, monto: 30000 }];
      const r = normalizarObjetivos([Obj({ gastos })]);
      expect(r[0].gastos).toEqual(gastos);
    });
  });

  // ── BLOQUE: NaN E INDEFINIDOS ──────────────────────────────────────────────
  describe('NaN e indefinidos', () => {
    it('ahorrado = NaN → 0', () => {
      const r = normalizarObjetivos([Obj({ ahorrado: NaN })]);
      expect(r[0].ahorrado).toBe(0);
    });
    it('objetivoAhorro = undefined → 0', () => {
      const r = normalizarObjetivos([Obj({ objetivoAhorro: undefined })]);
      expect(r[0].objetivoAhorro).toBe(0);
    });
    it('gastado = NaN (evento) → 0', () => {
      const r = normalizarObjetivos([Obj({ tipo: 'evento', gastado: NaN })]);
      expect(r[0].gastado).toBe(0);
    });
  });

  // ── BLOQUE: ROBUSTEZ GENERAL ───────────────────────────────────────────────
  describe('robustez general', () => {
    it('objetivo malformado (null) en array → ignorado', () => {
      const r = normalizarObjetivos([Obj(), null, Obj()]);
      expect(r).toHaveLength(2);
    });
    it('objetivo sin campos críticos → fallbacks aplicados', () => {
      const r = normalizarObjetivos([{}]);
      expect(r).toHaveLength(1);
      expect(r[0].nombre).toBe('Sin nombre');
      expect(r[0].tipo).toBe('ahorro');
      expect(r[0].icono).toBe('🎯');
      expect(r[0].gastos).toEqual([]);
    });
    it('mix de válidos + inválidos → solo válidos normalizados', () => {
      const r = normalizarObjetivos([
        Obj({ nombre: 'Válido 1' }),
        null,
        Obj({ nombre: 'Válido 2' }),
        'basura',
        Obj({ nombre: 'Válido 3', ahorrado: 5_000_000, objetivoAhorro: 1_000_000 }),
      ]);
      expect(r).toHaveLength(3);
      expect(r[0].nombre).toBe('Válido 1');
      expect(r[1].nombre).toBe('Válido 2');
      expect(r[2].nombre).toBe('Válido 3');
      expect(r[2].ahorrado).toBe(1_000_000);  // capeado
    });
  });

  // ── BLOQUE: DETERMINISMO E IDEMPOTENCIA ────────────────────────────────────
  describe('determinismo e idempotencia', () => {
    it('misma entrada → mismo output (fields en orden)', () => {
      const orig = Obj({ ahorrado: 5_000_000, objetivoAhorro: 2_000_000 });
      const r1 = normalizarObjetivos([orig]);
      const r2 = normalizarObjetivos([orig]);
      expect(r1[0]).toEqual(r2[0]);
    });
    it('no muta input original', () => {
      const orig = Obj({ ahorrado: 5_000_000, objetivoAhorro: 2_000_000 });
      const origCopy = JSON.parse(JSON.stringify(orig));
      normalizarObjetivos([orig]);
      expect(orig).toEqual(origCopy);
    });
    it('aplicar 2 veces = 1 vez (idempotencia)', () => {
      const orig = Obj({ ahorrado: 5_000_000, objetivoAhorro: 2_000_000 });
      const r1 = normalizarObjetivos([orig]);
      const r2 = normalizarObjetivos(r1);
      expect(r1[0]).toEqual(r2[0]);
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales de corrupción', () => {
    it('objetivo importado pre-v8 con ahorrado > objetivo', () => {
      const r = normalizarObjetivos([
        {
          id: 1234567890,
          nombre: 'Carro',
          tipo: 'ahorro',
          icono: '🚗',
          fecha: '2025-01-01',
          objetivoAhorro: 10_000_000,
          ahorrado: 12_000_000,  // ¡sobre-ahorrado!
          presupuesto: undefined,
          gastado: undefined,
          gastos: undefined,
        },
      ]);
      expect(r[0].ahorrado).toBe(10_000_000);
      expect(r[0].presupuesto).toBe(0);
      expect(r[0].gastado).toBe(0);
      expect(r[0].gastos).toEqual([]);
    });

    it('objetivo editado en DevTools con valores negativos', () => {
      const r = normalizarObjetivos([
        {
          id: 9999,
          nombre: '  Viaje  ',
          tipo: 'evento',
          icono: '✈️',
          fecha: '',
          objetivoAhorro: -500_000,      // negativo
          ahorrado: -100_000,             // negativo (será 0 para evento)
          presupuesto: -200_000,          // negativo
          gastado: -50_000,               // negativo
          gastos: null,
        },
      ]);
      expect(r[0].nombre).toBe('Viaje');
      expect(r[0].objetivoAhorro).toBe(0);
      expect(r[0].ahorrado).toBe(0);
      expect(r[0].presupuesto).toBe(0);
      expect(r[0].gastado).toBe(0);
      expect(r[0].gastos).toEqual([]);
    });

    it('objetivo con NaN/undefined en todos lados', () => {
      const r = normalizarObjetivos([
        {
          id: NaN,
          nombre: undefined,
          tipo: undefined,
          icono: undefined,
          fecha: undefined,
          objetivoAhorro: NaN,
          ahorrado: undefined,
          presupuesto: undefined,
          gastado: NaN,
          gastos: undefined,
          fechaUltimoAporte: undefined,
        },
      ]);
      expect(r[0].id).toBeDefined();
      expect(r[0].nombre).toBe('Sin nombre');
      expect(r[0].tipo).toBe('ahorro');
      expect(r[0].icono).toBe('🎯');
      expect(r[0].objetivoAhorro).toBe(0);
      expect(r[0].ahorrado).toBe(0);
      expect(r[0].gastos).toEqual([]);
    });
  });

});
