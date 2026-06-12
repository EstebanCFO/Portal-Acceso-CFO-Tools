// ── Tipos compartidos — Bandas Salariales DC ─────────────────────────────────
// Mapean exactamente los modelos C# del backend (camelCase).

export interface ImportacionRow {
  id:             number
  periodo:        string
  fechaCarga:     string
  totalRegistros: number
  archivoFuente:  string
}

export interface DashboardKpis {
  periodo:    string
  fechaCarga: string
  total:      number
  ok:         number
  revisar:    number
  sinBanda:   number
  pctOk:      number
  pctRevisar: number
  pctSin:     number
  remAvg:     number | null
  remMax:     number | null
  remMin:     number | null
}

export interface BandaSalarial {
  cuil:         string
  apellidos:    string | null
  nombres:      string | null
  ceco:         string | null
  perfil:       string | null
  seniority:    string | null
  salarioBruto: number | null
  internet:     number | null
  factCash:     number | null
  remuneracion: number | null
  limInferior:  number | null
  limSuperior:  number | null
  estadoVsInf:  'OK' | 'REVISAR' | null
  estadoVsSup:  string | null
  varMonto:     string | null
  varPct:       string | null
  gerencia:     string | null
}

export interface EmpleadoHistorialRow {
  fechaCarga:   string | null
  periodo:      string | null
  perfil:       string | null
  seniority:    string | null
  ceco:         string | null
  remuneracion: number | null
  salarioBruto: number | null
  internet:     number | null
  factCash:     number | null
  limInferior:  number | null
  limSuperior:  number | null
  estadoVsInf:  'OK' | 'REVISAR' | null
  estadoVsSup:  string | null
  varMonto:     string | null
  varPct:       string | null
}

export interface EmpleadoDetalle {
  cuil:         string
  dni:          string | null
  apellidos:    string | null
  nombres:      string | null
  ceco:         string | null
  fechaIngreso: string | null
  perfil:       string | null
  seniority:    string | null
  historial:    EmpleadoHistorialRow[]
}

export interface EmpleadoBusqueda {
  cuil:      string
  apellidos: string | null
  nombres:   string | null
  perfil:    string | null
  seniority: string | null
}

export interface ComparativoRow {
  cuil:         string | null
  apellidos:    string | null
  nombres:      string | null
  perfil:       string | null
  seniority:    string | null
  remA:         number | null
  remB:         number | null
  estadoA:      'OK' | 'REVISAR' | null
  estadoB:      'OK' | 'REVISAR' | null
  varPctA:      string | null
  varPctB:      string | null
  movimiento:   'ingreso' | 'egreso' | 'continua'
  variacionPct: number | null
}

export interface UploadResult {
  status:  'ok' | 'ya_existia' | 'error'
  message: string
}
