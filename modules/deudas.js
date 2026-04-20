import { S }    from './core/state.js';
import { save } from './core/storage.js';
import { f, he, hoy, mesStr, setEl, setHtml, openM, closeM, showAlert, showConfirm, descontarFondo } from './infra/utils.js';
import { TASA_USURA_EA } from './core/constants.js';
import { renderSmart, updSaldo, totalCuentas } from './infra/render.js';

// ─── GUARDAR ─────────────────────────────────────────────────────────────────
export async function guardarDeuda() {
  const no = document.getElementById('dn-no').value.trim();
  const to = +document.getElementById('dn-to').value;
  const cu = +document.getElementById('dn-cu').value;
  if (!no || !to || !cu) { await showAlert('Falta el nombre de la deuda, cuánto debés en total y cuánto pagás cada vez. Sin eso no podemos registrarla.', 'Falta info'); return; }

  S.deudas.push({
    id:           Date.now(),
    nombre:       no,
    total:        to,
    cuota:        cu,
    periodicidad: document.getElementById('dn-pe')?.value || 'mensual',
    tasa:         +document.getElementById('dn-ta')?.value || 0,
    tipo:         document.getElementById('dn-ti')?.value || 'otro',
    diaPago:      +document.getElementById('dn-dia')?.value || 1,
    pagado:       0
  });

  ['dn-no', 'dn-to', 'dn-cu', 'dn-ta', 'dn-dia'].forEach(i => {
    const e = document.getElementById(i); if (e) e.value = '';
  });
  closeM('m-deu'); save(); renderSmart(['deudas']);
}

// ─── ESTRATEGIA: AVALANCHA / BOLA DE NIEVE ───────────────────────────────────
let _modoTimer = null;

export function setModoDeuda(m) {
  S.modoDeuda = m;
  const btnAva  = document.getElementById('btn-ava');
  const btnBola = document.getElementById('btn-bola');
  if (btnAva)  btnAva.className  = m === 'avalancha' ? 'btn bp' : 'btn bg';
  if (btnBola) btnBola.className = m === 'bola'      ? 'btn bp' : 'btn bg';

  const lista = document.getElementById('de-lst');
  if (lista) {
    lista.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    lista.style.opacity = '0'; lista.style.transform = 'translateY(6px)';
    if (_modoTimer) clearTimeout(_modoTimer);
    _modoTimer = setTimeout(() => {
      _modoTimer = null;
      save(); renderDeudas();
      requestAnimationFrame(() => { lista.style.opacity = '1'; lista.style.transform = 'translateY(0)'; });
    }, 300);
  } else { save(); renderDeudas(); }
}

