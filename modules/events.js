// Orquestador principal: importa todos los módulos, expone globals, arranca la app.

// ─── CIMIENTOS ───────────────────────────────────────────────────────────────
import { S, resetAppState }   from './core/state.js';
import { save, loadData }     from './core/storage.js';
import { inyectarConstantes, verificarVigenciaConstantes } from './core/constants.js';
import { f, hoy, mesStr, he, setEl, setHtml, sr, openM, closeM, showAlert, showConfirm, showPrompt, showPromptConfirm } from './infra/utils.js';
import { updSaldo, updateBadge, renderSmart, renderAll, totalCuentas } from './infra/render.js';

// ─── NAVEGACIÓN ──────────────────────────────────────────────────────────────
import { go, toggleMas, closeMas, setPer, setResumenTab, toggleSidebar } from './sections.js';

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
import { updateDash, calcScore, renderDashCuentas } from './dashboard.js';

// ─── GASTOS ──────────────────────────────────────────────────────────────────
import { agregarGasto, delGasto, abrirEditarGasto, guardarEditarGasto, limpiarGastos, setFiltroGasto, renderGastos, prev4k, actualizarSemaforo, calcularImpactoHormiga } from './gastos.js';

// ─── FIJOS ───────────────────────────────────────────────────────────────────
import { guardarFijo, renderFijos, abrirModalFijo, cerrarModalFijo, ejecutarPagoFijo, desmFijo, delFijo } from './fijos.js';

// ─── DEUDAS ──────────────────────────────────────────────────────────────────
import { guardarDeuda, renderDeudas, setModoDeuda, abrirPagarCuota, confPagarCuota, abrirEditarDeuda, guardarEditarDeuda, delDeu, selTipoDeuda, selTipoDeudaEdit, selFrecDeuda, selFrecDeudaEdit } from './deudas.js';

// ─── OBJETIVOS ───────────────────────────────────────────────────────────────
import { guardarObjetivo, toggleTipoObjetivo, openNuevoObjetivo, renderObjetivos, abrirAccionObj, evaluarGastoEvento, ejecutarAccionObjetivo, delObjetivo, calcSimObj, populateSelectObjetivos } from './objetivos.js';

// ─── INVERSIONES ─────────────────────────────────────────────────────────────
import { guardarInversion, renderInversiones, openRendimiento, guardarRendimiento, delInversion } from './inversiones.js';

// ─── AGENDA ──────────────────────────────────────────────────────────────────
import { renderCal, prevMonth, nextMonth, showDayDetails, guardarPago, marcarPagado, ejecutarPagoAgendado, delPago, renderPagos } from './agenda.js';

// ─── CUENTAS ─────────────────────────────────────────────────────────────────
import { guardarCuenta, delCuenta, editSaldoCuenta, editSaldoCuentaDash, renderCuentas, actualizarListasFondos, toggleFundSelect, selFundOpt } from './cuentas.js';

// ─── HISTORIAL ───────────────────────────────────────────────────────────────
// Solo funciones propias del historial — render, borrar, cerrar período.
import { renderHistorial, delHistorial, cerrarQ } from './historial.js';

// ─── EXPORTACIÓN / IMPORTACIÓN ────────────────────────────────────────────────
// Fuente canónica: exports.js tiene las versiones con versioning y validaciones.
// historial.js tenía copias antiguas e inferiores — ya eliminadas.
import { exportarDatos, importarDatos, exportarCSV, generarReporteHTML } from './exports.js';

// ─── RESUMEN QUINCENAL ────────────────────────────────────────────────────────
import { mostrarResumenQuincena, calcularResumen, generarConsejo } from './resumen.js';

// ─── FONDO DE EMERGENCIA ─────────────────────────────────────────────────────
import { calcularFondoEmergencia, actualizarVistaFondo, registrarAbonoFondo } from './fondo.js';

