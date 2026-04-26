// ─── PERSONALES (Me Deben) ───────────────────────────────────────────────────
// R3 (auditoría v5): préstamos personales — plata que TÚ prestaste a otros.
// Es la cara opuesta de `compromisos.deudas` (donde *tú* le debes a alguien).
//
// Schema de cada registro en S.meDeben:
//   {
//     id:           number,    // Date.now() al crear
//     persona:      string,    // a quién le prestaste
//     monto:        number,    // total prestado
//     pagado:       number,    // cuánto te ha devuelto hasta ahora
//     fecha:        string,    // YYYY-MM-DD del préstamo
//     motivo:       string,    // descripción opcional ("mercado", "favor")
//     fechaLimite?: string,    // YYYY-MM-DD opcional, fecha pactada
//     liquidado?:   boolean    // se marca true cuando pagado >= monto
//   }

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { S }    from '../core/state.js';
import { save } from '../core/storage.js';
import {
  f, he, hoy, setEl, setHtml,
  openM, closeM, showAlert, showConfirm
} from '../infra/utils.js';
import { renderSmart } from '../infra/render.js';
import { registerAction } from '../ui/actions.js';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PURAS DEL DOMINIO (R3 auditoría v5)
// ═══════════════════════════════════════════════════════════════════════════════
// Sin S, sin DOM. Las usan render y los handlers de abajo.

/**
 * Saldo pendiente de un préstamo personal (lo que aún no te han devuelto).
 * Nunca negativo: si pagado > monto, devuelve 0 (no le cobramos extra al amigo).
 *
 * @param {{monto:number, pagado?:number}} prestamo
 * @returns {number}
 */
export function calcularPendientePersona(prestamo) {
  const monto  = prestamo?.monto  || 0;
  const pagado = prestamo?.pagado || 0;
  return Math.max(0, monto - pagado);
}

/**
 * Días transcurridos desde la fecha del préstamo (o desde fechaLimite si la hay).
 * Sirve para calcular antigüedad y clasificar la "incomodidad" del cobro.
 *
 * @param {{fecha?:string, fechaLimite?:string}} prestamo
 * @param {Date|string} [fechaRef] default: ahora.
 * @returns {number} días (>= 0).
 */
export function calcularDiasPrestamo(prestamo, fechaRef = new Date()) {
  if (!prestamo?.fecha && !prestamo?.fechaLimite) return 0;
  const ref = fechaRef instanceof Date ? fechaRef : new Date(fechaRef);
  ref.setHours(0, 0, 0, 0);

  // Si hay fechaLimite y ya pasó, contamos desde ahí (ya está en mora real).
  // Sino contamos desde la fecha del préstamo.
  const base = prestamo.fechaLimite || prestamo.fecha;
  const fBase = new Date(base + 'T12:00:00');
  fBase.setHours(0, 0, 0, 0);
  const dias = Math.floor((ref - fBase) / 86_400_000);
  return Math.max(0, dias);
}

/**
 * Clasifica la antigüedad de un préstamo pendiente para decidir el tono UX.
 *
 * • reciente : 0–14 días — no hace falta presionar.
 * • mediano  : 15–60 días — recordatorio sugerido.
 * • viejo    : 61+ días — incomodidad real, hay que hablar.
 *
 * Estos cortes son culturales, no legales — entre amigos/familia colombianos
 * la deuda mayor a 2 meses ya genera tensión.
 *
 * @param {number} dias
 * @returns {'reciente'|'mediano'|'viejo'}
 */
export function clasificarAntiguedadPrestamo(dias) {
  if (dias <= 14)  return 'reciente';
  if (dias <= 60)  return 'mediano';
  return 'viejo';
}

/**
 * Resume el estado total de los préstamos hechos.
 *
 * @param {Array} meDeben — S.meDeben.
 * @returns {{
 *   totalPrestado: number,    // suma de montos
 *   totalCobrado:  number,    // suma de pagado
 *   totalPendiente: number,   // sumatoria de saldos pendientes
 *   activos:       number,    // # préstamos no liquidados
 *   liquidados:    number,    // # préstamos completos
 *   pctCobrado:    number,    // 0–100
 * }}
 */
