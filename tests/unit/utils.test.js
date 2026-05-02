// tests/unit/utils.test.js
import { describe, it, expect, vi } from 'vitest';
import { he, debounce, normalizarTexto, getValueOrThrow } from '../../modules/infra/utils.js';

// ─── he() — escape de HTML ────────────────────────────────────────────────────

describe('he() — escape de HTML', () => {

  it('escapa el símbolo &', () => {
    expect(he('Banco & Ahorro')).toBe('Banco &amp; Ahorro');
  });

  it('escapa < y >', () => {
    expect(he('<script>')).toBe('&lt;script&gt;');
  });

  it('escapa comillas dobles', () => {
    expect(he('"hola"')).toBe('&quot;hola&quot;');
  });

  it('escapa apóstrofe', () => {
    expect(he("D'Angelo")).toBe('D&#39;Angelo');
  });

  it('no rompe con string vacío', () => {
    expect(he('')).toBe('');
  });

  it('no rompe con null', () => {
    expect(he(null)).toBe('');
  });

  it('no rompe con undefined', () => {
    expect(he(undefined)).toBe('');
  });

  it('no modifica texto plano sin caracteres especiales', () => {
    expect(he('Efectivo')).toBe('Efectivo');
  });

  it('escapa todos los caracteres peligrosos juntos', () => {
    expect(he('<img src="x" onerror=\'alert(1)\'>')).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;'
    );
  });

});

// ─── debounce() ───────────────────────────────────────────────────────────────

describe('debounce()', () => {

  it('ejecuta la función una sola vez tras el delay', async () => {
    const fn  = vi.fn();
    const dfn = debounce(fn, 50);

    dfn(); dfn(); dfn();

    expect(fn).not.toHaveBeenCalled();

    await new Promise(r => setTimeout(r, 80));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('pasa los argumentos correctamente', async () => {
    const fn  = vi.fn();
    const dfn = debounce(fn, 30);

    dfn('Sofía', 42);
    await new Promise(r => setTimeout(r, 60));

    expect(fn).toHaveBeenCalledWith('Sofía', 42);
  });

  it('resetea el timer en cada llamada nueva', async () => {
    const fn  = vi.fn();
    const dfn = debounce(fn, 50);

    dfn();
    await new Promise(r => setTimeout(r, 30));
    dfn();
    await new Promise(r => setTimeout(r, 30));
    expect(fn).not.toHaveBeenCalled();

    await new Promise(r => setTimeout(r, 40));
    expect(fn).toHaveBeenCalledTimes(1);
  });

});

// ─── normalizarTexto() ────────────────────────────────────────────────────────

describe('normalizarTexto() — normalización de strings', () => {

  it('convierte a minúsculas', () => {
    expect(normalizarTexto('GASTOS')).toBe('gastos');
    expect(normalizarTexto('Efectivo')).toBe('efectivo');
  });

  it('remueve acentos y diacríticos', () => {
    expect(normalizarTexto('Café')).toBe('cafe');
    expect(normalizarTexto('Mérida')).toBe('merida');
    expect(normalizarTexto('Qué')).toBe('que');
    expect(normalizarTexto('Sofía')).toBe('sofia');
  });

  it('hace trim de espacios', () => {
    expect(normalizarTexto('  Gasto  ')).toBe('gasto');
    expect(normalizarTexto('\tRappi\n')).toBe('rappi');
  });

  it('combina todas las transformaciones', () => {
    expect(normalizarTexto('  SOFÍA GARCÍA  ')).toBe('sofia garcia');
    expect(normalizarTexto('Cómo Está')).toBe('como esta');
  });

  it('no rompe con string vacío', () => {
    expect(normalizarTexto('')).toBe('');
  });

  it('no rompe con null', () => {
    expect(normalizarTexto(null)).toBe('');
  });

  it('no rompe con undefined', () => {
    expect(normalizarTexto(undefined)).toBe('');
  });

  it('funciona con números', () => {
    expect(normalizarTexto('2026 gasto')).toBe('2026 gasto');
  });

  it('no modifica texto plano sin acentos', () => {
    expect(normalizarTexto('efectivo')).toBe('efectivo');
    expect(normalizarTexto('Banco')).toBe('banco');
  });

});

// ─── getValueOrThrow() ────────────────────────────────────────────────────────
// Nota: getValueOrThrow() es una función simple que depende del DOM y se valida
// indirectamente a través de los tests de integración de las funciones de dominio
// que la usan (agregarGasto, guardarFijo, guardarDeuda, guardarCuenta, guardarObjetivo).
// Su comportamiento es verificado por:
// 1. Error handling en try-catch de cada función
// 2. Validación de inputs en los modales del DOM (prevalidación)
// 3. Tests E2E del flujo completo en Semana 3