// ─── ESTADÍSTICAS ────────────────────────────────────────────────────────────
import { renderStats } from './stats.js';

// ─── GAMIFICACIÓN ─────────────────────────────────────────────────────────────
import { evaluarLogros, renderLogros, renderRachaWidget, calcularRachas } from './logros.js';

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────
import { toggleDayPicker, selectDay, setDayPicker, updCustomFundButton, toggleFormGasto, toggleFijoInline, toggleFijosPanel, calcDist, onMetCh, selM, guardarQ, resetTodo, resetQuincena, toggleTheme, applyTheme, getPreferredTheme, initTheme, initClickOutside } from './ui-components.js';

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────

// utils
window.f                   = f;
window.hoy                 = hoy;
window.mesStr              = mesStr;
window.he                  = he;
window.setEl               = setEl;
window.setHtml             = setHtml;
window.sr                  = sr;
window.openM               = openM;
window.closeM              = closeM;
window.showAlert           = showAlert;
window.showConfirm         = showConfirm;
window.showPrompt          = showPrompt;
window.showPromptConfirm   = showPromptConfirm;
window.save                = save;

// render
window.updSaldo            = updSaldo;
window.updateBadge         = updateBadge;
window.renderSmart         = renderSmart;
window.renderAll           = renderAll;
window.totalCuentas        = totalCuentas;

// sections
window.go                  = go;
window.toggleMas           = toggleMas;
window.closeMas            = closeMas;
window.setPer              = setPer;
window.setResumenTab       = setResumenTab;
window.toggleSidebar       = toggleSidebar;

// dashboard
window.updateDash          = updateDash;
window.calcScore           = calcScore;
window.renderDashCuentas   = renderDashCuentas;

// hero: acordeón de desglose efectivo/banco
window.toggleDesgloseHero  = function() {
  const body  = document.getElementById('desglose-hero-body');
  const btn   = document.getElementById('btn-desglose-hero');
  const arrow = document.getElementById('desglose-hero-arrow');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  btn?.setAttribute('aria-expanded', String(!open));
  if (arrow) arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
};

// gastos
window.agregarGasto        = agregarGasto;
window.delGasto            = delGasto;
window.abrirEditarGasto    = abrirEditarGasto;
window.guardarEditarGasto  = guardarEditarGasto;
window.limpiarGastos       = limpiarGastos;
window.setFiltroGasto      = setFiltroGasto;
window.renderGastos        = renderGastos;
window.prev4k              = prev4k;
window.actualizarSemaforo  = actualizarSemaforo;
window.calcularImpactoHormiga = calcularImpactoHormiga;

// fijos
window.guardarFijo         = guardarFijo;
window.renderFijos         = renderFijos;
window.abrirModalFijo      = abrirModalFijo;
window.cerrarModalFijo     = cerrarModalFijo;
window.ejecutarPagoFijo    = ejecutarPagoFijo;
window.desmFijo            = desmFijo;
window.delFijo             = delFijo;

// deudas
window.guardarDeuda        = guardarDeuda;
window.renderDeudas        = renderDeudas;
window.setModoDeuda        = setModoDeuda;
window.abrirPagarCuota     = abrirPagarCuota;
window.confPagarCuota      = confPagarCuota;
window.abrirEditarDeuda    = abrirEditarDeuda;
window.guardarEditarDeuda  = guardarEditarDeuda;
window.delDeu              = delDeu;
window.selTipoDeuda        = selTipoDeuda;
window.selTipoDeudaEdit    = selTipoDeudaEdit;
window.selFrecDeuda        = selFrecDeuda;
window.selFrecDeudaEdit    = selFrecDeudaEdit;