// ─── MORA REAL ───────────────────────────────────────────────────────────────
function _obtenerAlertaMora(deuda) {
  const diaPago = deuda.diaPago || 1;
  const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0);
  const ultimoDiaMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0).getDate();
  const diaReal = Math.min(diaPago, ultimoDiaMes);
  const fechaLimite = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), diaReal);

  if (hoyDate > fechaLimite) {
    // ⚠️ FIX A: toISOString() usaba UTC → a las 11 PM en Bogotá daba el mes siguiente.
    // Se construye mesPago con hora local del dispositivo.
    const mesPago = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}`;

    // ⚠️ FIX B: g.desc.includes(deuda.nombre) era frágil — fallaba con tildes,
    // mayúsculas o espacios extra. Ahora busca primero por deudaId (campo
    // guardado desde confPagarCuota), con fallback normalizado para datos viejos.
    const _norm = s => String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const nombreNorm = _norm(deuda.nombre);

    const pagadoEsteMes = S.gastos.find(g => {
      if (g.cat !== 'deudas' || !g.fecha.startsWith(mesPago)) return false;
      // Coincidencia exacta por ID (datos nuevos con confPagarCuota actualizado)
      if (g.deudaId != null) return g.deudaId === deuda.id;
      // Fallback: comparación normalizada para registros históricos sin deudaId
      return _norm(g.desc).includes(nombreNorm);
    });

    if (pagadoEsteMes || (deuda.total - deuda.pagado <= 0)) return '';

    const diasMora = Math.floor((hoyDate - fechaLimite) / 86_400_000);
    if (diasMora <= 0) return '';
    if (diasMora < 30)  return `<div class="alerta-mora alerta-leve" role="status" aria-live="polite" style="margin-top:10px; padding:10px; background:rgba(255,214,10,.1); color:var(--a2); border-radius:8px; border:1px solid rgba(255,214,10,.3); font-size:12px;"><span aria-hidden="true">⏳</span> <strong>Llevás ${diasMora} día${diasMora !== 1 ? 's' : ''} sin cubrir esta cuota.</strong> Entre más esperés, más se acumulan los intereses de mora. No dejés que eso pase.</div>`;
    if (diasMora < 90)  return `<div class="alerta-mora alerta-media" role="alert" aria-live="assertive" style="margin-top:10px; padding:10px; background:rgba(255,107,53,.1); color:var(--a3); border-radius:8px; border:1px solid rgba(255,107,53,.3); font-size:12px;"><span aria-hidden="true">⚠️</span> <strong>¡${diasMora} días sin pagar es mucho!</strong> Tu historial en Datacrédito puede estar tomando nota. Llamá al banco antes de que la cosa se ponga más difícil.</div>`;
    return `<div class="alerta-mora alerta-grave" role="alert" aria-live="assertive" style="margin-top:10px; padding:10px; background:rgba(255,68,68,.1); color:var(--dan); border-radius:8px; border:1px solid rgba(255,68,68,.3); font-size:12px;"><span aria-hidden="true">🚨</span> <strong>¡Cuidadito! Llevás ${diasMora} días en mora.</strong> Pero ojo: la ley te protege. El banco debe avisarte con 20 días de anticipación antes de reportarte a Datacrédito (Ley 1266/2008, Art. 13). ¡Actuá hoy!</div>`;
  }
  return '';
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderDeudas() {
  const sq    = S.deudas.filter(d => d.periodicidad === 'quincenal').reduce((s, d) => s + d.cuota, 0);
  const sm    = S.deudas.filter(d => d.periodicidad === 'mensual').reduce((s, d) => s + d.cuota, 0);
  let   cPer  = 0;
  if (S.tipoPeriodo === 'mensual') cPer = (sq * 2) + sm;
  else if (S.tipoPeriodo === 'q1') cPer = sq + sm;
  else                             cPer = sq;

  const totD           = S.deudas.reduce((s, d) => s + Math.max(0, d.total - d.pagado), 0);
  const cuotaMensual   = (sq * 2) + sm;
  let   ingresoBase    = S.ingreso > 0 ? S.ingreso : (S.saldos.efectivo + totalCuentas());
  let   ingresoMensual = (S.tipoPeriodo === 'q1' || S.tipoPeriodo === 'q2') ? ingresoBase * 2 : ingresoBase;
  const pct            = ingresoMensual > 0 ? Math.round((cuotaMensual / ingresoMensual) * 100) : 0;

  setEl('de-tot', f(totD));
  setEl('de-cp',  f(cPer));

  // Indicador % del ingreso
  const pe = document.getElementById('de-pct');
  const cardPct = document.getElementById('card-pct-ingreso');
  const cardMsg = document.getElementById('de-pct-msg');
  if (pe && cardPct) {
    const cfg = pct > 100
      ? { badge: `🚨 ${pct}%`, color: 'var(--dan)', bg: 'rgba(255,68,68,.08)', border: 'rgba(255,68,68,.3)', msg: '¡Tus deudas cuestan más de lo que ganás! Esto es urgente, hay que actuar ya.' }
      : pct > 40
      ? { badge: `⚠️ ${pct}%`, color: 'var(--a2)', bg: 'rgba(255,214,10,.08)', border: 'rgba(255,214,10,.3)', msg: 'Más del 40% de tu quincena se va en deudas. Por favor, no agarrés más compromisos por ahora.' }
      : pct > 0
      ? { badge: `✅ ${pct}%`, color: 'var(--a1)', bg: 'var(--s1)', border: 'var(--b1)', msg: '¡Bien! Tus deudas están bajo control. Seguí así.' }
      : { badge: '✅ 0%',       color: 'var(--a1)', bg: 'var(--s1)', border: 'var(--b1)', msg: '' };

    pe.innerHTML = cfg.badge.replace(/%/, '<span style="font-size:16px; font-weight:600; margin-left:2px;">%</span>');
    pe.style.color = cfg.color;
    cardPct.style.background   = cfg.bg;
    cardPct.style.borderColor  = cfg.border;
    if (cardMsg) { cardMsg.textContent = cfg.msg; cardMsg.style.color = cfg.color; }
  }

  // ── Avisos inteligentes ──
  _renderAvisosDeudas(pct, totD);

  // ── Fijos pendientes en sección deudas ──
  window.renderFijos?.(); // dispara _renderFijosEnDeudas dentro de fijos.js

  const el = document.getElementById('de-lst');
  if (!S.deudas.length) {
    el.innerHTML = `
      <div style="text-align:center; padding:48px 20px; background:var(--s1); border-radius:16px; border:1px dashed var(--a1); margin-top:20px;">
        <div style="font-size:64px; margin-bottom:16px;">🏆</div>
        <h3 style="color:var(--t1); margin-bottom:8px; font-size:22px;">¡Estás libre de deudas! ¡Eso es enorme!</h3>
        <p style="color:var(--t3); font-size:14px; max-width:320px; margin:0 auto; line-height:1.6;">Lograste uno de los hitos financieros más importantes. Ahora redirigí esa plata de las cuotas a hacer crecer tu patrimonio. ¡Felicitaciones!</p>
      </div>`;
    return;
  }

  const modo  = S.modoDeuda || 'avalancha';
  const btnAva  = document.getElementById('btn-ava');
  const btnBola = document.getElementById('btn-bola');
  if (btnAva)  btnAva.className  = modo === 'avalancha' ? 'btn bp' : 'btn bg';
  if (btnBola) btnBola.className = modo === 'bola'      ? 'btn bp' : 'btn bg';

  // Ordenar según estrategia
  let copia = [...S.deudas];
  const msgEl = document.getElementById('deu-coach-msg');

  if (modo === 'avalancha') {
    copia.sort((a, b) => {
      const dTasa = (b.tasa || 0) - (a.tasa || 0);
      if (dTasa !== 0) return dTasa;
      return (b.total - b.pagado) - (a.total - a.pagado);
    });
    if (msgEl) msgEl.innerHTML = `
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <span style="font-size:20px; flex-shrink:0;">🔥</span>
        <div>
          <div style="font-weight:700; font-size:12px; color:var(--t1); margin-bottom:4px;">Estrategia Avalancha — La más inteligente para tu bolsillo</div>
          <div style="font-size:11px; color:var(--t3); line-height:1.6;">Pagá el <strong style="color:var(--t2);">mínimo en todas</strong> y mandá todo el dinero extra a atacar la deuda con la <strong style="color:var(--dan);">tasa más alta</strong>. Cuando la liquides, ese dinero cae en cascada sobre la siguiente. Así es como pagás menos intereses en total. ¡Duro de cabeza!</div>
        </div>
      </div>`;
  } else {
    copia.sort((a, b) => {
      const dSaldo = (a.total - a.pagado) - (b.total - b.pagado);
      if (dSaldo !== 0) return dSaldo;
      return (b.tasa || 0) - (a.tasa || 0);
    });
    if (msgEl) msgEl.innerHTML = `
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <span style="font-size:20px; flex-shrink:0;">⛄</span>
        <div>
          <div style="font-weight:700; font-size:12px; color:var(--t1); margin-bottom:4px;">Estrategia Bola de Nieve — La más motivadora para el corazón</div>
          <div style="font-size:11px; color:var(--t3); line-height:1.6;">Pagá el <strong style="color:var(--t2);">mínimo en todas</strong> y liquidá primero la deuda <strong style="color:var(--a1);">más pequeña</strong>. Cada victoria te da el empuje para la siguiente. ¡Nada como ver cómo van cayendo!</div>
        </div>
      </div>`;
  }

  const primeraVivaId = copia.find(d => (d.total - d.pagado) > 0)?.id;

  const iconoTipoMap   = { tarjeta:'💳', credito:'🏦', hipoteca:'🏠', vehiculo:'🚗', educacion:'🎓', persona:'👤', salud:'🏥', otro:'📦' };
  const nombreTipoMap  = { tarjeta:'Tarjeta de Crédito', credito:'Crédito Libre Inversión', hipoteca:'Crédito Hipotecario', vehiculo:'Crédito Vehicular', educacion:'Crédito Educativo', persona:'Préstamo Personal', salud:'Deuda Médica', otro:'Otra Deuda' };
  const consejoMap     = {
    tarjeta:   { texto: `💳 <strong>Truco clave:</strong> Comprá siempre a <strong>1 sola cuota</strong> y pagá el total antes del corte. Nunca saques plata en efectivo con la tarjeta — te cobran intereses desde el primer día, sin período de gracia. La tarjeta es una herramienta, no una extensión del sueldo.`, ley: '' },
    credito:   { texto: `🏦 <strong>Tu derecho colombiano:</strong> Podés pagar más del mínimo sin penalización ni multa. Pedile al banco un <strong>"abono extraordinario a capital con reducción de plazo"</strong>. Así, cada peso extra que metas te acorta la deuda, no solo el tiempo.`, ley: 'Ley 546/1999' },
    hipoteca:  { texto: `🏠 <strong>Ahorrá millones sin hacer nada raro:</strong> En Colombia podés llevar tu crédito hipotecario a otro banco con mejor tasa sin que te cobren penalización. Se llama <strong>"traslado de cartera"</strong> y es tu derecho. Cotizá en otros bancos antes de resignarte a la tasa actual.`, ley: 'Ley 546/1999, Art. 20' },
    vehiculo:  { texto: `🚗 <strong>Salí más rápido de esta:</strong> Hacé abonos extra a capital cuando puedas, aunque sean pequeños. Cada abono te reduce la deuda real, no solo aplaza el calendario. El carro se devalúa con los años, ¡que no le debás más de lo que vale!`, ley: '' },
    educacion: { texto: `🎓 <strong>Buscá los alivios antes de entrar en mora:</strong> El ICETEX tiene períodos de gracia y programas de apoyo para graduados sin empleo. Llamá y preguntá antes de dejar de pagar. La ignorancia aquí sale carísima.`, ley: 'Ley 1002/2005' },
    persona:   { texto: `👤 <strong>Regla de oro con familia y amigos:</strong> Aunque sea de confianza, escribí en un papel cuánto debés, cuánto pagás y cada cuándo. Los dos firman. Un trato claro evita que una deuda dañe una relación que vale más que la plata.`, ley: '' },
    salud:     { texto: `🏥 <strong>Negociá sin pena, que a nadie le sobra la plata:</strong> Las clínicas y hospitales prefieren recibir algo a no recibir nada. Preguntá por descuento de contado o un plan de pagos sin intereses. Son más flexibles de lo que parecen.`, ley: '' },
    otro:      { texto: `📦 <strong>Tres reglas de oro para cualquier deuda:</strong> Nunca la ignorés. Siempre negociá. Pagá primero la de mayor tasa. Y una más: ninguna deuda te define como persona, solo como alguien que está aprendiendo a manejar su plata.`, ley: '' }
  };

  el.innerHTML = copia.map(d => {
    const pend        = Math.max(0, d.total - d.pagado);
    const p           = d.total > 0 ? Math.min((d.pagado / d.total) * 100, 100) : 0;
    const esPrioridad = d.id === primeraVivaId;
    const icono       = iconoTipoMap[d.tipo]  || '📦';
    const nombreTipo  = nombreTipoMap[d.tipo] || 'Otra Deuda';
    const { texto: consejoTexto, ley: consejoLey } = consejoMap[d.tipo] || { texto: '', ley: '' };
    const colorBarra  = p >= 100 ? 'var(--a1)' : p > 50 ? 'var(--a2)' : 'var(--a4)';
    const textoBarra  = p >= 100 ? '🏆 ¡La liquidaste!' : p > 0 ? `${Math.round(p)}% pagado` : '';
    const borderLeft  = esPrioridad ? (modo === 'avalancha' ? 'border-left:4px solid var(--dan);' : 'border-left:4px solid var(--a1);') : 'border-left:4px solid transparent;';
    const badgePrio   = esPrioridad
      ? (modo === 'avalancha'
        ? `<span style="background:rgba(255,68,68,.12); color:var(--dan); border:1px solid rgba(255,68,68,.2); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px;">🔥 ¡A ESTA PRIMERO!</span>`
        : `<span style="background:rgba(0,220,130,.12); color:var(--a1); border:1px solid rgba(0,220,130,.2); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px;">⛄ ¡A ESTA PRIMERO!</span>`)
      : '';

    // Proyección de liberación
    const mesesRestantes = d.cuota > 0 ? Math.ceil(pend / d.cuota) : 0;
    let tiempoTexto = '';
    if (pend <= 0)              tiempoTexto = `<span style="color:var(--a1); font-weight:700;">🏆 ¡Esta la liquidaste! ¡Qué orgullo!</span>`;
    else if (mesesRestantes === 1) tiempoTexto = `<span style="color:var(--a1); font-weight:700;">🔥 ¡Un cuotazo más y quedás libre de esta! ¡Dale con todo!</span>`;
    else if (mesesRestantes <= 6)  tiempoTexto = `<span style="color:var(--a2);">📅 Cumpliendo tu cuota, en <strong>${mesesRestantes} meses</strong> ya no le debés nada a nadie por aquí.</span>`;
    else {
      const anos = Math.floor(mesesRestantes / 12);
      const meses = mesesRestantes % 12;
      const tiempo = anos > 0 ? `${anos} año${anos > 1 ? 's' : ''}${meses > 0 ? ` y ${meses} mes${meses > 1 ? 'es' : ''}` : ''}` : `${mesesRestantes} meses`;
      tiempoTexto = `<span style="color:var(--t3);">📅 Cumpliendo tu cuota, en <strong style="color:var(--t2);">${tiempo}</strong> quedás libre de esta deuda. ¡Tené paciencia y constancia!</span>`;
    }

    // Interés mensual para detectar "trampa del mínimo"
    const alertaMora  = _obtenerAlertaMora(d);
    const consejoAbierto = esPrioridad && consejoTexto;

    return `
    <article class="deuda-card-animada gc"
      style="background:var(--s1); border:1px solid var(--b1); border-radius:16px; margin-bottom:16px; overflow:hidden; ${borderLeft} animation-delay:${copia.indexOf(d) * 0.08}s;"
      aria-label="Deuda: ${he(d.nombre)}">

      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:20px 20px 16px; border-bottom:1px solid var(--b1); flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <div style="width:44px; height:44px; border-radius:12px; background:var(--s2); border:1px solid var(--b2); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;" aria-hidden="true">${icono}</div>
          <div style="min-width:0;">
            <div style="font-weight:800; font-size:17px; color:var(--t1); line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${he(d.nombre)}</div>
            <div style="font-size:11px; color:var(--t3); margin-top:3px;">${nombreTipo}${d.tasa > 0 ? ` · ${d.tasa}% E.A.` : ''} · ${d.periodicidad}</div>
            <div style="margin-top:6px;">${badgePrio}</div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:10px; font-weight:700; color:var(--t3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Tu cuota</div>
          <div style="font-family:var(--fm); font-size:26px; font-weight:800; color:var(--t1); line-height:1;">${f(d.cuota)}</div>
          ${d.diaPago ? `<div style="font-size:10px; color:var(--t3); margin-top:4px;">📅 Cada mes el día ${d.diaPago}</div>` : ''}
        </div>
      </div>

      <div style="padding:16px 20px; border-bottom:1px solid var(--b1);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:12px;">
          <div>
            <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Lo que te falta</div>
            <div style="font-family:var(--fm); font-size:24px; font-weight:800; color:var(--dan);">${f(pend)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Ya le diste</div>
            <div style="font-family:var(--fm); font-size:24px; font-weight:800; color:${colorBarra};">${f(d.pagado)}</div>
          </div>
        </div>
        <div style="height:10px; background:var(--s3); border-radius:999px; overflow:hidden; margin-bottom:8px;" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100">
          <div style="height:100%; width:${p}%; background:${colorBarra}; border-radius:999px; transition:width .6s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:11px; color:${p > 0 ? colorBarra : 'var(--t3)'}; font-weight:${p > 0 ? '700' : '400'};">${textoBarra || 'Todavía no has abonado a esta'}</span>
          <span style="font-size:11px; color:var(--t3);">Total: ${f(d.total)}</span>
        </div>
        <div style="font-size:12px; line-height:1.5;">${tiempoTexto}</div>
        ${alertaMora}
      </div>

      <div style="padding:14px 20px;">
        ${consejoTexto ? `
        <div style="margin-bottom:12px;">
          <button id="btn-consejo-${d.id}" aria-expanded="${consejoAbierto}" aria-controls="consejo-${d.id}"
            onclick="const c=document.getElementById('consejo-${d.id}');const btn=document.getElementById('btn-consejo-${d.id}');const ab=c.style.display==='block';c.style.display=ab?'none':'block';btn.setAttribute('aria-expanded',ab?'false':'true');btn.querySelector('.consejo-txt').textContent=ab?'💡 Ver consejo':'💡 Ocultar consejo';"
            style="background:none; border:none; color:var(--a4); font-size:12px; font-weight:600; cursor:pointer; padding:0; display:flex; align-items:center; gap:6px;">
            <span class="consejo-txt">${consejoAbierto ? '💡 Ocultar consejo' : '💡 Ver consejo'}</span>
          </button>
          <div id="consejo-${d.id}" style="display:${consejoAbierto ? 'block' : 'none'}; margin-top:8px; padding:12px; background:var(--s2); border:1px solid var(--b2); border-left:3px solid var(--a4); border-radius:8px; font-size:12px; color:var(--t2); line-height:1.6;">
            ${consejoTexto}
            ${consejoLey ? `<div style="margin-top:8px;"><span style="display:inline-flex; align-items:center; gap:4px; background:var(--s3); border:1px solid var(--b2); border-radius:6px; padding:3px 8px; font-size:10px; font-weight:700; color:var(--t3); font-family:var(--fm);">⚖️ ${consejoLey}</span></div>` : ''}
          </div>
        </div>` : ''}
        <div class="deu-card-footer">
          <button class="btn bg bsm" onclick="abrirEditarDeuda(${d.id})" aria-label="Editar ${he(d.nombre)}">✏️ Editar</button>
          <button class="btn-eliminar-deu" onclick="delDeu(${d.id})" aria-label="Eliminar ${he(d.nombre)}">🗑️ Borrar</button>
          <button class="btn bp btn-pagar-cuota" onclick="abrirPagarCuota(${d.id})" aria-label="Pagar cuota de ${he(d.nombre)}">Registrar Pago →</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

// ─── PAGAR CUOTA ─────────────────────────────────────────────────────────────
export function abrirPagarCuota(id) {
  const d = S.deudas.find(x => x.id === id); if (!d) return;
  const pendiente = Math.max(0, d.total - d.pagado);
  const pct       = d.total > 0 ? Math.min(Math.round((d.pagado / d.total) * 100), 100) : 0;
  const nuevoPct  = d.total > 0 ? Math.min(Math.round(((d.pagado + d.cuota) / d.total) * 100), 100) : 0;

  setEl('pgc-no',       d.nombre);
  setEl('pgc-mo',       f(d.cuota));
  setEl('pgc-pagado',   f(d.pagado));
  setEl('pgc-pct',      `${pct}% pagado → ${nuevoPct}% al confirmar este abono`);
  setEl('pgc-pendiente', `Pendiente: ${f(pendiente)}`);
  const barra = document.getElementById('pgc-barra');
  if (barra) barra.style.width = `${pct}%`;
  document.getElementById('pgc-id').value = id;
  window.actualizarListasFondos?.();
  openM('m-pgc');
}

export async function confPagarCuota() {
  const id = +document.getElementById('pgc-id').value;
  const d  = S.deudas.find(x => x.id === id);
  if (!d) { closeM('m-pgc'); return; }

  const fo   = document.getElementById('pgc-fo').value;
  let   disp = fo === 'efectivo' ? S.saldos.efectivo
    : fo.startsWith('cuenta_') ? (S.cuentas.find(x => x.id === +fo.split('_')[1])?.saldo ?? 0)
    : S.saldos.banco;

  if (disp < d.cuota) {
    const ok = await showConfirm(`⚠️ En esa fuente solo hay ${f(disp)} y la cuota es de ${f(d.cuota)}.\n¿La anotamos de todas formas?`, 'Saldo insuficiente');
    if (!ok) return;
  }

  descontarFondo(fo, d.cuota);
  d.pagado = Math.min(d.pagado + d.cuota, d.total);
  S.gastos.unshift({
    id: Date.now(), desc: `💳 Cuota: ${d.nombre}`, monto: d.cuota, montoTotal: d.cuota,
    cat: 'deudas', tipo: 'necesidad', fondo: fo, hormiga: false, cuatroXMil: false,
    fecha: hoy(), metaId: '', autoFijo: false,
    // ✅ FIX: deudaId permite a _obtenerAlertaMora identificar el pago con
    // exactitud, sin depender de comparación frágil de strings en la descripción.
    deudaId: d.id
  });
  closeM('m-pgc'); save(); renderSmart(['deudas', 'gastos']);
}

// ─── EDITAR ──────────────────────────────────────────────────────────────────
export function abrirEditarDeuda(id) {
  const d = S.deudas.find(x => x.id === id); if (!d) return;
  document.getElementById('ed-id').value  = id;
  document.getElementById('ed-no').value  = d.nombre;
  document.getElementById('ed-ti').value  = d.tipo;
  document.getElementById('ed-to').value  = d.total;
  document.getElementById('ed-cu').value  = d.cuota;
  document.getElementById('ed-pe').value  = d.periodicidad;
  document.getElementById('ed-ta').value  = d.tasa;
  document.getElementById('ed-dia').value = d.diaPago || 1;
  openM('m-edit-deu');
}

export async function guardarEditarDeuda() {
  const id        = +document.getElementById('ed-id').value;
  const d         = S.deudas.find(x => x.id === id); if (!d) return;
  const nuevoTotal = +document.getElementById('ed-to').value;
  const nuevaCuota = +document.getElementById('ed-cu').value;
  if (!nuevoTotal || !nuevaCuota) { await showAlert('El saldo que debés y la cuota no pueden quedar en blanco. ¡Completalos!', 'Falta info'); return; }
  d.nombre       = document.getElementById('ed-no').value.trim();
  d.tipo         = document.getElementById('ed-ti').value;
  d.total        = nuevoTotal; d.cuota = nuevaCuota;
  d.periodicidad = document.getElementById('ed-pe').value;
  d.tasa         = +document.getElementById('ed-ta').value || 0;
  d.diaPago      = +document.getElementById('ed-dia').value || 1;
  closeM('m-edit-deu'); save(); renderSmart(['deudas']);
}

export async function delDeu(id) {
  const ok = await showConfirm('¿Borramos esta deuda del registro? Si ya la pagaste completa, ¡felicitaciones! Pero si no, mejor editala.', 'Borrar deuda'); if (!ok) return;
  S.deudas = S.deudas.filter(d => d.id !== id); save(); renderSmart(['deudas']);
}

// ─── SELECCIÓN UI ────────────────────────────────────────────────────────────
function _selTipoDeudaBase(inputId, selectorClass, tipo, el) {
  document.getElementById(inputId).value = tipo;
  document.querySelectorAll(selectorClass).forEach(b => {
    b.style.background = 'var(--s2)'; b.style.border = '2px solid var(--b2)';
    b.querySelector('span:last-child').style.color = 'var(--t3)';
  });
  el.style.background = 'rgba(59,158,255,.1)'; el.style.border = '2px solid var(--a4)';
  el.querySelector('span:last-child').style.color = 'var(--a4)';
}

function _selFrecDeudaBase(inputId, idMensual, idQuincenal, frec) {
  document.getElementById(inputId).value = frec;
  const btnM = document.getElementById(idMensual);
  const btnQ = document.getElementById(idQuincenal);
  if (!btnM || !btnQ) return;
  const activo   = { border: '2px solid var(--a1)', background: 'rgba(0,220,130,.1)', color: 'var(--a1)' };
  const inactivo = { border: '2px solid var(--b2)', background: 'var(--s2)',           color: 'var(--t3)' };
  const esMensual = frec === 'mensual';
  Object.assign(btnM.style, esMensual ? activo : inactivo);
  Object.assign(btnQ.style, esMensual ? inactivo : activo);
}

export function selTipoDeuda(tipo, el)     { _selTipoDeudaBase('dn-ti', '.btn-tipo-deuda',      tipo, el); }
export function selTipoDeudaEdit(tipo, el) { _selTipoDeudaBase('ed-ti', '.btn-tipo-deuda-edit', tipo, el); }
export function selFrecDeuda(frec)         { _selFrecDeudaBase('dn-pe', 'btn-frec-mensual',       'btn-frec-quincenal',      frec); }
export function selFrecDeudaEdit(frec)     { _selFrecDeudaBase('ed-pe', 'btn-edit-frec-mensual',  'btn-edit-frec-quincenal', frec); }

// ─── AVISOS INTELIGENTES ─────────────────────────────────────────────────────
function _renderAvisosDeudas(pct, totD) {
  const avisosEl = document.getElementById('de-avisos'); if (!avisosEl) return;
  const deudasVivas = S.deudas.filter(d => (d.total - d.pagado) > 0);
  const avisos = [];

  // Tasa de usura (constante TASA_USURA_EA de constants.js)
  const deudasUsura = deudasVivas.filter(d => (d.tasa || 0) > TASA_USURA_EA);
  if (deudasUsura.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,68,68,.03);">
      <span style="font-size:20px; flex-shrink:0;">⚖️</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--dan); margin-bottom:3px;">¡Ojo! Posible cobro ilegal — Tasa de Usura</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong style="color:var(--t2);">${deudasUsura.map(d => d.nombre).join(', ')}</strong> supera el tope legal (${TASA_USURA_EA}% E.A.). En Colombia cobrar por encima de la tasa de usura es un delito, no una cortesía. Consultá con un asesor o la Superintendencia Financiera. <span style="background:var(--s2); border:1px solid var(--b2); border-radius:4px; padding:2px 6px; font-size:10px; font-weight:700; font-family:var(--fm);">⚖️ Art. 305 C.P.</span></div>
      </div>
    </div>`);
  }

  // Compra de cartera — 2+ deudas con tasa >= 2%
  const deudasCaras = deudasVivas.filter(d => (d.tasa || 0) >= 2);
  if (deudasCaras.length >= 2) {
    const totalCaro = deudasCaras.reduce((s, d) => s + (d.total - d.pagado), 0);
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(59,158,255,.03);">
      <span style="font-size:20px; flex-shrink:0;">🏦</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a4); margin-bottom:3px;">Oportunidad: unite a una sola deuda y pagá menos</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Tenés <strong style="color:var(--t2);">${deudasCaras.length} deudas con tasas altas</strong> que suman <strong style="color:var(--t2);">${f(totalCaro)}</strong>. Preguntale a tu banco por una <strong style="color:var(--a4);">compra de cartera</strong>: es unirlas todas en una sola con mejor tasa. ¡Puede ahorrarte mucha plata!</div>
      </div>
    </div>`);
  }

  // Trampa del mínimo — cuota apenas cubre intereses
  const deudasEstancadas = deudasVivas.filter(d => {
    if (!d.tasa || d.tasa <= 0 || !d.cuota) return false;
    const tm = Math.pow(1 + d.tasa / 100, 1 / 12) - 1;
    return d.cuota <= (d.total - d.pagado) * tm * 1.1;
  });
  if (deudasEstancadas.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,68,68,.03);">
      <span style="font-size:20px; flex-shrink:0;">🚨</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--dan); margin-bottom:3px;">¡Trampa del mínimo! Tu deuda casi no está bajando</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">En <strong style="color:var(--t2);">${deudasEstancadas.map(d => d.nombre).join(', ')}</strong> tu cuota apenas alcanza a cubrir los intereses del mes. La deuda se estanca. Agregar $20.000–$50.000 extra al pago puede cambiar completamente cuándo te liberás de ella.</div>
      </div>
    </div>`);
  }

  // Refinanciación — >= 50% pagado
  const candidatasRefin = deudasVivas.filter(d => {
    const p = d.total > 0 ? (d.pagado / d.total) * 100 : 0;
    return p >= 50 && (d.tasa || 0) >= 1.5;
  });
  if (candidatasRefin.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(0,220,130,.03);">
      <span style="font-size:20px; flex-shrink:0;">🔄</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a1); margin-bottom:3px;">¡Buen momento para negociar una tasa mejor!</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Ya llevás más del 50% pagado en <strong style="color:var(--t2);">${candidatasRefin.map(d => d.nombre).join(', ')}</strong>. Eso te convierte en buen cliente a ojos del banco. Llamá y pedí que te bajen la tasa. El que no llora, no mama.</div>
      </div>
    </div>`);
  }

  // Regla del 20%
  if (pct > 20 && pct <= 40 && S.ingreso > 0) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,214,10,.03);">
      <span style="font-size:20px; flex-shrink:0;">⚠️</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a2); margin-bottom:3px;">Más del 20% de tu ingreso ya va en deudas</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Estás en el <strong style="color:var(--t2);">${pct}%</strong>. No es una catástrofe, pero ojo: no agarrés más compromisos financieros por ahora. Concentrate en liquidar lo que ya tenés.</div>
      </div>
    </div>`);
  }

  // Sin fondo de emergencia
  if ((S.fondoEmergencia?.actual || 0) === 0 && deudasVivas.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(180,78,255,.03);">
      <span style="font-size:20px; flex-shrink:0;">🛡️</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a5); margin-bottom:3px;">Sin colchoneta de emergencia — eso es riesgo alto</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Antes de abonarte más a las deudas, guardá aunque sea el 5%–10% de tu ingreso en una cuenta aparte que no toques. Si llega un imprevisto y no tenés ese colchón, vas a terminar adquiriendo más deuda. ¡Primero el seguro!</div>
      </div>
    </div>`);
  }

  // Felicitación — control saludable
  if (pct > 0 && pct <= 20 && deudasVivas.length) {
    avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(0,220,130,.03);">
      <span style="font-size:20px; flex-shrink:0;">🌟</span>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:12px; color:var(--a1); margin-bottom:3px;">¡Tus deudas están súper bien manejadas!</div>
        <div style="font-size:11px; color:var(--t3); line-height:1.6;">Solo el <strong style="color:var(--a1);">${pct}%</strong> de tu ingreso va en deudas. ¡Eso es salud financiera! Cuando las termines, redirigí esas cuotas al ahorro y verás cómo tu plata empieza a trabajar para vos.</div>
      </div>
    </div>`);
  }

  // Mora por días (Ley 1266) — deudas formales
  const tiposFormales = ['tarjeta', 'credito', 'hipoteca', 'vehiculo', 'educacion', 'salud'];
  const hoyMora = new Date(); hoyMora.setHours(0, 0, 0, 0);
  const deudasConMora = deudasVivas
    .filter(d => tiposFormales.includes(d.tipo) && d.diaPago)
    .map(d => {
      const ultima = new Date(hoyMora.getFullYear(), hoyMora.getMonth(), Math.min(d.diaPago, new Date(hoyMora.getFullYear(), hoyMora.getMonth() + 1, 0).getDate()));
      const mesVerif = `${ultima.getFullYear()}-${String(ultima.getMonth() + 1).padStart(2, '0')}`;
      const pagado   = S.gastos.some(g => g.cat === 'deudas' && g.fecha.startsWith(mesVerif) && g.desc.includes(d.nombre));
      if (pagado) return null;
      const diasMora = Math.floor((hoyMora - ultima) / 86_400_000);
      return diasMora > 0 ? { d, diasMora } : null;
    })
    .filter(Boolean);

  const m30 = deudasConMora.filter(x => x.diasMora >= 30 && x.diasMora < 60);
  const m60 = deudasConMora.filter(x => x.diasMora >= 60 && x.diasMora < 90);
  const m90 = deudasConMora.filter(x => x.diasMora >= 90);

  if (m90.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,68,68,.03);">
    <span style="font-size:20px; flex-shrink:0;">🚨</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--dan); margin-bottom:3px;">¡Peligro de reporte en Datacrédito!</div>
    <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong>${m90.map(x => x.d.nombre).join(', ')}</strong> lleva${m90.length > 1 ? 'n' : ''} más de 90 días sin pago. Pero tranquilo: el banco está obligado a avisarte con <strong>20 días de anticipación</strong> antes de reportarte (Ley 1266/2008, Art. 13). Llamá hoy y negociá. ¡Aún estás a tiempo!</div></div>
  </div>`);
  if (m60.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,107,53,.03);">
    <span style="font-size:20px; flex-shrink:0;">📞</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--a3); margin-bottom:3px;">El banco puede estar a punto de llamarte</div>
    <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong>${m60.map(x => x.d.nombre).join(', ')}</strong> lleva${m60.length > 1 ? 'n' : ''} entre 60–90 días sin pago. Llamá vos primero y negociá antes de llegar a los 90 días críticos. El que pide de buenas, consigue de buenas.</div></div>
  </div>`);
  if (m30.length) avisos.push(`<div style="display:flex; align-items:flex-start; gap:12px; padding:14px 24px; border-bottom:1px solid var(--b1); background:rgba(255,214,10,.03);">
    <span style="font-size:20px; flex-shrink:0;">⏳</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:12px; color:var(--a2); margin-bottom:3px;">Retraso detectado — todavía se puede resolver</div>
    <div style="font-size:11px; color:var(--t3); line-height:1.6;"><strong>${m30.map(x => x.d.nombre).join(', ')}</strong> lleva${m30.length > 1 ? 'n' : ''} más de 30 días sin pago. Ponete al día pronto para no llegar a los 90 días donde la cosa se complica de verdad.</div></div>
  </div>`);

  avisosEl.innerHTML = avisos.join('');
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.guardarDeuda       = guardarDeuda;
window.renderDeudas       = renderDeudas;
window.setModoDeuda       = setModoDeuda;
window.abrirPagarCuota    = abrirPagarCuota;
window.confPagarCuota     = confPagarCuota;
window.abrirEditarDeuda   = abrirEditarDeuda;
window.guardarEditarDeuda = guardarEditarDeuda;
window.delDeu             = delDeu;
window.selTipoDeuda       = selTipoDeuda;
window.selTipoDeudaEdit   = selTipoDeudaEdit;
window.selFrecDeuda       = selFrecDeuda;
window.selFrecDeudaEdit   = selFrecDeudaEdit;