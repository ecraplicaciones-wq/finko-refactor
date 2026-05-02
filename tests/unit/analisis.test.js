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
  detectarMesesSinCerrar,
  analizarHormigaAcumulada,
  calcularSaludFinanciera,
  calcularComparacionCategorias,
  calcularTendencias,
  predecirFinQuincena,
  _rangoPeriodo,
  validarTipoPeriodo,
  detectarAlertasUrgentes,
  detectarAlertasFinancieras,
  calcularChecklistSalud,
  detectarPatronGastoSemanal,
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

// ─── detectarMesesSinCerrar ──────────────────────────────────────────────────
//
// Detecta meses en S.gastos que no tienen entry en S.historial — son meses que
// el usuario "abandonó" sin cerrar la quincena. Excluye el mes actual (en curso)
// y los meses futuros (fechas adelantadas/typos).

describe('detectarMesesSinCerrar()', () => {

  // Helper: gasto canónico con id y campos mínimos.
  const G = (fecha, monto = 50_000, extra = {}) => ({
    id: parseInt(fecha.replace(/-/g, ''), 10) + Math.floor(Math.random() * 100),
    fecha, monto,
    cat: 'comida', tipo: 'necesidad', desc: 'test',
    ...extra,
  });

  // Helper: entry de historial con `mes`.
  const H = (mes, extra = {}) => ({
    id: parseInt(mes.replace('-', ''), 10),
    mes,
    ingreso: 1_000_000, gastado: 500_000, ahorro: 200_000, hormiga: 30_000,
    catMap: {},
    ...extra,
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → []', () => {
    it('gastos no array', () => {
      expect(detectarMesesSinCerrar(null, [], '2026-04-27')).toEqual([]);
      expect(detectarMesesSinCerrar(undefined, [], '2026-04-27')).toEqual([]);
      expect(detectarMesesSinCerrar('foo', [], '2026-04-27')).toEqual([]);
      expect(detectarMesesSinCerrar(42, [], '2026-04-27')).toEqual([]);
    });
    it('gastos array vacío', () => {
      expect(detectarMesesSinCerrar([], [], '2026-04-27')).toEqual([]);
    });
    it('hoyISO no string', () => {
      expect(detectarMesesSinCerrar([G('2026-03-10')], [], null)).toEqual([]);
      expect(detectarMesesSinCerrar([G('2026-03-10')], [], 12345)).toEqual([]);
    });
    it('hoyISO con formato inválido', () => {
      expect(detectarMesesSinCerrar([G('2026-03-10')], [], 'no-fecha')).toEqual([]);
      expect(detectarMesesSinCerrar([G('2026-03-10')], [], '04-2026')).toEqual([]);
    });
    it('historial no array → tratado como vacío (no rompe)', () => {
      const r = detectarMesesSinCerrar([G('2026-03-10')], null, '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].mes).toBe('2026-03');
    });
  });

  // ── BLOQUE: MES ACTUAL Y FUTURO EXCLUIDOS ──────────────────────────────────
  describe('exclusión del mes actual y futuros', () => {
    it('gastos en el mes actual no se reportan', () => {
      const gastos = [G('2026-04-10'), G('2026-04-22')];
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27')).toEqual([]);
    });
    it('gastos en el futuro (fechas adelantadas) se ignoran', () => {
      const gastos = [G('2026-05-15'), G('2027-01-01')];
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27')).toEqual([]);
    });
    it('mezcla de actual + futuro + huérfano → solo el huérfano', () => {
      const gastos = [G('2026-04-10'), G('2026-05-15'), G('2026-02-10')];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].mes).toBe('2026-02');
    });
  });

  // ── BLOQUE: MESES YA CERRADOS ──────────────────────────────────────────────
  describe('meses ya cerrados se excluyen', () => {
    it('gastos en mes con entry en historial → no es huérfano', () => {
      const gastos = [G('2026-02-10'), G('2026-02-20')];
      const hist   = [H('2026-02')];
      expect(detectarMesesSinCerrar(gastos, hist, '2026-04-27')).toEqual([]);
    });
    it('historial con varios meses cerrados → todos excluidos', () => {
      const gastos = [G('2026-01-10'), G('2026-02-10'), G('2026-03-10')];
      const hist   = [H('2026-01'), H('2026-02'), H('2026-03')];
      expect(detectarMesesSinCerrar(gastos, hist, '2026-04-27')).toEqual([]);
    });
    it('historial con un mes cerrado y otro huérfano → solo el huérfano', () => {
      const gastos = [G('2026-01-10'), G('2026-02-10'), G('2026-03-10')];
      const hist   = [H('2026-02')];
      const r = detectarMesesSinCerrar(gastos, hist, '2026-04-27');
      expect(r.map(x => x.mes)).toEqual(['2026-01', '2026-03']);
    });
    it('entries de historial sin `mes` se ignoran (versión vieja)', () => {
      const gastos = [G('2026-02-10')];
      const hist   = [{ id: 1, ingreso: 100_000 }, H('2026-03')];
      const r = detectarMesesSinCerrar(gastos, hist, '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].mes).toBe('2026-02');
    });
    it('entries de historial null/no-objeto se ignoran', () => {
      const gastos = [G('2026-02-10')];
      const hist   = [null, undefined, 'string', 42, H('2026-02')];
      // 2026-02 SÍ está cerrado por el último entry → no es huérfano
      expect(detectarMesesSinCerrar(gastos, hist, '2026-04-27')).toEqual([]);
    });
    it('entries de historial con `mes` malformado se ignoran', () => {
      const gastos = [G('2026-02-10')];
      const hist   = [{ mes: '2026/02' }, { mes: 'sin-formato' }];
      const r = detectarMesesSinCerrar(gastos, hist, '2026-04-27');
      expect(r).toHaveLength(1); // 2026-02 sigue siendo huérfano
    });
  });

  // ── BLOQUE: AGREGADO POR MES ───────────────────────────────────────────────
  describe('agregado nGastos / total / fechas', () => {
    it('cuenta gastos por mes correctamente', () => {
      const gastos = [
        G('2026-02-05', 10_000),
        G('2026-02-15', 20_000),
        G('2026-02-25', 30_000),
      ];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r[0]).toEqual(expect.objectContaining({
        mes: '2026-02',
        nGastos: 3,
        total: 60_000,
        primerGasto: '2026-02-05',
        ultimoGasto: '2026-02-25',
      }));
    });
    it('usa montoTotal si está presente (soporte para gastos con cuotas)', () => {
      const gastos = [
        G('2026-02-10', 10_000, { montoTotal: 100_000 }),  // monto=10k pero total 100k
      ];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r[0].total).toBe(100_000);
    });
    it('cae al monto si montoTotal es 0/falsy', () => {
      const gastos = [G('2026-02-10', 10_000, { montoTotal: 0 })];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r[0].total).toBe(10_000);
    });
    it('cae a 0 si ni monto ni montoTotal son numéricos', () => {
      const gastos = [{ fecha: '2026-02-10', monto: 'qué' }];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r[0].total).toBe(0);
      expect(r[0].nGastos).toBe(1);
    });
    it('primerGasto y ultimoGasto se calculan independientemente del orden de input', () => {
      const gastos = [
        G('2026-02-25'),
        G('2026-02-05'),
        G('2026-02-15'),
      ];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r[0].primerGasto).toBe('2026-02-05');
      expect(r[0].ultimoGasto).toBe('2026-02-25');
    });
  });

  // ── BLOQUE: GASTOS MALFORMADOS ─────────────────────────────────────────────
  describe('gastos malformados', () => {
    it('gastos null/no-objeto se ignoran', () => {
      const gastos = [null, undefined, 'foo', 42, G('2026-02-10')];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].nGastos).toBe(1);
    });
    it('gastos sin fecha se ignoran', () => {
      const gastos = [
        { id: 1, monto: 50_000, cat: 'x' }, // sin fecha
        G('2026-02-10'),
      ];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].nGastos).toBe(1);
    });
    it('gastos con fecha malformada se ignoran', () => {
      const gastos = [
        { id: 1, fecha: '2026/02/10', monto: 50_000 },
        { id: 2, fecha: 'no-fecha',   monto: 50_000 },
        G('2026-02-10'),
      ];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].nGastos).toBe(1);
    });
    it('fecha con tiempo (ISO completo) se acepta — _MES_RX usa solo el prefijo', () => {
      const gastos = [{ id: 1, fecha: '2026-02-10T15:30:00Z', monto: 50_000 }];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(1);
      expect(r[0].mes).toBe('2026-02');
    });
  });

  // ── BLOQUE: CONFIG ─────────────────────────────────────────────────────────
  describe('config (umbralMinGastos)', () => {
    it('umbralMinGastos = 3 → ignora meses con menos gastos', () => {
      const gastos = [
        G('2026-01-10'),                              // mes con 1 gasto
        G('2026-02-10'), G('2026-02-20'),             // mes con 2 gastos
        G('2026-03-10'), G('2026-03-15'), G('2026-03-25'), // mes con 3 gastos
      ];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27', { umbralMinGastos: 3 });
      expect(r).toHaveLength(1);
      expect(r[0].mes).toBe('2026-03');
    });
    it('umbralMinGastos = 1 (default) → todos los meses con gasto', () => {
      const gastos = [G('2026-01-10'), G('2026-02-10'), G('2026-02-20')];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(2);
    });
    it('umbralMinGastos inválido → fallback al default 1', () => {
      const gastos = [G('2026-02-10')];
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27', { umbralMinGastos: 'tres' })).toHaveLength(1);
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27', { umbralMinGastos: 0 })).toHaveLength(1);
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27', { umbralMinGastos: -5 })).toHaveLength(1);
    });
    it('config null o no-objeto → defaults', () => {
      const gastos = [G('2026-02-10')];
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27', null)).toHaveLength(1);
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27', 'foo')).toHaveLength(1);
    });
    it('umbralMinGastos decimal se trunca con floor', () => {
      const gastos = [G('2026-02-10'), G('2026-02-20')];
      // floor(2.9) = 2 → con 2 gastos pasa
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27', { umbralMinGastos: 2.9 })).toHaveLength(1);
      // floor(3.1) = 3 → con 2 gastos no pasa
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27', { umbralMinGastos: 3.1 })).toEqual([]);
    });
  });

  // ── BLOQUE: ORDENAMIENTO ───────────────────────────────────────────────────
  describe('ordenamiento', () => {
    it('más viejo primero (ASC por mes)', () => {
      const gastos = [G('2026-03-10'), G('2026-01-10'), G('2026-02-10')];
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r.map(x => x.mes)).toEqual(['2026-01', '2026-02', '2026-03']);
    });
    it('cruce de año mantiene el orden', () => {
      const gastos = [G('2025-12-10'), G('2026-01-10'), G('2025-11-10')];
      const r = detectarMesesSinCerrar(gastos, [], '2026-03-27');
      expect(r.map(x => x.mes)).toEqual(['2025-11', '2025-12', '2026-01']);
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('usuario abandonó 5 meses → 5 entries en orden cronológico', () => {
      const meses = ['2025-11','2025-12','2026-01','2026-02','2026-03'];
      const gastos = meses.flatMap(m => [
        G(`${m}-05`, 100_000),
        G(`${m}-15`, 80_000),
        G(`${m}-25`, 60_000),
      ]);
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(5);
      expect(r[0].mes).toBe('2025-11');
      expect(r[4].mes).toBe('2026-03');
      expect(r[0].total).toBe(240_000);
      expect(r[0].nGastos).toBe(3);
    });
    it('usuario activo: solo gastos del mes actual → []', () => {
      const gastos = [
        G('2026-04-10'), G('2026-04-12'), G('2026-04-15'),
        G('2026-04-20'), G('2026-04-25'),
      ];
      expect(detectarMesesSinCerrar(gastos, [], '2026-04-27')).toEqual([]);
    });
    it('usuario disciplinado: cierra cada mes → []', () => {
      const gastos = [G('2026-04-15'), G('2026-04-20')];  // mes actual, no huérfano
      const hist   = [H('2026-03'), H('2026-02'), H('2026-01')];
      expect(detectarMesesSinCerrar(gastos, hist, '2026-04-27')).toEqual([]);
    });
    it('1000 gastos repartidos → procesa rápido y orden estable', () => {
      const gastos = [];
      for (let i = 0; i < 1000; i++) {
        const mes = `2025-${String((i % 6) + 1).padStart(2, '0')}`;
        gastos.push(G(`${mes}-10`, 1000 + i));
      }
      const r = detectarMesesSinCerrar(gastos, [], '2026-04-27');
      expect(r).toHaveLength(6);
      expect(r[0].mes).toBe('2025-01');
      expect(r[5].mes).toBe('2025-06');
    });
    it('no muta los inputs', () => {
      const gastos = [G('2026-02-10'), G('2026-01-15')];
      const hist   = [H('2026-03')];
      const gOriginal = JSON.parse(JSON.stringify(gastos));
      const hOriginal = JSON.parse(JSON.stringify(hist));
      detectarMesesSinCerrar(gastos, hist, '2026-04-27');
      expect(gastos).toEqual(gOriginal);
      expect(hist).toEqual(hOriginal);
    });
  });

});

// ─── analizarHormigaAcumulada ────────────────────────────────────────────────
//
// Análisis retrospectivo del acumulado de hormigas del mes corriente. Pure:
// gastos, ingreso y hoyISO entran por argumento. Top categorías, proyección
// lineal al fin del mes, severidad por % del ingreso (o por count si no hay).