// objetivos
window.guardarObjetivo          = guardarObjetivo;
window.toggleTipoObjetivo       = toggleTipoObjetivo;
window.openNuevoObjetivo        = openNuevoObjetivo;
window.renderObjetivos          = renderObjetivos;
window.abrirAccionObj           = abrirAccionObj;
window.evaluarGastoEvento       = evaluarGastoEvento;
window.ejecutarAccionObjetivo   = ejecutarAccionObjetivo;
window.delObjetivo              = delObjetivo;
window.calcSimObj               = calcSimObj;
window.populateSelectObjetivos  = populateSelectObjetivos;

// inversiones
window.guardarInversion    = guardarInversion;
window.renderInversiones   = renderInversiones;
window.openRendimiento     = openRendimiento;
window.guardarRendimiento  = guardarRendimiento;
window.delInversion        = delInversion;

// agenda
window.renderCal            = renderCal;
window.prevMonth            = prevMonth;
window.nextMonth            = nextMonth;
window.showDayDetails       = showDayDetails;
window.guardarPago          = guardarPago;
window.marcarPagado         = marcarPagado;
window.ejecutarPagoAgendado = ejecutarPagoAgendado;
window.delPago              = delPago;
window.renderPagos          = renderPagos;

// cuentas
window.guardarCuenta          = guardarCuenta;
window.delCuenta              = delCuenta;
window.editSaldoCuenta        = editSaldoCuenta;
window.editSaldoCuentaDash    = editSaldoCuentaDash;
window.renderCuentas          = renderCuentas;
window.actualizarListasFondos = actualizarListasFondos;
window.toggleFundSelect       = toggleFundSelect;
window.selFundOpt             = selFundOpt;

// historial / export
window.renderHistorial     = renderHistorial;
window.delHistorial        = delHistorial;
window.cerrarQ             = cerrarQ;
window.exportarDatos       = exportarDatos;
window.importarDatos       = importarDatos;
window.exportarCSV         = exportarCSV;
window.descargarCSVDirecto = exportarCSV;
window.generarReporteHTML  = generarReporteHTML;

// resumen quincenal
window.mostrarResumenQuincena = mostrarResumenQuincena;
window.calcularResumen        = calcularResumen;
window.generarConsejo         = generarConsejo;

// fondo de emergencia
window.calcularFondoEmergencia = calcularFondoEmergencia;
window.actualizarVistaFondo    = actualizarVistaFondo;
window.registrarAbonoFondo     = registrarAbonoFondo;

// stats
window.renderStats = renderStats;

// logros / gamificación
window.evaluarLogros     = evaluarLogros;
window.renderLogros      = renderLogros;
window.renderRachaWidget = renderRachaWidget;
window.calcularRachas    = calcularRachas;

// ui-components
window.toggleDayPicker     = toggleDayPicker;
window.selectDay           = selectDay;
window.setDayPicker        = setDayPicker;
window.updCustomFundButton = updCustomFundButton;
window.toggleFormGasto     = toggleFormGasto;
window.toggleFijoInline    = toggleFijoInline;
window.toggleFijosPanel    = toggleFijosPanel;
window.calcDist            = calcDist;
window.onMetCh             = onMetCh;
window.selM                = selM;
window.guardarQ            = guardarQ;
window.resetTodo           = resetTodo;
window.resetQuincena       = resetQuincena;
window.toggleTheme         = toggleTheme;
window.applyTheme          = applyTheme;
window.getPreferredTheme   = getPreferredTheme;
window.initTheme           = initTheme;

// efectivo — atajo directo del Dashboard
window.editEfectivoDash = async function () {
  const val = await showPrompt(
    `Efectivo registrado: ${f(S.saldos.efectivo)}\n\nIngresa el dinero físico exacto que tienes ahora en tu billetera:`,
    '💵 Actualizar Efectivo',
    S.saldos.efectivo
  );
  if (val === null) return;
  S.saldos.efectivo = Math.max(0, +val || 0);
  save(); updSaldo(); updateDash();
};

