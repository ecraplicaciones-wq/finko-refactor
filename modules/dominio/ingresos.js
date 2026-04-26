// Fusión de: gastos.js + dashboard.js + resumen.js + historial.js
import { S }        from '../core/state.js';
import { save }     from '../core/storage.js';
import { f, he, hoy, mesStr, setEl, setHtml, openM, closeM, showAlert, showConfirm, descontarFondo, reintegrarFondo } from '../infra/utils.js';
import { CATS, GMF_TASA, GMF_EXENTO_MONTO, GMF_EXENTO_UVT, SMMLV_2026, TASA_USURA_EA, TOPE_DIAN, CCOLORS } from '../core/constants.js';
import { renderSmart, updSaldo, totalCuentas } from '../infra/render.js';
import { registerAction } from '../ui/actions.js';

let _filtroGasto = '';

// ─── HELPERS INTERNOS ────────────────────────────────────────────────────────
function _getPct() {
  const m   = document.getElementById('q-met')?.value || '50-30-20';
  const MAP = { '50-30-20': { n: 50, d: 30, a: 20 }, '50-20-30': { n: 50, d: 20, a: 30 }, '70-20-10': { n: 70, d: 20, a: 10 } };
  if (MAP[m]) return MAP[m];
  const valN = document.getElementById('pn')?.value;
  const valD = document.getElementById('pd')?.value;
  const valA = document.getElementById('pa')?.value;
  return {
    n: valN === '' || valN == null ? 50 : Number(valN),
    d: valD === '' || valD == null ? 30 : Number(valD),
    a: valA === '' || valA == null ? 20 : Number(valA)
  };
}

/**
 * Compara métricas de la quincena actual vs la anterior. Para cada métrica
 * devuelve delta absoluto, % de variación y un "estado" interpretable según
 * la dirección deseada (gasto/hormiga: menos es mejor; ahorro/ingreso: más).
 *
 * @param {{gastado:number, ahorro:number, hormiga:number, ingreso:number}} actual
 * @param {{gastado:number, ahorro:number, hormiga:number, ingreso:number} | null} anterior
 *     Suele ser S.historial[0]. Si es null, retorna null (no hay con qué comparar).
 * @returns {null | {
 *   gastado:  { delta:number, pct:number, estado:'mejor'|'peor'|'igual' },
 *   ahorro:   { delta:number, pct:number, estado:'mejor'|'peor'|'igual' },
 *   hormiga:  { delta:number, pct:number, estado:'mejor'|'peor'|'igual' },
 *   ingreso:  { delta:number, pct:number, estado:'mejor'|'peor'|'igual' }
 * }}
 */
export function calcularComparacionQuincenas(actual, anterior) {
  if (!anterior || typeof anterior !== 'object') return null;
  if (!actual   || typeof actual   !== 'object') return null;

  const compara = (act, prev, menosEsMejor) => {
    const a = +act  || 0;
    const p = +prev || 0;
    const delta = a - p;
    const pct   = p > 0 ? Math.round((delta / p) * 100) : (a > 0 ? 100 : 0);
    let estado;
    if (Math.abs(pct) < 1)    estado = 'igual';
    else if (menosEsMejor)    estado = delta < 0 ? 'mejor' : 'peor';
    else                      estado = delta > 0 ? 'mejor' : 'peor';
    return { delta, pct, estado };
  };

  return {
    gastado: compara(actual.gastado, anterior.gastado, true),
    ahorro:  compara(actual.ahorro,  anterior.ahorro,  false),
    hormiga: compara(actual.hormiga, anterior.hormiga, true),
    ingreso: compara(actual.ingreso, anterior.ingreso, false),
  };
}

/**
 * Top N hormigas del período: agrupa los gastos hormiga por descripción
 * (case + tilde insensitive), suma sus montos y devuelve los más caros.
 *
 * El "concepto canónico" devuelto es la primera variante encontrada del
 * grupo (ej. si hay "Café", "café" y "Cafe", se reporta como apareció el
 * primero, conservando estilo).
 *
 * Esta pura es la base del widget "Top 3 hormigas del mes" en el dashboard.
 *
 * @param {Array<{fecha?:string, desc?:string, monto:number, montoTotal?:number,
 *                tipo?:string, hormiga?:boolean}>} gastos — S.gastos.
 * @param {string|null} [mesYYYYMM] — filtra a 'YYYY-MM' por g.fecha. null = todos.
 * @param {number} [limit=3]       — cuántas devolver.
 * @returns {Array<{ concepto: string, total: number, count: number }>}
 *     Ordenado por total DESC. Vacío si no hay hormigas.
 */
export function calcularTopHormigas(gastos, mesYYYYMM = null, limit = 3) {
  if (!Array.isArray(gastos) || gastos.length === 0) return [];

  const norm = s => String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();

  const mapa = new Map();   // key normalizada → { concepto, total, count }
  for (const g of gastos) {
    if (!(g?.tipo === 'hormiga' || g?.hormiga === true)) continue;
    if (mesYYYYMM && !String(g.fecha || '').startsWith(mesYYYYMM)) continue;

    const desc = (g.desc || '').trim() || 'Sin descripción';
    const key  = norm(desc);
    const monto = g.montoTotal || g.monto || 0;
    if (!mapa.has(key)) {
      mapa.set(key, { concepto: desc, total: 0, count: 0 });
    }
    const entry = mapa.get(key);
    entry.total += monto;
    entry.count += 1;
  }

  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, Math.max(0, limit));
}

/**
 * Suma de cuotas del período activo (S.tipoPeriodo).
 * • mensual → quincenales × 2 + mensuales
 * • q1      → quincenales + mensuales
 * • q2      → solo quincenales
 *
 * @returns {number} Total de cuotas del período en pesos.
 */
export function cuotasPeriodo() {
  const sq = S.deudas.filter(d => d.periodicidad === 'quincenal').reduce((s, d) => s + d.cuota, 0);
  const sm = S.deudas.filter(d => d.periodicidad === 'mensual').reduce((s, d) => s + d.cuota, 0);
  if (S.tipoPeriodo === 'mensual') return (sq * 2) + sm;
  if (S.tipoPeriodo === 'q1')     return sq + sm;
  return sq;
}

/**
 * Consolidado del mes corriente: suma del histórico (quincenas anteriores) + el
 * ingreso/gasto de la quincena en curso. Devuelve totales de ingreso, gasto,
 * balance y nº de quincenas registradas.
 *
 * @returns {{ ing: number, eg: number, bal: number, q: number }}
 */
export function consolMes() {
  const mes  = mesStr();
  const hist = S.historial.filter(h => h.mes === mes);
  let ing = 0, eg = 0;
  hist.forEach(h => { ing += h.ingreso; eg += h.gastado; });
  const gasAct = S.gastos.filter(g => g.tipo !== 'ahorro').reduce((s, g) => s + (g.montoTotal ?? g.monto), 0);
  return { ing: ing + S.ingreso, eg: eg + gasAct, bal: (ing + S.ingreso) - (eg + gasAct), q: hist.length + (S.ingreso > 0 ? 1 : 0) };
}

// Aliases internos para no romper los call sites históricos. Una vez los
// consumidores adopten el nombre público, se pueden borrar.
const _cuotasPeriodo = cuotasPeriodo;
const _consolMes     = consolMes;

// ═══════════════════════════════════════════════════════════════════════════════
// GASTOS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SEMÁFORO DE PRESUPUESTO ──────────────────────────────────────────────────
export function actualizarSemaforo() {
  const mInput  = document.getElementById('g-mo');
  const tInput  = document.getElementById('g-ti');
  const infoEl  = document.getElementById('g-semaforo');
  if (!mInput || !tInput || !infoEl) return;

  const monto = +mInput.value || 0;
  const tipo  = tInput.value;
  if (monto <= 0 || S.ingreso <= 0) { infoEl.style.display = 'none'; return; }

  const p = _getPct();
  let limite = 0, etiqueta = '';

  if (tipo === 'necesidad')      { limite = S.ingreso * (p.n / 100); etiqueta = 'lo que necesitás este mes'; }
  else if (tipo === 'ahorro')    { limite = S.ingreso * (p.a / 100); etiqueta = 'tu colchoneta de ahorro'; }
  else                           { limite = S.ingreso * (p.d / 100); etiqueta = 'tus gustos y caprichos'; }

  const yaGastado = (tipo === 'hormiga')
    ? S.gastos.filter(g => g.tipo === 'deseo' || g.tipo === 'hormiga' || g.hormiga).reduce((s, g) => s + (g.montoTotal || g.monto), 0)
    : S.gastos.filter(g => g.tipo === tipo).reduce((s, g) => s + (g.montoTotal || g.monto), 0);

  const disponible = (limite - yaGastado) - monto;
  infoEl.style.display = 'block';

  if (disponible < 0) {
    infoEl.style.cssText += '; background:rgba(255,68,68,.1); color:var(--dan); border:1px solid rgba(255,68,68,.3);';
    infoEl.innerHTML = `🚨 ¡Epa! Con este gasto te pasás ${f(Math.abs(disponible))} de lo que tenías planeado para ${etiqueta}. Pensalo dos veces, ¿vale la pena?`;
  } else if (disponible <= 100_000) {
    infoEl.style.cssText += '; background:rgba(255,214,10,.1); color:var(--a2); border:1px solid rgba(255,214,10,.3);';
    infoEl.innerHTML = `⚠️ Ojo al parche: si pagás esto, solo te quedan ${f(disponible)} para ${etiqueta}. No te quedés corto.`;
  } else {
    infoEl.style.cssText += '; background:rgba(0,220,130,.1); color:var(--a1); border:1px solid rgba(0,220,130,.3);';
    infoEl.innerHTML = `✅ ¡Bien manejado! Después de este gasto todavía tenés ${f(disponible)} disponibles para ${etiqueta}. ¡Vas de bien!`;
  }
}