describe('analizarHormigaAcumulada()', () => {

  // Helper: gasto canónico hormiga.
  const HG = (over = {}) => ({
    id: 1, fecha: '2026-04-10', monto: 5000, cat: 'comida',
    desc: 'Café', hormiga: true, tipo: 'deseo',
    ...over,
  });
  // Helper: gasto canónico no-hormiga.
  const GN = (over = {}) => ({
    id: 1, fecha: '2026-04-10', monto: 50_000, cat: 'comida',
    desc: 'Almuerzo', hormiga: false, tipo: 'necesidad',
    ...over,
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → null', () => {
    it('gastos no array', () => {
      expect(analizarHormigaAcumulada(null,      0, '2026-04-15')).toBe(null);
      expect(analizarHormigaAcumulada(undefined, 0, '2026-04-15')).toBe(null);
      expect(analizarHormigaAcumulada('foo',     0, '2026-04-15')).toBe(null);
    });
    it('gastos vacío', () => {
      expect(analizarHormigaAcumulada([], 0, '2026-04-15')).toBe(null);
    });
    it('hoyISO no string', () => {
      expect(analizarHormigaAcumulada([HG()], 0, null)).toBe(null);
      expect(analizarHormigaAcumulada([HG()], 0, 12345)).toBe(null);
    });
    it('hoyISO sin formato YYYY-MM-DD completo', () => {
      expect(analizarHormigaAcumulada([HG()], 0, '2026-04')).toBe(null);
      expect(analizarHormigaAcumulada([HG()], 0, 'no-fecha')).toBe(null);
    });
    it('hoyISO con mes/día fuera de rango', () => {
      expect(analizarHormigaAcumulada([HG()], 0, '2026-13-15')).toBe(null);
      expect(analizarHormigaAcumulada([HG()], 0, '2026-04-32')).toBe(null);
      expect(analizarHormigaAcumulada([HG()], 0, '2026-04-00')).toBe(null);
    });
  });

  // ── BLOQUE: SIN HORMIGAS EN EL MES ─────────────────────────────────────────
  describe('sin hormigas en el mes corriente → null', () => {
    it('todos los gastos son no-hormiga', () => {
      const gastos = [GN(), GN({ id: 2 }), GN({ id: 3 })];
      expect(analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15')).toBe(null);
    });
    it('hormigas todas en otro mes', () => {
      const gastos = [HG({ fecha: '2026-03-10' }), HG({ id: 2, fecha: '2026-03-20' })];
      expect(analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15')).toBe(null);
    });
    it('hormigas con monto cero o negativo se ignoran', () => {
      const gastos = [HG({ monto: 0 }), HG({ id: 2, monto: -5000 })];
      expect(analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15')).toBe(null);
    });
    it('items malformados se ignoran', () => {
      const gastos = [null, undefined, 'string', 42, { fecha: 'mal' }];
      expect(analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15')).toBe(null);
    });
  });

  // ── BLOQUE: AGREGADO ───────────────────────────────────────────────────────
  describe('total / count / proyección', () => {
    it('1 hormiga → total y count correctos', () => {
      const gastos = [HG({ monto: 8000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.total).toBe(8000);
      expect(r.nGastos).toBe(1);
    });
    it('múltiples hormigas → suma correcta', () => {
      const gastos = [HG({ monto: 5000 }), HG({ id: 2, monto: 7000 }), HG({ id: 3, monto: 3000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.total).toBe(15_000);
      expect(r.nGastos).toBe(3);
    });
    it('mezcla hormigas + no-hormigas → solo cuenta hormigas', () => {
      const gastos = [HG({ monto: 5000 }), GN({ id: 2, monto: 100_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.total).toBe(5000);
      expect(r.nGastos).toBe(1);
    });
    it('usa montoTotal si está presente', () => {
      const gastos = [HG({ monto: 5000, montoTotal: 5020 })];  // con 4×1000
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.total).toBe(5020);
    });
    it('proyección lineal (día 10 con 10k → ~30k al mes)', () => {
      const gastos = [HG({ monto: 10_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-10');
      expect(r.diasTranscurridos).toBe(10);
      expect(r.proyeccionMensual).toBe(30_000);
    });
    it('proyección día 1 (worst case) → total × 30', () => {
      const gastos = [HG({ fecha: '2026-04-01', monto: 10_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-01');
      expect(r.diasTranscurridos).toBe(1);
      expect(r.proyeccionMensual).toBe(300_000);
    });
    it('proyección día 30 → ~igual al total', () => {
      const gastos = [HG({ monto: 100_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-30');
      expect(r.proyeccionMensual).toBe(100_000);
    });
  });

  // ── BLOQUE: DETECCIÓN DE HORMIGA (TIPO LEGADO) ─────────────────────────────
  describe('compatibilidad con representaciones de hormiga', () => {
    it('reconoce hormiga: true (canon nuevo post v4)', () => {
      const r = analizarHormigaAcumulada([HG({ hormiga: true, tipo: 'deseo' })], 1_000_000, '2026-04-15');
      expect(r.nGastos).toBe(1);
    });
    it("reconoce tipo: 'hormiga' (canon viejo pre v4)", () => {
      const g = { id: 1, fecha: '2026-04-10', monto: 5000, cat: 'comida', desc: 'X', tipo: 'hormiga' };
      const r = analizarHormigaAcumulada([g], 1_000_000, '2026-04-15');
      expect(r.nGastos).toBe(1);
    });
    it('hormiga: false y tipo: deseo → no es hormiga', () => {
      const r = analizarHormigaAcumulada([HG({ hormiga: false, tipo: 'deseo' })], 1_000_000, '2026-04-15');
      expect(r).toBe(null);
    });
  });

  // ── BLOQUE: SEVERIDAD ──────────────────────────────────────────────────────
  describe('severidad', () => {
    it("con ingreso: 'info' si % < 5", () => {
      // 30k de 1M = 3% → info
      const gastos = [HG({ monto: 30_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.severidad).toBe('info');
      expect(r.pctIngreso).toBe(3);
    });
    it("con ingreso: 'warn' si % entre 5 y 15", () => {
      // 80k de 1M = 8% → warn
      const gastos = [HG({ monto: 80_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.severidad).toBe('warn');
      expect(r.pctIngreso).toBe(8);
    });
    it("con ingreso: 'urgent' si % >= 15", () => {
      // 200k de 1M = 20% → urgent
      const gastos = [HG({ monto: 200_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.severidad).toBe('urgent');
      expect(r.pctIngreso).toBe(20);
    });
    it("borde 5%: pct=5 → warn, pct=4.9 → info", () => {
      const r5 = analizarHormigaAcumulada([HG({ monto: 50_000 })], 1_000_000, '2026-04-15');
      const r49 = analizarHormigaAcumulada([HG({ monto: 49_000 })], 1_000_000, '2026-04-15');
      expect(r5.severidad).toBe('warn');
      expect(r49.severidad).toBe('info');
    });
    it("sin ingreso: 'info' si nGastos < 10", () => {
      const gastos = Array.from({ length: 5 }, (_, i) => HG({ id: i + 1, monto: 5000 }));
      const r = analizarHormigaAcumulada(gastos, 0, '2026-04-15');
      expect(r.severidad).toBe('info');
      expect(r.pctIngreso).toBe(null);
    });
    it("sin ingreso: 'warn' si nGastos entre 10 y 24", () => {
      const gastos = Array.from({ length: 15 }, (_, i) => HG({ id: i + 1, monto: 5000 }));
      const r = analizarHormigaAcumulada(gastos, 0, '2026-04-15');
      expect(r.severidad).toBe('warn');
      expect(r.pctIngreso).toBe(null);
    });
    it("sin ingreso: 'urgent' si nGastos >= 25", () => {
      const gastos = Array.from({ length: 25 }, (_, i) => HG({ id: i + 1, monto: 5000 }));
      const r = analizarHormigaAcumulada(gastos, 0, '2026-04-15');
      expect(r.severidad).toBe('urgent');
    });
  });

  // ── BLOQUE: TOP CATEGORÍAS ─────────────────────────────────────────────────
  describe('topCategorias', () => {
    it('agrupa por categoría sumando totales', () => {
      const gastos = [
        HG({ id: 1, monto: 5000, cat: 'comida' }),
        HG({ id: 2, monto: 3000, cat: 'comida' }),
        HG({ id: 3, monto: 7000, cat: 'transporte' }),
      ];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      const comida = r.topCategorias.find(c => c.cat === 'comida');
      const transp = r.topCategorias.find(c => c.cat === 'transporte');
      expect(comida).toEqual({ cat: 'comida', total: 8000, n: 2 });
      expect(transp).toEqual({ cat: 'transporte', total: 7000, n: 1 });
    });
    it('top 3 por defecto, mayor total primero', () => {
      const gastos = [
        HG({ id: 1, monto: 1000, cat: 'a' }),
        HG({ id: 2, monto: 5000, cat: 'b' }),
        HG({ id: 3, monto: 3000, cat: 'c' }),
        HG({ id: 4, monto: 10_000, cat: 'd' }),
        HG({ id: 5, monto: 500, cat: 'e' }),
      ];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.topCategorias).toHaveLength(3);
      expect(r.topCategorias.map(c => c.cat)).toEqual(['d', 'b', 'c']);
    });
    it('topN custom respetado', () => {
      const gastos = Array.from({ length: 5 }, (_, i) =>
        HG({ id: i + 1, monto: 1000 * (i + 1), cat: `cat${i}` }));
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15', { topN: 5 });
      expect(r.topCategorias).toHaveLength(5);
    });
    it("cat vacía o ausente → 'otros'", () => {
      const gastos = [
        HG({ id: 1, monto: 5000, cat: '' }),
        HG({ id: 2, monto: 3000, cat: undefined }),
      ];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      const otros = r.topCategorias.find(c => c.cat === 'otros');
      expect(otros.total).toBe(8000);
      expect(otros.n).toBe(2);
    });
    it('empate de total → mayor n primero', () => {
      const gastos = [
        HG({ id: 1, monto: 10_000, cat: 'a' }),
        HG({ id: 2, monto: 5000,   cat: 'b' }),
        HG({ id: 3, monto: 5000,   cat: 'b' }),
      ];
      // a: 10k×1, b: 10k×2 → empate en total, b debería ir primero
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.topCategorias[0].cat).toBe('b');
      expect(r.topCategorias[1].cat).toBe('a');
    });
    it('empate de total y n → orden alfabético (determinístico)', () => {
      const gastos = [
        HG({ id: 1, monto: 5000, cat: 'zorro' }),
        HG({ id: 2, monto: 5000, cat: 'arena' }),
      ];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.topCategorias[0].cat).toBe('arena');
      expect(r.topCategorias[1].cat).toBe('zorro');
    });
  });

  // ── BLOQUE: MAYOR GASTO ────────────────────────────────────────────────────
  describe('mayorGasto', () => {
    it('captura el gasto hormiga más caro del mes', () => {
      const gastos = [
        HG({ id: 1, monto: 3000, desc: 'Café', cat: 'comida' }),
        HG({ id: 2, monto: 15_000, desc: 'Suscripción Netflix', cat: 'ocio' }),
        HG({ id: 3, monto: 5000, desc: 'Propina', cat: 'comida' }),
      ];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.mayorGasto).toEqual({
        desc: 'Suscripción Netflix',
        monto: 15_000,
        fecha: '2026-04-10',
        cat: 'ocio',
      });
    });
    it("desc vacía → '(sin descripción)'", () => {
      const gastos = [HG({ desc: '' })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.mayorGasto.desc).toBe('(sin descripción)');
    });
  });

  // ── BLOQUE: GASTOS MALFORMADOS ─────────────────────────────────────────────
  describe('gastos malformados', () => {
    it('fecha vacía o malformada se ignora', () => {
      const gastos = [
        HG({ id: 1, fecha: '' }),
        HG({ id: 2, fecha: '2026/04/10' }),
        HG({ id: 3, fecha: '2026-04-10', monto: 5000 }),
      ];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.nGastos).toBe(1);
      expect(r.total).toBe(5000);
    });
    it('null/undefined/no-objeto se ignoran', () => {
      const gastos = [null, undefined, 'foo', 42, HG({ monto: 5000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.nGastos).toBe(1);
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('usuario típico: 12 cafés a 5k en 12 días → warn por count o pct', () => {
      const gastos = Array.from({ length: 12 }, (_, i) => HG({
        id: i + 1, monto: 5000,
        fecha: `2026-04-${String(i + 1).padStart(2, '0')}`,
        cat: 'comida', desc: `Café día ${i + 1}`,
      }));
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.total).toBe(60_000);
      expect(r.nGastos).toBe(12);
      expect(r.severidad).toBe('warn'); // 6% del ingreso → warn
      expect(r.proyeccionMensual).toBe(120_000);  // 60k × 30/15
    });
    it('1 hormiga grande sola → severidad por % puro, sin importar count bajo', () => {
      const gastos = [HG({ monto: 250_000 })];
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.nGastos).toBe(1);
      expect(r.severidad).toBe('urgent'); // 25%
    });
    it('no muta los inputs', () => {
      const gastos = [HG({ monto: 5000 })];
      const original = JSON.parse(JSON.stringify(gastos));
      analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(gastos).toEqual(original);
    });
    it('500 hormigas (stress) → procesa rápido', () => {
      const gastos = Array.from({ length: 500 }, (_, i) =>
        HG({ id: i + 1, monto: 1000 + i, cat: `cat${i % 5}` }));
      const r = analizarHormigaAcumulada(gastos, 1_000_000, '2026-04-15');
      expect(r.nGastos).toBe(500);
      expect(r.topCategorias).toHaveLength(3);
    });
  });

});

// ─── calcularSaludFinanciera ─────────────────────────────────────────────────
//
// Indicador positivo del dashboard: 6 componentes (atrasos, ahorro, fondo,
// deudas, backup, hormigas) con peso fijo total 100. Pure: input completo
// por argumento, sin S, sin DOM.

describe('calcularSaludFinanciera()', () => {

  // Helper: input "perfecto" — todos los componentes en máximo.
  const perfecto = (over = {}) => ({
    gastos: [
      { id: 1, fecha: '2026-04-10', monto: 300_000, tipo: 'ahorro' },  // 30% ahorro
    ],
    gastosFijos: [],     // sin fijos atrasados
    deudas: [],          // sin deudas
    objetivos: [],       // sin objetivos
    ingreso: 1_000_000,
    fondoEmergencia: { objetivoMeses: 6, actual: 6_000_000 }, // 100%
    lastBackupAt: '2026-04-25',  // hace 2 días
    ...over,
  });

  const HOY = '2026-04-27';

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas → null', () => {
    it('input null/undefined/string/array', () => {
      expect(calcularSaludFinanciera(null, HOY)).toBe(null);
      expect(calcularSaludFinanciera(undefined, HOY)).toBe(null);
      expect(calcularSaludFinanciera('foo', HOY)).toBe(null);
      expect(calcularSaludFinanciera([1], HOY)).toBe(null);
    });
    it('hoyISO no string o malformada', () => {
      expect(calcularSaludFinanciera({}, null)).toBe(null);
      expect(calcularSaludFinanciera({}, '2026-04')).toBe(null);
      expect(calcularSaludFinanciera({}, 'no-fecha')).toBe(null);
    });
    it('hoyISO con mes/día fuera de rango', () => {
      expect(calcularSaludFinanciera({}, '2026-13-01')).toBe(null);
      expect(calcularSaludFinanciera({}, '2026-04-32')).toBe(null);
    });
  });

  // ── BLOQUE: ETIQUETAS POR SCORE ────────────────────────────────────────────
  describe('etiqueta por score', () => {
    it('score 100 (todo perfecto) → excelente', () => {
      const r = calcularSaludFinanciera(perfecto(), HOY);
      expect(r.score).toBe(100);
      expect(r.etiqueta).toBe('excelente');
    });
    it("score 90+ → 'excelente'", () => {
      // perfecto - 10pts (backup viejo)
      const r = calcularSaludFinanciera(perfecto({ lastBackupAt: '2026-03-15' }), HOY); // ~43d → 3pts
      expect(r.score).toBeLessThan(100);
      expect(r.score).toBeGreaterThanOrEqual(90);
      expect(r.etiqueta).toBe('excelente');
    });
    it("70 ≤ score < 90 → 'buena'", () => {
      // perfecto - fondo casi vacío (-14pts) y -7pts backup
      const input = perfecto({
        fondoEmergencia: { objetivoMeses: 6, actual: 1_500_000 }, // 25% → 6pts
        lastBackupAt: '2026-03-15',  // 3pts
      });
      const r = calcularSaludFinanciera(input, HOY);
      expect(r.score).toBeGreaterThanOrEqual(70);
      expect(r.score).toBeLessThan(90);
      expect(r.etiqueta).toBe('buena');
    });
    it("40 ≤ score < 70 → 'mejorable'", () => {
      // sin ahorro, fondo bajo, sin backup
      const input = perfecto({
        gastos: [],  // sin ahorro → 0
        fondoEmergencia: { objetivoMeses: 6, actual: 0 }, // 0
        lastBackupAt: null, // 0
      });
      const r = calcularSaludFinanciera(input, HOY);
      // atrasos 25 + ahorro 0 + fondo 0 + deudas 15 + backup 0 + hormigas 5 = 45
      expect(r.score).toBeGreaterThanOrEqual(40);
      expect(r.score).toBeLessThan(70);
      expect(r.etiqueta).toBe('mejorable');
    });
    it("score < 40 → 'critica'", () => {
      // todo mal: atrasos múltiples, sin ahorro, sin fondo, deudas pesadas, sin backup
      const input = {
        gastos: [],
        gastosFijos: [
          { id: 1, dia: 1, pagadoEn: [] },
          { id: 2, dia: 1, pagadoEn: [] },
          { id: 3, dia: 1, pagadoEn: [] },  // 3 fijos atrasados → atrasos 0
        ],
        deudas: [
          { id: 1, total: 1_000_000, pagado: 0, cuota: 500_000, periodicidad: 'mensual' },
          // cuota 500k de ingreso 1M = 50% → deudas 5pts
        ],
        objetivos: [],
        ingreso: 1_000_000,
        fondoEmergencia: { objetivoMeses: 6, actual: 0 },
        lastBackupAt: null,
      };
      const r = calcularSaludFinanciera(input, HOY);
      // atrasos 0 + ahorro 0 + fondo 0 + deudas 5 + backup 0 + hormigas 5 = 10
      expect(r.score).toBeLessThan(40);
      expect(r.etiqueta).toBe('critica');
    });
  });

  // ── BLOQUE: COMPONENTE ATRASOS (25 PTS) ────────────────────────────────────
  describe('componente atrasos', () => {
    it('sin atrasos → 25 pts', () => {
      const r = calcularSaludFinanciera(perfecto(), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(25);
    });
    it('1 fijo atrasado → 15 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastosFijos: [{ id: 1, dia: 1, pagadoEn: [] }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(15);
    });
    it('1 deuda durmiendo → 15 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [{ id: 1, total: 1_000_000, pagado: 100_000, cuota: 0,
                   fechaUltimoPago: '2025-12-01' }],  // > 60 días
      }), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(15);
    });
    it('1 objetivo sin progreso → 15 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        objetivos: [{ id: 1, objetivoAhorro: 1_000_000, ahorrado: 100_000,
                      fechaUltimoAporte: '2025-12-01' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(15);
    });
    it('2 atrasos (fijo + deuda) → 5 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastosFijos: [{ id: 1, dia: 1, pagadoEn: [] }],
        deudas: [{ id: 1, total: 1_000_000, pagado: 100_000, cuota: 0,
                   fechaUltimoPago: '2025-12-01' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(5);
    });
    it('3+ atrasos → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastosFijos: [
          { id: 1, dia: 1, pagadoEn: [] },
          { id: 2, dia: 1, pagadoEn: [] },
          { id: 3, dia: 1, pagadoEn: [] },
        ],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(0);
    });
    it('fijo pagado este mes → no es atraso', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastosFijos: [{ id: 1, dia: 1, pagadoEn: ['2026-04'] }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(25);
    });
    it('deuda liquidada → no cuenta', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [{ id: 1, total: 1_000_000, pagado: 1_000_000 }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'atrasos');
      expect(c.score).toBe(25);
    });
  });

  // ── BLOQUE: COMPONENTE AHORRO (25 PTS) ─────────────────────────────────────
  describe('componente ahorro', () => {
    it('20%+ del ingreso → 25 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [{ fecha: '2026-04-10', monto: 200_000, tipo: 'ahorro' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'ahorro');
      expect(c.score).toBe(25);
    });
    it('10-20% → 15 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [{ fecha: '2026-04-10', monto: 100_000, tipo: 'ahorro' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'ahorro');
      expect(c.score).toBe(15);
    });
    it('5-10% → 8 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [{ fecha: '2026-04-10', monto: 50_000, tipo: 'ahorro' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'ahorro');
      expect(c.score).toBe(8);
    });
    it('< 5% → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [{ fecha: '2026-04-10', monto: 10_000, tipo: 'ahorro' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'ahorro');
      expect(c.score).toBe(0);
    });
    it('sin ingreso configurado → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        ingreso: 0,
        gastos: [{ fecha: '2026-04-10', monto: 100_000, tipo: 'ahorro' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'ahorro');
      expect(c.score).toBe(0);
    });
    it('ahorro de OTRO mes no cuenta', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [{ fecha: '2026-03-10', monto: 500_000, tipo: 'ahorro' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'ahorro');
      expect(c.score).toBe(0);
    });
    it('usa montoTotal si presente', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [{ fecha: '2026-04-10', monto: 50_000, montoTotal: 200_000, tipo: 'ahorro' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'ahorro');
      expect(c.score).toBe(25);
    });
  });

  // ── BLOQUE: COMPONENTE FONDO (20 PTS) ──────────────────────────────────────
  describe('componente fondo de emergencia', () => {
    it('100%+ → 20 pts', () => {
      const r = calcularSaludFinanciera(perfecto(), HOY);
      const c = r.componentes.find(x => x.key === 'fondo');
      expect(c.score).toBe(20);
    });
    it('50-100% → 12 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        fondoEmergencia: { objetivoMeses: 6, actual: 3_500_000 },  // ~58%
      }), HOY);
      const c = r.componentes.find(x => x.key === 'fondo');
      expect(c.score).toBe(12);
    });
    it('20-50% → 6 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        fondoEmergencia: { objetivoMeses: 6, actual: 1_500_000 },  // 25%
      }), HOY);
      const c = r.componentes.find(x => x.key === 'fondo');
      expect(c.score).toBe(6);
    });
    it('< 20% → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        fondoEmergencia: { objetivoMeses: 6, actual: 500_000 },  // ~8%
      }), HOY);
      const c = r.componentes.find(x => x.key === 'fondo');
      expect(c.score).toBe(0);
    });
    it('sin ingreso → 0 pts (no se puede juzgar)', () => {
      const r = calcularSaludFinanciera(perfecto({
        ingreso: 0,
      }), HOY);
      const c = r.componentes.find(x => x.key === 'fondo');
      expect(c.score).toBe(0);
    });
    it('fondoEmergencia ausente → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        fondoEmergencia: undefined,
      }), HOY);
      const c = r.componentes.find(x => x.key === 'fondo');
      expect(c.score).toBe(0);
    });
  });

  // ── BLOQUE: COMPONENTE DEUDAS (15 PTS) ─────────────────────────────────────
  describe('componente deudas', () => {
    it('sin deudas vivas → 15 pts', () => {
      const r = calcularSaludFinanciera(perfecto(), HOY);
      const c = r.componentes.find(x => x.key === 'deudas');
      expect(c.score).toBe(15);
    });
    it('cuota ≤ 20% del ingreso → 15 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [{ id: 1, total: 1_000_000, pagado: 0, cuota: 200_000, periodicidad: 'mensual' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'deudas');
      expect(c.score).toBe(15);
    });
    it('cuota 20-40% → 10 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [{ id: 1, total: 1_000_000, pagado: 0, cuota: 300_000, periodicidad: 'mensual' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'deudas');
      expect(c.score).toBe(10);
    });
    it('cuota 40-60% → 5 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [{ id: 1, total: 1_000_000, pagado: 0, cuota: 500_000, periodicidad: 'mensual' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'deudas');
      expect(c.score).toBe(5);
    });
    it('cuota > 60% → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [{ id: 1, total: 1_000_000, pagado: 0, cuota: 800_000, periodicidad: 'mensual' }],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'deudas');
      expect(c.score).toBe(0);
    });
    it('quincenal multiplica × 2 al mes', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [{ id: 1, total: 1_000_000, pagado: 0, cuota: 200_000, periodicidad: 'quincenal' }],
      }), HOY);
      // 200k × 2 = 400k = 40% → 10 pts (límite)
      const c = r.componentes.find(x => x.key === 'deudas');
      expect(c.score).toBe(10);
    });
    it('deudas liquidadas no cuentan en cuota', () => {
      const r = calcularSaludFinanciera(perfecto({
        deudas: [
          { id: 1, total: 1_000_000, pagado: 1_000_000, cuota: 500_000 },  // liquidada
          { id: 2, total: 500_000, pagado: 0, cuota: 100_000, periodicidad: 'mensual' },
        ],
      }), HOY);
      // Solo deuda 2 cuenta: 100k de 1M = 10% → 15 pts
      const c = r.componentes.find(x => x.key === 'deudas');
      expect(c.score).toBe(15);
    });
  });

  // ── BLOQUE: COMPONENTE BACKUP (10 PTS) ─────────────────────────────────────
  describe('componente backup', () => {
    it('hace 0-7 días → 10 pts', () => {
      const r = calcularSaludFinanciera(perfecto({ lastBackupAt: '2026-04-25' }), HOY);
      const c = r.componentes.find(x => x.key === 'backup');
      expect(c.score).toBe(10);
    });
    it('hace 8-30 días → 6 pts', () => {
      const r = calcularSaludFinanciera(perfecto({ lastBackupAt: '2026-04-05' }), HOY);
      const c = r.componentes.find(x => x.key === 'backup');
      expect(c.score).toBe(6);
    });
    it('hace 31-60 días → 3 pts', () => {
      const r = calcularSaludFinanciera(perfecto({ lastBackupAt: '2026-03-15' }), HOY);
      const c = r.componentes.find(x => x.key === 'backup');
      expect(c.score).toBe(3);
    });
    it('hace > 60 días → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({ lastBackupAt: '2026-01-01' }), HOY);
      const c = r.componentes.find(x => x.key === 'backup');
      expect(c.score).toBe(0);
    });
    it('lastBackupAt null/undefined → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({ lastBackupAt: null }), HOY);
      const c = r.componentes.find(x => x.key === 'backup');
      expect(c.score).toBe(0);
    });
    it('lastBackupAt malformada → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({ lastBackupAt: '2026/04/25' }), HOY);
      const c = r.componentes.find(x => x.key === 'backup');
      expect(c.score).toBe(0);
    });
  });

  // ── BLOQUE: COMPONENTE HORMIGAS (5 PTS) ────────────────────────────────────
  describe('componente hormigas', () => {
    it('sin hormigas → 5 pts', () => {
      const r = calcularSaludFinanciera(perfecto(), HOY);
      const c = r.componentes.find(x => x.key === 'hormiga');
      expect(c.score).toBe(5);
    });
    it('< 2% del ingreso → 5 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [
          ...perfecto().gastos,
          { fecha: '2026-04-10', monto: 10_000, hormiga: true },  // 1%
        ],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'hormiga');
      expect(c.score).toBe(5);
    });
    it('2-5% → 3 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [
          ...perfecto().gastos,
          { fecha: '2026-04-10', monto: 30_000, hormiga: true },  // 3%
        ],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'hormiga');
      expect(c.score).toBe(3);
    });
    it('5-10% → 1 pt', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [
          ...perfecto().gastos,
          { fecha: '2026-04-10', monto: 70_000, hormiga: true },  // 7%
        ],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'hormiga');
      expect(c.score).toBe(1);
    });
    it('> 10% → 0 pts', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [
          ...perfecto().gastos,
          { fecha: '2026-04-10', monto: 200_000, hormiga: true },  // 20%
        ],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'hormiga');
      expect(c.score).toBe(0);
    });
    it('hormigas de otro mes no cuentan', () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [
          ...perfecto().gastos,
          { fecha: '2026-03-10', monto: 500_000, hormiga: true },
        ],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'hormiga');
      expect(c.score).toBe(5);
    });
    it("compatibilidad con tipo: 'hormiga' (canon viejo)", () => {
      const r = calcularSaludFinanciera(perfecto({
        gastos: [
          ...perfecto().gastos,
          { fecha: '2026-04-10', monto: 30_000, tipo: 'hormiga' },  // 3%
        ],
      }), HOY);
      const c = r.componentes.find(x => x.key === 'hormiga');
      expect(c.score).toBe(3);
    });
  });

  // ── BLOQUE: ESTRUCTURA DEL RETORNO ─────────────────────────────────────────
  describe('estructura del retorno', () => {
    it('siempre devuelve los 6 componentes', () => {
      const r = calcularSaludFinanciera({}, HOY);
      expect(r.componentes).toHaveLength(6);
      expect(r.componentes.map(c => c.key)).toEqual([
        'atrasos', 'ahorro', 'fondo', 'deudas', 'backup', 'hormiga',
      ]);
    });
    it('cada componente tiene { key, label, peso, score, mensaje }', () => {
      const r = calcularSaludFinanciera({}, HOY);
      r.componentes.forEach(c => {
        expect(c).toHaveProperty('key');
        expect(c).toHaveProperty('label');
        expect(c).toHaveProperty('peso');
        expect(c).toHaveProperty('score');
        expect(c).toHaveProperty('mensaje');
        expect(typeof c.peso).toBe('number');
        expect(typeof c.score).toBe('number');
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(c.peso);
      });
    });
    it('suma de pesos = 100', () => {
      const r = calcularSaludFinanciera({}, HOY);
      const totalPeso = r.componentes.reduce((s, c) => s + c.peso, 0);
      expect(totalPeso).toBe(100);
    });
    it('score total = suma de scores individuales', () => {
      const r = calcularSaludFinanciera(perfecto(), HOY);
      const sumaScores = r.componentes.reduce((s, c) => s + c.score, 0);
      expect(r.score).toBe(sumaScores);
    });
    it('input vacío {} → score plausible (no rompe)', () => {
      const r = calcularSaludFinanciera({}, HOY);
      expect(r).not.toBe(null);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('usuario disciplinado típico → buena (~85)', () => {
      const r = calcularSaludFinanciera({
        gastos: [{ fecha: '2026-04-10', monto: 120_000, tipo: 'ahorro' }],  // 12%
        gastosFijos: [{ id: 1, dia: 1, pagadoEn: ['2026-04'] }],            // pagado
        deudas: [{ id: 1, total: 5_000_000, pagado: 1_000_000, cuota: 200_000,
                   periodicidad: 'mensual', fechaUltimoPago: '2026-04-01' }],  // 20% — al día
        objetivos: [],
        ingreso: 1_000_000,
        fondoEmergencia: { objetivoMeses: 6, actual: 4_000_000 },  // 67%
        lastBackupAt: '2026-04-20',  // 7 días
      }, HOY);
      // atrasos 25 + ahorro 15 + fondo 12 + deudas 15 + backup 10 + hormigas 5 = 82
      expect(r.score).toBe(82);
      expect(r.etiqueta).toBe('buena');
    });
    it('usuario excelente → 100', () => {
      const r = calcularSaludFinanciera(perfecto(), HOY);
      expect(r.score).toBe(100);
      expect(r.etiqueta).toBe('excelente');
    });
    it('no muta el input', () => {
      const input = perfecto();
      const original = JSON.parse(JSON.stringify(input));
      calcularSaludFinanciera(input, HOY);
      expect(input).toEqual(original);
    });
  });

});

