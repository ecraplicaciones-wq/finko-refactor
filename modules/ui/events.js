// Orquestador principal: importa todos los módulos, expone globals, arranca la app.

// ─── CIMIENTOS ───────────────────────────────────────────────────────────────
import { S, resetAppState }   from '../core/state.js';
import { save, loadData }     from '../core/storage.js';
import { inyectarConstantes, verificarVigenciaConstantes } from '../core/constants.js';
import { f, hoy, mesStr, he, setEl, setHtml, openM, closeM, showAlert, showConfirm, showPrompt, showPromptConfirm } from '../infra/utils.js';
import { sr } from '../infra/a11y.js';
import { updSaldo, updateBadge, renderSmart, renderAll, totalCuentas } from '../infra/render.js';

// ─── NAVEGACIÓN + UI SHELL ───────────────────────────────────────────────────
import { go, toggleMas, closeMas, setPer, setResumenTab, toggleSidebar, toggleDayPicker, selectDay, setDayPicker, updCustomFundButton, toggleFormGasto, toggleFijoInline, toggleFijosPanel, calcDist, onMetCh, selM, guardarQ, resetTodo, resetQuincena, toggleTheme, applyTheme, getPreferredTheme, initTheme, initClickOutside, toggleDashCard, switchSecTab } from './shell.js';

// ─── CALCULADORAS ─────────────────────────────────────────────────────────────
import { toggleCalc, guardarPrima } from '../calculadoras.js';

// ─── INGRESOS (gastos + dashboard + resumen + historial) ─────────────────────
import { agregarGasto, delGasto, abrirEditarGasto, guardarEditarGasto, limpiarGastos, setFiltroGasto, renderGastos, prev4k, actualizarSemaforo, calcularImpactoHormiga, updateDash, calcScore, renderDashCuentas, calcularResumen, generarConsejo, mostrarResumenQuincena, renderHistorial, delHistorial, cerrarQ } from '../dominio/ingresos.js';

// ─── COMPROMISOS (fijos + agenda + deudas) ───────────────────────────────────
import {
  guardarFijo, renderFijos, abrirModalFijo, cerrarModalFijo, ejecutarPagoFijo, desmFijo, delFijo,
  renderCal, prevMonth, nextMonth, showDayDetails, guardarPago, marcarPagado, ejecutarPagoAgendado, delPago, renderPagos,
  guardarDeuda, renderDeudas, setModoDeuda, abrirPagarCuota, confPagarCuota, abrirEditarDeuda, guardarEditarDeuda, delDeu, selTipoDeuda, selTipoDeudaEdit, selFrecDeuda, selFrecDeudaEdit
} from '../dominio/compromisos.js';

// ─── METAS (objetivos + inversiones) ─────────────────────────────────────────
import { guardarObjetivo, toggleTipoObjetivo, openNuevoObjetivo, renderObjetivos, abrirAccionObj, evaluarGastoEvento, ejecutarAccionObjetivo, delObjetivo, calcSimObj, populateSelectObjetivos, guardarInversion, renderInversiones, openRendimiento, guardarRendimiento, delInversion } from '../dominio/metas.js';

// ─── CUENTAS ─────────────────────────────────────────────────────────────────
import { guardarCuenta, delCuenta, editSaldoCuenta, editSaldoCuentaDash, renderCuentas, actualizarListasFondos, toggleFundSelect, selFundOpt } from '../dominio/tesoreria.js';

// ─── EXPORTACIÓN / IMPORTACIÓN ────────────────────────────────────────────────
import { exportarDatos, importarDatos, exportarCSV, generarReporteHTML } from '../dominio/exports.js';

// ─── FONDO DE EMERGENCIA ─────────────────────────────────────────────────────
import { calcularFondoEmergencia, actualizarVistaFondo, registrarAbonoFondo } from '../dominio/tesoreria.js';

// ─── ANÁLISIS (stats + logros) ────────────────────────────────────────────────
import { renderStats, evaluarLogros, renderLogros, renderRachaWidget, calcularRachas } from '../dominio/analisis.js';

// ─── SISTEMA DE DELEGACIÓN CON data-action ───────────────────────────────────

const ACTIONS = new Map();

export function registerAction(name, fn) {
  ACTIONS.set(name, fn);
}

// Delegación global de clicks
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;
  const fn = ACTIONS.get(action);

  if (!fn) {
    console.warn('Acción no registrada:', action);
    return;
  }

  // Extraer argumentos de data-arg-*
  const args = {};
  Array.from(el.attributes).forEach(attr => {
    if (attr.name.startsWith('data-arg-')) {
      const key = attr.name.replace('data-arg-', '');
      args[key] = attr.value;
    }
  });

  fn(args, el, e);
});

// === INIT: registrar acciones desde módulos ===
export function initActions() {
  // Los módulos llamarán registerAction() en su init
}

// ─── ACCIONES DE SHELL (sin circular dependency) ──────────────────────────────
registerAction('toggleDashCard',  ({ key })  => toggleDashCard(key));
registerAction('setResumenTab',   ({ tab })  => setResumenTab(tab));
registerAction('setFiltroGasto',  ({ tipo }, el) => setFiltroGasto(tipo, el));
registerAction('go',              ({ sec })  => go(sec));
registerAction('toggleSidebar',   ()         => toggleSidebar());
registerAction('toggleMas',       ()         => toggleMas());
registerAction('closeMas',        ()         => closeMas());
registerAction('toggleTheme',     ()         => toggleTheme());
registerAction('resetQuincena',   ()         => resetQuincena());
registerAction('resetTodo',       ()         => resetTodo());
registerAction('setPer',          ({ per }, el) => setPer(per, el));
registerAction('selM',            ({ mod }, el) => selM(el, mod));
registerAction('guardarQ',        ()         => guardarQ());
registerAction('toggleFormGasto', ()         => toggleFormGasto());
registerAction('toggleFijoInline',()         => toggleFijoInline());
registerAction('toggleDayPicker', ({ id })   => toggleDayPicker(id));
// utils (openM / closeM vienen de utils.js)
registerAction('openM',              ({ id })   => openM(id));
registerAction('closeM',             ({ id })   => closeM(id));
registerAction('toggleThemeAndClose',()         => { toggleTheme(); closeMas(); });
registerAction('switchSecTab',       ({ section, tab }, el) => switchSecTab(section, tab, el));

// ─── ACCIONES DE CALCULADORAS ─────────────────────────────────────────────────
registerAction('toggleCalc',   ({ id }) => toggleCalc(id));
registerAction('guardarPrima', ()       => guardarPrima());

// ─── ACCIONES INLINE (definidas en events.js) ─────────────────────────────────
registerAction('toggleDesgloseHero', () => window.toggleDesgloseHero?.());
registerAction('editEfectivoDash',   () => window.editEfectivoDash?.());
registerAction('cdlgResOk',          () => window._cdlgRes?.(true));
registerAction('cdlgResCancel',      () => window._cdlgRes?.(false));

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────

// utils
window.f                   = f;
window.hoy                 = hoy;
window.mesStr              = mesStr;
window.he                  = he;
window.setEl               = setEl;
window.setHtml             = setHtml;
window.sr                  = sr;
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
window.selectDay           = selectDay;
window.setDayPicker        = setDayPicker;
window.updCustomFundButton = updCustomFundButton;
window.toggleFijosPanel    = toggleFijosPanel;
window.calcDist            = calcDist;
window.onMetCh             = onMetCh;
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