// ─── IMPACTO HORMIGA ─────────────────────────────────────────────────────────
export function calcularImpactoHormiga() {
  const ti    = document.getElementById('g-ti')?.value;
  const mo    = +document.getElementById('g-mo')?.value || 0;
  const infoEl = document.getElementById('g-hormiga-impact');
  if (!infoEl) return;
  if (ti !== 'hormiga' || mo <= 0) { infoEl.style.display = 'none'; return; }

  const anual = mo * 365;
  let msg = `🐜 <strong>¡Ojo con los gasticos!</strong> Si hacés esto todos los días, en un año le decís adiós a <strong>${f(anual)}</strong>. Eso duele, ¿verdad?`;

  if (S.objetivos && S.objetivos.length > 0) {
    const metaGrande = S.objetivos.reduce((mayor, o) =>
      (o.objetivoAhorro || 0) > (mayor.objetivoAhorro || 0) ? o : mayor, S.objetivos[0]);
    if (metaGrande && metaGrande.objetivoAhorro > 0) {
      const veces = anual / metaGrande.objetivoAhorro;
      if (veces >= 1) {
        const vr = Math.floor(veces * 10) / 10;
        msg += `<br><br>Con esa misma plata podría cumplirse tu sueño de <em>"${he(metaGrande.nombre)}"</em> <strong>${vr >= 2 ? Math.floor(veces) + ' veces' : 'completico'}</strong>${vr >= 2 ? ' seguidas' : ''}. ¿Cuál vale más?`;
      } else {
        const pct = Math.round(veces * 100);
        const mesesParaMeta = Math.ceil(metaGrande.objetivoAhorro / (mo * 30));
        msg += `<br><br>Eso es el <strong>${pct}%</strong> de tu sueño <em>"${he(metaGrande.nombre)}"</em>. Si guardás esa plata en lugar de gastarla, en <strong>${mesesParaMeta} meses</strong> ya lo tenés listo. ¡Tú decidís!`;
      }
    }
  } else {
    if (anual >= SMMLV_2026) {
      const salarios = (anual / SMMLV_2026).toFixed(1);
      msg += `<br><br>Eso es lo mismo que <strong>${salarios} salario${salarios > 1 ? 's' : ''} mínimo${salarios > 1 ? 's' : ''}</strong> al año. Plata seria, ¿no?`;
    }
  }

  infoEl.innerHTML = msg;
  infoEl.style.display = 'block';
}

