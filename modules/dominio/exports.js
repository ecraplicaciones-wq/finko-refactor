import { S }    from '../core/state.js';
import { save, CURRENT_VERSION, medirUso } from '../core/storage.js';
import { f, he, hoy } from '../infra/utils.js';
import { CATS, GMF_TASA } from '../core/constants.js';
import { registerAction } from '../ui/actions.js';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PURA — ESTADO DEL ÚLTIMO RESPALDO
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Decide si toca recordarle al usuario que haga un backup.
 * Sin S, sin DOM. La consume `_renderBackupNudge()` y los tests.
 *
 * Estados:
 *   • 'nunca'    — nunca exportó. Mostrar banner.
 *   • 'reciente' — hizo backup dentro del umbral. No mostrar.
 *   • 'vencido'  — hace `umbralDias` o más que no respalda. Mostrar.
 *   • 'futuro'   — fecha de backup en el futuro (clock skew). No mostrar.
 *
 * Se considera "backup" tanto un export (exportarDatos) como un import
 * (importarDatos): tener un .json en el dispositivo es la garantía.
 *
 * @param {string|null} lastBackupISO  'YYYY-MM-DD' del último backup, o null.
 * @param {string}      hoyISO         'YYYY-MM-DD' de hoy.
 * @param {number}      [umbralDias=30]
 * @returns {{
 *   estado: 'nunca'|'reciente'|'vencido'|'futuro',
 *   diasDesde: number|null,
 *   mostrar: boolean,
 *   umbralDias: number
 * }}
 */
export function calcularEstadoBackup(lastBackupISO, hoyISO, umbralDias = 30) {
  const u = umbralDias > 0 ? umbralDias : 30;
  const wrap = (estado, dias, mostrar) => ({
    estado, diasDesde: dias, mostrar, umbralDias: u,
  });

  if (!hoyISO) return wrap('nunca', null, false); // sin hoy no podemos decidir
  if (!lastBackupISO) return wrap('nunca', null, true);

  const last  = new Date(lastBackupISO + 'T12:00:00');
  const today = new Date(hoyISO        + 'T12:00:00');
  if (isNaN(last.getTime()) || isNaN(today.getTime())) {
    return wrap('nunca', null, true); // fecha corrupta → tratamos como nunca
  }

  const dias = Math.floor((today - last) / 86_400_000);
  if (dias < 0)   return wrap('futuro',   0,    false);
  if (dias >= u)  return wrap('vencido',  dias, true);
  return            wrap('reciente', dias, false);
}