// ─── calcularComparacionCategorias ───────────────────────────────────────────
//
// Compara dos catMap (períodos actual vs anterior). Devuelve análisis por
// categoría con direcciones (subio/bajo/igual/nueva/desaparecio), highlights
// y totales. Pure: dos objetos planos como input, sin S, sin DOM.

describe('calcularComparacionCategorias()', () => {

  // ── BLOQUE: ENTRADAS INVÁLIDAS ─────────────────────────────────────────────
  describe('entradas inválidas', () => {
    it('ambos no objeto → null', () => {
      expect(calcularComparacionCategorias(null, null)).toBe(null);
      expect(calcularComparacionCategorias('foo', 'bar')).toBe(null);
      expect(calcularComparacionCategorias([1], [2])).toBe(null);
    });
    it('uno válido y otro inválido → procesa el válido', () => {
      const r = calcularComparacionCategorias({ comida: 100_000 }, null);
      expect(r).not.toBe(null);
      expect(r.totalActual).toBe(100_000);
      expect(r.totalAnterior).toBe(0);
    });
    it('ambos vacíos → categorias vacío, no null', () => {
      const r = calcularComparacionCategorias({}, {});
      expect(r.categorias).toEqual([]);
      expect(r.highlights).toEqual([]);
      expect(r.totalActual).toBe(0);
      expect(r.totalAnterior).toBe(0);
    });
  });

  // ── BLOQUE: DIRECCIONES ────────────────────────────────────────────────────
  describe('direcciones', () => {
    it("'subio' cuando delta > 0 con ambos > 0", () => {
      const r = calcularComparacionCategorias(
        { comida: 200_000 },
        { comida: 100_000 }
      );
      expect(r.categorias[0].direccion).toBe('subio');
      expect(r.categorias[0].deltaPct).toBe(100);
    });
    it("'bajo' cuando delta < 0 con ambos > 0", () => {
      const r = calcularComparacionCategorias(
        { comida: 50_000 },
        { comida: 100_000 }
      );
      expect(r.categorias[0].direccion).toBe('bajo');
      expect(r.categorias[0].deltaPct).toBe(-50);
    });
    it("'igual' cuando |deltaPct| < 5%", () => {
      const r = calcularComparacionCategorias(
        { comida: 102_000 },
        { comida: 100_000 }
      );
      expect(r.categorias[0].direccion).toBe('igual');
    });
    it("'nueva' cuando solo en actual", () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000, ocio: 50_000 },
        { comida: 100_000 }
      );
      const ocio = r.categorias.find(c => c.cat === 'ocio');
      expect(ocio.direccion).toBe('nueva');
      expect(ocio.deltaPct).toBe(100);
      expect(ocio.anterior).toBe(0);
    });
    it("'desaparecio' cuando solo en anterior", () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000 },
        { comida: 100_000, ocio: 50_000 }
      );
      const ocio = r.categorias.find(c => c.cat === 'ocio');
      expect(ocio.direccion).toBe('desaparecio');
      expect(ocio.actual).toBe(0);
    });
    it("borde 5%: pct=5 → 'subio', pct=4.9 → 'igual'", () => {
      const r5 = calcularComparacionCategorias({ x: 105_000 }, { x: 100_000 });
      const r4 = calcularComparacionCategorias({ x: 104_000 }, { x: 100_000 });
      expect(r5.categorias[0].direccion).toBe('subio');
      expect(r4.categorias[0].direccion).toBe('igual');
    });
    it('cat con ambos en 0 → ignorada (no aporta info)', () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000, vacio: 0 },
        { comida: 100_000, vacio: 0 }
      );
      expect(r.categorias.find(c => c.cat === 'vacio')).toBeUndefined();
    });
  });

  // ── BLOQUE: AGREGADOS Y TOTALES ────────────────────────────────────────────
  describe('totales', () => {
    it('totalActual = suma de catMapActual', () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000, ocio: 50_000, transporte: 30_000 },
        { comida: 80_000 }
      );
      expect(r.totalActual).toBe(180_000);
    });
    it('totalAnterior = suma de catMapAnterior', () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000 },
        { comida: 80_000, ocio: 50_000, transporte: 30_000 }
      );
      expect(r.totalAnterior).toBe(160_000);
    });
    it('valores no numéricos → tratados como 0', () => {
      const r = calcularComparacionCategorias(
        { comida: 'foo', ocio: 50_000 },
        { comida: 100_000, ocio: undefined }
      );
      expect(r.totalActual).toBe(50_000);
      expect(r.totalAnterior).toBe(100_000);
    });
  });

  // ── BLOQUE: ORDENAMIENTO ───────────────────────────────────────────────────
  describe('ordenamiento por |delta|', () => {
    it('mayor cambio absoluto primero', () => {
      const r = calcularComparacionCategorias(
        { a: 100_000, b: 100_000, c: 100_000 },
        { a: 90_000,  b: 50_000,  c: 99_000 }
      );
      // Deltas: a=10k, b=50k, c=1k → orden: b, a, c
      expect(r.categorias.map(x => x.cat)).toEqual(['b', 'a', 'c']);
    });
    it('cambio negativo se ordena por |delta|', () => {
      const r = calcularComparacionCategorias(
        { a: 50_000, b: 100_000 },
        { a: 100_000, b: 100_000 }
      );
      // a: -50k, b: 0 → orden: a primero
      expect(r.categorias[0].cat).toBe('a');
    });
    it('empate exacto → alfabético (determinístico)', () => {
      const r = calcularComparacionCategorias(
        { zorro: 100_000, arena: 100_000 },
        { zorro: 50_000,  arena: 50_000 }
      );
      // mismo delta de 50k → alfabético
      expect(r.categorias[0].cat).toBe('arena');
      expect(r.categorias[1].cat).toBe('zorro');
    });
  });

  // ── BLOQUE: TOPN ───────────────────────────────────────────────────────────
  describe('config topN', () => {
    it('default 5', () => {
      const cm = { a: 1_000_000, b: 800_000, c: 600_000, d: 400_000, e: 200_000, f: 100_000 };
      const r = calcularComparacionCategorias(cm, {});
      expect(r.categorias).toHaveLength(5);
    });
    it('topN custom respetado', () => {
      const cm = { a: 100_000, b: 80_000, c: 60_000 };
      const r = calcularComparacionCategorias(cm, {}, { topN: 2 });
      expect(r.categorias).toHaveLength(2);
    });
    it('topN inválido → fallback a 5', () => {
      const cm = { a: 100_000, b: 80_000, c: 60_000, d: 40_000, e: 20_000, f: 10_000 };
      const r = calcularComparacionCategorias(cm, {}, { topN: 'foo' });
      expect(r.categorias).toHaveLength(5);
    });
    it('topN ≤ 0 → fallback a 5', () => {
      const cm = { a: 100_000, b: 80_000, c: 60_000, d: 40_000, e: 20_000, f: 10_000 };
      const r0 = calcularComparacionCategorias(cm, {}, { topN: 0 });
      const rN = calcularComparacionCategorias(cm, {}, { topN: -3 });
      expect(r0.categorias).toHaveLength(5);
      expect(rN.categorias).toHaveLength(5);
    });
  });

  // ── BLOQUE: HIGHLIGHTS ─────────────────────────────────────────────────────
  describe('highlights', () => {
    it('top 3 cambios con tipo mejora/alerta correcto', () => {
      const r = calcularComparacionCategorias(
        { comida: 200_000, ocio: 50_000, transporte: 100_000, salud: 0 },
        { comida: 100_000, ocio: 100_000, transporte: 100_000, salud: 30_000 }
      );
      // comida: subio (alerta, 100k delta), ocio: bajo (mejora, 50k), salud: desaparecio (mejora, 30k)
      // transporte: igual → no en highlights
      expect(r.highlights).toHaveLength(3);
      expect(r.highlights[0]).toEqual({ tipo: 'alerta', cat: 'comida', mensaje: expect.stringContaining('Subió 100%') });
      expect(r.highlights[1]).toEqual({ tipo: 'mejora', cat: 'ocio', mensaje: expect.stringContaining('Bajó 50%') });
      expect(r.highlights[2]).toEqual({ tipo: 'mejora', cat: 'salud', mensaje: expect.stringContaining('Dejaste de gastar') });
    });
    it("dirección 'nueva' → highlights tipo alerta", () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000, ocio: 50_000 },
        { comida: 100_000 }
      );
      const hOcio = r.highlights.find(h => h.cat === 'ocio');
      expect(hOcio.tipo).toBe('alerta');
      expect(hOcio.mensaje).toContain('Empezaste a gastar');
    });
    it("dirección 'desaparecio' → highlights tipo mejora", () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000 },
        { comida: 100_000, ocio: 50_000 }
      );
      const hOcio = r.highlights.find(h => h.cat === 'ocio');
      expect(hOcio.tipo).toBe('mejora');
    });
    it('todos los cambios "iguales" → highlights vacío', () => {
      const r = calcularComparacionCategorias(
        { comida: 102_000, ocio: 51_000 },
        { comida: 100_000, ocio: 50_000 }
      );
      expect(r.highlights).toEqual([]);
    });
    it('máximo 3 highlights aunque haya más cambios', () => {
      const r = calcularComparacionCategorias(
        { a: 1_000_000, b: 1_000_000, c: 1_000_000, d: 1_000_000, e: 1_000_000 },
        { a: 100_000,   b: 100_000,   c: 100_000,   d: 100_000,   e: 100_000 }
      );
      expect(r.highlights).toHaveLength(3);
    });
  });

  // ── BLOQUE: ESTRUCTURA DEL RETORNO ─────────────────────────────────────────
  describe('estructura del retorno', () => {
    it('cada categoria tiene shape esperada', () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000 },
        { comida: 80_000 }
      );
      expect(r.categorias[0]).toEqual({
        cat: 'comida',
        actual: 100_000,
        anterior: 80_000,
        delta: 20_000,
        deltaPct: 25,
        direccion: 'subio',
      });
    });
    it('campos top-level: categorias, highlights, totalActual, totalAnterior', () => {
      const r = calcularComparacionCategorias({ a: 100 }, { a: 50 });
      expect(r).toHaveProperty('categorias');
      expect(r).toHaveProperty('highlights');
      expect(r).toHaveProperty('totalActual');
      expect(r).toHaveProperty('totalAnterior');
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('mes típico: subió comida, bajó ocio, igual transporte', () => {
      const r = calcularComparacionCategorias(
        { comida: 600_000, ocio: 100_000, transporte: 200_000, salud: 50_000 },
        { comida: 400_000, ocio: 250_000, transporte: 195_000, salud: 50_000 }
      );
      const comida = r.categorias.find(c => c.cat === 'comida');
      const ocio   = r.categorias.find(c => c.cat === 'ocio');
      const trans  = r.categorias.find(c => c.cat === 'transporte');
      const salud  = r.categorias.find(c => c.cat === 'salud');
      expect(comida.direccion).toBe('subio');
      expect(ocio.direccion).toBe('bajo');
      expect(trans.direccion).toBe('igual');
      expect(salud.direccion).toBe('igual');
    });
    it('primer mes (sin anterior) — todas nuevas', () => {
      const r = calcularComparacionCategorias(
        { comida: 100_000, ocio: 50_000 },
        {}
      );
      expect(r.categorias).toHaveLength(2);
      expect(r.categorias.every(c => c.direccion === 'nueva')).toBe(true);
      expect(r.totalAnterior).toBe(0);
    });
    it('mes en blanco — todas desaparecieron', () => {
      const r = calcularComparacionCategorias(
        {},
        { comida: 100_000, ocio: 50_000 }
      );
      expect(r.categorias).toHaveLength(2);
      expect(r.categorias.every(c => c.direccion === 'desaparecio')).toBe(true);
      expect(r.totalActual).toBe(0);
    });
    it('no muta los inputs', () => {
      const cmA = { comida: 100_000, ocio: 50_000 };
      const cmP = { comida: 80_000 };
      const aOriginal = JSON.parse(JSON.stringify(cmA));
      const pOriginal = JSON.parse(JSON.stringify(cmP));
      calcularComparacionCategorias(cmA, cmP);
      expect(cmA).toEqual(aOriginal);
      expect(cmP).toEqual(pOriginal);
    });
    it('100 categorías (stress)', () => {
      const cmA = {}, cmP = {};
      for (let i = 0; i < 100; i++) {
        cmA[`cat${i}`] = i * 1000;
        cmP[`cat${i}`] = i * 800;
      }
      const r = calcularComparacionCategorias(cmA, cmP, { topN: 10 });
      expect(r.categorias).toHaveLength(10);
      // mayor delta: cat99 con delta de 99*200 = 19800
      expect(r.categorias[0].cat).toBe('cat99');
    });
  });

});

