// ─── CONSTANTES FINANCIERAS COLOMBIA ─────────────────────────────────────────
// Fuentes: DIAN, MinTrabajo, Superfinanciera. Revisar anualmente.
export const SMMLV_2026        = 1_750_905;   // Decreto 0159 - MinTrabajo
export const UVT_2026          = 52_374;      // Resolución DIAN 000238 dic-2025
export const TOPE_DIAN_UVT     = 1_400;       // Art. 594 E.T.
export const TOPE_DIAN         = TOPE_DIAN_UVT * UVT_2026; // $73.323.600
export const TASA_USURA_EA     = 24.36;       // Q1-2026 - Superfinanciera ⚠️ actualizar trimestral
export const GMF_TASA          = 0.004;       // 4x1000 = 0.4% - Art. 872 E.T.
export const GMF_EXENTO_UVT    = 350;         // Art. 879 E.T.
export const GMF_EXENTO_MONTO  = GMF_EXENTO_UVT * UVT_2026; // $18.330.900
export const SALUD_INDEPEND    = 0.125;       // 12.5% - Art. 204 Ley 100/1993
export const PENSION_INDEPEND  = 0.16;        // 16%   - Art. 18 Ley 100/1993
export const RETEFUENTE_CDT    = 0.04;        // 4%    - Art. 395 E.T. + Decreto 2418/2013
export const RETEFUENTE_AHORRO = 0.07;        // 7%    - Art. 395 E.T.

// Mapa inyectable en HTML via data-const="CLAVE"
export const CONST_MAP = {
  'RETEFUENTE_CDT_PCT':    (RETEFUENTE_CDT * 100).toFixed(0) + '%',
  'RETEFUENTE_AHORRO_PCT': (RETEFUENTE_AHORRO * 100).toFixed(0) + '%',
  'GMF_EXENTO_MONTO':      '$' + Math.round(GMF_EXENTO_MONTO).toLocaleString('es-CO'),
  'GMF_EXENTO_UVT':        GMF_EXENTO_UVT + ' UVT',
  'TASA_USURA_EA':         TASA_USURA_EA + '% E.A.',
  'TOPE_DIAN':             '$' + Math.round(TOPE_DIAN).toLocaleString('es-CO'),
  'SMMLV_2026':            '$' + Math.round(SMMLV_2026).toLocaleString('es-CO'),
  'UVT_2026':              '$' + Math.round(UVT_2026).toLocaleString('es-CO'),
};

// Vencimiento de constantes — actualizar VENCEN_EN cada año junto con los valores
const VENCEN_EN = '2026-12-31';
export function verificarVigenciaConstantes() {
  const dias = Math.ceil((new Date(VENCEN_EN) - new Date()) / 86400000);
  if (dias <= 60) {
    console.warn(`⚠️ Finko Pro: Las constantes financieras vencen en ${dias} día(s). Actualizar antes del ${VENCEN_EN}.`);
  }
}

export function inyectarConstantes() {
  document.querySelectorAll('[data-const]').forEach(el => {
    const key = el.getAttribute('data-const');
    if (CONST_MAP[key] !== undefined) el.textContent = CONST_MAP[key];
  });
}

// ─── CATÁLOGOS UI ────────────────────────────────────────────────────────────
export const CATS = {
  alimentacion: '🍽️ Alimentación', transporte: '🚌 Transporte',
  vivienda: '🏠 Vivienda',        servicios: '💡 Servicios',
  salud: '🏥 Salud',              entretenimiento: '🎬 Entretenimiento',
  ropa: '👕 Ropa',                tecnologia: '💻 Tecnología',
  hormiga: '🐜 Hormiga',          deudas: '💳 Deudas',
  ahorro: '💰 Ahorro',            otro: '📦 Otro'
};

export const PCATS = {
  comida: '🍽️ Comida', hotel: '🏨 Hotel', transporte: '🚌 Transporte',
  fiesta: '🎉 Fiesta', compras: '🛍️ Compras', entradas: '🎟️ Entradas', otro: '📦 Otro'
};

export const CCOLORS = {
  alimentacion: '#00dc82', transporte: '#3b9eff', vivienda: '#b44eff',
  servicios: '#ffd60a',   salud: '#ff6b35',       entretenimiento: '#ff4eb8',
  ropa: '#00e5cc',        tecnologia: '#4eb8ff',  hormiga: '#ff9944',
  deudas: '#ff4444',      ahorro: '#00dc82',       otro: '#666'
};

// ux_02: NAVS reducido de 9 a 7 — fusión Deudas+Agenda → compromisos,
// Metas+Apartado → alcancias. go() redirige los IDs viejos automáticamente.
export const NAVS = ['dash', 'quin', 'gast', 'compromisos', 'alcancias', 'inve', 'stat'];

export const BANCOS_CO = [
  { id: 'nequi',       nombre: 'Nequi',               icono: '📱', color: '#b44eff' },
  { id: 'daviplata',   nombre: 'Daviplata',            icono: '💳', color: '#ff4444' },
  { id: 'nu',          nombre: 'Nubank',               icono: '💜', color: '#820ad1' },
  { id: 'lulo',        nombre: 'Lulo Bank',            icono: '🍋', color: '#ccff00' },
  { id: 'bancolombia', nombre: 'Bancolombia',          icono: '🌻', color: '#ffd60a' },
  { id: 'davivienda',  nombre: 'Davivienda',           icono: '🏠', color: '#ff4444' },
  { id: 'bogota',      nombre: 'Banco de Bogotá',      icono: '🏛️', color: '#002855' },
  { id: 'avvillas',    nombre: 'AV Villas',            icono: '🏡', color: '#00478F' },
  { id: 'cajasocial',  nombre: 'Caja Social',          icono: '🤲', color: '#003B7A' },
  { id: 'bbva',        nombre: 'BBVA',                 icono: '🌊', color: '#072146' },
  { id: 'colpatria',   nombre: 'Colpatria',            icono: '🏢', color: '#df0024' },
  { id: 'popular',     nombre: 'Banco Popular',        icono: '🌿', color: '#00A859' },
  { id: 'occidente',   nombre: 'Banco de Occidente',   icono: '🌅', color: '#0062A5' },
  { id: 'confiar',     nombre: 'Confiar Coop.',        icono: '🛡️', color: '#e30421' },
  { id: 'jfk',         nombre: 'JFK Cooperativa',      icono: '✈️', color: '#f39200' },
  { id: 'cotrafa',     nombre: 'Cotrafa',              icono: '⚙️', color: '#0061a9' },
  { id: 'otro',        nombre: 'Otro banco',           icono: '🏦', color: '#888888' }
];