// ─── 4×1000 PREVIEW ──────────────────────────────────────────────────────────
export function prev4k() {
  const mo  = +document.getElementById('g-mo')?.value || 0;
  const ck  = document.getElementById('g-4k')?.checked;
  const el  = document.getElementById('p4k');
  if (!el) return;
  if (ck && mo > 0) {
    el.style.display = 'block';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      <span style="font-weight:700; color:var(--t1);">Gravamen de Movimientos Financieros (4×1000): +${f(mo * GMF_TASA)}</span>
      ➔ Lo que realmente sale de tu bolsillo: <span style="color:var(--a3); font-weight:800;">${f(mo * 1.004)}</span>
      <br>
      <span style="font-size:0.85rem; color:var(--t3); display:block; margin-top:0.5rem;">
        💡 <strong>Dato que te sirve:</strong> En Colombia podés marcar <strong>una cuenta</strong> como exenta del 4×1000. Los primeros ${f(GMF_EXENTO_MONTO)}/mes (${GMF_EXENTO_UVT} UVT) no pagan ese descuento (Art. 879 E.T.). Pregúntale a tu banco, ¡es tu derecho!
      </span>`;
  } else {
    el.style.display = 'none';
    el.removeAttribute('role');
    el.innerHTML = '';
  }
}

// ─── AGREGAR GASTO ────────────────────────────────────────────────────────────
export async function agregarGasto() {
  const de = document.getElementById('g-de').value.trim();
  const mo = +document.getElementById('g-mo').value;
  const ca = document.getElementById('g-ca').value;
  if (!de || !mo || !ca) { await showAlert('Falta ponerle nombre al gasto, cuánto fue y de qué es. ¡Sin eso no podemos anotarlo!', 'Falta info'); return; }

  const fx         = document.getElementById('g-4k').checked;
  const montoTotal = fx ? Math.round(mo * (1 + GMF_TASA)) : mo;
  const fo         = document.getElementById('g-fo').value;
  const ti         = document.getElementById('g-ti').value;

  if (ti !== 'ahorro') {
    let disp = 0;
    if (fo === 'efectivo') {
      disp = S.saldos.efectivo;
    } else if (fo.startsWith('cuenta_')) {
      const cuenta = S.cuentas.find(x => x.id === +fo.split('_')[1]);
      if (!cuenta) { await showAlert('Esa cuenta ya no existe. Revisá tus bolsillos registrados.', 'Cuenta no encontrada'); return; }
      disp = cuenta.saldo;
    } else {
      disp = S.saldos.banco;
    }
    if (disp < montoTotal) {
      const ok = await showConfirm(`⚠️ En esa fuente solo hay ${f(disp)} y este gasto vale ${f(montoTotal)}.\n\n¿Querés anotarlo de todas formas? El saldo quedará en negativo.`, 'Saldo insuficiente');
      if (!ok) return;
    }
  }

  S.gastos.unshift({
    id: Date.now(), desc: de, monto: mo, montoTotal, cat: ca,
    tipo: ti, fondo: fo, hormiga: (ti === 'hormiga'), cuatroXMil: fx,
    fecha: document.getElementById('g-fe').value || hoy(), metaId: '', autoFijo: false
  });

  if (ti !== 'ahorro') descontarFondo(fo, montoTotal);

  ['g-de', 'g-mo'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
  document.getElementById('g-4k').checked = false;
  ['p4k', 'g-semaforo', 'g-hormiga-impact'].forEach(id => {
    const e = document.getElementById(id); if (e) e.style.display = 'none';
  });

  save(); renderSmart(['gastos', 'stats']);
}

// ─── ELIMINAR GASTO ───────────────────────────────────────────────────────────
export async function delGasto(id) {
  const ok = await showConfirm('¿Borramos este gasto del registro? Recuerda que no hay marcha atrás.', 'Borrar gasto');
  if (!ok) return;
  const g = S.gastos.find(x => x.id === id);
  if (g && g.tipo !== 'ahorro') reintegrarFondo(g.fondo, g.montoTotal || g.monto);
  if (g && g.autoFijo && g.fijoRef) {
    const mes  = mesStr();
    const fijo = S.gastosFijos.find(x => x.id === g.fijoRef);
    if (fijo) fijo.pagadoEn = fijo.pagadoEn.filter(m => m !== mes);
  }
  S.gastos = S.gastos.filter(x => x.id !== id);
  save(); renderSmart(['gastos', 'stats']);
}

// ─── EDITAR GASTO ─────────────────────────────────────────────────────────────
export function abrirEditarGasto(id) {
  const g = S.gastos.find(x => x.id === id); if (!g) return;
  document.getElementById('eg-id').value  = id;
  document.getElementById('eg-de').value  = g.desc;
  document.getElementById('eg-mo').value  = g.monto;
  document.getElementById('eg-ca').value  = g.cat;
  document.getElementById('eg-ti').value  = g.tipo;
  document.getElementById('eg-fe').value  = g.fecha;
  const hiddenFo = document.getElementById('eg-fo');
  if (hiddenFo) hiddenFo.value = g.fondo || 'efectivo';
  window.actualizarListasFondos?.();
  openM('m-edit-gasto');
}

export async function guardarEditarGasto() {
  const id     = +document.getElementById('eg-id').value;
  const g      = S.gastos.find(x => x.id === id); if (!g) return;
  const nMonto = +document.getElementById('eg-mo').value;
  const nFondo = document.getElementById('eg-fo').value;
  if (!nMonto) return;
  if (g.tipo !== 'ahorro') reintegrarFondo(g.fondo, g.montoTotal || g.monto);
  g.desc       = document.getElementById('eg-de').value.trim();
  g.monto      = nMonto; g.montoTotal = nMonto;
  g.cat        = document.getElementById('eg-ca').value;
  g.tipo       = document.getElementById('eg-ti').value;
  g.fondo      = nFondo;
  g.hormiga    = g.tipo === 'hormiga';
  g.fecha      = document.getElementById('eg-fe').value;
  if (g.tipo !== 'ahorro') descontarFondo(nFondo, nMonto);
  closeM('m-edit-gasto'); save(); renderSmart(['gastos', 'stats']);
}

// ─── LIMPIAR PERÍODO ─────────────────────────────────────────────────────────
export async function limpiarGastos() {
  const ok = await showConfirm('¿Arrancamos el período desde cero? Se van todos los gastos anotados, pero tus fijos y tus metas quedan intactos.', 'Limpiar período');
  if (!ok) return;
  S.gastos.filter(g => g.tipo !== 'ahorro').forEach(g => reintegrarFondo(g.fondo, g.montoTotal || g.monto));
  const mes = mesStr();
  S.gastosFijos.forEach(g => { g.pagadoEn = (g.pagadoEn || []).filter(m => m !== mes); });
  S.gastos = [];
  save(); renderSmart(['gastos', 'stats']);
}

// ─── FILTRO ──────────────────────────────────────────────────────────────────
export function setFiltroGasto(tipo, el) {
  _filtroGasto = tipo;
  document.querySelectorAll('.gfil').forEach(b => {
    b.classList.remove('active-fil');
    b.style.opacity = '.65'; b.style.fontWeight = '600';
    b.setAttribute('aria-pressed', 'false');
  });
  if (el) {
    el.classList.add('active-fil');
    el.style.opacity = '1'; el.style.fontWeight = '800';
    el.setAttribute('aria-pressed', 'true');
  }
  renderGastos();
}

// ─── RENDER GASTOS ───────────────────────────────────────────────────────────
export function renderGastos() {
  const tb = document.getElementById('g-tab');
  if (!tb) return;
  const q = (document.getElementById('g-search')?.value || '').toLowerCase().trim();
  let list = [...S.gastos];

  if (q)                           list = list.filter(g => (g.desc || '').toLowerCase().includes(q) || (CATS[g.cat] || g.cat).toLowerCase().includes(q));
  if (_filtroGasto === '4x1000')   list = list.filter(g => g.cuatroXMil);
  else if (_filtroGasto === 'hormiga') list = list.filter(g => g.hormiga || g.tipo === 'hormiga');
  else if (_filtroGasto)           list = list.filter(g => g.tipo === _filtroGasto);

  if (!list.length) {
    tb.innerHTML = q
      ? `<tr><td colspan="9" class="emp">No encontramos nada con "${q}". Probá con otras palabras.</td></tr>`
      : '<tr><td colspan="9" class="emp">Todavía no hay gastos anotados en este período. ¡Llevar el control es el primer paso!</td></tr>';
    return;
  }

  const total = list.length;
  tb.innerHTML = list.slice(0, 80).map(g => {
    let cIcono = '🏦', cNom = 'Banco';
    if (g.fondo === 'efectivo') { cIcono = '💵'; cNom = 'Efectivo'; }
    else if (g.fondo?.startsWith('cuenta_')) {
      const c = S.cuentas.find(x => x.id === +g.fondo.split('_')[1]);
      if (c) { cIcono = c.icono; cNom = c.nombre; }
    }
    return `<tr>
      <td class="mono" style="font-size:10px">${g.fecha}</td>
      <td>${he(g.desc)}${g.autoFijo ? ' <span class="pill pm" style="font-size:9px">Fijo</span>' : ''}</td>
      <td style="font-size:10px">${CATS[g.cat] || g.cat}</td>
      <td><span class="pill ${g.tipo === 'necesidad' ? 'pb' : g.tipo === 'ahorro' ? 'pg' : 'py'}">${g.tipo}</span></td>
      <td><span class="pill pm">${cIcono} ${he(cNom)}</span></td>
      <td>${g.hormiga ? '🐜' : '—'}</td>
      <td>${g.cuatroXMil ? '<span class="pill pt">✓</span>' : '—'}</td>
      <td class="ac mono" style="color:${g.tipo === 'ahorro' ? 'var(--a1)' : 'var(--a3)'};font-weight:600">${f(g.montoTotal || g.monto)}</td>
      <td style="display:flex;gap:4px">
        <button class="btn bg bsm" onclick="abrirEditarGasto(${g.id})">✏️</button>
        <button class="btn bd bsm" onclick="delGasto(${g.id})">×</button>
      </td>
    </tr>`;
  }).join('');

  if (total > 80) {
    tb.innerHTML += `<tr><td colspan="9" style="text-align:center; padding:12px; color:var(--a2); font-size:11px; font-weight:600;">
      Mostrando los 80 más recientes de ${total} gastos en total. Usá el buscador para encontrar alguno en específico.</td></tr>`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── vs QUINCENA PASADA (auditoría v5: comparación semanal) ──────────────────
function _renderComparacionQuincena(actual) {
  const el = document.getElementById('d-vs-quincena');
  if (!el) return;
  const prev = (S.historial && S.historial[0]) || null;
  const r    = calcularComparacionQuincenas(actual, prev);

  if (!r) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const fila = (label, emoji, m, menosEsMejor) => {
    let flecha, color;
    if (m.estado === 'igual') { flecha = '➡️'; color = 'var(--t3)'; }
    else if (m.estado === 'mejor') {
      flecha = menosEsMejor ? '⬇️' : '⬆️';
      color = 'var(--a1)';
    } else {
      flecha = menosEsMejor ? '⬆️' : '⬇️';
      color = 'var(--dan)';
    }
    const signo = m.pct > 0 ? '+' : '';
    const txt   = m.estado === 'igual'
      ? '~ igual'
      : `${signo}${m.pct}% (${signo}${f(Math.abs(m.delta) * (m.pct < 0 ? -1 : 1))})`;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:11px;">
        <span style="color:var(--t2);font-weight:600;">${emoji} ${label}</span>
        <span style="color:${color};font-weight:700;">${flecha} ${txt}</span>
      </div>
    `;
  };

  el.style.display = 'block';
  el.innerHTML = `
    <div style="padding:12px 14px;background:var(--s2);border:1px solid var(--b1);border-radius:8px;">
      <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        📊 vs quincena pasada (${he(prev.periodo || prev.mes || 'anterior')})
      </div>
      ${fila('Gastos',  '💸', r.gastado, true)}
      ${fila('Ahorro',  '💰', r.ahorro,  false)}
      ${fila('Hormiga', '🐜', r.hormiga, true)}
      ${fila('Ingreso', '💵', r.ingreso, false)}
    </div>
  `;
}