// ─── calcularTendencias ──────────────────────────────────────────────────────
//
// Trayectoria multi-período: para cada métrica (gastado, ahorro, hormiga,
// ingreso) determina dirección sostenida, racha actual y pendiente promedio.
// Highlights cuando alguna racha ≥ rachaMin (default 3). Pure: array de
// historial (más reciente primero) como input.

describe('calcularTendencias()', () => {

  // Helper: entrada del historial. Default todos los campos en 0.
  const H = (over = {}) => ({
    id: 1, mes: '2026-04', periodo: 'Q1 2026-04',
    gastado: 0, ahorro: 0, hormiga: 0, ingreso: 0,
    catMap: {},
    ...over,
  });

  // ── BLOQUE: ENTRADAS INVÁLIDAS / INSUFICIENTES ─────────────────────────────
  describe('entradas inválidas o insuficientes → null', () => {
    it('historial no array', () => {
      expect(calcularTendencias(null)).toBe(null);
      expect(calcularTendencias(undefined)).toBe(null);
      expect(calcularTendencias('foo')).toBe(null);
    });
    it('historial vacío', () => {
      expect(calcularTendencias([])).toBe(null);
    });
    it('historial con 1 entrada → no hay con qué juzgar', () => {
      expect(calcularTendencias([H()])).toBe(null);
    });
    it('historial con 2 entradas → < 3 mínimo', () => {
      expect(calcularTendencias([H(), H()])).toBe(null);
    });
    it('historial con 3 entradas pero menos válidas tras filtro', () => {
      expect(calcularTendencias([H(), null, undefined])).toBe(null);
    });
  });

  // ── BLOQUE: DETECCIÓN DE DIRECCIÓN ─────────────────────────────────────────
  describe('detección de dirección', () => {
    it('subiendo monotónico → racha = N-1', () => {
      // Más reciente primero. ahorro: 400, 300, 200, 100 (subiendo)
      const hist = [
        H({ ahorro: 400_000 }),
        H({ ahorro: 300_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('subiendo');
      expect(r.metricas.ahorro.racha).toBe(3);
    });
    it('bajando monotónico → racha = N-1', () => {
      const hist = [
        H({ ahorro: 100_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 300_000 }),
        H({ ahorro: 400_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('bajando');
      expect(r.metricas.ahorro.racha).toBe(3);
    });
    it('estable (cambios bajo umbral) → estable', () => {
      const hist = [
        H({ ahorro: 100_000 }),
        H({ ahorro: 101_000 }),  // +1%
        H({ ahorro: 100_500 }),
        H({ ahorro: 99_500 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('estable');
      expect(r.metricas.ahorro.racha).toBe(0);
    });
    it("racha de 1 → 'volatil'", () => {
      // Sube en el primero, luego cambia.
      const hist = [
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('volatil');
    });
    it('racha de 2 cuenta como subiendo (umbral mínimo)', () => {
      const hist = [
        H({ ahorro: 300_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('subiendo');
      expect(r.metricas.ahorro.racha).toBe(2);
    });
    it('cambio bajo umbral corta racha', () => {
      // ahorro: 200, 199.5, 100 → primer cambio (200→199.5) es <1%, corta.
      const hist = [
        H({ ahorro: 200_000 }),
        H({ ahorro: 199_500 }),
        H({ ahorro: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      // Primer paso 199.5→200 = 0.25% < 5% → corta. racha = 0. Direccion estable.
      expect(r.metricas.ahorro.racha).toBe(0);
    });
  });

  // ── BLOQUE: SIGNO Y POLARIDAD ──────────────────────────────────────────────
  describe('signo y polaridad', () => {
    it('subiendo → signo +1', () => {
      const hist = [
        H({ ahorro: 300_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
      ];
      expect(calcularTendencias(hist).metricas.ahorro.signo).toBe(1);
    });
    it('bajando → signo -1', () => {
      const hist = [
        H({ ahorro: 100_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 300_000 }),
      ];
      expect(calcularTendencias(hist).metricas.ahorro.signo).toBe(-1);
    });
    it('estable o volatil → signo 0', () => {
      const histEst = [H(), H(), H()];
      const histVol = [
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
        H({ ahorro: 300_000 }),
      ];
      expect(calcularTendencias(histEst).metricas.ahorro.signo).toBe(0);
      expect(calcularTendencias(histVol).metricas.ahorro.signo).toBe(0);
    });
    it("polaridad 'mas-es-mejor' para ahorro/ingreso", () => {
      const hist = [H(), H(), H()];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.polaridad).toBe('mas-es-mejor');
      expect(r.metricas.ingreso.polaridad).toBe('mas-es-mejor');
    });
    it("polaridad 'menos-es-mejor' para gastado/hormiga", () => {
      const hist = [H(), H(), H()];
      const r = calcularTendencias(hist);
      expect(r.metricas.gastado.polaridad).toBe('menos-es-mejor');
      expect(r.metricas.hormiga.polaridad).toBe('menos-es-mejor');
    });
  });

  // ── BLOQUE: PENDIENTE PROMEDIO ─────────────────────────────────────────────
  describe('pendientePromedio', () => {
    it('serie monotónica creciente: pendiente positiva', () => {
      const hist = [
        H({ ahorro: 400_000 }),  // reciente
        H({ ahorro: 300_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),  // viejo
      ];
      const r = calcularTendencias(hist);
      // (400 - 100) / 3 = 100k por período
      expect(r.metricas.ahorro.pendientePromedio).toBe(100_000);
    });
    it('serie monotónica decreciente: pendiente negativa', () => {
      const hist = [
        H({ ahorro: 100_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 300_000 }),
        H({ ahorro: 400_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.pendientePromedio).toBe(-100_000);
    });
    it('estable: pendiente cerca de cero', () => {
      const hist = [H(), H(), H()];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.pendientePromedio).toBe(0);
    });
  });

  // ── BLOQUE: HIGHLIGHTS ─────────────────────────────────────────────────────
  describe('highlights por racha ≥ rachaMin', () => {
    it("ahorro bajando 3+ períodos → alerta", () => {
      const hist = [
        H({ ahorro: 100_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 300_000 }),
        H({ ahorro: 400_000 }),
      ];
      const r = calcularTendencias(hist);
      const hl = r.highlights.find(h => h.metrica === 'ahorro');
      expect(hl).toBeDefined();
      expect(hl.tipo).toBe('alerta');
    });
    it("ahorro subiendo 3+ períodos → mejora", () => {
      const hist = [
        H({ ahorro: 400_000 }),
        H({ ahorro: 300_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      const hl = r.highlights.find(h => h.metrica === 'ahorro');
      expect(hl.tipo).toBe('mejora');
    });
    it("hormiga subiendo 3+ → alerta (menos-es-mejor)", () => {
      const hist = [
        H({ hormiga: 100_000 }),
        H({ hormiga: 70_000 }),
        H({ hormiga: 50_000 }),
        H({ hormiga: 20_000 }),
      ];
      const r = calcularTendencias(hist);
      const hl = r.highlights.find(h => h.metrica === 'hormiga');
      expect(hl.tipo).toBe('alerta');
    });
    it("hormiga bajando 3+ → mejora (menos-es-mejor)", () => {
      const hist = [
        H({ hormiga: 20_000 }),
        H({ hormiga: 50_000 }),
        H({ hormiga: 70_000 }),
        H({ hormiga: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      const hl = r.highlights.find(h => h.metrica === 'hormiga');
      expect(hl.tipo).toBe('mejora');
    });
    it('rachaMin custom = 4 ignora rachas de 3', () => {
      const hist = [
        H({ ahorro: 100_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 300_000 }),
        H({ ahorro: 400_000 }),
      ];
      const r = calcularTendencias(hist, { rachaMin: 4 });
      expect(r.highlights).toEqual([]);
    });
    it('múltiples métricas con racha → múltiples highlights', () => {
      const hist = [
        H({ ahorro: 100_000, hormiga: 100_000 }),
        H({ ahorro: 200_000, hormiga: 70_000 }),
        H({ ahorro: 300_000, hormiga: 50_000 }),
        H({ ahorro: 400_000, hormiga: 20_000 }),
      ];
      const r = calcularTendencias(hist);
      // ahorro bajando (alerta), hormiga subiendo (alerta) → 2 highlights
      expect(r.highlights).toHaveLength(2);
      expect(r.highlights.every(h => h.tipo === 'alerta')).toBe(true);
    });
    it('alertas antes que mejoras en orden', () => {
      const hist = [
        // ahorro subiendo (mejora), gastado subiendo (alerta)
        H({ ahorro: 400_000, gastado: 400_000 }),
        H({ ahorro: 300_000, gastado: 300_000 }),
        H({ ahorro: 200_000, gastado: 200_000 }),
        H({ ahorro: 100_000, gastado: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.highlights[0].tipo).toBe('alerta');
    });
  });

  // ── BLOQUE: CONFIG ─────────────────────────────────────────────────────────
  describe('config', () => {
    it('ventana custom limita análisis a N entradas', () => {
      const hist = [];
      // 6 entradas: las 3 más recientes son estables, las 3 viejas suben
      for (let i = 0; i < 3; i++) hist.push(H({ ahorro: 100_000 }));
      hist.push(H({ ahorro: 200_000 }));
      hist.push(H({ ahorro: 300_000 }));
      hist.push(H({ ahorro: 400_000 }));
      const rVent3 = calcularTendencias(hist, { ventana: 3 });
      expect(rVent3.metricas.ahorro.direccion).toBe('estable');
      const rVent6 = calcularTendencias(hist, { ventana: 6 });
      // Entre las 6 hay subida desde el viejo, pero las 3 recientes son estables
      // → racha desde el más reciente = 0 → estable. Confirma que cuenta desde
      // el punto reciente, no desde el viejo.
      expect(rVent6.metricas.ahorro.racha).toBe(0);
    });
    it('ventana < 3 se trata como inválida → fallback default', () => {
      const hist = [
        H({ ahorro: 300_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
      ];
      const r = calcularTendencias(hist, { ventana: 2 });
      expect(r.nDatos).toBe(3);
    });
    it('umbralCambio custom (0.20) ignora cambios menores', () => {
      // 10% changes → no cuentan con umbral 20%
      const hist = [
        H({ ahorro: 121_000 }),
        H({ ahorro: 110_000 }),
        H({ ahorro: 100_000 }),
      ];
      const rDef = calcularTendencias(hist);
      const rUmb = calcularTendencias(hist, { umbralCambio: 0.20 });
      expect(rDef.metricas.ahorro.direccion).toBe('subiendo');
      expect(rUmb.metricas.ahorro.direccion).toBe('estable');
    });
    it('config null o no-objeto → defaults', () => {
      const hist = [
        H({ ahorro: 300_000 }),
        H({ ahorro: 200_000 }),
        H({ ahorro: 100_000 }),
      ];
      expect(calcularTendencias(hist, null).metricas.ahorro.racha).toBe(2);
      expect(calcularTendencias(hist, 'foo').metricas.ahorro.racha).toBe(2);
    });
  });

  // ── BLOQUE: ENTRADAS MALFORMADAS ───────────────────────────────────────────
  describe('entradas malformadas', () => {
    it('items null/no-objeto se filtran', () => {
      const hist = [
        H({ ahorro: 300_000 }),
        null,
        H({ ahorro: 200_000 }),
        'foo',
        H({ ahorro: 100_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r).not.toBe(null);
      expect(r.nDatos).toBe(3);
    });
    it('campos faltantes → tratados como 0', () => {
      const hist = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('estable');
    });
    it('valores no numéricos → tratados como 0', () => {
      const hist = [
        H({ ahorro: 'a' }),
        H({ ahorro: undefined }),
        H({ ahorro: NaN }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('estable');
    });
    it('división por cero (anterior=0) maneja seguro', () => {
      const hist = [
        H({ ahorro: 100_000 }),
        H({ ahorro: 0 }),
        H({ ahorro: 0 }),
      ];
      const r = calcularTendencias(hist);
      // anterior=0, actual=100k, signo positivo → cuenta como subiendo (racha 1)
      // luego anterior=0, actual=0 → delta=0, no cuenta → corta
      expect(r.metricas.ahorro.racha).toBeLessThanOrEqual(1);
    });
  });

  // ── BLOQUE: ESTRUCTURA DEL RETORNO ─────────────────────────────────────────
  describe('estructura del retorno', () => {
    it('contiene las 4 métricas', () => {
      const hist = [H(), H(), H()];
      const r = calcularTendencias(hist);
      expect(Object.keys(r.metricas)).toEqual(['gastado', 'ahorro', 'hormiga', 'ingreso']);
    });
    it('cada métrica tiene shape esperada', () => {
      const hist = [H(), H(), H()];
      const r = calcularTendencias(hist);
      ['direccion', 'racha', 'signo', 'pendientePromedio', 'polaridad', 'mensaje']
        .forEach(k => expect(r.metricas.ahorro).toHaveProperty(k));
    });
    it('campos top-level: ventana, nDatos, metricas, highlights', () => {
      const r = calcularTendencias([H(), H(), H()]);
      expect(r).toHaveProperty('ventana');
      expect(r).toHaveProperty('nDatos');
      expect(r).toHaveProperty('metricas');
      expect(r).toHaveProperty('highlights');
    });
  });

  // ── BLOQUE: CASOS REALES ───────────────────────────────────────────────────
  describe('casos reales', () => {
    it('usuario con disciplina creciente: ahorro sube, hormiga baja', () => {
      const hist = [
        H({ ahorro: 400_000, hormiga: 20_000 }),
        H({ ahorro: 300_000, hormiga: 50_000 }),
        H({ ahorro: 200_000, hormiga: 80_000 }),
        H({ ahorro: 100_000, hormiga: 120_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('subiendo');
      expect(r.metricas.hormiga.direccion).toBe('bajando');
      expect(r.highlights.every(h => h.tipo === 'mejora')).toBe(true);
      expect(r.highlights).toHaveLength(2);
    });
    it('usuario en alerta: gastos subiendo, ahorro bajando', () => {
      const hist = [
        H({ gastado: 800_000, ahorro: 50_000 }),
        H({ gastado: 700_000, ahorro: 100_000 }),
        H({ gastado: 600_000, ahorro: 150_000 }),
        H({ gastado: 500_000, ahorro: 200_000 }),
      ];
      const r = calcularTendencias(hist);
      expect(r.highlights).toHaveLength(2);
      expect(r.highlights.every(h => h.tipo === 'alerta')).toBe(true);
    });
    it('historial de 12 períodos (anual) con ventana 4', () => {
      const hist = [];
      for (let i = 0; i < 12; i++) {
        hist.push(H({ ahorro: 100_000 + i * 10_000 }));  // subiendo gradualmente
      }
      // Más reciente al inicio → 100k. Viejo al final → 210k. Bajando.
      const r = calcularTendencias(hist);
      expect(r.metricas.ahorro.direccion).toBe('bajando');
      expect(r.nDatos).toBe(4);  // ventana default
    });
    it('no muta el historial', () => {
      const hist = [H({ ahorro: 100 }), H({ ahorro: 200 }), H({ ahorro: 300 })];
      const original = JSON.parse(JSON.stringify(hist));
      calcularTendencias(hist);
      expect(hist).toEqual(original);
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// predecirFinQuincena()  — Tanda 14
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure: dado un set de gastos del periodo en curso, ingreso, saldoActual,
// tipoPeriodo y hoyStr, proyecta linealmente el saldo al cierre del periodo.
// Cubrimos: rangos por tipoPeriodo, severidades con/sin ingreso, diagnósticos
// (sin-datos, periodo-sin-iniciar, fuera-de-periodo, fin-de-periodo, normal),
// edge cases, y robustez ante inputs basura.

describe('_rangoPeriodo()', () => {
  it('q1 → 1-15 con mes de 31 días', () => {
    const r = _rangoPeriodo('2026-01-10', 'q1');
    expect(r.inicio).toBe('2026-01-01');
    expect(r.fin).toBe('2026-01-15');
    expect(r.diasTotales).toBe(15);
  });
  it('q2 → 16-31 en enero', () => {
    const r = _rangoPeriodo('2026-01-20', 'q2');
    expect(r.inicio).toBe('2026-01-16');
    expect(r.fin).toBe('2026-01-31');
    expect(r.diasTotales).toBe(16);
  });
  it('q2 → 16-28 en febrero no bisiesto', () => {
    const r = _rangoPeriodo('2026-02-20', 'q2');
    expect(r.inicio).toBe('2026-02-16');
    expect(r.fin).toBe('2026-02-28');
    expect(r.diasTotales).toBe(13);
  });
  it('q2 → 16-29 en febrero bisiesto', () => {
    const r = _rangoPeriodo('2024-02-20', 'q2');
    expect(r.inicio).toBe('2024-02-16');
    expect(r.fin).toBe('2024-02-29');
    expect(r.diasTotales).toBe(14);
  });
  it('q2 → 16-30 en abril', () => {
    const r = _rangoPeriodo('2026-04-20', 'q2');
    expect(r.fin).toBe('2026-04-30');
    expect(r.diasTotales).toBe(15);
  });
  it('mensual → 1-último-día', () => {
    const r = _rangoPeriodo('2026-03-15', 'mensual');
    expect(r.inicio).toBe('2026-03-01');
    expect(r.fin).toBe('2026-03-31');
    expect(r.diasTotales).toBe(31);
  });
  it('mensual febrero bisiesto → 29 días', () => {
    const r = _rangoPeriodo('2024-02-10', 'mensual');
    expect(r.fin).toBe('2024-02-29');
    expect(r.diasTotales).toBe(29);
  });
  it('hoyStr inválido → null', () => {
    expect(_rangoPeriodo('xx', 'q1')).toBe(null);
    expect(_rangoPeriodo('2026/01/10', 'q1')).toBe(null);
    expect(_rangoPeriodo('', 'q1')).toBe(null);
    expect(_rangoPeriodo(null, 'q1')).toBe(null);
  });
  it('tipoPeriodo inválido → null', () => {
    expect(_rangoPeriodo('2026-01-10', 'xxx')).toBe(null);
    expect(_rangoPeriodo('2026-01-10', '')).toBe(null);
    expect(_rangoPeriodo('2026-01-10', null)).toBe(null);
  });
  it('mes fuera de 1-12 → null', () => {
    expect(_rangoPeriodo('2026-13-01', 'q1')).toBe(null);
    expect(_rangoPeriodo('2026-00-01', 'q1')).toBe(null);
  });
});

describe('predecirFinQuincena()', () => {

  // Helper para generar gastos consistentes.
  const G = ({ fecha, monto = 10000, tipo = 'necesidad', montoTotal } = {}) => ({
    id: Date.now() + Math.random(), desc: 'g', cat: 'Otros',
    monto, montoTotal: montoTotal != null ? montoTotal : monto,
    tipo, fecha, fondo: 'efectivo',
  });

  describe('rangos de fechas por tipoPeriodo', () => {
    it('q1: hoy día 8 → 8 transcurridos, 7 restantes', () => {
      const gastos = [G({ fecha: '2026-05-01', monto: 10000 })];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-08');
      expect(r.fechaInicio).toBe('2026-05-01');
      expect(r.fechaFin).toBe('2026-05-15');
      expect(r.diasTotales).toBe(15);
      expect(r.diasTranscurridos).toBe(8);
      expect(r.diasRestantes).toBe(7);
    });
    it('q2: hoy día 20 (mes de 31) → 5 transcurridos, 11 restantes', () => {
      const r = predecirFinQuincena([], 0, 100000, 'q2', '2026-05-20');
      expect(r.fechaInicio).toBe('2026-05-16');
      expect(r.fechaFin).toBe('2026-05-31');
      expect(r.diasTranscurridos).toBe(5);
      expect(r.diasRestantes).toBe(11);
    });
    it('mensual: hoy día 10 → 10 transcurridos, 21 restantes', () => {
      const r = predecirFinQuincena([], 0, 100000, 'mensual', '2026-05-10');
      expect(r.fechaInicio).toBe('2026-05-01');
      expect(r.fechaFin).toBe('2026-05-31');
      expect(r.diasTranscurridos).toBe(10);
      expect(r.diasRestantes).toBe(21);
    });
  });

  describe('cálculo de ritmo y proyección', () => {
    it('200k en 4 días → ritmo 50k/día, 11 días restantes → +550k', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 50000 }),
        G({ fecha: '2026-05-02', monto: 50000 }),
        G({ fecha: '2026-05-03', monto: 50000 }),
        G({ fecha: '2026-05-04', monto: 50000 }),
      ];
      const r = predecirFinQuincena(gastos, 0, 1000000, 'q1', '2026-05-04');
      expect(r.gastoActual).toBe(200000);
      expect(r.diasTranscurridos).toBe(4);
      expect(r.diasRestantes).toBe(11);
      expect(r.ritmoDiario).toBe(50000);
      expect(r.proyeccionAdicional).toBe(550000);
      expect(r.proyeccionTotal).toBe(750000);
      expect(r.saldoProyectado).toBe(450000);
    });
    it('usa montoTotal si está presente (sobre monto)', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 1000, montoTotal: 1004 }),
        G({ fecha: '2026-05-02', monto: 1000, montoTotal: 1004 }),
      ];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-02');
      expect(r.gastoActual).toBe(2008);
    });
    it('excluye gastos tipo "ahorro"', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 50000, tipo: 'necesidad' }),
        G({ fecha: '2026-05-02', monto: 30000, tipo: 'ahorro' }),
      ];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-02');
      expect(r.gastoActual).toBe(50000);
    });
    it('excluye gastos con fecha antes del inicio del periodo', () => {
      const gastos = [
        G({ fecha: '2026-04-29', monto: 100000 }), // fuera (q1 mayo)
        G({ fecha: '2026-05-01', monto: 50000  }),
      ];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-04');
      expect(r.gastoActual).toBe(50000);
    });
    it('excluye gastos con fecha posterior a hoy (no se ha "gastado" aún)', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 50000 }),
        G({ fecha: '2026-05-10', monto: 80000 }), // futuro vs hoy=05-04
      ];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-04');
      expect(r.gastoActual).toBe(50000);
    });
    it('redondea proyeccionAdicional a entero', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 1 }),
        G({ fecha: '2026-05-02', monto: 1 }),
        G({ fecha: '2026-05-03', monto: 1 }),
      ];
      // ritmo = 1, 12 días restantes → 12 (entero)
      const r = predecirFinQuincena(gastos, 0, 1000, 'q1', '2026-05-03');
      expect(Number.isInteger(r.proyeccionAdicional)).toBe(true);
    });
  });

  describe('severidades con ingreso', () => {
    // ingreso 1.000.000, periodo q1 mayo (15 días).
    // Para gastoActual=X en día 5 → ritmo X/5/día → proyeccionAdicional = X/5*10
    const fecha = (d) => `2026-05-${String(d).padStart(2, '0')}`;
    const conGastoEnDia = (totalEnDia, dia) => {
      const gastos = [];
      for (let i = 1; i <= dia; i++) {
        gastos.push(G({ fecha: fecha(i), monto: totalEnDia / dia }));
      }
      return gastos;
    };

    it('saldoProyectado<0 → critico', () => {
      // ingreso 1M, gastoActual=600k en 5 días → ritmo 120k/día * 10 = 1.2M proyAd
      // saldoActual=1M, saldoProyectado = 1M - 1.2M = -200k → critico
      const r = predecirFinQuincena(
        conGastoEnDia(600000, 5), 1000000, 1000000, 'q1', '2026-05-05'
      );
      expect(r.severidad).toBe('critico');
      expect(r.saldoProyectado).toBeLessThan(0);
    });
    it('saldoProyectado < ingreso*5% → alerta', () => {
      // ingreso 1M, saldo 600k, gasto 250k en 5 días → ritmo 50k/día * 10 = 500k
      // saldoProyectado = 600k-500k = 100k > ing*5%=50k → ok (NO alerta)
      // Para alerta: saldoProyectado entre 0 y 50k. Ajuste:
      // saldo 510k, gasto 250k en 5 días → proyAd 500k → saldoProy 10k < 50k → alerta
      const r = predecirFinQuincena(
        conGastoEnDia(250000, 5), 1000000, 510000, 'q1', '2026-05-05'
      );
      expect(r.severidad).toBe('alerta');
      expect(r.saldoProyectado).toBeGreaterThanOrEqual(0);
      expect(r.saldoProyectado).toBeLessThan(50000);
    });
    it('pctIngreso>=95% → cuidado', () => {
      // gasto 480k en 5 días → ritmo 96k/día * 10 = 960k → total 1.44M
      // ingreso 1.5M → pct = 96% → cuidado (con saldo grande para que NO sea critico/alerta)
      const r = predecirFinQuincena(
        conGastoEnDia(480000, 5), 1500000, 5000000, 'q1', '2026-05-05'
      );
      expect(r.severidad).toBe('cuidado');
      expect(r.pctIngresoProyectado).toBeGreaterThanOrEqual(95);
    });
    it('pctIngreso<70% → excelente', () => {
      // gasto 100k en 5 días → ritmo 20k/día * 10 = 200k → total 300k
      // ingreso 1M → pct = 30% → excelente
      const r = predecirFinQuincena(
        conGastoEnDia(100000, 5), 1000000, 5000000, 'q1', '2026-05-05'
      );
      expect(r.severidad).toBe('excelente');
      expect(r.pctIngresoProyectado).toBeLessThan(70);
    });
    it('caso intermedio (70-95%) → ok', () => {
      // gasto 400k en 5 días → ritmo 80k/día * 10 = 800k → total 1.2M
      // ingreso 1.5M → pct = 80% → ok
      const r = predecirFinQuincena(
        conGastoEnDia(400000, 5), 1500000, 5000000, 'q1', '2026-05-05'
      );
      expect(r.severidad).toBe('ok');
      expect(r.pctIngresoProyectado).toBeGreaterThanOrEqual(70);
      expect(r.pctIngresoProyectado).toBeLessThan(95);
    });
  });

  describe('severidades sin ingreso (ingreso=0)', () => {
    it('saldoProyectado<0 → critico', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 50000 }),
        G({ fecha: '2026-05-02', monto: 50000 }),
        G({ fecha: '2026-05-03', monto: 50000 }),
        G({ fecha: '2026-05-04', monto: 50000 }),
        G({ fecha: '2026-05-05', monto: 50000 }),
      ];
      // ritmo 50k/día * 10 = 500k. saldoActual 100k → saldoProy = -400k → critico
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-05');
      expect(r.severidad).toBe('critico');
    });
    it('saldoProyectado<saldoActual*10% → alerta', () => {
      // ritmo bajo pero saldo MUY al filo: saldo 510k, ritmo 50k/día * 10 = 500k
      // saldoProy = 10k < 51k (saldo*10%) → alerta
      const gastos = Array.from({ length: 5 }, (_, i) => ({
        ...G({ fecha: `2026-05-0${i + 1}`, monto: 50000 }),
      }));
      const r = predecirFinQuincena(gastos, 0, 510000, 'q1', '2026-05-05');
      expect(r.severidad).toBe('alerta');
    });
    it('saldoProyectado holgado → ok (sin excelente porque no hay ingreso)', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 5000 }),
        G({ fecha: '2026-05-02', monto: 5000 }),
        G({ fecha: '2026-05-03', monto: 5000 }),
      ];
      // ritmo 5k/día * 12 = 60k. saldo 1M → saldoProy 940k → ok
      const r = predecirFinQuincena(gastos, 0, 1000000, 'q1', '2026-05-03');
      expect(r.severidad).toBe('ok');
    });
  });

  describe('diagnósticos', () => {
    it('gastos vacíos → diagnostico="sin-datos", severidad="ok"', () => {
      const r = predecirFinQuincena([], 1000000, 500000, 'q1', '2026-05-05');
      expect(r.diagnostico).toBe('sin-datos');
      expect(r.severidad).toBe('ok');
      expect(r.gastoActual).toBe(0);
    });
    it('día 1 con gastos → diagnostico="periodo-sin-iniciar"', () => {
      const gastos = [G({ fecha: '2026-05-01', monto: 100000 })];
      const r = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-01');
      expect(r.diagnostico).toBe('periodo-sin-iniciar');
      expect(r.severidad).toBe('ok');
      expect(r.diasTranscurridos).toBe(1);
    });
    it('hoy fuera del periodo (q1 pero hoy=día 20) → fuera-de-periodo', () => {
      const gastos = [G({ fecha: '2026-05-01', monto: 50000 })];
      const r = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-20');
      expect(r.diagnostico).toBe('fuera-de-periodo');
      expect(r.severidad).toBe('ok');
    });
    it('hoy=día 15 (último de q1) con gastos → fin-de-periodo', () => {
      const gastos = Array.from({ length: 15 }, (_, i) => G({
        fecha: `2026-05-${String(i + 1).padStart(2, '0')}`, monto: 10000,
      }));
      const r = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-15');
      expect(r.diagnostico).toBe('fin-de-periodo');
      expect(r.diasRestantes).toBe(0);
      expect(r.proyeccionAdicional).toBe(0);
    });
    it('caso normal → diagnostico="normal"', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 10000 }),
        G({ fecha: '2026-05-03', monto: 15000 }),
      ];
      const r = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-04');
      expect(r.diagnostico).toBe('normal');
    });
    it('config minDiasParaProyectar=1 permite día 1', () => {
      const gastos = [G({ fecha: '2026-05-01', monto: 30000 })];
      const r = predecirFinQuincena(
        gastos, 1000000, 500000, 'q1', '2026-05-01',
        { minDiasParaProyectar: 1 }
      );
      expect(r.diagnostico).toBe('normal');
    });
  });

  describe('robustez', () => {
    it('tipoPeriodo inválido → null', () => {
      expect(predecirFinQuincena([], 0, 0, 'xxx', '2026-05-05')).toBe(null);
    });
    it('hoyStr inválido → null', () => {
      expect(predecirFinQuincena([], 0, 0, 'q1', 'no-fecha')).toBe(null);
    });
    it('gastos null → tratado como []', () => {
      const r = predecirFinQuincena(null, 1000000, 500000, 'q1', '2026-05-05');
      expect(r.diagnostico).toBe('sin-datos');
    });
    it('gastos no-array → tratado como []', () => {
      const r = predecirFinQuincena('foo', 1000000, 500000, 'q1', '2026-05-05');
      expect(r.diagnostico).toBe('sin-datos');
    });
    it('ingreso negativo → tratado como 0', () => {
      const gastos = Array.from({ length: 5 }, (_, i) => G({
        fecha: `2026-05-0${i + 1}`, monto: 5000,
      }));
      const r = predecirFinQuincena(gastos, -1000, 100000, 'q1', '2026-05-05');
      expect(r.pctIngresoProyectado).toBe(null); // sin ingreso válido
    });
    it('saldoActual negativo es respetado (puede ser real)', () => {
      const gastos = Array.from({ length: 5 }, (_, i) => G({
        fecha: `2026-05-0${i + 1}`, monto: 5000,
      }));
      const r = predecirFinQuincena(gastos, 1000000, -50000, 'q1', '2026-05-05');
      expect(r.saldoProyectado).toBeLessThan(0);
      expect(r.severidad).toBe('critico');
    });
    it('gastos con fecha inválida se ignoran', () => {
      const gastos = [
        G({ fecha: 'no-fecha', monto: 999999 }),
        G({ fecha: '2026-05-01', monto: 50000 }),
      ];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-05');
      expect(r.gastoActual).toBe(50000);
    });
    it('gastos con monto/montoTotal no numérico se ignoran', () => {
      const gastos = [
        { id: 1, fecha: '2026-05-01', monto: 'abc', tipo: 'necesidad' },
        { id: 2, fecha: '2026-05-02' },                          // sin monto
        G({ fecha: '2026-05-03', monto: 30000 }),
      ];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-05');
      expect(r.gastoActual).toBe(30000);
    });
    it('monto negativo se ignora (no resta)', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: -10000 }),
        G({ fecha: '2026-05-02', monto: 50000 }),
      ];
      const r = predecirFinQuincena(gastos, 0, 100000, 'q1', '2026-05-05');
      expect(r.gastoActual).toBe(50000);
    });
  });

  describe('determinismo y mutación', () => {
    it('misma entrada → mismo output', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 50000 }),
        G({ fecha: '2026-05-02', monto: 30000 }),
      ];
      const a = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-05');
      const b = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-05');
      expect(a).toEqual(b);
    });
    it('no muta gastos', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 50000 }),
        G({ fecha: '2026-05-02', monto: 30000 }),
      ];
      const original = JSON.parse(JSON.stringify(gastos));
      predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-05');
      expect(gastos).toEqual(original);
    });
    it('todos los montos retornados son números enteros (no fracciones)', () => {
      const gastos = [
        G({ fecha: '2026-05-01', monto: 13333 }),
        G({ fecha: '2026-05-02', monto: 13333 }),
        G({ fecha: '2026-05-03', monto: 13333 }),
      ];
      const r = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-03');
      expect(Number.isInteger(r.gastoActual)).toBe(true);
      expect(Number.isInteger(r.proyeccionAdicional)).toBe(true);
      expect(Number.isInteger(r.proyeccionTotal)).toBe(true);
      expect(Number.isInteger(r.saldoProyectado)).toBe(true);
    });
  });

  describe('mensaje', () => {
    it('crítico menciona "rojo"', () => {
      const gastos = Array.from({ length: 5 }, (_, i) => G({
        fecha: `2026-05-0${i + 1}`, monto: 100000,
      }));
      const r = predecirFinQuincena(gastos, 1000000, 500000, 'q1', '2026-05-05');
      expect(r.severidad).toBe('critico');
      expect(r.mensaje).toMatch(/rojo/i);
    });
    it('cuidado menciona porcentaje del ingreso', () => {
      const gastos = Array.from({ length: 5 }, (_, i) => G({
        fecha: `2026-05-0${i + 1}`, monto: 96000,
      }));
      const r = predecirFinQuincena(gastos, 1500000, 5000000, 'q1', '2026-05-05');
      expect(r.severidad).toBe('cuidado');
      expect(r.mensaje).toMatch(/%/);
    });
    it('mensaje siempre es string no vacío', () => {
      const gastos = Array.from({ length: 5 }, (_, i) => G({
        fecha: `2026-05-0${i + 1}`, monto: 5000,
      }));
      for (const ing of [0, 100000, 1000000, 5000000]) {
        for (const saldo of [0, 100000, 500000, 5000000]) {
          const r = predecirFinQuincena(gastos, ing, saldo, 'q1', '2026-05-05');
          expect(typeof r.mensaje).toBe('string');
          expect(r.mensaje.length).toBeGreaterThan(0);
        }
      }
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// validarTipoPeriodo()  — Tanda 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure: valida que el tipoPeriodo actual sea consistente con el día del mes.
// Retorna { tipoPeriodo, valido, motivo? }. La lógica es simple: día 1-15 → q1,
// día 16-31 → q2. No usa Date.UTC ni cálculos complejos — es determinístico
// basado solo en día del mes, garantizando consistencia con _rangoPeriodo().

describe('validarTipoPeriodo()', () => {

  describe('casos normales — sin corrección', () => {
    it('día 1-15 con q1 → valido=true', () => {
      const r = validarTipoPeriodo('2026-05-01', 'q1');
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(true);
      expect(r.motivo).toBeUndefined();
    });
    it('día 5 con q1 → valido=true', () => {
      const r = validarTipoPeriodo('2026-05-05', 'q1');
      expect(r.valido).toBe(true);
    });
    it('día 15 (último de q1) con q1 → valido=true', () => {
      const r = validarTipoPeriodo('2026-05-15', 'q1');
      expect(r.valido).toBe(true);
    });
    it('día 16-31 con q2 → valido=true', () => {
      const r = validarTipoPeriodo('2026-05-20', 'q2');
      expect(r.tipoPeriodo).toBe('q2');
      expect(r.valido).toBe(true);
    });
    it('día 31 (último de mes) con q2 → valido=true', () => {
      const r = validarTipoPeriodo('2026-05-31', 'q2');
      expect(r.valido).toBe(true);
    });
    it('febrero 28 (no bisiesto) con q2 → valido=true', () => {
      const r = validarTipoPeriodo('2026-02-28', 'q2');
      expect(r.valido).toBe(true);
    });
    it('febrero 29 (bisiesto) con q2 → valido=true', () => {
      const r = validarTipoPeriodo('2024-02-29', 'q2');
      expect(r.valido).toBe(true);
    });
  });

  describe('mismatches — requieren corrección', () => {
    it('día 5 con q2 → valido=false, tipoPeriodo=q1', () => {
      const r = validarTipoPeriodo('2026-05-05', 'q2');
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(false);
      expect(r.motivo).toBeDefined();
    });
    it('día 20 con q1 → valido=false, tipoPeriodo=q2', () => {
      const r = validarTipoPeriodo('2026-05-20', 'q1');
      expect(r.tipoPeriodo).toBe('q2');
      expect(r.valido).toBe(false);
      expect(r.motivo).toContain('q1');
    });
    it('día 1 con q2 → valido=false, tipoPeriodo=q1', () => {
      const r = validarTipoPeriodo('2026-05-01', 'q2');
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(false);
    });
    it('día 16 con q1 → valido=false, tipoPeriodo=q2', () => {
      const r = validarTipoPeriodo('2026-05-16', 'q1');
      expect(r.tipoPeriodo).toBe('q2');
      expect(r.valido).toBe(false);
    });
    it('motivo incluye el día y el tipoPeriodo incorrecto', () => {
      const r = validarTipoPeriodo('2026-05-10', 'q2');
      expect(r.motivo).toContain('10');
      expect(r.motivo).toContain('q2');
    });
  });

  describe('edge cases — entrada inválida', () => {
    it('hoyStr formato inválido (no YYYY-MM-DD) → valido=false, fallback q1', () => {
      const r = validarTipoPeriodo('no-fecha', 'q1');
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(false);
      expect(r.motivo).toBe('fecha-invalida');
    });
    it('hoyStr null → valido=false', () => {
      const r = validarTipoPeriodo(null, 'q1');
      expect(r.valido).toBe(false);
      expect(r.motivo).toBe('fecha-invalida');
    });
    it('hoyStr undefined → valido=false', () => {
      const r = validarTipoPeriodo(undefined, 'q1');
      expect(r.valido).toBe(false);
    });
    it('hoyStr número → valido=false', () => {
      const r = validarTipoPeriodo(20260505, 'q1');
      expect(r.valido).toBe(false);
    });
    it('día 00 en formato → valido=false', () => {
      const r = validarTipoPeriodo('2026-05-00', 'q1');
      expect(r.valido).toBe(false);
    });
    it('día 32 en formato → valido=false', () => {
      const r = validarTipoPeriodo('2026-05-32', 'q1');
      expect(r.valido).toBe(false);
    });
    it('tipoPeriodoActual con typo "q3" → retorna correcto, valido=false', () => {
      const r = validarTipoPeriodo('2026-05-05', 'q3');
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(false);
    });
    it('tipoPeriodoActual con typo "quincenal" → retorna correcto, valido=false', () => {
      const r = validarTipoPeriodo('2026-05-05', 'quincenal');
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(false);
    });
    it('tipoPeriodoActual null → retorna correcto, valido=false', () => {
      const r = validarTipoPeriodo('2026-05-05', null);
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(false);
    });
  });

  describe('determinismo', () => {
    it('misma entrada → mismo output', () => {
      const a = validarTipoPeriodo('2026-05-05', 'q1');
      const b = validarTipoPeriodo('2026-05-05', 'q1');
      expect(a).toEqual(b);
    });
    it('no depende de la fecha "actual" (usa hoyStr inyectable)', () => {
      const r1 = validarTipoPeriodo('2026-05-05', 'q1');
      const r2 = validarTipoPeriodo('2026-05-05', 'q1');
      expect(r1).toEqual(r2);
    });
  });

  describe('integración con _rangoPeriodo', () => {
    it('día 1-15 con q1 → rango _rangoPeriodo coincide', () => {
      const v = validarTipoPeriodo('2026-05-10', 'q1');
      const rango = _rangoPeriodo('2026-05-10', 'q1');
      expect(v.valido).toBe(true);
      expect(v.tipoPeriodo).toBe('q1');
      expect(rango.inicio).toBe('2026-05-01');
      expect(rango.fin).toBe('2026-05-15');
    });
    it('día 16-31 con q2 → rango _rangoPeriodo coincide', () => {
      const v = validarTipoPeriodo('2026-05-25', 'q2');
      const rango = _rangoPeriodo('2026-05-25', 'q2');
      expect(v.valido).toBe(true);
      expect(v.tipoPeriodo).toBe('q2');
      expect(rango.inicio).toBe('2026-05-16');
      expect(rango.fin).toBe('2026-05-31');
    });
    it('validador nunca corrige "mensual" a q1/q2 (lo deja pasar como inválido)', () => {
      // En el contexto de la app, si alguien pone tipoPeriodo='mensual',
      // el validador retorna q1 (correcto para hoy) pero valido=false.
      // Esto es intencional: "mensual" es un modo de visualización alternativo,
      // no una verdad absoluta sobre el día del mes.
      const r = validarTipoPeriodo('2026-05-10', 'mensual');
      expect(r.tipoPeriodo).toBe('q1');
      expect(r.valido).toBe(false);
    });
  });

});

// ─── detectarAlertasUrgentes ─────────────────────────────────────────────────
// Tanda 19: Detecta saldo negativo, eventos excedidos/cerca del límite, y
// ausencia prolongada de registros. Función pura — no lee S, no toca DOM.

describe('detectarAlertasUrgentes()', () => {

  // ── helpers ──────────────────────────────────────────────────────────────
  const saldosOk   = { efectivo: 500_000, banco: 1_000_000 };
  const saldosCero = { efectivo: 0, banco: 0 };
  const hoy = '2026-05-10';

  const eventoOk = {
    tipo: 'evento', nombre: 'Fiesta', presupuesto: 1_000_000, gastado: 400_000,
  };
  const eventoCerca = {
    tipo: 'evento', nombre: 'Viaje', presupuesto: 1_000_000, gastado: 870_000,
  };
  const eventoExcedido = {
    tipo: 'evento', nombre: 'Boda', presupuesto: 1_000_000, gastado: 1_200_000,
  };
  const gastoReciente = [{ fecha: '2026-05-09' }];
  const gastoViejo    = [{ fecha: '2026-04-20' }]; // 20 días atrás

  // ── input inválido ────────────────────────────────────────────────────────
  describe('input inválido', () => {
    it('null → []', () => {
      expect(detectarAlertasUrgentes(null)).toEqual([]);
    });
    it('undefined → []', () => {
      expect(detectarAlertasUrgentes(undefined)).toEqual([]);
    });
    it('string → []', () => {
      expect(detectarAlertasUrgentes('no-objeto')).toEqual([]);
    });
    it('inputs vacíos → [] (sin alertas activas)', () => {
      const r = detectarAlertasUrgentes({ saldos: saldosOk, objetivos: [], gastos: [], hoyStr: hoy });
      expect(r).toEqual([]);
    });
  });

  // ── saldo negativo ────────────────────────────────────────────────────────
  describe('saldo negativo', () => {
    it('efectivo + banco < 0 → alerta critico saldo-negativo', () => {
      const r = detectarAlertasUrgentes({
        saldos: { efectivo: -200_000, banco: 0 }, objetivos: [], gastos: [], hoyStr: hoy,
      });
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('saldo-negativo');
      expect(r[0].nivel).toBe('critico');
    });
    it('efectivo + banco = 0 → sin alerta de saldo (cero no es negativo)', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosCero, objetivos: [], gastos: [], hoyStr: hoy,
      });
      expect(r.some(a => a.tipo === 'saldo-negativo')).toBe(false);
    });
    it('efectivo positivo, banco negativo, suma positiva → sin alerta', () => {
      const r = detectarAlertasUrgentes({
        saldos: { efectivo: 1_000_000, banco: -300_000 }, objetivos: [], gastos: [], hoyStr: hoy,
      });
      expect(r.some(a => a.tipo === 'saldo-negativo')).toBe(false);
    });
    it('saldos undefined → trata como 0 (sin alerta negativa)', () => {
      const r = detectarAlertasUrgentes({ objetivos: [], gastos: [], hoyStr: hoy });
      expect(r.some(a => a.tipo === 'saldo-negativo')).toBe(false);
    });
    it('mensaje incluye el monto total', () => {
      const r = detectarAlertasUrgentes({
        saldos: { efectivo: -500_000, banco: -100_000 }, objetivos: [], gastos: [], hoyStr: hoy,
      });
      expect(r[0].mensaje).toMatch(/-600/);
    });
  });

  // ── evento excedido ───────────────────────────────────────────────────────
  describe('evento excedido', () => {
    it('gastado > presupuesto → evento-excedido con nivel alerta', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [eventoExcedido], gastos: [], hoyStr: hoy,
      });
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('evento-excedido');
      expect(r[0].nivel).toBe('alerta');
    });
    it('mensaje contiene el nombre del evento', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [eventoExcedido], gastos: [], hoyStr: hoy,
      });
      expect(r[0].mensaje).toContain('Boda');
    });
    it('mensaje contiene porcentaje > 100', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [eventoExcedido], gastos: [], hoyStr: hoy,
      });
      expect(r[0].mensaje).toMatch(/120%/);
    });
    it('objetivo tipo ahorro → ignorado aunque ahorrado > objetivoAhorro', () => {
      const ahorro = { tipo: 'ahorro', nombre: 'Fondo', objetivoAhorro: 500_000, ahorrado: 600_000, presupuesto: 500_000, gastado: 600_000 };
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [ahorro], gastos: [], hoyStr: hoy,
      });
      expect(r).toEqual([]);
    });
    it('presupuesto = 0 → ignorado (no aplica la regla)', () => {
      const sinPres = { tipo: 'evento', nombre: 'X', presupuesto: 0, gastado: 500_000 };
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [sinPres], gastos: [], hoyStr: hoy,
      });
      expect(r).toEqual([]);
    });
    it('nombre vacío → usa fallback "Evento"', () => {
      const sinNombre = { tipo: 'evento', nombre: '', presupuesto: 1_000_000, gastado: 1_100_000 };
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [sinNombre], gastos: [], hoyStr: hoy,
      });
      expect(r[0].mensaje).toContain('Evento');
    });
  });

  // ── evento cerca del límite ───────────────────────────────────────────────
  describe('evento cerca del límite', () => {
    it('gastado >= 85% del presupuesto (pero no excedido) → evento-cerca nivel cuidado', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [eventoCerca], gastos: [], hoyStr: hoy,
      });
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('evento-cerca');
      expect(r[0].nivel).toBe('cuidado');
    });
    it('gastado exactamente al 85% → evento-cerca (umbral inclusivo)', () => {
      const exacto = { tipo: 'evento', nombre: 'X', presupuesto: 1_000_000, gastado: 850_000 };
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [exacto], gastos: [], hoyStr: hoy,
      });
      expect(r[0].tipo).toBe('evento-cerca');
    });
    it('gastado al 84% → sin alerta', () => {
      const debajo = { tipo: 'evento', nombre: 'X', presupuesto: 1_000_000, gastado: 840_000 };
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [debajo], gastos: [], hoyStr: hoy,
      });
      expect(r).toEqual([]);
    });
    it('config.pctCercaLimite custom (0.7) → activa a 70%', () => {
      const obj = { tipo: 'evento', nombre: 'X', presupuesto: 1_000_000, gastado: 720_000 };
      const r = detectarAlertasUrgentes(
        { saldos: saldosOk, objetivos: [obj], gastos: [], hoyStr: hoy },
        { pctCercaLimite: 0.7 }
      );
      expect(r[0].tipo).toBe('evento-cerca');
    });
    it('excedido tiene prioridad — no genera evento-cerca sino evento-excedido', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [eventoExcedido], gastos: [], hoyStr: hoy,
      });
      expect(r.every(a => a.tipo !== 'evento-cerca')).toBe(true);
    });
    it('múltiples eventos → genera alerta por cada uno', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [eventoExcedido, eventoCerca], gastos: [], hoyStr: hoy,
      });
      expect(r).toHaveLength(2);
      expect(r.some(a => a.tipo === 'evento-excedido')).toBe(true);
      expect(r.some(a => a.tipo === 'evento-cerca')).toBe(true);
    });
  });

  // ── sin registros en N días ───────────────────────────────────────────────
  describe('sin registros', () => {
    it('último gasto hace 20 días → sin-registro nivel cuidado', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [], gastos: gastoViejo, hoyStr: hoy,
      });
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe('sin-registro');
      expect(r[0].nivel).toBe('cuidado');
    });
    it('mensaje contiene la cantidad de días', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [], gastos: gastoViejo, hoyStr: hoy,
      });
      expect(r[0].mensaje).toMatch(/20 día/);
    });
    it('último gasto ayer → sin alerta (dentro del umbral)', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [], gastos: gastoReciente, hoyStr: hoy,
      });
      expect(r.some(a => a.tipo === 'sin-registro')).toBe(false);
    });
    it('gastos = [] → sin alerta de sin-registro', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [], gastos: [], hoyStr: hoy,
      });
      expect(r.some(a => a.tipo === 'sin-registro')).toBe(false);
    });
    it('config.diasSinRegistroUmbral = 3 → activa a partir de 3 días', () => {
      const gastoHace4 = [{ fecha: '2026-05-06' }]; // 4 días antes del 10
      const r = detectarAlertasUrgentes(
        { saldos: saldosOk, objetivos: [], gastos: gastoHace4, hoyStr: hoy },
        { diasSinRegistroUmbral: 3 }
      );
      expect(r[0].tipo).toBe('sin-registro');
    });
    it('hoyStr inválido → no lanza, retorna sin alerta de sin-registro', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [], gastos: gastoViejo, hoyStr: 'no-fecha',
      });
      expect(r.some(a => a.tipo === 'sin-registro')).toBe(false);
    });
    it('gasto.fecha = undefined → ignorado (no cuenta como último)', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [], gastos: [{ fecha: undefined }, { fecha: '2026-05-09' }], hoyStr: hoy,
      });
      expect(r.some(a => a.tipo === 'sin-registro')).toBe(false);
    });
  });

  // ── combinaciones y determinismo ──────────────────────────────────────────
  describe('combinaciones y determinismo', () => {
    it('sin nada activo → array vacío', () => {
      const r = detectarAlertasUrgentes({
        saldos: saldosOk, objetivos: [eventoOk], gastos: gastoReciente, hoyStr: hoy,
      });
      expect(r).toEqual([]);
    });
    it('saldo negativo + evento excedido → 2 alertas', () => {
      const r = detectarAlertasUrgentes({
        saldos: { efectivo: -100_000, banco: 0 }, objetivos: [eventoExcedido], gastos: [], hoyStr: hoy,
      });
      expect(r).toHaveLength(2);
    });
    it('misma entrada → mismo output (determinismo)', () => {
      const inputs = {
        saldos: { efectivo: -50_000, banco: 0 }, objetivos: [eventoExcedido], gastos: gastoViejo, hoyStr: hoy,
      };
      const r1 = detectarAlertasUrgentes(inputs);
      const r2 = detectarAlertasUrgentes(inputs);
      expect(r1).toEqual(r2);
    });
    it('no muta el array de objetivos recibido', () => {
      const objs = [eventoExcedido];
      const snapshot = JSON.stringify(objs);
      detectarAlertasUrgentes({ saldos: saldosOk, objetivos: objs, gastos: [], hoyStr: hoy });
      expect(JSON.stringify(objs)).toBe(snapshot);
    });
    it('cada alerta tiene tipo, nivel, icono, mensaje como strings', () => {
      const r = detectarAlertasUrgentes({
        saldos: { efectivo: -1, banco: 0 }, objetivos: [eventoExcedido], gastos: gastoViejo, hoyStr: hoy,
      });
      for (const a of r) {
        expect(typeof a.tipo).toBe('string');
        expect(typeof a.nivel).toBe('string');
        expect(typeof a.icono).toBe('string');
        expect(typeof a.mensaje).toBe('string');
        expect(a.mensaje.length).toBeGreaterThan(0);
      }
    });
  });

});