export function calcularResumenMeDeben(meDeben) {
  const lista = Array.isArray(meDeben) ? meDeben : [];
  let totalPrestado = 0, totalCobrado = 0, totalPendiente = 0;
  let activos = 0, liquidados = 0;

  for (const p of lista) {
    const monto  = p?.monto  || 0;
    const pagado = Math.min(p?.pagado || 0, monto);  // clamp por seguridad
    totalPrestado  += monto;
    totalCobrado   += pagado;
    totalPendiente += Math.max(0, monto - pagado);
    if (monto > 0 && pagado >= monto) liquidados++;
    else if (monto > 0)                activos++;
  }

  const pctCobrado = totalPrestado > 0
    ? Math.round((totalCobrado / totalPrestado) * 100)
    : 0;

  return { totalPrestado, totalCobrado, totalPendiente, activos, liquidados, pctCobrado };
}

/**
 * Ordena préstamos según el modo elegido. No muta el input.
 *
 * • antiguo  : más viejos primero — los que urge cobrar (default).
 * • reciente : más recientes primero.
 * • monto    : mayor pendiente primero.
 *
 * @param {Array} meDeben
 * @param {'antiguo'|'reciente'|'monto'} [modo='antiguo']
 * @returns {Array} nueva lista ordenada.
 */
