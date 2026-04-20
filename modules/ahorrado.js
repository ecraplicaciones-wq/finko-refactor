import { S }    from './state.js';
import { save } from './storage.js';
import {
  f, he, hoy, setEl, setHtml,
  openM, closeM, showAlert, showConfirm, sr
} from './utils.js';
import { BANCOS_CO } from './constants.js';
import { updSaldo }  from './render.js';

// ─── CATÁLOGO DE EMOJIS PARA BOLSILLOS ───────────────────────────────────────
const ICONOS_BOLS = [
  '🏠','✈️','🚗','📱','🎓','👶','💊','🛒','🎉','🐾',
  '💻','👗','🍔','⛽','💈','🏋️','🎮','📦','🛡️','🌱',
  '🎁','📚','🔧','🏥','🎵','🐶','🚌','🍕','👟','🌎'
];

// ─── INICIALIZACIÓN DEFENSIVA ─────────────────────────────────────────────────
// Si el usuario viene de una versión anterior sin bolsillos, no truena.
function _init() {
  if (!Array.isArray(S.bolsillos)) S.bolsillos = [];
}

// ─── CÁLCULOS BASE ────────────────────────────────────────────────────────────

/** Suma de todo lo que hay apartado en bolsillos. */
export function totalBolsillos() {
  _init();
  return S.bolsillos.reduce((s, b) => s + (Number(b.monto) || 0), 0);
}

/** Plata que puedes gastar sin sentirte mal: saldo real menos lo apartado. */
export function platoLibre() {
  const saldoReal = (S.saldos?.efectivo || 0) + (S.saldos?.banco || 0);
  return Math.max(0, saldoReal - totalBolsillos());
}

