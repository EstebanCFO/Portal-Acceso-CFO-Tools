import type { ImportacionRow } from '../types'

const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

/** "2026-06"     → "Junio 2026" */
export function fmtPeriodo(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  if (!y || !m) return periodo
  return `${MESES_ES[m - 1] ?? ''} ${y}`
}

/** "2026-06-09"  → "09/06/2026" */
export function fmtFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}

/** Label completo para combos de snapshot: "Junio 2026 — 09/06/2026" */
export function snapshotLabel(s: ImportacionRow): string {
  return `${fmtPeriodo(s.periodo)} — ${fmtFecha(s.fechaCarga)}`
}
