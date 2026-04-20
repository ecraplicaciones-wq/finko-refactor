// ─────────────────────────────────────────────────────────────────────────────
// Finko Pro — Módulo de Resumen Quincenal
//
// Responsabilidades:
//   1. calcularResumen()     — transforma los datos crudos del período en métricas
//   2. generarConsejo()      — consejo personalizado en colombiano según los números
//   3. mostrarResumenQuincena() — modal completo, devuelve Promise<{ok, etiqueta}>
//
// Sin cambios en index.html — todo el UI se inyecta dinámicamente.
// ─────────────────────────────────────────────────────────────────────────────
import { S }      from './core/state.js';
import { f, hoy } from './utils.js';
import { CATS, CCOLORS } from './core/constants.js';

// ─── 1. CALCULAR MÉTRICAS DEL PERÍODO ────────────────────────────────────────
/**
 * Procesa S.gastos y S.ingreso del período actual y devuelve un objeto
 * con todas las métricas necesarias para el resumen y el consejo.
 */
export function calcularResumen() {
  const gastos  = S.gastos || [];
  const ingreso = S.ingreso || 0;

  // Totales base
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

  // Top 3 categorías por monto
  const topCats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, monto]) => ({
      cat, monto,
      label: CATS[cat] || cat,
      color: CCOLORS[cat] || 'var(--a4)',
      pct: tG > 0 ? (monto / tG) * 100 : 0,
    }));

  // Método presupuestal activo
  const metodoId = S.metodo || '50-30-20';
  const METODOS  = {
    '50-30-20': { n: 50, d: 30, a: 20 },
    '50-20-30': { n: 50, d: 20, a: 30 },
    '70-20-10': { n: 70, d: 20, a: 10 },
  };
  const metasPct = METODOS[metodoId] || { n: 50, d: 30, a: 20 };

  // Cuotas de deudas del período
  const tDeudas = gastos
    .filter(g => g.cat === 'deudas')
    .reduce((s, g) => s + (g.montoTotal || g.monto || 0), 0);
  const pctDeudas = ingreso > 0 ? (tDeudas / ingreso) * 100 : 0;

  // Gasto más grande del período
  const gastoMax = gastos
    .filter(g => g.tipo !== 'ahorro')
    .reduce((max, g) => {
      const m = g.montoTotal || g.monto || 0;
      return m > max.monto ? { monto: m, desc: g.desc } : max;
    }, { monto: 0, desc: '' });

  // Comparativa vs período anterior (historial[0])
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

// ─── 2. CONSEJO PERSONALIZADO ─────────────────────────────────────────────────
/**
 * Genera un consejo colombiano honesto y cálido basado en las métricas del período.
 * Prioriza el problema más urgente — no arroja todo de una vez.
 */
export function generarConsejo(r) {
  // Sin datos suficientes
  if (r.ingreso === 0 || r.numGastos === 0) {
    return { icon: '📋', texto: 'Este período no tuvo registros suficientes para darte un análisis. ¡En la próxima quincena llevá el control desde el día uno!' };
  }

  // 1. Sin ahorro — lo más crítico
  if (r.tA === 0) {
    return {
      icon: '⚠️',
      texto: `Cerraste la quincena sin guardar ni un peso. La regla de oro es <strong>págate a ti primero</strong>: aparta el ahorro el mismo día que te cae el ingreso, antes de gastar en cualquier otra cosa. Aunque sea el 5%, el hábito es lo que importa.`,
    };
  }

  // 2. Gasto hormiga alto (> 15% del ingreso)
  if (r.pctHormiga > 15) {
    const anual = r.tH * 26; // 26 quincenas al año
    return {
      icon: '🐜',
      texto: `Los gasticos hormiga se tragaron el <strong>${r.pctHormiga.toFixed(1)}% de tu ingreso</strong> (${f(r.tH)}). Proyectado al año, eso son <strong>${f(anual)}</strong> que se van sin que te des cuenta. La próxima quincena, antes de pagar ese café o ese domicilio, preguntate si lo necesitás o si es un piloto automático.`,
    };
  }

  // 3. Gastó más del 90% del ingreso
  if (r.pctGasto > 90) {
    return {
      icon: '🚨',
      texto: `Gastaste el <strong>${r.pctGasto.toFixed(1)}%</strong> de lo que entraron. Eso es una señal de alerta real. Revisá cuáles gastos no eran necesarios y construí un presupuesto más ajustado para la siguiente quincena.`,
    };
  }

  // 4. Cuotas de deuda > 30%
  if (r.pctDeudas > 30) {
    return {
      icon: '💳',
      texto: `Más del <strong>30% de tu ingreso</strong> se fue en cuotas este período. Esa carga es pesada. Antes de agarrar cualquier nuevo compromiso financiero, enfocate en liquidar las deudas que ya tenés — especialmente las de mayor tasa.`,
    };
  }

  // 5. Deseos > meta del método
  if (r.pctDeseo > r.metasPct.d + 10) {
    return {
      icon: '🛍️',
      texto: `Los gustos y caprichos estuvieron al <strong>${r.pctDeseo.toFixed(1)}%</strong>, cuando tu plan era máximo el <strong>${r.metasPct.d}%</strong>. No hay que dejar de disfrutar, pero conviene revisar cuáles de esos gastos realmente valieron la pena.`,
    };
  }

  // 6. Comparativa positiva vs período anterior
  if (r.delta && r.delta.ahorro > 5) {
    return {
      icon: '📈',
      texto: `¡Vas mejorando! Ahorraste <strong>${r.delta.ahorro.toFixed(1)} puntos porcentuales más</strong> que la quincena anterior. Esa tendencia, si la mantenés, va a cambiar tus finanzas de verdad. ¡Seguile metiendo!`,
    };
  }

  // 7. Gasto bien controlado — celebrar
  if (r.pctAhorro >= r.metasPct.a) {
    return {
      icon: '🏆',
      texto: `¡Cumpliste la meta de ahorro del período! Guardaste el <strong>${r.pctAhorro.toFixed(1)}%</strong> de tu ingreso, que era exactamente lo que ibas a hacer. Así es como se construye un futuro sin afanes. ¡Muy bien!`,
    };
  }

  // 8. General positivo
  return {
    icon: '✅',
    texto: `Cerraste bien la quincena. Balance positivo de <strong>${f(r.balance)}</strong> y con ahorro registrado. El paso siguiente es subir ese porcentaje de ahorro quincena a quincena, aunque sea de a poquito.`,
  };
}

