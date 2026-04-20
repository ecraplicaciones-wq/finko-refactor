// tests/unit/utils.test.js
import { describe, it, expect, vi } from 'vitest';
import { he, debounce } from '../../modules/infra/utils.js';

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