// ─── TOP 3 HORMIGAS DEL MES (auditoría v5: insight accionable) ───────────────
function _renderTopHormigas() {
  const el = document.getElementById('d-top-hormigas');
  if (!el) return;
  const mes = mesStr();   // 'YYYY-MM' del mes actual
  const top = calcularTopHormigas(S.gastos || [], mes, 3);

  if (top.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const max = top[0].total;
  const filas = top.map((h, i) => {
    const ancho = max > 0 ? Math.round((h.total / max) * 100) : 0;
    const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    return `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:11px;margin-bottom:3px;">
          <span style="font-weight:700;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">
            ${medalla} ${he(h.concepto)}
            <span style="color:var(--t3);font-weight:500;font-size:10px;">×${h.count}</span>
          </span>
          <span class="mono" style="font-weight:700;color:#a1887f;flex-shrink:0;">${f(h.total)}</span>
        </div>
        <div style="height:4px;background:rgba(121,85,72,.15);border-radius:999px;overflow:hidden;">
          <div style="height:100%;border-radius:999px;background:#a1887f;width:${ancho}%;transition:width .4s ease;"></div>
        </div>
      </div>
    `;
  }).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
      🎯 Top 3 hormigas de este mes
    </div>
    ${filas}
    <div style="margin-top:8px;font-size:10px;color:var(--t3);line-height:1.5;">
      💡 Atacá estas tres y vas a ver el cambio en la próxima quincena.
    </div>
  `;
}

// ─── RENDER DE CUENTAS EN DASH ───────────────────────────────────────────────
export function renderDashCuentas() {
  const el = document.getElementById('d-cuentas');
  if (!el) return;
  if (!S.cuentas || !S.cuentas.length) {
    el.innerHTML = '<div class="tm" style="padding:10px 0;">Agrega tus cuentas en la sección Quincena.</div>';
    return;
  }
  const total = totalCuentas();
  let html = S.cuentas.map(c => {
    const pct = total > 0 ? (c.saldo / total * 100).toFixed(1) : 0;
    return `
    <div style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:var(--t2);">
          <span style="font-size:16px;">${c.icono}</span><span>${he(c.nombre)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="mono" style="color:var(--a1); font-weight:600; font-size:13px;">${f(c.saldo)}</span>
          <button class="btn bg bsm" onclick="editSaldoCuentaDash(${c.id})" style="padding:3px 8px; border-radius:6px; font-size:11px;" title="Editar saldo">✏️</button>
          <button class="btn bd bsm" onclick="delCuenta(${c.id})" style="padding:3px 8px; border-radius:6px; font-size:12px; font-weight:bold;" title="Eliminar cuenta">×</button>
        </div>
      </div>
      <div class="pw" style="height:4px; margin-top:0; background:var(--s3); border-radius:4px;">
        <div class="pf" style="width:${pct}%; background:${c.color || 'var(--a1)'}; border-radius:4px;"></div>
      </div>
    </div>`;
  }).join('');
  html += `<div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--b1); padding-top:14px; margin-top:8px;">
    <span style="font-size:11px; font-weight:800; color:var(--t3); text-transform:uppercase; letter-spacing:1px;">Total Cuentas</span>
    <span class="mono" style="font-size:14px; font-weight:700; color:var(--a4);">${f(total)}</span>
  </div>`;
  el.innerHTML = html;
}

// ─── UPDATE DASH ─────────────────────────────────────────────────────────────
export function updateDash() {
  let tG = 0, tA = 0, tH = 0;
  for (let i = 0; i < S.gastos.length; i++) {
    const g = S.gastos[i];
    const m = g.montoTotal || g.monto;
    if (g.tipo === 'ahorro') tA += m; else tG += m;
    if (g.tipo === 'hormiga' || g.hormiga) tH += m;
  }

  setEl('d-ing', f(S.ingreso));
  setEl('d-gas', f(tG));
  setEl('d-pgc', `${S.ingreso > 0 ? Math.round(tG / S.ingreso * 100) : 0}% del ingreso`);
  setEl('d-aho', f(tA));
  const pctHormiga = S.ingreso > 0 ? Math.min(Math.round(tH / S.ingreso * 100), 100) : 0;
  setEl('d-hor', f(tH));
  setEl('d-phc', `${pctHormiga}% del ingreso`);
  const horBarra = document.getElementById('d-hor-barra');
  if (horBarra) horBarra.style.width = `${pctHormiga}%`;

  // Top 3 hormigas del mes — insight accionable
  _renderTopHormigas();

  // Comparación con quincena anterior
  _renderComparacionQuincena({ gastado: tG, ahorro: tA, hormiga: tH, ingreso: S.ingreso });

  // Nudges defensivos: respaldo cada 30 días + bolsillos olvidados (15d sin aporte)
  if (typeof window !== 'undefined') {
    window.renderBackupNudge?.();
    window.renderBolsillosOlvidados?.();
  }

  updSaldo();

  if (S.ingreso > 0) {
    const p = _getPct();
    const bar = (l, g, b, col) => {
      const u  = b > 0 ? Math.min(g / b * 100, 100) : 0;
      const ov = g > b;
      return `
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
          <span style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--t2);">${l}</span>
          <div style="text-align:right;">
            <div class="mono" style="font-size:18px; font-weight:800; color:${ov ? 'var(--dan)' : col}; line-height:1;">${f(g)}</div>
            <div class="tm" style="font-size:11px; color:var(--t3); margin-top:4px;">de ${f(b)} presupuestado</div>
          </div>
        </div>
        <div class="pw" style="height:8px; border-radius:8px; background:var(--s3);">
          <div class="pf" style="width:${u}%; background:${ov ? 'var(--dan)' : col}; border-radius:8px; transition:width 0.5s ease;"></div>
        </div>
      </div>`;
    };
    const gN = S.gastos.filter(g => g.tipo === 'necesidad').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
    const gD = S.gastos.filter(g => g.tipo === 'deseo').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
    setHtml('d-bud',
      bar('🏠 Necesidades', gN, S.ingreso * p.n / 100, 'var(--a4)') +
      bar('🎉 Deseos',      gD, S.ingreso * p.d / 100, 'var(--a2)') +
      bar('💰 Ahorro',      tA, S.ingreso * p.a / 100, 'var(--a1)')
    );
  }

  const cm = _consolMes();
  setEl('m-ing', f(cm.ing));
  setEl('m-eg',  f(cm.eg));
  const balEl = document.getElementById('m-bal');
  if (balEl) { balEl.textContent = f(cm.bal); balEl.style.color = cm.bal >= 0 ? 'var(--a1)' : 'var(--dan)'; }
  setHtml('m-det', `${cm.q} quincena(s) del mes`);

  const filasMovimientos = S.gastos.slice(0, 3).map(g => {
    let cIcono = '🏦', cNom = 'Banco';
    if (g.fondo === 'efectivo') { cIcono = '💵'; cNom = 'Efectivo'; }
    else if (g.fondo?.startsWith('cuenta_')) {
      const c = S.cuentas.find(x => x.id === +g.fondo.split('_')[1]);
      if (c) { cIcono = c.icono; cNom = c.nombre; }
    }
    const colorMonto = g.tipo === 'ahorro' ? 'var(--a1)' : 'var(--a3)';
    const colorPill  = g.tipo === 'necesidad' ? 'pb' : (g.tipo === 'ahorro' ? 'pg' : 'py');
    const signo      = g.tipo === 'ahorro' ? '+' : '-';
    const catLabel   = CATS[g.cat] || '📦 Otro';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--s2);border:1px solid var(--b1);border-radius:10px;margin-bottom:6px;"
         role="listitem">
      <div style="font-size:22px;line-height:1;flex-shrink:0;" aria-hidden="true">${cIcono}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${he(g.desc)}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:3px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
          <span class="mono">${g.fecha}</span>
          <span aria-hidden="true">·</span>
          <span>${catLabel}</span>
          <span class="pill ${colorPill}" style="font-size:9px;padding:1px 5px;">${g.tipo}</span>
        </div>
      </div>
      <div class="mono" style="color:${colorMonto};font-weight:700;font-size:14px;flex-shrink:0;"
           aria-label="${g.tipo === 'ahorro' ? 'Ahorro' : 'Gasto'} de ${f(g.montoTotal || g.monto)}">${signo}${f(g.montoTotal || g.monto)}</div>
    </div>`;
  });
  setHtml('d-rec', S.gastos.length
    ? `<div role="list">${filasMovimientos.join('')}</div>`
    : '<div class="emp"><span class="emp-icon">🕐</span>Sin movimientos registrados</div>'
  );
  const verMasEl = document.getElementById('d-rec-ver-mas');
  if (verMasEl) verMasEl.style.display = S.gastos.length > 3 ? 'block' : 'none';

  const dMetEl = document.getElementById('d-met');
  if (dMetEl) {
    if (!S.objetivos || !S.objetivos.length) {
      dMetEl.innerHTML = '<div class="emp"><span class="emp-icon">◯</span>Sin objetivos creados</div>';
    } else {
      dMetEl.innerHTML = S.objetivos.slice(0, 3).map(o => {
        const pct = o.objetivoAhorro > 0 ? Math.min((o.ahorrado / o.objetivoAhorro) * 100, 100) : 0;
        const col = pct >= 100 ? 'var(--a1)' : pct > 50 ? 'var(--a2)' : 'var(--a4)';
        return `<div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:600;">${o.icono} ${he(o.nombre)}</span>
            <span style="font-family:var(--fm); font-size:11px; font-weight:700; color:${col};">${Math.round(pct)}%</span>
          </div>
          <div class="pw" style="height:4px;"><div class="pf" style="width:${pct}%; background:${col};"></div></div>
          <div style="display:flex; justify-content:space-between; margin-top:4px;">
            <span class="tm" style="font-size:10px;">${f(o.ahorrado)} ahorrado</span>
            <span class="tm" style="font-size:10px;">Meta: ${f(o.objetivoAhorro)}</span>
          </div>
        </div>`;
      }).join('') + (S.objetivos.length > 3
        ? `<div class="tm" style="text-align:center; margin-top:4px;">+${S.objetivos.length - 3} objetivos más</div>`
        : '');
    }
  }

  // ─── ALERTAS FINANCIERAS ─────────────────────────────────────────────────
  const al  = [];
  const cPer = _cuotasPeriodo();
  const mes  = mesStr();

  const mesActual = new Date().getMonth() + 1;
  if (mesActual === 6 || mesActual === 12) {
    al.push(`<div class="al alg" style="align-items:center; border-width:2px;"><span class=\"al-icon\" style=\"font-size:24px;\" aria-hidden=\"true\">🎉</span><div style="flex:1"><strong>¡Es época de Prima/Bono!</strong> Si recibiste este dinero extra, regístralo aquí para simular su distribución inteligente.</div><button class="btn bp bsm" onclick="openM('m-prima')" style="white-space:nowrap; padding:8px 12px; font-size:12px;">+ Registrar Prima</button></div>`);
  }

  // ── Cesantías e intereses sobre cesantías (Ley 50/1990 + Decreto 116/76) ──
  // Enero: el empleador paga al trabajador los intereses (12% sobre cesantías)
  //        hasta el 31. El depósito llega a la cuenta del trabajador.
  // Febrero: el empleador consigna las cesantías al fondo (Porvenir, Colfondos,
  //          Protección, Skandia) hasta el 14. La plata NO va a la billetera
  //          del usuario — por eso el aviso es para "verificar con el fondo".
  // No condicionamos por tipo de empleo (igual que prima): es un recordatorio
  // legal universal; quienes no aplican simplemente lo ignoran.
  if (mesActual === 1) {
    al.push(`<div class="al alb"><span class=\"al-icon\" aria-hidden=\"true\">💼</span><div><strong>Intereses sobre cesantías:</strong> Antes del <strong>31 de enero</strong>, tu empleador debe pagarte el 12% sobre tus cesantías. Verifica que el depósito haya llegado a tu cuenta.</div></div>`);
  }
  if (mesActual === 2) {
    al.push(`<div class="al alb"><span class=\"al-icon\" aria-hidden=\"true\">🏦</span><div><strong>Consignación de cesantías:</strong> Antes del <strong>14 de febrero</strong>, tu empleador debe consignar tus cesantías al fondo (Porvenir, Colfondos, Protección, Skandia). Revisa con tu fondo para confirmar.</div></div>`);
  }

  const anioActual = new Date().getFullYear().toString();
  let ingresosAnio = S.ingreso;
  S.historial.forEach(h => { if (h.periodo && h.periodo.includes(anioActual)) ingresosAnio += h.ingreso; });
  // TOPE_DIAN viene de constants.js (1400 UVT × UVT_2026). Antes era un literal
  // 73_323_600 hardcoded que se desincronizaba cada vez que cambiaba la UVT
  // anual.
  if (ingresosAnio >= TOPE_DIAN) {
    al.push(`<div class="al ald"><span class=\"al-icon\" aria-hidden=\"true\">🏛️</span><div><strong>Alerta DIAN (Declaración de Renta):</strong> Tus ingresos este año suman <strong>${f(ingresosAnio)}</strong>. Has superado el tope legal aproximado (${f(TOPE_DIAN)}). Contacta a un contador público.</div></div>`);
  } else if (ingresosAnio >= TOPE_DIAN * 0.68) {
    al.push(`<div class="al alw"><span class=\"al-icon\" aria-hidden=\"true\">🏛️</span><div><strong>Aviso DIAN:</strong> Llevas <strong>${f(ingresosAnio)}</strong> este año. Estás próximo al tope legal para declarar renta (aprox. ${f(TOPE_DIAN)}). Ve reuniendo tus soportes.</div></div>`);
  }

  if (S.saldos.efectivo === 0 && S.saldos.banco === 0 && S.ingreso > 0) {
    al.push(`<div class="al alb"><span class=\"al-icon\" aria-hidden=\"true\">💡</span><div>Saldos en $0. Ve a <strong>Quincena</strong> y configura cuánto tienes en efectivo y banco.</div></div>`);
  }

  if (tG > S.ingreso * 0.9 && S.ingreso > 0) {
    al.push(`<div class="al ald"><span class=\"al-icon\" aria-hidden=\"true\">🚨</span><div>Gastas más del 90% de tu ingreso esta quincena. Revisa tus finanzas urgente.</div></div>`);
  }

  if (tH > S.ingreso * 0.15 && S.ingreso > 0) {
    const pctH = Math.round((tH / S.ingreso) * 100);
    al.push(`<div class="al alw"><span class=\"al-icon\" aria-hidden=\"true\">🐜</span><div>Tus gastos hormiga ya representan el <strong>${pctH}%</strong> de tu ingreso (${f(tH)}). ¡Es una fuga de capital muy alta!</div></div>`);
  }

  if (tA === 0 && S.gastos.length > 3) {
    al.push(`<div class="al alw"><span class=\"al-icon\" aria-hidden=\"true\">💰</span><div>No has registrado ningún ahorro esta quincena. ¡Págate a ti primero!</div></div>`);
  }

  if (cPer > S.ingreso * 0.3 && S.ingreso > 0) {
    al.push(`<div class="al ald"><span class=\"al-icon\" aria-hidden=\"true\">💳</span><div>Las cuotas de tus deudas (${f(cPer)}) superan el 30% de tu ingreso. Estás en zona de riesgo financiero.</div></div>`);
  }

  const fijNP = S.gastosFijos.filter(g => !(g.pagadoEn || []).includes(mes));
  if (fijNP.length) {
    al.push(`<div class="al alb"><span class=\"al-icon\" aria-hidden=\"true\">📌</span><div><strong>${fijNP.length}</strong> gasto(s) fijo(s) sin pagar este mes: ${fijNP.map(g => g.nombre).join(', ')}.</div></div>`);
  }

  setHtml('d-alr', al.join(''));
}

