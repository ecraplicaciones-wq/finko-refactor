import { S }    from './core/state.js';
import { save } from './core/storage.js';
import { f, he, hoy, mesStr, setHtml } from './utils.js';
import { CATS } from './core/constants.js';
import { renderSmart } from './render.js';
import { mostrarResumenQuincena } from './resumen.js';

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

// ─── TOP CATEGORÍAS POR PERÍODO ───────────────────────────────────────────────
function _renderTopCats(hx) {
  if (!hx.catMap || !Object.keys(hx.catMap).length) return '';
  // ✅ Usa CATS importado de constants.js en lugar de la declaración inline
  // duplicada que tenía solo 10 categorías (faltaban hormiga y ahorro).
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

  // Mostrar resumen completo — el usuario confirma o cancela desde ahí
  const { ok, etiqueta } = await mostrarResumenQuincena();
  if (!ok) return;

  // Calcular totales para el historial
  const tG = S.gastos.filter(g => g.tipo !== 'ahorro').reduce((s, g) => s + (g.montoTotal || g.monto), 0);
  const tA = S.gastos.filter(g => g.tipo === 'ahorro').reduce((s, g) => s + g.monto, 0);
  const tH = S.gastos.filter(g => g.hormiga || g.tipo === 'hormiga').reduce((s, g) => s + g.monto, 0);
  const catMap = {};
  S.gastos.filter(g => g.tipo !== 'ahorro').forEach(g => {
    catMap[g.cat] = (catMap[g.cat] || 0) + (g.montoTotal || g.monto);
  });

  S.historial.unshift({
    id:      Date.now(),
    // ✅ Usa la etiqueta editada por el usuario desde el modal de resumen
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

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
// Solo las funciones propias de este módulo. Las de exportación/importación
// se registran globalmente desde events.js, que las importa de exports.js.
window.renderHistorial = renderHistorial;
window.delHistorial    = delHistorial;
window.cerrarQ         = cerrarQ;