// ─── EXPORTAR JSON (RESPALDO COMPLETO) ───────────────────────────────────────
export function exportarDatos() {
  // Marcar la fecha del respaldo ANTES de serializar para que el snapshot
  // y el localStorage queden consistentes (evita un segundo `save` posterior
  // y que el JSON descargado lleve un `lastBackupAt` viejo).
  S.lastBackupAt = hoy();
  save();

  // Incluir metadatos de versión y fecha para que el import pueda validar
  // y migrar correctamente, incluso desde versiones futuras.
  const snapshot = {
    ...S,
    _version:    CURRENT_VERSION,
    _exportadoEn: hoy(),
    _appName:    'Finko Pro',
  };
  const data = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `finko_backup_${hoy()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Esconder el nudge de respaldo si está visible (y resetear dismiss flag).
  _backupNudgeDismissedThisSession = false;
  _renderBackupNudge();
}

// ─── IMPORTAR JSON ───────────────────────────────────────────────────────────
export function importarDatos(e) {
  const file = e.target.files?.[0]; if (!file) return;

  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_BYTES) {
    window.showAlert?.(
      'Ese archivo pesa demasiado para ser un respaldo de Finko. ¿Seguro es el correcto?',
      'Archivo muy grande'
    );
    e.target.value = '';
    return;
  }

  const r = new FileReader();
  r.onload   = function (ev) {
    try {
      const d = JSON.parse(ev.target.result);
      if (typeof d !== 'object' || d === null || Array.isArray(d)) {
        window.showAlert?.('El archivo no tiene un formato válido de Finko Pro.', 'Error de importación');
        return;
      }

      // ✅ Validación de app: rechazar archivos que no sean de Finko Pro
      if (d._appName && d._appName !== 'Finko Pro') {
        window.showAlert?.('Este archivo no es un backup de Finko Pro. No se puede importar.', 'Archivo no válido');
        return;
      }

      // ✅ Validación de versión: versión futura incompatible
      const versionBackup = d._version ?? 0;
      if (versionBackup > CURRENT_VERSION) {
        window.showAlert?.(
          `Este backup fue creado con una versión más nueva de Finko Pro (v${versionBackup}). Actualizá la app antes de importar.`,
          'Versión incompatible'
        );
        return;
      }

      // ✅ Validación de rangos: detectar datos obviamente corruptos o manipulados
      const INGRESO_MAX = 100_000_000; // $100M — razonable para quincena
      if (typeof d.ingreso === 'number' && (d.ingreso < 0 || d.ingreso > INGRESO_MAX)) {
        window.showAlert?.('El archivo tiene un valor de ingreso fuera de rango. Puede estar corrupto.', 'Datos inválidos');
        return;
      }
      if (Array.isArray(d.gastos) && d.gastos.some(g => typeof g.monto === 'number' && g.monto < 0)) {
        window.showAlert?.('El archivo tiene gastos con montos negativos. Puede estar corrupto.', 'Datos inválidos');
        return;
      }

      // Fusión segura: copiar claves del backup sobre el estado
      Object.keys(d).forEach(key => { S[key] = d[key]; });

      // Garantías estructurales (mismas que loadData)
      if (!Array.isArray(S.cuentas))        S.cuentas        = [];
      if (!Array.isArray(S.gastos))         S.gastos         = [];
      if (!Array.isArray(S.objetivos))      S.objetivos      = [];
      if (!Array.isArray(S.deudas))         S.deudas         = [];
      if (!Array.isArray(S.historial))      S.historial      = [];
      if (!Array.isArray(S.gastosFijos))    S.gastosFijos    = [];
      if (!Array.isArray(S.pagosAgendados)) S.pagosAgendados = [];
      if (!Array.isArray(S.inversiones))    S.inversiones    = [];
      if (!Array.isArray(S.bolsillos))      S.bolsillos      = [];
      if (!S.saldos)         S.saldos         = { efectivo: 0, banco: 0 };
      if (!S.fondoEmergencia) S.fondoEmergencia = { objetivoMeses: 6, actual: 0 };
      if (!S.logros)          S.logros          = { desbloqueados: [], vistos: [], rachas: {} };

      // Marcar el último respaldo: el archivo importado YA es un .json en
      // disco, equivalente a haber hecho export en esa fecha. Si el archivo
      // venía sin _exportadoEn (formato muy viejo), tratamos el import como
      // un evento de respaldo "ahora" para no fastidiar con el banner.
      S.lastBackupAt = d._exportadoEn || hoy();

      // Limpiar metadatos del backup del estado en memoria
      delete S._exportadoEn;
      delete S._appName;

      save();
      window.renderAll?.();
      window.go?.('dash');

      const fechaBackup = d._exportadoEn ? ` (backup del ${d._exportadoEn})` : '';
      window.showAlert?.(
        `✅ Todos tus registros han sido restaurados${fechaBackup}. ¡Bienvenido de vuelta!`,
        'Importación exitosa'
      );
    } catch (err) {
      window.showAlert?.(
        'No se pudo leer el archivo. Asegúrate de que sea un backup válido de Finko Pro (.json).',
        'Error de importación'
      );
      console.error('[Finko] importarDatos:', err);
    }
  };
  r.readAsText(file);
}

// ─── LAZY LOAD DE XLSX ───────────────────────────────────────────────────────
async function _cargarXLSX() {
  if (window.XLSX) return;
  return new Promise((resolve, reject) => {
    const script  = document.createElement('script');
    script.src    = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar XLSX'));
    document.head.appendChild(script);
  });
}

// ─── EXPORTAR EXCEL ──────────────────────────────────────────────────────────
// Columnas: Fecha, Descripción, Categoría, Tipo, Fondo, Hormiga, 4x1000, Monto Base, GMF, Monto Total
export async function exportarCSV() {
  if (!S.gastos.length) {
    window.showAlert?.('No hay gastos registrados para exportar.', 'Sin datos');
    return;
  }

  try {
    await _cargarXLSX();
  } catch {
    window.showAlert?.('No se pudo cargar la librería de Excel. Verifica tu conexión e intenta de nuevo.', 'Error de exportación');
    return;
  }

  // Encabezados con formato amigable para contadores
  const filas = [[
    'Fecha',
    'Descripción',
    'Categoría',
    'Tipo',
    'Fondo / Cuenta',
    'Gasto Hormiga',
    'Aplica 4×1000',
    'Monto Base (COP)',
    'GMF Cobrado (COP)',
    'Monto Total (COP)'
  ]];

  S.gastos.forEach(g => {
    // Nombre del fondo con detalle de cuenta
    let nombreFondo = 'Banco';
    if (g.fondo === 'efectivo') {
      nombreFondo = 'Efectivo';
    } else if (g.fondo && g.fondo.startsWith('cuenta_')) {
      const c = S.cuentas.find(x => x.id === +g.fondo.split('_')[1]);
      nombreFondo = c ? `${c.icono} ${c.nombre}` : 'Cuenta eliminada';
    }

    // Cálculo preciso del GMF
    const montoBase  = g.monto || 0;
    const montoTotal = g.montoTotal || g.monto || 0;
    const gmfCobrado = g.cuatroXMil ? Math.round(montoBase * GMF_TASA) : 0;

    filas.push([
      g.fecha,
      g.desc,
      CATS[g.cat] || g.cat,
      g.tipo,
      nombreFondo,
      (g.hormiga || g.tipo === 'hormiga') ? 'Sí' : 'No',
      g.cuatroXMil ? 'Sí' : 'No',
      montoBase,
      gmfCobrado,
      montoTotal
    ]);
  });

  // Fila de totales al final
  const totalBase  = S.gastos.reduce((s, g) => s + (g.monto || 0), 0);
  const totalGMF   = S.gastos.filter(g => g.cuatroXMil).reduce((s, g) => s + Math.round((g.monto || 0) * GMF_TASA), 0);
  const totalFinal = S.gastos.reduce((s, g) => s + (g.montoTotal || g.monto || 0), 0);
  filas.push([]);
  filas.push(['TOTALES', '', '', '', '', '', '', totalBase, totalGMF, totalFinal]);

  // Hoja de resumen por categoría
  const catMap = {};
  S.gastos.filter(g => g.tipo !== 'ahorro').forEach(g => {
    const label = CATS[g.cat] || g.cat;
    catMap[label] = (catMap[label] || 0) + (g.montoTotal || g.monto || 0);
  });
  const filasResumen = [['Categoría', 'Total (COP)', '% del gasto']];
  const totalGastos  = Object.values(catMap).reduce((s, v) => s + v, 0);
  Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, monto]) => {
      const pct = totalGastos > 0 ? ((monto / totalGastos) * 100).toFixed(1) + '%' : '0%';
      filasResumen.push([cat, monto, pct]);
    });

  // Hoja de historial
  const filasHistorial = [['Período', 'Ingreso', 'Gastado', 'Ahorrado', 'Balance', 'Hormiga', '% Ahorro']];
  S.historial.forEach(hx => {
    const balance    = hx.ingreso - hx.gastado;
    const tasaAhorro = hx.ingreso > 0 ? ((hx.ahorro / hx.ingreso) * 100).toFixed(1) + '%' : '0%';
    filasHistorial.push([hx.periodo, hx.ingreso, hx.gastado, hx.ahorro, balance, hx.hormiga || 0, tasaAhorro]);
  });

  // Construir workbook con 3 hojas
  const wb      = XLSX.utils.book_new();
  const wsGastos = XLSX.utils.aoa_to_sheet(filas);
  const wsResumen = XLSX.utils.aoa_to_sheet(filasResumen);
  const wsHist   = XLSX.utils.aoa_to_sheet(filasHistorial);

  // Anchos de columna para hoja de gastos
  wsGastos['!cols'] = [
    { wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 12 },
    { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 }
  ];
  wsResumen['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 14 }];
  wsHist['!cols']    = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];

  XLSX.utils.book_append_sheet(wb, wsGastos,  'Gastos');
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Por Categoría');
  XLSX.utils.book_append_sheet(wb, wsHist,    'Historial');

  XLSX.writeFile(wb, `finko_gastos_${hoy()}.xlsx`);
}

// ─── REPORTE MODAL (tabla HTML interna) ──────────────────────────────────────
export function generarReporteHTML() {
  if (!S.gastos.length) return '<div class="emp">Sin gastos para reportar.</div>';

  const catMap = {};
  let tG = 0, tA = 0, tH = 0;
  S.gastos.forEach(g => {
    const m = g.montoTotal || g.monto;
    if (g.tipo === 'ahorro') tA += m; else tG += m;
    if (g.hormiga || g.tipo === 'hormiga') tH += m;
    const label = CATS[g.cat] || g.cat;
    if (g.tipo !== 'ahorro') catMap[label] = (catMap[label] || 0) + m;
  });

  const filasCat = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, monto]) => {
      const pct = tG > 0 ? ((monto / tG) * 100).toFixed(1) : 0;
      return `<tr><td>${cat}</td><td class="ac mono">${f(monto)}</td><td class="ac">${pct}%</td></tr>`;
    }).join('');

  return `
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px;">
      <div style="padding:14px; background:var(--s2); border-radius:8px; text-align:center;">
        <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; margin-bottom:6px;">Total gastado</div>
        <div style="font-family:var(--fm); font-size:18px; font-weight:800; color:var(--dan);">${f(tG)}</div>
      </div>
      <div style="padding:14px; background:var(--s2); border-radius:8px; text-align:center;">
        <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; margin-bottom:6px;">Ahorrado</div>
        <div style="font-family:var(--fm); font-size:18px; font-weight:800; color:var(--a1);">${f(tA)}</div>
      </div>
      <div style="padding:14px; background:var(--s2); border-radius:8px; text-align:center;">
        <div style="font-size:10px; color:var(--t3); font-weight:700; text-transform:uppercase; margin-bottom:6px;">Hormiga 🐜</div>
        <div style="font-family:var(--fm); font-size:18px; font-weight:800; color:#a1887f;">${f(tH)}</div>
      </div>
    </div>
    <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>Categoría</th><th class="ac">Monto</th><th class="ac">% Gasto</th></tr></thead>
        <tbody>${filasCat}</tbody>
      </table>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUDGE DE RESPALDO EN EL DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
// Tarjeta blanda (no banner fixed) que aparece arriba del dashboard cuando
// `calcularEstadoBackup` lo recomienda. Si el usuario lo descarta con "Luego",
// se silencia HASTA que recargue la app (flag a nivel módulo).

let _backupNudgeDismissedThisSession = false;

export function _renderBackupNudge() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('d-backup-nudge');
  if (!el) return;

  if (_backupNudgeDismissedThisSession) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const estado = calcularEstadoBackup(S.lastBackupAt || null, hoy(), 30);
  if (!estado.mostrar) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const titulo = estado.estado === 'nunca'
    ? '🛟 Aún no has hecho un respaldo'
    : `🛟 Hace ${estado.diasDesde} días que no respaldas`;

  const cuerpo = estado.estado === 'nunca'
    ? 'Tus datos viven solo en este navegador. Si lo limpias o cambias de teléfono, se borrarían. Te toma 5 segundos exportar un archivo de respaldo.'
    : 'Tus datos viven solo en este navegador. Exportá un respaldo nuevo para no perder nada si algo pasa.';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="card mb" style="border-color:rgba(59,158,255,.3);background:rgba(59,158,255,.05);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-size:13px;font-weight:800;color:var(--a4);margin-bottom:6px;">${he(titulo)}</div>
          <div style="font-size:12px;color:var(--t2);line-height:1.5;">${he(cuerpo)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn bbl bsm" data-action="exportarDatos">📥 Hacer respaldo</button>
          <button class="btn bg bsm"  data-action="dismissBackupNudge" aria-label="Recordarme luego">Luego</button>
        </div>
      </div>
    </div>
  `;
}

export function dismissBackupNudge() {
  _backupNudgeDismissedThisSession = true;
  _renderBackupNudge();
}

// ─── REGISTRO DE ACCIONES ─────────────────────────────────────────────────────
registerAction('exportarDatos',       () => exportarDatos());
registerAction('importarDatos',       () => importarDatos());
registerAction('exportarCSV',         () => exportarCSV());
registerAction('descargarCSVDirecto', () => exportarCSV());
registerAction('generarReporteHTML',  () => generarReporteHTML());
registerAction('dismissBackupNudge',  () => dismissBackupNudge());

// ─── EXPOSICIÓN GLOBAL ───────────────────────────────────────────────────────
// exportarDatos, exportarCSV, descargarCSVDirecto → migrados a data-action
// Guard `typeof window` para soportar tests/SSR sin DOM.
if (typeof window !== 'undefined') {
  window.importarDatos       = importarDatos;     // input[type=file] handler
  window.generarReporteHTML  = generarReporteHTML; // llamado desde JS
  window.renderBackupNudge   = _renderBackupNudge; // llamado desde updateDash
  window.dismissBackupNudge  = dismissBackupNudge; // por si algún HTML viejo
}