// ─── SCORE DE SALUD FINANCIERA ───────────────────────────────────────────────
/**
 * Calcula el score financiero (0–100) a partir de los inputs ya agregados.
 * Pura: no lee S, no toca DOM.
 *
 * Distribución de puntos:
 *   • Ahorro: hasta 40 pts (20% del ingreso = puntaje completo)
 *   • Deuda:  hasta 30 pts (≤30% del ingreso = puntaje completo, decae lineal)
 *   • Fondo:  hasta 30 pts (% completado del fondo de emergencia)
 *
 * @param {object} inputs
 * @param {number} inputs.ingreso        Ingreso del período.
 * @param {number} inputs.totalAhorro    Suma de gastos tipo "ahorro".
 * @param {number} inputs.cuotasPeriodo  Suma de cuotas del período activo.
 * @param {number} inputs.fondoPct       Porcentaje completado del fondo (0–100).
 * @returns {{
 *   total: number, ptsAhorro: number, ptsDeuda: number, ptsFondo: number,
 *   nivel: 'excelente'|'aceptable'|'malo'|'critico',
 *   colorClass: string, frase: string
 * }|null}  null si ingreso=0 y no hay datos suficientes.
 */
export function calcularScoreFinanciero({ ingreso, totalAhorro, cuotasPeriodo, fondoPct }) {
  const ptsAhorro = ingreso > 0 ? Math.min(((totalAhorro / ingreso) / 0.20) * 40, 40) : 0;
  const pctDeuda  = ingreso > 0 ? cuotasPeriodo / ingreso : 0;
  const ptsDeuda  = pctDeuda <= 0.30 ? 30 : Math.max(0, 30 - ((pctDeuda - 0.30) * 100));
  const ptsFondo  = Math.min((Math.max(0, fondoPct || 0) / 100) * 30, 30);
  const total     = Math.round(ptsAhorro + ptsDeuda + ptsFondo);

  let nivel, colorClass, frase;
  if (total >= 80)      { nivel = 'excelente'; colorClass = 'fs-excellent';  frase = 'Excelente — Finanzas muy saludables'; }
  else if (total >= 60) { nivel = 'aceptable'; colorClass = 'fs-acceptable'; frase = 'Buen camino — Hay margen de mejora'; }
  else if (total >= 40) { nivel = 'malo';      colorClass = 'fs-bad';        frase = 'Alerta — Revisa tus gastos pronto'; }
  else                  { nivel = 'critico';   colorClass = 'fs-very-bad';   frase = 'Riesgo — Necesitas un plan de acción'; }

  return { total, ptsAhorro, ptsDeuda, ptsFondo, nivel, colorClass, frase };
}