// ─── detectarAlertasFinancieras ───────────────────────────────────────────────
// Tanda 20: 6 condiciones de salud financiera del periodo extraídas del código
// inline de updateDash(). Función pura — no lee S, no toca DOM.

describe('detectarAlertasFinancieras()', () => {

  // ── helpers ──────────────────────────────────────────────────────────────
  const base = {
    totalGastos:   500_000,
    totalAhorro:   100_000,
    totalHormiga:  50_000,
    numGastos:     5,
    ingreso:       2_000_000,
    cuotasPeriodo: 200_000,
    saldos:        { efectivo: 1_000_000, banco: 500_000 },
    gastosFijos:   [],
    mesActual:     '2026-05',
  };
  const tipos = r => r.map(a => a.tipo);

  // ── input inválido ────────────────────────────────────────────────────────
  describe('input inválido', () => {
    it('null → []', () => expect(detectarAlertasFinancieras(null)).toEqual([]));
    it('undefined → []', () => expect(detectarAlertasFinancieras(undefined)).toEqual([]));
    it('string → []', () => expect(detectarAlertasFinancieras('nope')).toEqual([]));
    it('inputs base sin alertas → []', () => {
      expect(detectarAlertasFinancieras(base)).toEqual([]);
    });
  });

  // ── saldo cero ────────────────────────────────────────────────────────────
  describe('saldo-cero', () => {
    it('efectivo=0 y banco=0 con ingreso > 0 → saldo-cero', () => {
      const r = detectarAlertasFinancieras({ ...base, saldos: { efectivo: 0, banco: 0 } });
      expect(tipos(r)).toContain('saldo-cero');
    });
    it('solo efectivo=0 (banco>0) → sin alerta', () => {
      const r = detectarAlertasFinancieras({ ...base, saldos: { efectivo: 0, banco: 500_000 } });
      expect(tipos(r)).not.toContain('saldo-cero');
    });
    it('ingreso=0 aunque saldos=0 → sin alerta (usuario sin ingreso configado)', () => {
      const r = detectarAlertasFinancieras({ ...base, ingreso: 0, saldos: { efectivo: 0, banco: 0 } });
      expect(tipos(r)).not.toContain('saldo-cero');
    });
  });

  // ── gasto excesivo ────────────────────────────────────────────────────────
  describe('gasto-excesivo', () => {
    it('totalGastos > 90% ingreso → gasto-excesivo', () => {
      const r = detectarAlertasFinancieras({ ...base, totalGastos: 1_900_000 });
      expect(tipos(r)).toContain('gasto-excesivo');
    });
    it('totalGastos = 90% exacto → sin alerta (umbral exclusivo)', () => {
      const r = detectarAlertasFinancieras({ ...base, totalGastos: 1_800_000 });
      expect(tipos(r)).not.toContain('gasto-excesivo');
    });
    it('ingreso=0 → sin alerta', () => {
      const r = detectarAlertasFinancieras({ ...base, ingreso: 0, totalGastos: 1_000_000 });
      expect(tipos(r)).not.toContain('gasto-excesivo');
    });
    it('config.umbralGasto custom (0.7) → activa a 70%', () => {
      const r = detectarAlertasFinancieras(
        { ...base, totalGastos: 1_500_000 },
        { umbralGasto: 0.7 }
      );
      expect(tipos(r)).toContain('gasto-excesivo');
    });
  });

  // ── hormiga alta ─────────────────────────────────────────────────────────
  describe('hormiga-alta', () => {
    it('totalHormiga > 15% ingreso → hormiga-alta', () => {
      const r = detectarAlertasFinancieras({ ...base, totalHormiga: 400_000 });
      expect(tipos(r)).toContain('hormiga-alta');
    });
    it('html incluye el porcentaje de hormigas', () => {
      const r = detectarAlertasFinancieras({ ...base, totalHormiga: 400_000 });
      const alerta = r.find(a => a.tipo === 'hormiga-alta');
      expect(alerta.html).toMatch(/20%/); // 400k / 2M = 20%
    });
    it('totalHormiga = 15% exacto → sin alerta (umbral exclusivo)', () => {
      const r = detectarAlertasFinancieras({ ...base, totalHormiga: 300_000 });
      expect(tipos(r)).not.toContain('hormiga-alta');
    });
  });

  // ── sin ahorro ────────────────────────────────────────────────────────────
  describe('sin-ahorro', () => {
    it('totalAhorro=0 con numGastos > 3 → sin-ahorro', () => {
      const r = detectarAlertasFinancieras({ ...base, totalAhorro: 0, numGastos: 5 });
      expect(tipos(r)).toContain('sin-ahorro');
    });
    it('totalAhorro=0 pero numGastos <= 3 → sin alerta (pocos datos)', () => {
      const r = detectarAlertasFinancieras({ ...base, totalAhorro: 0, numGastos: 2 });
      expect(tipos(r)).not.toContain('sin-ahorro');
    });
    it('totalAhorro > 0 → sin alerta', () => {
      const r = detectarAlertasFinancieras({ ...base, totalAhorro: 50_000, numGastos: 10 });
      expect(tipos(r)).not.toContain('sin-ahorro');
    });
  });

  // ── cuotas altas ──────────────────────────────────────────────────────────
  describe('cuotas-altas', () => {
    it('cuotasPeriodo > 30% ingreso → cuotas-altas', () => {
      const r = detectarAlertasFinancieras({ ...base, cuotasPeriodo: 700_000 });
      expect(tipos(r)).toContain('cuotas-altas');
    });
    it('cuotasPeriodo = 30% exacto → sin alerta', () => {
      const r = detectarAlertasFinancieras({ ...base, cuotasPeriodo: 600_000 });
      expect(tipos(r)).not.toContain('cuotas-altas');
    });
    it('ingreso=0 → sin alerta', () => {
      const r = detectarAlertasFinancieras({ ...base, ingreso: 0, cuotasPeriodo: 500_000 });
      expect(tipos(r)).not.toContain('cuotas-altas');
    });
  });

  // ── fijos sin pagar ───────────────────────────────────────────────────────
  describe('fijos-sin-pagar', () => {
    it('un fijo sin pagadoEn del mes → fijos-sin-pagar', () => {
      const fijos = [{ nombre: 'Arriendo', pagadoEn: ['2026-04'] }];
      const r = detectarAlertasFinancieras({ ...base, gastosFijos: fijos });
      expect(tipos(r)).toContain('fijos-sin-pagar');
    });
    it('html contiene el nombre del fijo', () => {
      const fijos = [{ nombre: 'Arriendo', pagadoEn: [] }];
      const r = detectarAlertasFinancieras({ ...base, gastosFijos: fijos });
      expect(r.find(a => a.tipo === 'fijos-sin-pagar').html).toContain('Arriendo');
    });
    it('fijo ya pagado en el mes → sin alerta', () => {
      const fijos = [{ nombre: 'Arriendo', pagadoEn: ['2026-05'] }];
      const r = detectarAlertasFinancieras({ ...base, gastosFijos: fijos });
      expect(tipos(r)).not.toContain('fijos-sin-pagar');
    });
    it('pagadoEn undefined → trata como no pagado', () => {
      const fijos = [{ nombre: 'Internet' }];
      const r = detectarAlertasFinancieras({ ...base, gastosFijos: fijos });
      expect(tipos(r)).toContain('fijos-sin-pagar');
    });
    it('gastosFijos vacío → sin alerta', () => {
      const r = detectarAlertasFinancieras({ ...base, gastosFijos: [] });
      expect(tipos(r)).not.toContain('fijos-sin-pagar');
    });
  });

  // ── estructura del output ─────────────────────────────────────────────────
  describe('estructura del output', () => {
    it('cada alerta tiene tipo (string) y html (string no vacío)', () => {
      const r = detectarAlertasFinancieras({
        ...base,
        totalGastos: 1_900_000,
        totalAhorro: 0,
      });
      for (const a of r) {
        expect(typeof a.tipo).toBe('string');
        expect(typeof a.html).toBe('string');
        expect(a.html.length).toBeGreaterThan(0);
      }
    });
    it('no muta el input', () => {
      const fijos = [{ nombre: 'X', pagadoEn: [] }];
      const snap = JSON.stringify(fijos);
      detectarAlertasFinancieras({ ...base, gastosFijos: fijos });
      expect(JSON.stringify(fijos)).toBe(snap);
    });
    it('determinismo: misma entrada → mismo output', () => {
      const inputs = { ...base, totalGastos: 1_900_000 };
      expect(detectarAlertasFinancieras(inputs)).toEqual(detectarAlertasFinancieras(inputs));
    });
  });

});

