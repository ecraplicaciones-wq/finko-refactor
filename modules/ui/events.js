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

// ─── ACCIONES INLINE (funciones locales, sin window.*) ───────────────────────
function _toggleDesgloseHero() {
  const body  = document.getElementById('desglose-hero-body');
  const btn   = document.getElementById('btn-desglose-hero');
  const arrow = document.getElementById('desglose-hero-arrow');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  btn?.setAttribute('aria-expanded', String(!open));
  if (arrow) arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}
async function _editEfectivoDash() {
  const val = await showPrompt(
    `Efectivo registrado: ${f(S.saldos.efectivo)}\n\nIngresa el dinero físico exacto que tienes ahora en tu billetera:`,
    '💵 Actualizar Efectivo',
    S.saldos.efectivo
  );
  if (val === null) return;
  S.saldos.efectivo = Math.max(0, +val || 0);
  save(); updSaldo(); updateDash();
}
registerAction('toggleDesgloseHero', () => _toggleDesgloseHero());
registerAction('editEfectivoDash',   () => _editEfectivoDash());
registerAction('cdlgResOk',          () => window._cdlgRes?.(true));
registerAction('cdlgResCancel',      () => window._cdlgRes?.(false));

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
// Solo se exponen funciones llamadas desde HTML dinámico (innerHTML) o desde JS externo.
// Las llamadas desde HTML estático (index.html) usan data-action y NO necesitan window.*.

// utils — usados en HTML dinámico y desde JS externo
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

// render / infra — llamados desde otros módulos vía window (renderSmart, etc.)
window.updSaldo            = updSaldo;
window.updateBadge         = updateBadge;
window.renderSmart         = renderSmart;
window.renderAll           = renderAll;
window.totalCuentas        = totalCuentas;
window.updateDash          = updateDash;
window.calcScore           = calcScore;
window.renderDashCuentas   = renderDashCuentas;

// gastos — delGasto y abrir* en HTML dinámico; render* llamados desde JS
window.delGasto            = delGasto;
window.abrirEditarGasto    = abrirEditarGasto;
window.renderGastos        = renderGastos;
window.actualizarSemaforo  = actualizarSemaforo;
window.calcularImpactoHormiga = calcularImpactoHormiga;

// fijos — abrir*/desm*/del* en HTML dinámico; render* desde JS
window.renderFijos         = renderFijos;
window.abrirModalFijo      = abrirModalFijo;
window.desmFijo            = desmFijo;
window.delFijo             = delFijo;

// deudas — abrir*/del* en HTML dinámico; render* desde JS
window.renderDeudas        = renderDeudas;
window.abrirPagarCuota     = abrirPagarCuota;
window.abrirEditarDeuda    = abrirEditarDeuda;
window.delDeu              = delDeu;

// objetivos — abrir*/del*/calc* en HTML dinámico; render* desde JS
window.renderObjetivos          = renderObjetivos;
window.abrirAccionObj           = abrirAccionObj;
window.delObjetivo              = delObjetivo;
window.calcSimObj               = calcSimObj;

// inversiones — open*/del* en HTML dinámico; render* desde JS
window.renderInversiones   = renderInversiones;
window.openRendimiento     = openRendimiento;
window.delInversion        = delInversion;

// agenda — marcar*/del*/showDay* en HTML dinámico; render* desde JS
window.renderCal            = renderCal;
window.showDayDetails       = showDayDetails;
window.marcarPagado         = marcarPagado;
window.delPago              = delPago;
window.renderPagos          = renderPagos;

// cuentas — del*/edit* en HTML dinámico; render* y selFundOpt desde JS/dinámico
window.delCuenta              = delCuenta;
window.editSaldoCuenta        = editSaldoCuenta;
window.editSaldoCuentaDash    = editSaldoCuentaDash;
window.renderCuentas          = renderCuentas;
window.actualizarListasFondos = actualizarListasFondos;
window.selFundOpt             = selFundOpt;

// historial — delHistorial en HTML dinámico; render* e importar desde JS
window.renderHistorial     = renderHistorial;
window.delHistorial        = delHistorial;
window.importarDatos       = importarDatos;
window.generarReporteHTML  = generarReporteHTML;

// resumen / fondo — llamados desde JS
window.mostrarResumenQuincena  = mostrarResumenQuincena;
window.calcularResumen         = calcularResumen;
window.generarConsejo          = generarConsejo;
window.calcularFondoEmergencia = calcularFondoEmergencia;
window.actualizarVistaFondo    = actualizarVistaFondo;

// stats / logros — llamados desde JS
window.renderStats       = renderStats;
window.evaluarLogros     = evaluarLogros;
window.renderLogros      = renderLogros;
window.renderRachaWidget = renderRachaWidget;
window.calcularRachas    = calcularRachas;

// ui-components — llamados desde JS
window.selectDay           = selectDay;
window.setDayPicker        = setDayPicker;
window.updCustomFundButton = updCustomFundButton;
window.toggleFijosPanel    = toggleFijosPanel;
window.calcDist            = calcDist;
window.onMetCh             = onMetCh;
window.applyTheme          = applyTheme;
window.getPreferredTheme   = getPreferredTheme;
window.initTheme           = initTheme;

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