export function calcScore() {
  const elScore = document.getElementById('stat-score');
  const elLabel = document.getElementById('stat-score-label');
  const elMsg   = document.getElementById('stat-score-msg');
  if (!elScore || !elMsg || !elLabel) return;

  const tG = S.gastos.filter(g => g.tipo !== 'ahorro').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tA = S.gastos.filter(g => g.tipo === 'ahorro').reduce((s, g) => s + g.monto, 0);
  const tH = S.gastos.filter(g => g.tipo === 'hormiga' || g.hormiga).reduce((s, g) => s + g.monto, 0);

  if (S.ingreso === 0 && S.gastos.length === 0) {
    elScore.textContent = '-'; elLabel.textContent = 'Sin datos'; elMsg.innerHTML = '';
    return;
  }

  const cPer     = cuotasPeriodo();
  const fondoPct = (typeof window.calcularFondoEmergencia === 'function')
    ? parseFloat(window.calcularFondoEmergencia().porcentajeCompletado) || 0
    : 0;

  const score = calcularScoreFinanciero({
    ingreso:       S.ingreso,
    totalAhorro:   tA,
    cuotasPeriodo: cPer,
    fondoPct,
  });

  const { total: totalScore, colorClass, frase } = score;
  elScore.textContent = totalScore;

  elScore.className   = `fin-score ${colorClass}`;
  elLabel.textContent = frase;
  elLabel.style.cssText = 'color:var(--t3); text-transform:none; font-weight:500; font-size:12px;';

  const ok  = (txt) => `<div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;"><span style="color:var(--a1); font-size:13px;">✅</span><span style="color:var(--a1); font-size:13px;">${txt}</span></div>`;
  const bad = (txt) => `<div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;"><span style="font-size:13px;">❌</span><span style="color:var(--t3); font-size:13px;">${txt}</span></div>`;
  const inf = (icon, txt) => `<div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;"><span style="font-size:13px;">${icon}</span><span style="color:var(--a1); font-size:13px;">${txt}</span></div>`;

  const checklist = [];
  checklist.push(S.ingreso > 0 && tG > S.ingreso * 0.9 ? bad('Gastos exceden el 90%') : ok('Gastos bajo control'));
  checklist.push(tA > 0 ? ok('Ahorro constante') : bad('Sin ahorro registrado'));
  checklist.push(S.ingreso > 0 && tH > S.ingreso * 0.15 ? bad('Fuga hormiga alta') : ok('Hormiga controlada'));
  if (cPer > 0) checklist.push(cPer > S.ingreso * 0.3 ? inf('💳', 'Deudas >30% del ingreso') : ok('Deudas bajo control'));
  if (S.objetivos && S.objetivos.length > 0) checklist.push(inf('🎯', 'Metas de ahorro activas'));

  elMsg.className = 'score-checklist';
  elMsg.innerHTML = checklist.join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMEN QUINCENAL
// ═══════════════════════════════════════════════════════════════════════════════

export function calcularResumen() {
  const gastos  = S.gastos || [];
  const ingreso = S.ingreso || 0;

  let tG = 0, tA = 0, tH = 0, tN = 0, tD = 0;
  const catMap = {};

  gastos.forEach(g => {
    const m = g.montoTotal || g.monto || 0;
    if (g.tipo === 'ahorro') {
      tA += m;
    } else {
      tG += m;
      if (g.tipo === 'necesidad') tN += m;
      else if (g.tipo === 'deseo') tD += m;
    }
    if (g.hormiga || g.tipo === 'hormiga') tH += m;
    if (g.tipo !== 'ahorro') catMap[g.cat] = (catMap[g.cat] || 0) + m;
  });

  const balance    = ingreso - tG;
  const pctGasto   = ingreso > 0 ? (tG   / ingreso) * 100 : 0;
  const pctAhorro  = ingreso > 0 ? (tA   / ingreso) * 100 : 0;
  const pctHormiga = ingreso > 0 ? (tH   / ingreso) * 100 : 0;
  const pctNeces   = ingreso > 0 ? (tN   / ingreso) * 100 : 0;
  const pctDeseo   = ingreso > 0 ? (tD   / ingreso) * 100 : 0;

  const topCats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, monto]) => ({
      cat, monto,
      label: CATS[cat] || cat,
      color: CCOLORS[cat] || 'var(--a4)',
      pct: tG > 0 ? (monto / tG) * 100 : 0,
    }));

  const metodoId = S.metodo || '50-30-20';
  const METODOS  = {
    '50-30-20': { n: 50, d: 30, a: 20 },
    '50-20-30': { n: 50, d: 20, a: 30 },
    '70-20-10': { n: 70, d: 20, a: 10 },
  };
  const metasPct = METODOS[metodoId] || { n: 50, d: 30, a: 20 };

  const tDeudas = gastos
    .filter(g => g.cat === 'deudas')
    .reduce((s, g) => s + (g.montoTotal || g.monto || 0), 0);
  const pctDeudas = ingreso > 0 ? (tDeudas / ingreso) * 100 : 0;

  const gastoMax = gastos
    .filter(g => g.tipo !== 'ahorro')
    .reduce((max, g) => {
      const m = g.montoTotal || g.monto || 0;
      return m > max.monto ? { monto: m, desc: g.desc } : max;
    }, { monto: 0, desc: '' });

  const prev = S.historial?.[0] || null;
  const delta = prev ? {
    gasto:  pctGasto  - (prev.ingreso > 0 ? (prev.gastado / prev.ingreso) * 100 : 0),
    ahorro: pctAhorro - (prev.ingreso > 0 ? (prev.ahorro  / prev.ingreso) * 100 : 0),
  } : null;

  return {
    ingreso, tG, tA, tH, tN, tD, tDeudas,
    balance,
    pctGasto, pctAhorro, pctHormiga, pctNeces, pctDeseo, pctDeudas,
    topCats, metasPct, metodoId,
    gastoMax, numGastos: gastos.length,
    numHormiga: gastos.filter(g => g.hormiga || g.tipo === 'hormiga').length,
    prev, delta,
  };
}

export function generarConsejo(r) {
  if (r.ingreso === 0 || r.numGastos === 0) {
    return { icon: '📋', texto: 'Este período no tuvo registros suficientes para darte un análisis. ¡En la próxima quincena llevá el control desde el día uno!' };
  }

  if (r.tA === 0) {
    return {
      icon: '⚠️',
      texto: `Cerraste la quincena sin guardar ni un peso. La regla de oro es <strong>págate a ti primero</strong>: aparta el ahorro el mismo día que te cae el ingreso, antes de gastar en cualquier otra cosa. Aunque sea el 5%, el hábito es lo que importa.`,
    };
  }

  if (r.pctHormiga > 15) {
    const anual = r.tH * 26;
    return {
      icon: '🐜',
      texto: `Los gasticos hormiga se tragaron el <strong>${r.pctHormiga.toFixed(1)}% de tu ingreso</strong> (${f(r.tH)}). Proyectado al año, eso son <strong>${f(anual)}</strong> que se van sin que te des cuenta. La próxima quincena, antes de pagar ese café o ese domicilio, preguntate si lo necesitás o si es un piloto automático.`,
    };
  }

  if (r.pctGasto > 90) {
    return {
      icon: '🚨',
      texto: `Gastaste el <strong>${r.pctGasto.toFixed(1)}%</strong> de lo que entraron. Eso es una señal de alerta real. Revisá cuáles gastos no eran necesarios y construí un presupuesto más ajustado para la siguiente quincena.`,
    };
  }

  if (r.pctDeudas > 30) {
    return {
      icon: '💳',
      texto: `Más del <strong>30% de tu ingreso</strong> se fue en cuotas este período. Esa carga es pesada. Antes de agarrar cualquier nuevo compromiso financiero, enfocate en liquidar las deudas que ya tenés — especialmente las de mayor tasa.`,
    };
  }

  if (r.pctDeseo > r.metasPct.d + 10) {
    return {
      icon: '🛍️',
      texto: `Los gustos y caprichos estuvieron al <strong>${r.pctDeseo.toFixed(1)}%</strong>, cuando tu plan era máximo el <strong>${r.metasPct.d}%</strong>. No hay que dejar de disfrutar, pero conviene revisar cuáles de esos gastos realmente valieron la pena.`,
    };
  }

  if (r.delta && r.delta.ahorro > 5) {
    return {
      icon: '📈',
      texto: `¡Vas mejorando! Ahorraste <strong>${r.delta.ahorro.toFixed(1)} puntos porcentuales más</strong> que la quincena anterior. Esa tendencia, si la mantenés, va a cambiar tus finanzas de verdad. ¡Seguile metiendo!`,
    };
  }

  if (r.pctAhorro >= r.metasPct.a) {
    return {
      icon: '🏆',
      texto: `¡Cumpliste la meta de ahorro del período! Guardaste el <strong>${r.pctAhorro.toFixed(1)}%</strong> de tu ingreso, que era exactamente lo que ibas a hacer. Así es como se construye un futuro sin afanes. ¡Muy bien!`,
    };
  }

  return {
    icon: '✅',
    texto: `Cerraste bien la quincena. Balance positivo de <strong>${f(r.balance)}</strong> y con ahorro registrado. El paso siguiente es subir ese porcentaje de ahorro quincena a quincena, aunque sea de a poquito.`,
  };
}