// ─── calcularChecklistSalud ───────────────────────────────────────────────────
// Tanda 21: centraliza las 5 dimensiones del checklist de salud financiera
// que antes vivían inline en calcScore(). Mismos umbrales que
// detectarAlertasFinancieras() — configurables, default 0.9/0.15/0.3.

describe('calcularChecklistSalud()', () => {

  const base = {
    totalGastos:    500_000,
    totalAhorro:    100_000,
    totalHormiga:   50_000,
    ingreso:        2_000_000,
    cuotasPeriodo:  200_000,
    tieneObjetivos: false,
  };

  // ── input inválido ────────────────────────────────────────────────────────
  describe('input inválido', () => {
    it('null → []', () => expect(calcularChecklistSalud(null)).toEqual([]));
    it('undefined → []', () => expect(calcularChecklistSalud(undefined)).toEqual([]));
    it('string → []', () => expect(calcularChecklistSalud('nope')).toEqual([]));
  });

  // ── dimensión gastos ──────────────────────────────────────────────────────
  describe('gastos', () => {
    it('gastos bajo control → estado ok', () => {
      const r = calcularChecklistSalud(base);
      expect(r.find(i => i.tipo === 'gastos').estado).toBe('ok');
    });
    it('gastos > 90% ingreso → estado mal', () => {
      const r = calcularChecklistSalud({ ...base, totalGastos: 1_900_000 });
      expect(r.find(i => i.tipo === 'gastos').estado).toBe('mal');
    });
    it('etiqueta de mal incluye el porcentaje del umbral', () => {
      const r = calcularChecklistSalud({ ...base, totalGastos: 1_900_000 });
      expect(r.find(i => i.tipo === 'gastos').etiqueta).toMatch(/90%/);
    });
    it('ingreso=0 → ok (sin ingreso no puede calcular exceso)', () => {
      const r = calcularChecklistSalud({ ...base, ingreso: 0, totalGastos: 999_999 });
      expect(r.find(i => i.tipo === 'gastos').estado).toBe('ok');
    });
    it('umbralGasto custom 0.7 → mal a 71%', () => {
      const r = calcularChecklistSalud(
        { ...base, totalGastos: 1_500_000 },
        { umbralGasto: 0.7 }
      );
      expect(r.find(i => i.tipo === 'gastos').estado).toBe('mal');
    });
  });

  // ── dimensión ahorro ──────────────────────────────────────────────────────
  describe('ahorro', () => {
    it('totalAhorro > 0 → ok', () => {
      const r = calcularChecklistSalud(base);
      expect(r.find(i => i.tipo === 'ahorro').estado).toBe('ok');
    });
    it('totalAhorro = 0 → mal', () => {
      const r = calcularChecklistSalud({ ...base, totalAhorro: 0 });
      expect(r.find(i => i.tipo === 'ahorro').estado).toBe('mal');
    });
    it('etiqueta ok = "Ahorro constante"', () => {
      const r = calcularChecklistSalud(base);
      expect(r.find(i => i.tipo === 'ahorro').etiqueta).toBe('Ahorro constante');
    });
    it('etiqueta mal = "Sin ahorro registrado"', () => {
      const r = calcularChecklistSalud({ ...base, totalAhorro: 0 });
      expect(r.find(i => i.tipo === 'ahorro').etiqueta).toBe('Sin ahorro registrado');
    });
  });

  // ── dimensión hormiga ─────────────────────────────────────────────────────
  describe('hormiga', () => {
    it('hormiga bajo control → ok', () => {
      const r = calcularChecklistSalud(base);
      expect(r.find(i => i.tipo === 'hormiga').estado).toBe('ok');
    });
    it('hormiga > 15% ingreso → mal', () => {
      const r = calcularChecklistSalud({ ...base, totalHormiga: 400_000 });
      expect(r.find(i => i.tipo === 'hormiga').estado).toBe('mal');
    });
    it('ingreso=0 → ok (no puede calcular proporción)', () => {
      const r = calcularChecklistSalud({ ...base, ingreso: 0, totalHormiga: 500_000 });
      expect(r.find(i => i.tipo === 'hormiga').estado).toBe('ok');
    });
  });

  // ── dimensión deudas ──────────────────────────────────────────────────────
  describe('deudas', () => {
    it('cuotasPeriodo=0 → item deudas no aparece', () => {
      const r = calcularChecklistSalud({ ...base, cuotasPeriodo: 0 });
      expect(r.find(i => i.tipo === 'deudas')).toBeUndefined();
    });
    it('cuotas <= 30% ingreso → ok', () => {
      const r = calcularChecklistSalud({ ...base, cuotasPeriodo: 600_000 });
      expect(r.find(i => i.tipo === 'deudas').estado).toBe('ok');
    });
    it('cuotas > 30% ingreso → info', () => {
      const r = calcularChecklistSalud({ ...base, cuotasPeriodo: 700_000 });
      expect(r.find(i => i.tipo === 'deudas').estado).toBe('info');
    });
    it('etiqueta info incluye porcentaje del umbral', () => {
      const r = calcularChecklistSalud({ ...base, cuotasPeriodo: 700_000 });
      expect(r.find(i => i.tipo === 'deudas').etiqueta).toMatch(/30%/);
    });
  });

  // ── dimensión metas ───────────────────────────────────────────────────────
  describe('metas', () => {
    it('tieneObjetivos=false → item metas no aparece', () => {
      const r = calcularChecklistSalud(base);
      expect(r.find(i => i.tipo === 'metas')).toBeUndefined();
    });
    it('tieneObjetivos=true → item metas con estado info', () => {
      const r = calcularChecklistSalud({ ...base, tieneObjetivos: true });
      const metas = r.find(i => i.tipo === 'metas');
      expect(metas).toBeDefined();
      expect(metas.estado).toBe('info');
      expect(metas.etiqueta).toBe('Metas de ahorro activas');
    });
  });

  // ── orden y estructura ────────────────────────────────────────────────────
  describe('orden y estructura', () => {
    it('sin cuotas ni metas → exactamente 3 items (gastos, ahorro, hormiga)', () => {
      const r = calcularChecklistSalud({ ...base, cuotasPeriodo: 0, tieneObjetivos: false });
      expect(r).toHaveLength(3);
      expect(r.map(i => i.tipo)).toEqual(['gastos', 'ahorro', 'hormiga']);
    });
    it('con cuotas y metas → 5 items en orden correcto', () => {
      const r = calcularChecklistSalud({ ...base, cuotasPeriodo: 300_000, tieneObjetivos: true });
      expect(r.map(i => i.tipo)).toEqual(['gastos', 'ahorro', 'hormiga', 'deudas', 'metas']);
    });
    it('cada item tiene tipo, estado y etiqueta como strings', () => {
      const r = calcularChecklistSalud({ ...base, tieneObjetivos: true });
      for (const item of r) {
        expect(typeof item.tipo).toBe('string');
        expect(typeof item.estado).toBe('string');
        expect(typeof item.etiqueta).toBe('string');
        expect(item.etiqueta.length).toBeGreaterThan(0);
      }
    });
    it('determinismo: misma entrada → mismo output', () => {
      expect(calcularChecklistSalud(base)).toEqual(calcularChecklistSalud(base));
    });
    it('no muta el input', () => {
      const snap = JSON.stringify(base);
      calcularChecklistSalud(base);
      expect(JSON.stringify(base)).toBe(snap);
    });
  });

});