// ─── RENDER PRINCIPAL DE LA SECCIÓN ──────────────────────────────────────────
export function renderBolsillos() {
  _init();

  const total     = totalBolsillos();
  const libre     = platoLibre();
  const saldoReal = (S.saldos?.efectivo || 0) + (S.saldos?.banco || 0);

  // ── Actualizar resúmenes del header de la sección ──
  setEl('bols-total-ap',  f(total));
  setEl('bols-libre-txt', f(libre));
  setEl('bols-count-txt', `${S.bolsillos.length} bolsillo${S.bolsillos.length !== 1 ? 's' : ''} activo${S.bolsillos.length !== 1 ? 's' : ''}`);

  // ── Actualizar también en el Dashboard ──
  setEl('d-bols-ap', f(total));
  setEl('d-libre',   f(libre));
  // Barra del dashboard
  const dBolsBarra = document.getElementById('d-bols-barra');
  if (dBolsBarra) {
    const pctAp = saldoReal > 0 ? Math.min((total / saldoReal) * 100, 100) : 0;
    dBolsBarra.style.width = `${pctAp.toFixed(1)}%`;
  }

  const cont = document.getElementById('bols-lista');
  if (!cont) return;

  // ── Estado vacío ──
  if (!S.bolsillos.length) {
    cont.innerHTML = `
      <div class="emp" style="padding:40px 16px; text-align:center;">
        <div style="font-size:56px; margin-bottom:14px; animation:none;">🪙</div>
        <div style="font-size:16px; font-weight:700; color:var(--t1); margin-bottom:10px;">
          Aún no tienes ningún bolsillo
        </div>
        <p class="tm" style="line-height:1.75; max-width:290px; margin:0 auto 22px;">
          Un bolsillo es plata que ya sabes para qué es: el arriendo, el viaje de diciembre,
          la cuota del carro, la fiesta de grado de tu peladito... Así no la tocas por accidente. 👀
        </p>
        <button class="btn bp bfw"
                onclick="abrirNuevoBolsillo()"
                aria-label="Crear mi primer bolsillo de ahorro con propósito">
          🪙 Crear mi primer bolsillo
        </button>
      </div>`;
    return;
  }

  // ── Barra de distribución global ──
  const pctApartado = saldoReal > 0 ? Math.min((total / saldoReal) * 100, 100) : 0;
  const pctLibre    = Math.max(0, 100 - pctApartado);

  let html = `
    <div role="region" aria-label="Distribución de tu plata"
         style="background:var(--s2); border-radius:14px; padding:16px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:11px; font-weight:700; color:var(--t3); text-transform:uppercase; letter-spacing:.8px;">
          Así está repartida tu plata
        </span>
        <span style="font-size:11px; color:var(--t3);">
          Saldo real: <strong>${f(saldoReal)}</strong>
        </span>
      </div>
      <div style="height:16px; border-radius:999px; background:var(--s3); overflow:hidden; display:flex; gap:2px;"
           role="img" aria-label="${pctApartado.toFixed(0)}% apartado, ${pctLibre.toFixed(0)}% libre">
        <div style="width:${pctApartado.toFixed(1)}%; background:var(--a2); border-radius:999px 0 0 999px;
                    transition:width .6s cubic-bezier(.4,0,.2,1);" title="Apartado en bolsillos"></div>
        <div style="width:${pctLibre.toFixed(1)}%; background:var(--a1); border-radius:0 999px 999px 0;
                    transition:width .6s cubic-bezier(.4,0,.2,1);" title="Libre para gastar"></div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:10px; flex-wrap:wrap; gap:6px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:10px; height:10px; border-radius:50%; background:var(--a2); flex-shrink:0;"></div>
          <span style="font-size:12px; color:var(--t2);">
            🪙 Apartado: <strong style="color:var(--a2);">${f(total)}</strong>
            <span style="color:var(--t3);"> (${pctApartado.toFixed(0)}%)</span>
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:10px; height:10px; border-radius:50%; background:var(--a1); flex-shrink:0;"></div>
          <span style="font-size:12px; color:var(--t2);">
            ✅ Libre: <strong style="color:var(--a1);">${f(libre)}</strong>
            <span style="color:var(--t3);"> (${pctLibre.toFixed(0)}%)</span>
          </span>
        </div>
      </div>
    </div>`;

  // ── Tarjetas de cada bolsillo ──
  html += S.bolsillos.map(b => {
    const banco    = BANCOS_CO.find(x => x.id === b.banco) || { icono: '🏦', nombre: 'Otro banco', color: '#888888' };
    const color    = b.color || banco.color || 'var(--a2)';
    const pctReal  = saldoReal > 0 ? Math.min((b.monto / saldoReal) * 100, 100).toFixed(1) : '0.0';
    const pctDeBols = total > 0 ? Math.min((b.monto / total) * 100, 100).toFixed(0) : '0';
    const ultimaMov = b.movimientos?.length
      ? b.movimientos[0]
      : null;

    return `
    <article class="card mb"
             style="border-left:4px solid ${color}; padding:16px 16px 12px;"
             aria-label="Bolsillo ${he(b.nombre)}: ${f(b.monto)} guardados en ${banco.nombre}">

      <!-- Encabezado del bolsillo -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <div style="font-size:32px; line-height:1; flex-shrink:0;"
               role="img" aria-label="Ícono del bolsillo">${b.icono || '🪙'}</div>
          <div style="min-width:0;">
            <div style="font-size:15px; font-weight:700; color:var(--t1);
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${he(b.nombre)}
            </div>
            <div style="font-size:11px; color:var(--t3); margin-top:4px;
                        display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="background:${color}22; color:${color}; padding:2px 7px; border-radius:6px;
                           font-weight:600; font-size:10px;">
                ${banco.icono} ${banco.nombre}
              </span>
              ${b.descripcion
                ? `<span style="color:var(--t3);">${he(b.descripcion)}</span>`
                : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div class="mono"
               style="font-size:22px; font-weight:800; color:${color}; line-height:1;"
               aria-label="${f(b.monto)} en este bolsillo">${f(b.monto)}</div>
          <div style="font-size:10px; color:var(--t3); margin-top:4px;">
            ${pctReal}% de tu saldo · ${pctDeBols}% de lo apartado
          </div>
        </div>
      </div>

      <!-- Barra de progreso del bolsillo -->
      <div class="pw" style="height:6px; border-radius:999px; margin-bottom:12px;"
           role="progressbar" aria-valuenow="${pctReal}" aria-valuemin="0" aria-valuemax="100"
           aria-label="${pctReal}% de tu saldo total">
        <div class="pf" style="width:${pctReal}%; background:${color}; border-radius:999px;
                                transition:width .5s ease;"></div>
      </div>

      <!-- Último movimiento -->
      ${ultimaMov ? `
      <div style="font-size:10px; color:var(--t3); margin-bottom:12px; padding:6px 10px;
                  background:var(--s2); border-radius:6px;">
        Último movimiento: ${ultimaMov.tipo === 'abono' ? '➕' : ultimaMov.tipo === 'retiro' ? '➖' : '🌱'}
        <strong>${f(ultimaMov.monto)}</strong> el ${ultimaMov.fecha}
        ${ultimaMov.nota ? `· "${he(ultimaMov.nota)}"` : ''}
      </div>` : ''}

      <!-- Acciones -->
      <div style="display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn bg bsm"
                onclick="abrirAbonarBolsillo(${b.id})"
                aria-label="Agregar plata al bolsillo ${he(b.nombre)}">
          ➕ Abonar
        </button>
        <button class="btn bbl bsm"
                onclick="abrirRetirarBolsillo(${b.id})"
                aria-label="Sacar plata del bolsillo ${he(b.nombre)}">
          ➖ Retirar
        </button>
        <button class="btn bd bsm"
                onclick="eliminarBolsillo(${b.id})"
                aria-label="Eliminar el bolsillo ${he(b.nombre)} y liberar los ${f(b.monto)}">
          🗑️
        </button>
      </div>
    </article>`;
  }).join('');

  cont.innerHTML = html;
}

