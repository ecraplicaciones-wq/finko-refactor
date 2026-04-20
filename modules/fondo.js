import { S }    from './core/state.js';
import { save } from './core/storage.js';
import { f, hoy, setEl, openM, closeM, showAlert, descontarFondo } from './infra/utils.js';
import { renderSmart } from './infra/render.js';

// ─── CÁLCULO BASE ─────────────────────────────────────────────────────────────
// La meta del fondo se basa en los gastos fijos mensuales reales del usuario.
// Si no tiene fijos registrados, usa el ingreso como proxy.
export function calcularFondoEmergencia() {
  const gastoFijoMensual = (S.gastosFijos || []).reduce((acc, g) => {
    const monto        = Number(g.monto) || 0;
    const montoMensual = g.periodicidad === 'quincenal' ? monto * 2 : monto;
    return acc + montoMensual;
  }, 0);

  // Si no hay fijos, usamos el 60% del ingreso como estimado del costo de vida
  const baseCalculo = gastoFijoMensual > 0
    ? gastoFijoMensual
    : S.ingreso * 0.6;

  const mesesMeta            = S.fondoEmergencia?.objetivoMeses || 6;
  const montoObjetivoTotal   = baseCalculo * mesesMeta;
  const dineroActual         = Number(S.fondoEmergencia?.actual) || 0;
  const faltaPorAhorrar      = Math.max(0, montoObjetivoTotal - dineroActual);
  const porcentajeCompletado = montoObjetivoTotal > 0
    ? Math.min((dineroActual / montoObjetivoTotal) * 100, 100)
    : 0;
  const mesesCubiertos = baseCalculo > 0 ? dineroActual / baseCalculo : 0;

  return {
    gastoMensualFijo:    baseCalculo,
    montoObjetivoTotal,
    actual:              dineroActual,
    faltaPorAhorrar,
    porcentajeCompletado: porcentajeCompletado.toFixed(1),
    mesesCubiertos:       mesesCubiertos.toFixed(1)
  };
}

// ─── RENDER / VISTA ──────────────────────────────────────────────────────────
export function actualizarVistaFondo() {
  const stats   = calcularFondoEmergencia();
  const elMeses = document.getElementById('fe-meses-cobertura');
  const elBarra = document.getElementById('fe-barra-progreso');

  if (elMeses) elMeses.innerHTML = `<strong>${stats.mesesCubiertos}</strong> de ${S.fondoEmergencia?.objetivoMeses || 6} meses cubiertos`;
  if (elBarra) elBarra.style.width = `${stats.porcentajeCompletado}%`;

  setEl('fe-dinero-actual',   f(stats.actual));
  setEl('fe-dinero-objetivo', f(stats.faltaPorAhorrar));
}

// ─── ABONO AL FONDO ──────────────────────────────────────────────────────────
export async function registrarAbonoFondo() {
  const inputAbono = document.getElementById('fe-monto-abono');
  const monto      = +(inputAbono?.value || 0);
  const fondoOrigen = document.getElementById('fe-fo')?.value;

  if (monto <= 0) { await showAlert('Ingresa un monto válido.', 'Inválido'); return; }

  // Descontar del fondo seleccionado
  if (fondoOrigen) descontarFondo(fondoOrigen, monto);

  // Registrar como gasto tipo ahorro para trazabilidad
  S.gastos.unshift({
    id:          Date.now(),
    desc:        '🛡️ Abono Fondo Emergencia',
    monto,
    montoTotal:  monto,
    cat:         'ahorro',
    tipo:        'ahorro',
    fondo:       fondoOrigen || 'banco',
    hormiga:     false,
    cuatroXMil:  false,
    fecha:       hoy(),
    metaId:      '',
    autoFijo:    false
  });

  if (!S.fondoEmergencia) S.fondoEmergencia = { objetivoMeses: 6, actual: 0 };
  S.fondoEmergencia.actual += monto;

  if (inputAbono) inputAbono.value = '';
  closeM('m-fondo-emergencia');
  save();
  actualizarVistaFondo();
  renderSmart(['gastos', 'stats']);
  await showAlert('¡Dinero blindado con éxito en tu Fondo de Emergencia! 🛡️', 'Fondo Actualizado');
}

// ─── ABRIR MODAL ─────────────────────────────────────────────────────────────
export function abrirFondoEmergencia() {
  window.actualizarListasFondos?.();
  openM('m-fondo-emergencia');
}

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
window.calcularFondoEmergencia = calcularFondoEmergencia;
window.actualizarVistaFondo    = actualizarVistaFondo;
window.registrarAbonoFondo     = registrarAbonoFondo;
window.abrirFondoEmergencia    = abrirFondoEmergencia;