// ─── 3. MODAL DE CIERRE ───────────────────────────────────────────────────────
/**
 * Muestra el modal de resumen quincenal.
 * @returns {Promise<{ ok: boolean, etiqueta: string }>}
 */
export function mostrarResumenQuincena() {
  return new Promise(resolve => {
    const r       = calcularResumen();
    const consejo = generarConsejo(r);

    // ── Construir etiqueta por defecto ────────────────────────────────────────
    const ahora   = new Date();
    const mesNom  = ahora.toLocaleString('es-CO', { month: 'long' });
    const quinNum = ahora.getDate() <= 15 ? '1ra' : '2da';
    const etqDef  = `${quinNum} quincena de ${mesNom} ${ahora.getFullYear()}`;

    // ── Balance: color y emoji ─────────────────────────────────────────────────
    const balPos      = r.balance >= 0;
    const balColor    = balPos ? 'var(--a1)' : 'var(--dan)';
    const balEmoji    = r.pctAhorro >= (r.metasPct.a)
      ? '🏆' : balPos ? '✅' : '⚠️';

    // ── Barra de cumplimiento del método ──────────────────────────────────────
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

    // ── Top categorías ─────────────────────────────────────────────────────────
    const topHtml = r.topCats.length
      ? r.topCats.map(c => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:6px;height:6px;border-radius:50%;background:${c.color};flex-shrink:0;"></div>
            <div style="flex:1;font-size:11px;color:var(--t2);">${c.label}</div>
            <div style="font-family:var(--fm);font-size:12px;font-weight:700;color:var(--t1);">${f(c.monto)}</div>
            <div style="font-size:10px;color:var(--t3);width:34px;text-align:right;">${c.pct.toFixed(1)}%</div>
          </div>`).join('')
      : '<div style="font-size:11px;color:var(--t3);">Sin gastos registrados</div>';

    // ── Comparativa vs anterior ────────────────────────────────────────────────
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

    // ── Montar el overlay ──────────────────────────────────────────────────────
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

        <!-- Handle -->
        <div style="text-align:center;padding:12px 0 0;">
          <div style="width:36px;height:4px;background:var(--b2);border-radius:2px;
                      display:inline-block;" aria-hidden="true"></div>
        </div>

        <div style="padding:16px 20px 24px;">

          <!-- ── Encabezado ── -->
          <div style="font-size:14px;font-weight:800;color:var(--t1);margin-bottom:4px;">
            🗓️ Resumen de quincena
          </div>
          <div style="font-size:11px;color:var(--t3);margin-bottom:20px;">
            Revisá cómo te fue antes de cerrar este período
          </div>

          <!-- ── Héroe: balance ── -->
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

          <!-- ── Cumplimiento del método ── -->
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:12px;">
              📐 Método ${r.metodoId}
            </div>
            ${barCumpl('🏠 Necesidades', r.pctNeces,  r.metasPct.n, 'var(--a4)')}
            ${barCumpl('🎉 Deseos',      r.pctDeseo,  r.metasPct.d, 'var(--a2)')}
            ${barCumpl('💰 Ahorro',      r.pctAhorro, r.metasPct.a, 'var(--a1)')}
          </div>

          <!-- ── Top categorías ── -->
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:10px;">
              🏆 Top gastos del período
            </div>
            ${topHtml}
          </div>

          <!-- ── Comparativa ── -->
          ${deltaHtml}

          <!-- ── Consejo ── -->
          <div style="padding:14px;background:rgba(0,220,130,.06);
                      border:1px solid rgba(0,220,130,.2);border-radius:12px;
                      margin-top:${r.delta ? '16px' : '4px'};">
            <div style="font-size:20px;margin-bottom:6px;">${consejo.icon}</div>
            <div style="font-size:12px;color:var(--t2);line-height:1.65;">${consejo.texto}</div>
          </div>

          <!-- ── Etiqueta editable ── -->
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

          <!-- ── Acciones ── -->
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

    // ── Animación de entrada ───────────────────────────────────────────────────
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }`;
    document.head.appendChild(styleTag);

    document.body.appendChild(ov);

    // Focus en el input de etiqueta para accesibilidad
    requestAnimationFrame(() => {
      document.getElementById('rq-btn-confirm')?.focus();
    });

    // ── Resolver con resultado ─────────────────────────────────────────────────
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

    // Escape cierra sin confirmar
    const escHandler = (e) => {
      if (e.key === 'Escape') { document.removeEventListener('keydown', escHandler); cerrar(false); }
    };
    document.addEventListener('keydown', escHandler);

    // Click en overlay cierra (no en la sheet)
    ov.addEventListener('click', (e) => {
      if (e.target === ov) cerrar(false);
    });
  });
}

// ─── EXPOSICIÓN GLOBAL ────────────────────────────────────────────────────────
window.mostrarResumenQuincena = mostrarResumenQuincena;
window.calcularResumen        = calcularResumen;
window.generarConsejo         = generarConsejo;