// ─── ABRIR MODAL: NUEVO BOLSILLO ─────────────────────────────────────────────
export function abrirNuevoBolsillo() {
  // Limpiar campos
  ['bols-nombre', 'bols-monto-ini', 'bols-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Ícono por defecto
  const iconVal = document.getElementById('bols-icono-val');
  if (iconVal) iconVal.value = '🪙';
  // Renderizar grid de íconos
  renderIconosBolsillo();
  // Poblar bancos
  _poblarSelectBancos('bols-banco');
  openM('m-nuevo-bolsillo');
  sr('Modal: Crear nuevo bolsillo');
}

// ─── GUARDAR NUEVO BOLSILLO ───────────────────────────────────────────────────
export async function guardarNuevoBolsillo() {
  _init();

  const nombre = document.getElementById('bols-nombre')?.value.trim();
  const monto  = +(document.getElementById('bols-monto-ini')?.value || 0);
  const banco  = document.getElementById('bols-banco')?.value || 'otro';
  const icono  = document.getElementById('bols-icono-val')?.value || '🪙';
  const desc   = document.getElementById('bols-desc')?.value.trim() || '';

  if (!nombre) {
    await showAlert(
      'Dale un nombre al bolsillo — ¿para qué es esa plata? Ej: "Arriendo julio", "Viaje diciembre".',
      '¡Falta el nombre! ✋'
    );
    document.getElementById('bols-nombre')?.focus();
    return;
  }

  const bancoInfo = BANCOS_CO.find(x => x.id === banco) || { color: '#888888' };

  const bolsillo = {
    id:          Date.now(),
    nombre,
    monto,
    banco,
    icono,
    color:       bancoInfo.color,
    descripcion: desc,
    fechaCreado: hoy(),
    movimientos: monto > 0
      ? [{ tipo: 'saldo_inicial', monto, fecha: hoy(), banco, nota: 'Saldo al crear' }]
      : []
  };

  S.bolsillos.push(bolsillo);
  save();
  closeM('m-nuevo-bolsillo');
  renderBolsillos();
  if (typeof window.updateDash === 'function') window.updateDash();
  sr(`Bolsillo "${nombre}" creado. Tiene ${f(monto)} apartados.`);

  const mensaje = monto > 0
    ? `¡Bolsillo creado! 🎉\n\nYa tienes ${f(monto)} apartados para "${nombre}". Esa plata sigue en tu cuenta, pero ahora sabés que ya tiene dueño. 💪`
    : `¡Bolsillo "${nombre}" listo! 🪙\n\nCuando consigas la plata, usa el botón ➕ Abonar para irlo llenando poco a poco.`;

  await showAlert(mensaje, 'Bolsillo creado 🪙');
}

// ─── ABRIR MODAL: ABONAR ─────────────────────────────────────────────────────
export function abrirAbonarBolsillo(id) {
  _init();
  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;
  _prepModalMov(id, 'abono', `Guardar plata en "${b.nombre}"`, b);
  openM('m-bolsillo-mov');
  sr(`Modal: abonar al bolsillo ${b.nombre}`);
}

// ─── ABRIR MODAL: RETIRAR ─────────────────────────────────────────────────────
export function abrirRetirarBolsillo(id) {
  _init();
  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;
  _prepModalMov(id, 'retiro', `Sacar plata de "${b.nombre}"`, b);
  openM('m-bolsillo-mov');
  sr(`Modal: retirar del bolsillo ${b.nombre}`);
}

// Prepara el modal de movimiento con contexto limpio
function _prepModalMov(id, tipo, titulo, b) {
  setEl('bols-mov-titulo', titulo);
  const fields = { 'bols-mov-id': id, 'bols-mov-tipo': tipo, 'bols-mov-monto': '', 'bols-mov-nota': '' };
  Object.entries(fields).forEach(([elId, val]) => {
    const el = document.getElementById(elId);
    if (el) el.value = val;
  });
  _poblarSelectBancos('bols-mov-banco');
  // Contexto: saldo actual del bolsillo
  setHtml('bols-mov-ctx', b ? `
    <div style="background:var(--s2); border-radius:8px; padding:10px 12px; margin-bottom:14px;
                display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
      <span style="font-size:12px; color:var(--t3);">${b.icono} En este bolsillo ahora</span>
      <strong class="mono" style="font-size:16px; color:var(--a1);">${f(b.monto)}</strong>
    </div>` : '');
}

// ─── CONFIRMAR MOVIMIENTO (abono o retiro) ────────────────────────────────────
export async function confirmarMovBolsillo() {
  _init();

  const id    = +document.getElementById('bols-mov-id')?.value;
  const tipo  = document.getElementById('bols-mov-tipo')?.value;
  const monto = +(document.getElementById('bols-mov-monto')?.value || 0);
  const banco = document.getElementById('bols-mov-banco')?.value || 'otro';
  const nota  = document.getElementById('bols-mov-nota')?.value.trim() || '';

  if (!monto || monto <= 0) {
    await showAlert('Escribe cuánta plata vas a mover — tiene que ser mayor a cero. 🙏', '¡Falta el monto!');
    document.getElementById('bols-mov-monto')?.focus();
    return;
  }

  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;

  if (tipo === 'abono') {
    b.monto += monto;
    b.movimientos = b.movimientos || [];
    b.movimientos.unshift({ tipo: 'abono', monto, fecha: hoy(), banco, nota });
    closeM('m-bolsillo-mov');
    save();
    renderBolsillos();
    if (typeof window.updateDash === 'function') window.updateDash();
    sr(`Abonaste ${f(monto)} al bolsillo ${b.nombre}. Total: ${f(b.monto)}`);
    await showAlert(
      `¡${f(monto)} guardados en el bolsillo "${b.nombre}"! 💪\n\nAhora tienes ${f(b.monto)} ahí apartados.`,
      'Abono exitoso ✅'
    );

  } else { // retiro
    if (monto > b.monto) {
      await showAlert(
        `En el bolsillo "${b.nombre}" solo hay ${f(b.monto)}. No puedes retirar ${f(monto)}.\n\nBaja el monto o retira todo.`,
        'No alcanza 😅'
      );
      return;
    }
    b.monto = Math.max(0, b.monto - monto);
    b.movimientos = b.movimientos || [];
    b.movimientos.unshift({ tipo: 'retiro', monto, fecha: hoy(), banco, nota });
    closeM('m-bolsillo-mov');
    save();
    renderBolsillos();
    if (typeof window.updateDash === 'function') window.updateDash();
    sr(`Retiraste ${f(monto)} del bolsillo ${b.nombre}. Quedó en ${f(b.monto)}`);
    await showAlert(
      `Retiraste ${f(monto)} del bolsillo "${b.nombre}".\n\nEl bolsillo quedó en ${f(b.monto)}. La plata ya está "libre" para gastar. 👌`,
      'Retiro listo ✅'
    );
  }
}

// ─── ELIMINAR BOLSILLO ────────────────────────────────────────────────────────
export async function eliminarBolsillo(id) {
  _init();
  const b = S.bolsillos.find(x => x.id === id);
  if (!b) return;

  const ok = await showConfirm(
    `¿Eliminar el bolsillo "${b.nombre}"?\n\nLos ${f(b.monto)} que tenías ahí quedan "libres" en tu saldo — no desaparecen, solo dejan de estar apartados.`,
    '¿Borrar este bolsillo? 🗑️'
  );
  if (!ok) return;

  S.bolsillos = S.bolsillos.filter(x => x.id !== id);
  save();
  renderBolsillos();
  if (typeof window.updateDash === 'function') window.updateDash();
  sr(`Bolsillo "${b.nombre}" eliminado.`);
}

// ─── RENDER GRID DE ÍCONOS ────────────────────────────────────────────────────
export function renderIconosBolsillo() {
  const cont = document.getElementById('bols-iconos-grid');
  if (!cont) return;
  const actual = document.getElementById('bols-icono-val')?.value || '🪙';
  cont.innerHTML = ICONOS_BOLS.map(ic => {
    const sel = ic === actual;
    return `
      <button type="button"
              class="bols-icono-btn${sel ? ' sel' : ''}"
              onclick="selIconoBolsillo('${ic}', this)"
              aria-label="Usar ícono ${ic}" aria-pressed="${sel}"
              style="font-size:22px; padding:7px; border-radius:9px; line-height:1;
                     border:2px solid ${sel ? 'var(--a1)' : 'transparent'};
                     background:${sel ? 'rgba(0,220,130,.12)' : 'var(--s2)'};
                     cursor:pointer; transition:all .15s; min-width:40px;">
        ${ic}
      </button>`;
  }).join('');
}

export function selIconoBolsillo(icono, btn) {
  const val = document.getElementById('bols-icono-val');
  if (val) val.value = icono;
  document.querySelectorAll('.bols-icono-btn').forEach(b => {
    b.classList.remove('sel');
    b.style.borderColor  = 'transparent';
    b.style.background   = 'var(--s2)';
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('sel');
  btn.style.borderColor = 'var(--a1)';
  btn.style.background  = 'rgba(0,220,130,.12)';
  btn.setAttribute('aria-pressed', 'true');
}

// ─── HELPER PRIVADO: POBLAR <SELECT> DE BANCOS ───────────────────────────────
function _poblarSelectBancos(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = [
    `<option value="efectivo">💵 Efectivo en mano</option>`,
    ...BANCOS_CO.map(b => `<option value="${b.id}">${b.icono} ${b.nombre}</option>`)
  ].join('');
}

// ─── EXPOSICIÓN GLOBAL (onclick desde HTML) ───────────────────────────────────
window.totalBolsillos       = totalBolsillos;
window.platoLibre           = platoLibre;
window.renderBolsillos      = renderBolsillos;
window.abrirNuevoBolsillo   = abrirNuevoBolsillo;
window.guardarNuevoBolsillo = guardarNuevoBolsillo;
window.abrirAbonarBolsillo  = abrirAbonarBolsillo;
window.abrirRetirarBolsillo = abrirRetirarBolsillo;
window.confirmarMovBolsillo = confirmarMovBolsillo;
window.eliminarBolsillo     = eliminarBolsillo;
window.renderIconosBolsillo = renderIconosBolsillo;
window.selIconoBolsillo     = selIconoBolsillo;