// ─── detectarPatronGastoSemanal ───────────────────────────────────────────────
// Tanda 23: detecta días de la semana con gasto sistemáticamente mayor al
// promedio. Función pura — Date.UTC anti-DST, ventana configurable, umbral
// de factor, mínimo de ocurrencias para evitar falsos positivos.

describe('detectarPatronGastoSemanal()', () => {

  // helpers: genera N gastos en el día de semana dado dentro de los últimos 90d
  const gastosEnDia = (diaSemana, n, monto, hoyRef = '2026-05-10') => {
    const out = [];
    const [y, m, d] = hoyRef.split('-').map(Number);
    for (let i = 0; i < n; i++) {
      const t    = Date.UTC(y, m - 1, d) - i * 7 * 86_400_000;
      const date = new Date(t);
      const offset = (date.getUTCDay() - diaSemana + 7) % 7;
      const tAjust = t - offset * 86_400_000;
      const aj = new Date(tAjust);
      const fecha = `${aj.getUTCFullYear()}-${String(aj.getUTCMonth()+1).padStart(2,'0')}-${String(aj.getUTCDate()).padStart(2,'0')}`;
      out.push({ fecha, monto, tipo: 'necesidad' });
    }
    return out;
  };

  // dia destacado gasta 10x más que los demás
  const buildGastos = (diaDestacado, hoyRef = '2026-05-10') => {
    const resultado = [];
    [0, 1, 2, 3, 4].filter(d => d !== diaDestacado).forEach(d => {
      resultado.push(...gastosEnDia(d, 3, 50_000, hoyRef));
    });
    resultado.push(...gastosEnDia(diaDestacado, 3, 500_000, hoyRef));
    return resultado;
  };

  describe('input invalido', () => {
    it('gastos null -> null', () => expect(detectarPatronGastoSemanal(null, '2026-05-10')).toBeNull());
    it('gastos no-array -> null', () => expect(detectarPatronGastoSemanal('str', '2026-05-10')).toBeNull());
    it('hoyISO faltante -> null', () => expect(detectarPatronGastoSemanal([], undefined)).toBeNull());
    it('hoyISO malformado -> null', () => expect(detectarPatronGastoSemanal([], 'no-fecha')).toBeNull());
  });

  describe('datos insuficientes', () => {
    it('array vacio -> null', () => expect(detectarPatronGastoSemanal([], '2026-05-10')).toBeNull());
    it('menos de minGastos registros -> null', () => {
      const gs = [1,2,3].map(i => ({ fecha: '2026-05-0'+i, monto: 10_000, tipo: 'necesidad' }));
      expect(detectarPatronGastoSemanal(gs, '2026-05-10')).toBeNull();
    });
    it('config.minGastos=3 activa con 4 gastos', () => {
      const gs = [
        { fecha: '2026-05-04', monto: 500_000, tipo: 'necesidad' },
        { fecha: '2026-05-04', monto: 500_000, tipo: 'necesidad' },
        { fecha: '2026-05-05', monto: 50_000,  tipo: 'necesidad' },
        { fecha: '2026-05-06', monto: 50_000,  tipo: 'necesidad' },
      ];
      const r = detectarPatronGastoSemanal(gs, '2026-05-10', { minGastos: 3, minOcurrencias: 1 });
      expect(r).not.toBeNull();
    });
  });

  describe('deteccion de patron', () => {
    it('dia con gasto 10x mayor aparece en diasDestacados', () => {
      const r = detectarPatronGastoSemanal(buildGastos(5, '2026-05-10'), '2026-05-10');
      expect(r).not.toBeNull();
      expect(r.diasDestacados.some(d => d.nombre === 'Viernes')).toBe(true);
    });
    it('sin dia que destaque -> diasDestacados vacio', () => {
      const gs = [0,1,2,3,4,5,6].flatMap(d => gastosEnDia(d, 3, 100_000, '2026-05-10'));
      const r = detectarPatronGastoSemanal(gs, '2026-05-10');
      expect(r).not.toBeNull();
      expect(r.diasDestacados).toHaveLength(0);
    });
    it('factor del dia destacado >= 2.0', () => {
      const r = detectarPatronGastoSemanal(buildGastos(5, '2026-05-10'), '2026-05-10');
      const viernes = r.diasDestacados.find(d => d.nombre === 'Viernes');
      expect(viernes.factor).toBeGreaterThanOrEqual(2.0);
    });
    it('factor >= 3.0 -> severidad alta', () => {
      const r = detectarPatronGastoSemanal(buildGastos(5, '2026-05-10'), '2026-05-10');
      const viernes = r.diasDestacados.find(d => d.nombre === 'Viernes');
      expect(viernes.severidad).toBe('alta');
    });
    it('diasDestacados ordenados por factor DESC', () => {
      const r = detectarPatronGastoSemanal(buildGastos(5, '2026-05-10'), '2026-05-10');
      for (let i = 1; i < r.diasDestacados.length; i++) {
        expect(r.diasDestacados[i-1].factor).toBeGreaterThanOrEqual(r.diasDestacados[i].factor);
      }
    });
  });

  describe('ventana temporal', () => {
    it('gastos de hace 200 dias son ignorados con ventana default 90', () => {
      const gastoViejo = { fecha: '2025-10-01', monto: 5_000_000, tipo: 'necesidad' };
      const r1 = detectarPatronGastoSemanal(buildGastos(5, '2026-05-10'), '2026-05-10');
      const r2 = detectarPatronGastoSemanal([gastoViejo, ...buildGastos(5, '2026-05-10')], '2026-05-10');
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
    });
    it('gastos del futuro (despues de hoyISO) son ignorados', () => {
      const futuro = { fecha: '2026-12-31', monto: 999_999, tipo: 'necesidad' };
      const r = detectarPatronGastoSemanal([futuro, ...buildGastos(5)], '2026-05-10');
      expect(r).not.toBeNull();
    });
  });

  describe('exclusion de ahorros', () => {
    it('tipo ahorro excluido por defecto', () => {
      const gastoAhorro = { fecha: '2026-05-09', monto: 9_000_000, tipo: 'ahorro' };
      const r = detectarPatronGastoSemanal([gastoAhorro, ...buildGastos(5)], '2026-05-10');
      expect(r).not.toBeNull();
    });
  });

  describe('estructura del output', () => {
    it('porDia tiene exactamente 7 entradas (Dom..Sab)', () => {
      const r = detectarPatronGastoSemanal(buildGastos(5), '2026-05-10');
      expect(r.porDia).toHaveLength(7);
    });
    it('totalAnalizado > 0', () => {
      const r = detectarPatronGastoSemanal(buildGastos(5), '2026-05-10');
      expect(r.totalAnalizado).toBeGreaterThan(0);
    });
    it('etiqueta contiene el nombre del dia', () => {
      const r = detectarPatronGastoSemanal(buildGastos(5), '2026-05-10');
      const viernes = r.diasDestacados.find(d => d.nombre === 'Viernes');
      expect(viernes.etiqueta.toLowerCase()).toContain('viernes');
    });
    it('determinismo: misma entrada -> mismo output', () => {
      const gs = buildGastos(5);
      expect(detectarPatronGastoSemanal(gs, '2026-05-10')).toEqual(detectarPatronGastoSemanal(gs, '2026-05-10'));
    });
    it('no muta el array de gastos', () => {
      const gs = buildGastos(5);
      const snap = JSON.stringify(gs);
      detectarPatronGastoSemanal(gs, '2026-05-10');
      expect(JSON.stringify(gs)).toBe(snap);
    });
  });

});