// ─── BANNER OFFLINE ──────────────────────────────────────────────────────────
// Muestra un aviso amable cuando el dispositivo pierde la conexión.
// Se inyecta dinámicamente — no requiere tocar index.html.
function _crearBannerOffline() {
  if (document.getElementById('finko-offline-banner')) return;
  const b = document.createElement('div');
  b.id = 'finko-offline-banner';
  b.setAttribute('role', 'status');
  b.setAttribute('aria-live', 'polite');
  b.setAttribute('aria-atomic', 'true');
  b.textContent = '📵 Sin conexión — tu plata y tus datos están seguros acá guardados';
  Object.assign(b.style, {
    position:      'fixed',
    bottom:        'calc(env(safe-area-inset-bottom, 0px) + 72px)',
    left:          '50%',
    transform:     'translateX(-50%)',
    background:    'var(--s2, #111a13)',
    color:         'var(--a2, #ffd60a)',
    border:        '1px solid rgba(255,214,10,.3)',
    borderRadius:  '999px',
    padding:       '8px 20px',
    fontSize:      '12px',
    fontWeight:    '600',
    fontFamily:    'var(--ff, sans-serif)',
    zIndex:        '9999',
    whiteSpace:    'nowrap',
    display:       'none',
    boxShadow:     '0 4px 20px rgba(0,0,0,.5)',
    pointerEvents: 'none',
    transition:    'opacity .3s ease',
  });
  document.body.appendChild(b);
}

function _actualizarBannerOffline() {
  _crearBannerOffline();
  const b = document.getElementById('finko-offline-banner');
  if (!b) return;
  const offline = !navigator.onLine;
  b.style.display = offline ? 'block' : 'none';
  // Anuncia el cambio a lectores de pantalla
  if (offline) sr('Sin conexión a internet. La app sigue funcionando con tus datos guardados.');
}

window.addEventListener('online',  _actualizarBannerOffline);
window.addEventListener('offline', _actualizarBannerOffline);

// ─── ARRANQUE ────────────────────────────────────────────────────────────────
function _initDatos() {
  loadData();
  updSaldo();
}

function _initUI() {
  // ① Tema primero — evita el flash de pantalla blanca/oscura incorrecta
  initTheme();

  if (localStorage.getItem('sb_expanded') === 'true') {
    document.getElementById('sidebar')?.classList.add('expanded');
    document.body.classList.add('sb-expanded');
  }
  inyectarConstantes();
  updateBadge();
  const today = new Date();
  ['g-fe', 'ag-fe', 'obj-fe'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.valueAsDate = today;
  });
  if (S.ingreso > 0) {
    const el = document.getElementById('q-ing'); if (el) el.value = S.ingreso;
  }
  initClickOutside();
}

// _initCalculadoras() eliminada — ver sections.js::_cargarCalculadoras()

function initApp() {
  _initDatos();
  _initUI();
  populateSelectObjetivos();
  renderAll();
  calcScore();
  verificarVigenciaConstantes();
  // Verificar estado de conexión al arrancar
  _actualizarBannerOffline();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ─── SERVICE WORKER ──────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // El SW vive en la raíz del proyecto — desde /modules/ se accede con ../
    // El scope './' cubre toda la app desde la raíz.
    navigator.serviceWorker.register('../service-worker.js', { scope: './' })
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw?.addEventListener('statechange', () => {
            // Solo pedir activación cuando ya hay un SW anterior controlando.
            // Así evitamos interrumpir la sesión actual del usuario.
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(err => console.warn('[SW] Error al registrar:', err));

    // Escuchar mensajes del Service Worker
    navigator.serviceWorker.addEventListener('message', event => {
      // ✅ FIX: el SW avisa cuando detecta que se perdió la conexión en una
      // petición de red. Mostramos el banner para que el usuario sepa que está
      // offline — antes no había ningún aviso y parecía que la app se cayó.
      if (event.data?.type === 'FINKO_OFFLINE') {
        _actualizarBannerOffline();
      }
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  });
}