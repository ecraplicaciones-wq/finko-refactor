export const S = {};

export function resetAppState() {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, {
    tipoPeriodo:     'q1',
    quincena:        1,
    ingreso:         0,
    metodo:          '50-30-20',
    saldos:          { efectivo: 0, banco: 0 },
    cuentas:         [],
    gastos:          [],
    objetivos:       [],
    deudas:          [],
    modoDeuda:       'avalancha',
    historial:       [],
    gastosFijos:     [],
    pagosAgendados:  [],
    inversiones:     [],
    fondoEmergencia: { objetivoMeses: 6, actual: 0 },
    bolsillos:       [],
    logros:          { desbloqueados: [], vistos: [], rachas: {} }  // ✅ agregado
  });
}