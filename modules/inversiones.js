import { S }    from './state.js';
import { save } from './storage.js';
import { f, he, setEl, openM, closeM, showConfirm, descontarFondo } from './utils.js';
import { renderSmart } from './render.js';

// ─── GUARDAR ─────────────────────────────────────────────────────────────────
export async function guardarInversion() {
  const no  = document.getElementById('inv-no').value.trim();
  const pl  = document.getElementById('inv-pl').value.trim();
  const cap = +document.getElementById('inv-cap').value || 0;
  const ta  = +document.getElementById('inv-ta').value || 0;

  // ✅ FIX #5: antes retornaba silenciosamente sin avisar qué faltaba.
  // Ahora el usuario sabe exactamente qué campo completar.
  if (!no || !pl || !cap) {
    const faltantes = [
      !no  && 'el nombre de la inversión',
      !pl  && 'la plataforma o entidad',
      !cap && 'el capital invertido',
    ].filter(Boolean).join(', ');
    await window.showAlert?.(
      `Falta completar: ${faltantes}. Sin esos datos no podemos registrar la inversión.`,
      'Faltan datos'
    );
    return;
  }

  const fo = document.getElementById('inv-fo').value;
  if (fo) descontarFondo(fo, cap);

  S.inversiones.push({ id: Date.now(), nombre: no, plataforma: pl, capital: cap, rendimiento: 0, tasa: ta });
  closeM('m-inversion');
  save();
  renderInversiones();
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderInversiones() {
  const el = document.getElementById('inv-lst'); if (!el) return;

  const tc = S.inversiones.reduce((s, i) => s + i.capital, 0);
  const tr = S.inversiones.reduce((s, i) => s + i.rendimiento, 0);
  setEl('inv-tot-cap',  f(tc));
  setEl('inv-tot-rend', f(tr));
  setEl('inv-tot-gral', f(tc + tr));

  if (!S.inversiones.length) {
    el.innerHTML = `
      <div style="text-align:center; padding:40px 20px; background:var(--s1); border-radius:16px; border:1px dashed rgba(59,158,255,.3);">
        <div style="font-size:48px; margin-bottom:14px;">📈</div>
        <div style="font-weight:800; font-size:17px; color:var(--t1); margin-bottom:8px;">Sin inversiones registradas</div>
        <div style="color:var(--t3); font-size:13px; max-width:260px; margin:0 auto; line-height:1.6;">Registra tus CDTs, FICs o acciones para ver cómo crece tu dinero.</div>
      </div>`;
    return;
  }

  el.innerHTML = S.inversiones.map(i => {
    const valorTotal = i.capital + i.rendimiento;
    const rendPct    = i.capital > 0 ? ((i.rendimiento / i.capital) * 100).toFixed(1) : 0;
    const colorRend  = i.rendimiento >= 0 ? 'var(--a1)' : 'var(--dan)';
    const signo      = i.rendimiento >= 0 ? '+' : '';
    const tasaBadge  = i.tasa > 0 ? `<span class="pill pg" style="font-size:9px;">${i.tasa}% E.A.</span>` : '';

    return `
    <article class="inv-card" aria-label="Inversión: ${he(i.nombre)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:16px 20px 14px; border-bottom:1px solid var(--b1); gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <div style="width:44px; height:44px; border-radius:12px; background:rgba(59,158,255,.1); border:1px solid rgba(59,158,255,.2); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;" aria-hidden="true">📊</div>
          <div style="min-width:0;">
            <div style="font-weight:800; font-size:15px; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${he(i.nombre)}">${he(i.nombre)}</div>
            <div style="margin-top:5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:11px; color:var(--t3);">📍 ${he(i.plataforma)}</span>
              ${tasaBadge}
            </div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:10px; font-weight:700; color:var(--t3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Valor total</div>
          <div style="font-family:var(--fm); font-size:26px; font-weight:800; color:var(--t1); letter-spacing:-1px; line-height:1;">${f(valorTotal)}</div>
        </div>
      </div>

      <div style="padding:14px 20px; border-bottom:1px solid var(--b1); display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:120px; background:var(--s2); border:1px solid var(--b1); border-radius:10px; padding:12px;">
          <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Capital invertido</div>
          <div style="font-family:var(--fm); font-size:18px; font-weight:800; color:var(--a4);">${f(i.capital)}</div>
        </div>
        <div style="flex:1; min-width:120px; background:${i.rendimiento >= 0 ? 'rgba(0,220,130,.05)' : 'rgba(255,96,96,.05)'}; border:1px solid ${i.rendimiento >= 0 ? 'rgba(0,220,130,.2)' : 'rgba(255,96,96,.2)'}; border-radius:10px; padding:12px;">
          <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Rendimiento</div>
          <div style="font-family:var(--fm); font-size:18px; font-weight:800; color:${colorRend};">${signo}${f(i.rendimiento)}</div>
          <div style="font-size:11px; color:${colorRend}; margin-top:2px; font-weight:600;">${signo}${rendPct}%</div>
        </div>
      </div>

      <div style="padding:12px 20px; display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn bg bsm" onclick="openRendimiento(${i.id})" data-name="${he(i.nombre).replace(/'/g, '&#39;')}" aria-label="Actualizar valor de ${he(i.nombre)}">📊 Actualizar valor</button>
        <button class="btn-eliminar-deu" onclick="delInversion(${i.id})" style="padding:6px 12px;" aria-label="Eliminar ${he(i.nombre)}">🗑️</button>
      </div>
    </article>`;
  }).join('');
}

// ─── RENDIMIENTO ─────────────────────────────────────────────────────────────
export function openRendimiento(id) {
  // ✅ FIX #4: antes recibía el nombre como segundo parámetro string en onclick,
  // lo que quebraba con nombres que contienen comilla simple (ej: "Davivienda's CDT").
  // Ahora lee el nombre directamente del estado global por ID — sin riesgo de inyección.
  const inv = S.inversiones.find(x => x.id === id);
  if (!inv) return;
  document.getElementById('rend-id').value       = id;
  document.getElementById('rend-t').textContent  = `Actualizar: ${inv.nombre}`;
  openM('m-rendimiento');
}

export async function guardarRendimiento() {
  const id  = +document.getElementById('rend-id').value;
  const nv  = +document.getElementById('rend-val').value;
  const inv = S.inversiones.find(x => x.id === id);
  if (!inv) { closeM('m-rendimiento'); return; }

  // ✅ FIX #3a: antes aceptaba 0 sin avisar.
  // nv=0 hacía inv.rendimiento = 0 - capital → pérdida total silenciosa.
  if (!nv || nv <= 0) {
    await window.showAlert?.(
      'El saldo actual no puede ser 0 ni estar vacío. Ingresá el valor total actual de la inversión (capital + rendimientos acumulados).',
      'Valor inválido'
    );
    return;
  }

  // ✅ FIX #3b: advertir si el valor nuevo es menor al capital original.
  // Esto puede ser legítimo (pérdida real) pero merece confirmación explícita.
  if (nv < inv.capital) {
    const perdida = inv.capital - nv;
    const ok = await window.showConfirm?.(
      `El valor que ingresaste (${window.f?.(nv) || nv}) es menor al capital invertido (${window.f?.(inv.capital) || inv.capital}).\n\n¿Confirmás que la inversión perdió ${window.f?.(perdida) || perdida}? Esto quedará registrado como rendimiento negativo.`,
      'Confirmar pérdida'
    );
    if (!ok) return;
  }

  inv.rendimiento = nv - inv.capital;
  closeM('m-rendimiento');
  save();
  renderInversiones();
}

// ─── ELIMINAR ────────────────────────────────────────────────────────────────
export async function delInversion(id) {
  const inv = S.inversiones.find(x => x.id === id); if (!inv) return;
  const ok  = await showConfirm(`¿Eliminar la inversión "${he(inv.nombre)}"? Esta acción no se puede deshacer.`, 'Eliminar inversión');
  if (!ok) return;
  S.inversiones = S.inversiones.filter(x => x.id !== id);
  save(); renderInversiones();
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.guardarInversion  = guardarInversion;
window.renderInversiones = renderInversiones;
window.openRendimiento   = openRendimiento;
window.guardarRendimiento = guardarRendimiento;
window.delInversion      = delInversion;