export function ordenarMeDeben(meDeben, modo = 'antiguo') {
  const copia = [...(meDeben || [])];
  if (modo === 'reciente') {
    copia.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  } else if (modo === 'monto') {
    copia.sort((a, b) => calcularPendientePersona(b) - calcularPendientePersona(a));
  } else {
    // antiguo: fecha ASC (más viejo primero)
    copia.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  }
  return copia;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD (operaciones que tocan S y DOM)
// ═══════════════════════════════════════════════════════════════════════════════

let _idEditando = null;

// ─── ABRIR MODAL NUEVO ───────────────────────────────────────────────────────
export function abrirNuevoMeDeben() {
  _idEditando = null;
  ['md-pe', 'md-mo', 'md-mt', 'md-fl'].forEach(i => {
    const e = document.getElementById(i); if (e) e.value = '';
  });
  const fecha = document.getElementById('md-fe');
  if (fecha) fecha.value = hoy();
  const titulo = document.getElementById('md-titulo');
  if (titulo) titulo.textContent = 'Nuevo Préstamo 🤝';
  openM('m-md');
}

// ─── ABRIR MODAL EDITAR ──────────────────────────────────────────────────────
export function abrirEditarMeDeben(id) {
  const p = (S.meDeben || []).find(x => x.id === id);
  if (!p) return;
  _idEditando = id;
  setEl('md-pe', p.persona || '');
  setEl('md-mo', p.monto  || '');
  setEl('md-mt', p.motivo || '');
  setEl('md-fe', p.fecha  || hoy());
  setEl('md-fl', p.fechaLimite || '');
  const titulo = document.getElementById('md-titulo');
  if (titulo) titulo.textContent = 'Editar Préstamo ✏️';
  openM('m-md');
}

// ─── GUARDAR (crear o editar) ────────────────────────────────────────────────
export async function guardarMeDeben() {
  const persona     = document.getElementById('md-pe')?.value.trim() || '';
  const monto       = +document.getElementById('md-mo')?.value || 0;
  const motivo      = document.getElementById('md-mt')?.value.trim() || '';
  const fecha       = document.getElementById('md-fe')?.value || hoy();
  const fechaLimite = document.getElementById('md-fl')?.value || '';

  if (!persona || monto <= 0) {
    await showAlert('Falta el nombre de la persona y el monto que le prestaste.', 'Falta info');
    return;
  }

  if (!Array.isArray(S.meDeben)) S.meDeben = [];

  if (_idEditando) {
    const p = S.meDeben.find(x => x.id === _idEditando);
    if (p) {
      p.persona     = persona;
      p.monto       = monto;
      p.motivo      = motivo;
      p.fecha       = fecha;
      p.fechaLimite = fechaLimite || undefined;
      // Si se reduce el monto por debajo de pagado, marcamos liquidado
      if ((p.pagado || 0) >= p.monto) p.liquidado = true;
    }
  } else {
    S.meDeben.push({
      id:          Date.now(),
      persona,
      monto,
      pagado:      0,
      fecha,
      motivo,
      fechaLimite: fechaLimite || undefined,
      liquidado:   false
    });
  }

  _idEditando = null;
  closeM('m-md');
  save();
  renderSmart(['meDeben']);
}

// ─── REGISTRAR PAGO PARCIAL O TOTAL ──────────────────────────────────────────
let _idPagando = null;

export function abrirPagarMeDeben(id) {
  const p = (S.meDeben || []).find(x => x.id === id);
  if (!p) return;
  _idPagando = id;
  const pendiente = calcularPendientePersona(p);
  setEl('mdp-no', he(p.persona || ''));
  setEl('mdp-pendiente', f(pendiente));
  const inp = document.getElementById('mdp-mo');
  if (inp) { inp.value = pendiente; inp.max = pendiente; }
  openM('m-mdp');
}

export async function confPagarMeDeben() {
  if (!_idPagando) return;
  const p = (S.meDeben || []).find(x => x.id === _idPagando);
  if (!p) return;

  const monto = +document.getElementById('mdp-mo')?.value || 0;
  if (monto <= 0) {
    await showAlert('Poné un monto mayor a 0.', 'Monto inválido');
    return;
  }

  const pendiente = calcularPendientePersona(p);
  const aplicado  = Math.min(monto, pendiente);
  p.pagado = (p.pagado || 0) + aplicado;
  if (p.pagado >= p.monto) p.liquidado = true;

  _idPagando = null;
  closeM('m-mdp');
  save();
  renderSmart(['meDeben']);
}

// ─── ELIMINAR ────────────────────────────────────────────────────────────────
export async function delMeDeben(id) {
  const p = (S.meDeben || []).find(x => x.id === id);
  if (!p) return;
  const ok = await showConfirm(
    `¿Borrar el préstamo a ${p.persona} por ${f(p.monto)}? Esto no devuelve la plata, solo limpia el registro.`,
    'Borrar préstamo'
  );
  if (!ok) return;
  S.meDeben = S.meDeben.filter(x => x.id !== id);
  save();
  renderSmart(['meDeben']);
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
let _modoOrden = 'antiguo';

export function setOrdenMeDeben(modo) {
  _modoOrden = modo;
  ['btn-md-antiguo', 'btn-md-reciente', 'btn-md-monto'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    const activo = id === `btn-md-${modo}`;
    b.className = activo ? 'btn bp' : 'btn bg';
  });
  renderMeDeben();
}

export function renderMeDeben() {
  const cont = document.getElementById('md-lst');
  if (!cont) return;
  if (!Array.isArray(S.meDeben)) S.meDeben = [];

  const lista = S.meDeben;
  if (lista.length === 0) {
    setHtml('md-lst', `
      <div class="emp" style="text-align:center;padding:36px 16px;">
        <div style="font-size:48px;margin-bottom:8px;">🤝</div>
        <div style="font-weight:700;color:var(--t1);font-size:15px;margin-bottom:6px;">Nadie te debe nada (o no lo registraste)</div>
        <div style="font-size:12px;color:var(--t3);max-width:300px;margin:0 auto;line-height:1.5;">Registrá los préstamos que hacés a familia y amigos para no olvidarte. Sin presión: solo es para vos.</div>
      </div>
    `);
    _renderResumenMeDeben();
    return;
  }

  const ordenadas = ordenarMeDeben(lista, _modoOrden);
  const hoyDate   = new Date();

  const html = ordenadas.map(p => {
    const pendiente   = calcularPendientePersona(p);
    const dias        = calcularDiasPrestamo(p, hoyDate);
    const antig       = clasificarAntiguedadPrestamo(dias);
    const liquidado   = pendiente <= 0;
    const pct         = p.monto > 0 ? Math.min(100, Math.round(((p.pagado || 0) / p.monto) * 100)) : 0;

    const colorAntig = liquidado     ? 'var(--a1)'
                     : antig === 'viejo'    ? 'var(--dan)'
                     : antig === 'mediano'  ? 'var(--a2)'
                     :                        'var(--t3)';
    const labelAntig = liquidado     ? '✅ Liquidado'
                     : antig === 'viejo'    ? `⚠️ ${dias} días — ya toca cobrar`
                     : antig === 'mediano'  ? `🕐 ${dias} días`
                     :                        `🆕 ${dias} día${dias === 1 ? '' : 's'}`;
    const fechaLim = p.fechaLimite
      ? `<span style="font-size:10px;color:var(--t3);">📅 Pactó devolver: ${p.fechaLimite}</span>`
      : '';

    return `
      <div class="card" style="margin-bottom:10px;padding:14px;border-radius:14px;background:var(--s2);border:1px solid var(--b1);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:15px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${he(p.persona)}</div>
            <div style="font-size:11px;color:${colorAntig};font-weight:700;margin-top:2px;">${labelAntig}</div>
            ${p.motivo ? `<div style="font-size:11px;color:var(--t3);margin-top:3px;font-style:italic;">«${he(p.motivo)}»</div>` : ''}
            ${fechaLim}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:9px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Pendiente</div>
            <div style="font-family:var(--fm);font-size:18px;font-weight:800;color:${liquidado ? 'var(--a1)' : 'var(--a2)'};">${f(pendiente)}</div>
            <div style="font-size:10px;color:var(--t3);margin-top:2px;">de ${f(p.monto)}</div>
          </div>
        </div>
        <div style="height:5px;background:var(--s3);border-radius:999px;overflow:hidden;margin-bottom:10px;">
          <div style="height:100%;border-radius:999px;background:${liquidado ? 'var(--a1)' : 'var(--a2)'};width:${pct}%;transition:width .3s ease;"></div>
        </div>
        <div style="display:flex;gap:8px;">
          ${liquidado
            ? `<button class="btn bg" style="flex:1;padding:8px;font-size:11px;" data-action="abrirEditarMeDeben" data-arg-id="${p.id}">✏️ Editar</button>`
            : `<button class="btn bp" style="flex:1;padding:8px;font-size:11px;" data-action="abrirPagarMeDeben"  data-arg-id="${p.id}">💵 Me pagaron</button>
               <button class="btn bg" style="flex:1;padding:8px;font-size:11px;" data-action="abrirEditarMeDeben" data-arg-id="${p.id}">✏️ Editar</button>`
          }
          <button class="btn bg" style="flex:0 0 auto;padding:8px 12px;font-size:11px;color:var(--dan);" data-action="delMeDeben" data-arg-id="${p.id}" aria-label="Borrar préstamo">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  setHtml('md-lst', html);
  _renderResumenMeDeben();
}

function _renderResumenMeDeben() {
  const r = calcularResumenMeDeben(S.meDeben || []);
  setEl('md-res-prestado',  f(r.totalPrestado));
  setEl('md-res-pendiente', f(r.totalPendiente));
  setEl('md-res-cobrado',   f(r.totalCobrado));
  setEl('md-res-activos',   r.activos);
  const barra = document.getElementById('md-res-barra');
  if (barra) barra.style.width = `${r.pctCobrado}%`;
  const pctEl = document.getElementById('md-res-pct');
  if (pctEl) pctEl.textContent = `${r.pctCobrado}%`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DE ACCIONES (data-action)
// ═══════════════════════════════════════════════════════════════════════════════
registerAction('renderMeDeben',      () => renderMeDeben());
registerAction('abrirNuevoMeDeben',  () => abrirNuevoMeDeben());
registerAction('guardarMeDeben',     () => guardarMeDeben());
registerAction('abrirPagarMeDeben',  ({ id }) => abrirPagarMeDeben(+id));
registerAction('confPagarMeDeben',   () => confPagarMeDeben());
registerAction('abrirEditarMeDeben', ({ id }) => abrirEditarMeDeben(+id));
registerAction('delMeDeben',         ({ id }) => delMeDeben(+id));
registerAction('setOrdenMeDeben',    ({ modo }) => setOrdenMeDeben(modo));

// ═══════════════════════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL (para HTML dinámico)
// ═══════════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.renderMeDeben      = renderMeDeben;
  window.abrirNuevoMeDeben  = abrirNuevoMeDeben;
  window.abrirPagarMeDeben  = abrirPagarMeDeben;
  window.abrirEditarMeDeben = abrirEditarMeDeben;
  window.delMeDeben         = delMeDeben;
}