export function mostrarResumenQuincena() {
  return new Promise(resolve => {
    const r       = calcularResumen();
    const consejo = generarConsejo(r);

    const ahora   = new Date();
    const mesNom  = ahora.toLocaleString('es-CO', { month: 'long' });
    const quinNum = ahora.getDate() <= 15 ? '1ra' : '2da';
    const etqDef  = `${quinNum} quincena de ${mesNom} ${ahora.getFullYear()}`;

    const balPos      = r.balance >= 0;
    const balColor    = balPos ? 'var(--a1)' : 'var(--dan)';
    const balEmoji    = r.pctAhorro >= (r.metasPct.a)
      ? '🏆' : balPos ? '✅' : '⚠️';

    const barCumpl = (label, actual, meta, color) => {
      const pct    = Math.min((actual / Math.max(meta, 0.1)) * 100, 150);
      const sobre  = actual > meta;
      const colorB = sobre ? 'var(--dan)' : color;
      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;
                      color:var(--t2);margin-bottom:5px;">
            <span>${label}</span>
            <span style="font-family:var(--fm);font-weight:700;color:${colorB};">
              ${actual.toFixed(1)}% <span style="color:var(--t3);font-weight:400;">/ meta ${meta}%</span>
            </span>
          </div>
          <div style="height:6px;background:var(--s3);border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${Math.min(pct, 100)}%;background:${colorB};
                        border-radius:999px;transition:width .5s ease;"></div>
          </div>
        </div>`;
    };

    const topHtml = r.topCats.length
      ? r.topCats.map(c => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:6px;height:6px;border-radius:50%;background:${c.color};flex-shrink:0;"></div>
            <div style="flex:1;font-size:11px;color:var(--t2);">${c.label}</div>
            <div style="font-family:var(--fm);font-size:12px;font-weight:700;color:var(--t1);">${f(c.monto)}</div>
            <div style="font-size:10px;color:var(--t3);width:34px;text-align:right;">${c.pct.toFixed(1)}%</div>
          </div>`).join('')
      : '<div style="font-size:11px;color:var(--t3);">Sin gastos registrados</div>';

    const deltaHtml = r.delta ? (() => {
      const dG = r.delta.gasto;
      const dA = r.delta.ahorro;
      const rowD = (label, delta, invertido) => {
        const mejoro = invertido ? delta < 0 : delta > 0;
        const signo  = delta > 0 ? '+' : '';
        const color  = delta === 0 ? 'var(--t3)' : mejoro ? 'var(--a1)' : 'var(--dan)';
        const icon   = delta === 0 ? '─' : mejoro ? '▲' : '▼';
        return `
          <div style="display:flex;justify-content:space-between;font-size:11px;
                      color:var(--t2);margin-bottom:6px;">
            <span>${label}</span>
            <span style="font-family:var(--fm);font-weight:700;color:${color};">
              ${icon} ${signo}${Math.abs(delta).toFixed(1)} pts
            </span>
          </div>`;
      };
      return `
        <div style="padding:12px 14px;background:var(--s1);border:1px solid var(--b1);
                    border-radius:10px;margin-top:4px;">
          <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
                      letter-spacing:.5px;margin-bottom:8px;">vs quincena anterior</div>
          ${rowD('Gasto %',  dG, true)}
          ${rowD('Ahorro %', dA, false)}
        </div>`;
    })() : '';

    const ov = document.createElement('div');
    ov.id = 'resumen-quincenal-ov';
    Object.assign(ov.style, {
      position:       'fixed',
      inset:          '0',
      background:     'var(--overlay-bg, rgba(0,0,0,.6))',
      zIndex:         '1000',
      display:        'flex',
      alignItems:     'flex-end',
      justifyContent: 'center',
      padding:        '0',
    });
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Resumen de quincena antes de cerrar el período');

    ov.innerHTML = `
      <div id="resumen-quin-sheet"
           style="background:var(--s1);border-radius:22px 22px 0 0;
                  width:100%;max-width:560px;
                  max-height:92dvh;overflow-y:auto;
                  padding:0 0 env(safe-area-inset-bottom,16px);
                  animation:slideUp .3s cubic-bezier(.4,0,.2,1);">

        <div style="text-align:center;padding:12px 0 0;">
          <div style="width:36px;height:4px;background:var(--b2);border-radius:2px;
                      display:inline-block;" aria-hidden="true"></div>
        </div>

        <div style="padding:16px 20px 24px;">

          <div style="font-size:14px;font-weight:800;color:var(--t1);margin-bottom:4px;">
            🗓️ Resumen de quincena
          </div>
          <div style="font-size:11px;color:var(--t3);margin-bottom:20px;">
            Revisá cómo te fue antes de cerrar este período
          </div>

          <div style="text-align:center;padding:20px;
                      background:var(--s2);border:1px solid var(--b1);
                      border-radius:16px;margin-bottom:20px;">
            <div style="font-size:32px;margin-bottom:8px;" aria-hidden="true">${balEmoji}</div>
            <div style="font-size:11px;font-weight:700;color:var(--t3);
                        text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">
              Balance del período
            </div>
            <div style="font-family:var(--fm);font-size:36px;font-weight:800;
                        color:${balColor};letter-spacing:-1.5px;line-height:1;"
                 aria-label="Balance: ${f(r.balance)}">
              ${r.balance >= 0 ? '+' : ''}${f(r.balance)}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:16px;">
              <div style="text-align:center;">
                <div style="font-size:9px;color:var(--t3);font-weight:700;
                            text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">
                  Gastado
                </div>
                <div style="font-family:var(--fm);font-size:15px;font-weight:800;
                            color:var(--a3);">${f(r.tG)}</div>
                <div style="font-size:10px;color:var(--t3);">${r.pctGasto.toFixed(1)}%</div>
              </div>
              <div style="text-align:center;border-left:1px solid var(--b1);
                          border-right:1px solid var(--b1);">
                <div style="font-size:9px;color:var(--t3);font-weight:700;
                            text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">
                  Ahorrado
                </div>
                <div style="font-family:var(--fm);font-size:15px;font-weight:800;
                            color:var(--a1);">${f(r.tA)}</div>
                <div style="font-size:10px;color:var(--t3);">${r.pctAhorro.toFixed(1)}%</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:9px;color:var(--t3);font-weight:700;
                            text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">
                  Hormiga 🐜
                </div>
                <div style="font-family:var(--fm);font-size:15px;font-weight:800;
                            color:var(--a2);">${f(r.tH)}</div>
                <div style="font-size:10px;color:var(--t3);">${r.pctHormiga.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:12px;">
              📐 Método ${r.metodoId}
            </div>
            ${barCumpl('🏠 Necesidades', r.pctNeces,  r.metasPct.n, 'var(--a4)')}
            ${barCumpl('🎉 Deseos',      r.pctDeseo,  r.metasPct.d, 'var(--a2)')}
            ${barCumpl('💰 Ahorro',      r.pctAhorro, r.metasPct.a, 'var(--a1)')}
          </div>

          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:10px;">
              🏆 Top gastos del período
            </div>
            ${topHtml}
          </div>

          ${deltaHtml}

          <div style="padding:14px;background:rgba(0,220,130,.06);
                      border:1px solid rgba(0,220,130,.2);border-radius:12px;
                      margin-top:${r.delta ? '16px' : '4px'};">
            <div style="font-size:20px;margin-bottom:6px;">${consejo.icon}</div>
            <div style="font-size:12px;color:var(--t2);line-height:1.65;">${consejo.texto}</div>
          </div>

          <div style="margin-top:20px;">
            <label for="rq-etiqueta"
                   style="display:block;font-size:11px;font-weight:700;color:var(--t3);
                          text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
              📝 Nombre del período (opcional)
            </label>
            <input id="rq-etiqueta" type="text"
                   value="${etqDef}"
                   maxlength="60"
                   style="width:100%;background:var(--s2);border:1px solid var(--b2);
                          border-radius:10px;padding:10px 14px;color:var(--t1);
                          font-family:var(--ff);font-size:13px;outline:none;"
                   aria-label="Nombre del período a archivar">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
            <button id="rq-btn-cancel"
                    style="padding:14px;background:var(--s2);border:1px solid var(--b2);
                           border-radius:12px;color:var(--t2);font-family:var(--ff);
                           font-size:13px;font-weight:600;cursor:pointer;"
                    aria-label="Seguir en el período actual sin cerrarlo">
              Seguir gastando
            </button>
            <button id="rq-btn-confirm"
                    style="padding:14px;background:var(--a1);border:none;border-radius:12px;
                           color:#000;font-family:var(--ff);font-size:13px;font-weight:800;
                           cursor:pointer;"
                    aria-label="Confirmar cierre y archivar este período">
              Cerrar y guardar →
            </button>
          </div>

        </div>
      </div>`;

    const styleTag = document.createElement('style');
    styleTag.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }`;
    document.head.appendChild(styleTag);

    document.body.appendChild(ov);

    requestAnimationFrame(() => {
      document.getElementById('rq-btn-confirm')?.focus();
    });

    const cerrar = (ok) => {
      const etiqueta = document.getElementById('rq-etiqueta')?.value?.trim() || etqDef;
      ov.style.opacity = '0';
      setTimeout(() => {
        ov.remove();
        styleTag.remove();
      }, 200);
      resolve({ ok, etiqueta });
    };

    document.getElementById('rq-btn-confirm')?.addEventListener('click', () => cerrar(true));
    document.getElementById('rq-btn-cancel')?.addEventListener('click',  () => cerrar(false));

    const escHandler = (e) => {
      if (e.key === 'Escape') { document.removeEventListener('keydown', escHandler); cerrar(false); }
    };
    document.addEventListener('keydown', escHandler);

    ov.addEventListener('click', (e) => {
      if (e.target === ov) cerrar(false);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIAL
// ═══════════════════════════════════════════════════════════════════════════════

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderHistorial() {
  const el = document.getElementById('hi-lst'); if (!el) return;

  if (!S.historial.length) {
    el.innerHTML = `
      <div style="text-align:center; padding:40px 20px; background:var(--s1); border-radius:16px; border:1px dashed rgba(0,220,130,.3);">
        <div style="font-size:48px; margin-bottom:14px;">🕰️</div>
        <div style="font-weight:800; font-size:17px; color:var(--t1); margin-bottom:8px;">Sin historial aún</div>
        <div style="color:var(--t3); font-size:13px; max-width:260px; margin:0 auto; line-height:1.6;">Cuando cierres un período, aquí quedará el resumen guardado para siempre.</div>
      </div>`;
    return;
  }

  el.innerHTML = S.historial.map(hx => {
    const balance    = hx.ingreso - hx.gastado;
    const colorBal   = balance >= 0 ? 'var(--a1)' : 'var(--dan)';
    const signoBal   = balance >= 0 ? '+' : '';
    const tasaAhorro = hx.ingreso > 0 ? Math.round((hx.ahorro / hx.ingreso) * 100) : 0;
    const tasaGasto  = hx.ingreso > 0 ? Math.round((hx.gastado / hx.ingreso) * 100) : 0;
    const pctGasto   = hx.ingreso > 0 ? Math.min((hx.gastado / hx.ingreso) * 100, 100) : 0;
    const pctAhorro  = hx.ingreso > 0 ? Math.min((hx.ahorro / hx.ingreso) * 100, 100) : 0;
    const pctHormiga = hx.ingreso > 0 ? Math.min(((hx.hormiga || 0) / hx.ingreso) * 100, 100) : 0;

    return `
    <article class="hist-card" aria-label="Historial: ${hx.periodo}">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--b1); flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:12px; background:var(--s2); border:1px solid var(--b2); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;" aria-hidden="true">📅</div>
          <div>
            <div style="font-weight:800; font-size:14px; color:var(--t1);">${hx.periodo}</div>
            <div style="font-size:11px; color:var(--t3); margin-top:2px;">Balance: <span style="font-family:var(--fm); font-weight:700; color:${colorBal};">${signoBal}${f(balance)}</span></div>
          </div>
        </div>
        <button class="btn-eliminar-deu" onclick="delHistorial(${hx.id})" style="padding:6px 12px;" aria-label="Eliminar historial ${hx.periodo}">🗑️</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--b1);">
        <div style="background:var(--s1); padding:14px 16px;">
          <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Ingreso</div>
          <div style="font-family:var(--fm); font-size:16px; font-weight:800; color:var(--t1);">${f(hx.ingreso)}</div>
        </div>
        <div style="background:var(--s1); padding:14px 16px;">
          <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Gastado</div>
          <div style="font-family:var(--fm); font-size:16px; font-weight:800; color:var(--dan);">${f(hx.gastado)}</div>
          <div style="font-size:10px; color:var(--t3); margin-top:2px;">${tasaGasto}% del ingreso</div>
        </div>
        <div style="background:var(--s1); padding:14px 16px;">
          <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Ahorrado</div>
          <div style="font-family:var(--fm); font-size:16px; font-weight:800; color:var(--a1);">${f(hx.ahorro)}</div>
          <div style="font-size:10px; color:var(--t3); margin-top:2px;">${tasaAhorro}% del ingreso</div>
        </div>
      </div>

      <div style="padding:12px 20px 16px;">
        <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Distribución del período</div>
        <div style="height:8px; border-radius:999px; background:var(--s3); overflow:hidden; display:flex;">
          <div style="width:${pctGasto}%; background:var(--dan); transition:width .6s ease;" title="Gastos ${tasaGasto}%"></div>
          <div style="width:${pctAhorro}%; background:var(--a1); transition:width .6s ease;" title="Ahorro ${tasaAhorro}%"></div>
          <div style="width:${pctHormiga}%; background:var(--a2); transition:width .6s ease;" title="Hormiga"></div>
        </div>
        <div style="display:flex; gap:14px; margin-top:6px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:4px; font-size:10px; color:var(--t3);"><div style="width:8px; height:8px; border-radius:50%; background:var(--dan); flex-shrink:0;"></div> Gastos</div>
          <div style="display:flex; align-items:center; gap:4px; font-size:10px; color:var(--t3);"><div style="width:8px; height:8px; border-radius:50%; background:var(--a1); flex-shrink:0;"></div> Ahorro</div>
          ${hx.hormiga > 0 ? `<div style="display:flex; align-items:center; gap:4px; font-size:10px; color:var(--t3);"><div style="width:8px; height:8px; border-radius:50%; background:var(--a2); flex-shrink:0;"></div> Hormiga ${f(hx.hormiga || 0)}</div>` : ''}
        </div>

        ${_renderTopCats(hx)}
      </div>
    </article>`;
  }).join('');
}

function _renderTopCats(hx) {
  if (!hx.catMap || !Object.keys(hx.catMap).length) return '';
  const sorted = Object.entries(hx.catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!sorted.length) return '';
  const filas = sorted.map(([cat, monto]) => `
    <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--t2); margin-bottom:4px;">
      <span>${CATS[cat] || cat}</span>
      <span class="mono" style="font-weight:700;">${f(monto)}</span>
    </div>`).join('');
  return `<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--b1);">
    <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; margin-bottom:6px;">Top gastos del período</div>
    ${filas}
  </div>`;
}

// ─── CERRAR QUINCENA ─────────────────────────────────────────────────────────
export async function cerrarQ() {
  if (!S.ingreso) {
    await window.showAlert?.(
      'No hay quincena configurada para cerrar. Primero armá tu plan en la sección de Planear.',
      'Nada que cerrar'
    );
    return;
  }

  const { ok, etiqueta } = await mostrarResumenQuincena();
  if (!ok) return;

  const tG = S.gastos.filter(g => g.tipo !== 'ahorro').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tA = S.gastos.filter(g => g.tipo === 'ahorro').reduce((s, g) => s + g.monto, 0);
  const tH = S.gastos.filter(g => g.hormiga || g.tipo === 'hormiga').reduce((s, g) => s + g.monto, 0);
  const catMap = {};
  S.gastos.filter(g => g.tipo !== 'ahorro').forEach(g => {
    catMap[g.cat] = (catMap[g.cat] || 0) + (g.montoTotal || g.monto);
  });

  S.historial.unshift({
    id:      Date.now(),
    periodo: etiqueta,
    mes:     mesStr(),
    ingreso: S.ingreso,
    gastado: tG,
    ahorro:  tA,
    hormiga: tH,
    catMap,
  });

  S.gastos  = [];
  S.ingreso = 0;
  save();
  renderSmart(['gastos', 'historial', 'stats']);
  window.go?.('stat');
  window.setResumenTab?.('historial');
}

// ─── ELIMINAR REGISTRO ───────────────────────────────────────────────────────
export function delHistorial(id) {
  S.historial = S.historial.filter(h => h.id !== id);
  save();
  renderHistorial();
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DE ACCIONES
// ═══════════════════════════════════════════════════════════════════════════════

// gastos
registerAction('agregarGasto',           () => agregarGasto());
registerAction('delGasto',               ({ id }) => delGasto(id));
registerAction('abrirEditarGasto',       ({ id }) => abrirEditarGasto(id));
registerAction('guardarEditarGasto',     () => guardarEditarGasto());
registerAction('limpiarGastos',          () => limpiarGastos());
registerAction('setFiltroGasto',         ({ tipo }) => setFiltroGasto(tipo));
registerAction('renderGastos',           () => renderGastos());
registerAction('prev4k',                 () => prev4k());
registerAction('actualizarSemaforo',     () => actualizarSemaforo());
registerAction('calcularImpactoHormiga', () => calcularImpactoHormiga());
// dashboard
registerAction('updateDash',             () => updateDash());
registerAction('calcScore',              () => calcScore());
registerAction('renderDashCuentas',      () => renderDashCuentas());
// resumen
registerAction('mostrarResumenQuincena', () => mostrarResumenQuincena());
registerAction('calcularResumen',        () => calcularResumen());
registerAction('generarConsejo',         () => generarConsejo());
// historial
registerAction('renderHistorial',        () => renderHistorial());
registerAction('delHistorial',           ({ id }) => delHistorial(id));
registerAction('cerrarQ',               () => cerrarQ());

// ═══════════════════════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════════════════════
// Guard `typeof window` para soportar tests/SSR sin DOM.
if (typeof window !== 'undefined') {
  // gastos — delGasto/abrirEditarGasto en HTML dinámico; render* llamados desde JS
  // agregarGasto, guardarEditarGasto, limpiarGastos, setFiltroGasto, cerrarQ → data-action
  window.delGasto               = delGasto;
  window.abrirEditarGasto       = abrirEditarGasto;
  window.renderGastos           = renderGastos;
  window.prev4k                 = prev4k;
  window.actualizarSemaforo     = actualizarSemaforo;
  window.calcularImpactoHormiga = calcularImpactoHormiga;
  // dashboard — llamados desde JS
  window.updateDash             = updateDash;
  window.calcScore              = calcScore;
  window.renderDashCuentas      = renderDashCuentas;
  // resumen — llamados desde JS
  window.mostrarResumenQuincena = mostrarResumenQuincena;
  window.calcularResumen        = calcularResumen;
  window.generarConsejo         = generarConsejo;
  // historial — delHistorial en HTML dinámico; renderHistorial desde JS
  window.renderHistorial        = renderHistorial;
  window.delHistorial           = delHistorial;
}
