/**
 * Helpers para el estado efectivo de bandas salariales.
 *
 * Regla de negocio:
 *   REVISAR + varPct '0%'  →  'OK'
 *   (diferencia negativa tan pequeña que redondea a cero — se exime del REVISAR)
 */

export function efectivoEstado(
  estado:  string | null | undefined,
  varPct:  string | null | undefined,
): string | null {
  if (estado === 'REVISAR' && varPct === '0%') return 'OK'
  return estado ?? null
}

/** True si el empleado está eximido de REVISAR por diferencia en 0% */
export function esEximidobyVarPct(
  estado: string | null | undefined,
  varPct: string | null | undefined,
): boolean {
  return estado === 'REVISAR' && varPct === '0%'
}
