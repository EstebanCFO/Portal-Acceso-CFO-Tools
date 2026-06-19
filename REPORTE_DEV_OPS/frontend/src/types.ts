// ── Organizaciones ────────────────────────────────────────
export interface Org {
  nombre: string
  url: string
}

// ── Proyectos ─────────────────────────────────────────────
export interface Proyecto {
  id: string
  nombre: string
  estado: string
}

export interface ProyectoInfo {
  total_sprints: number
  fecha_inicio: string
  fecha_fin: string
  headcount: number
  miembros: string[]
}

// ── Desvíos ───────────────────────────────────────────────
export interface Desvio {
  nombre: string
  inicio: string
  fin_planeado: string
  estado: string
  desvio_dias: number
  alerta: 'OK' | 'DESVIO' | 'RIESGO'
}

// ── Métricas ──────────────────────────────────────────────
export interface Metricas {
  total: number
  epicas: number
  user_stories: number
  estados: Record<string, number>
  tipos: Record<string, number>
  sp_total: number
  sp_done: number
  avance_pct: number
  items_done: number
  horas_comp: number
  horas_rest: number
}

export interface ProyectoDetalle {
  proyecto: string
  organizacion: string
  metricas: Metricas
  desvios: Desvio[]
  sprints_con_desvio: number
}

// ── Test Plans ────────────────────────────────────────────
export interface TestSuite {
  id: number
  nombre: string
  casos: number
}

export interface TestRun {
  id: number
  nombre: string
  estado: string
  total: number
  pasados: number
  fallidos: number
}

export interface TestPlanResumen {
  total_suites: number
  total_casos: number
  total_runs: number
  total_ejecutados: number
  pasados: number
  fallidos: number
}

export interface TestPlan {
  id: number
  nombre: string
  estado: string
  suites: TestSuite[]
  runs: TestRun[]
  resumen: TestPlanResumen
}

// ── Sprints ────────────────────────────────────────────────
export interface WorkItemsResumen {
  total: number
  abiertas: number
  cerradas: number
  estados: Record<string, number>
}

export interface TestPlanProgress {
  encontrado: boolean
  planNombre: string
  totalPlanes: number
  total: number
  corridos: number
  pasados: number
  pctCorridos: number
  pctPass: number
}

export interface SprintData {
  nombre: string
  path: string
  inicio: string
  fin: string
  workitems: WorkItemsResumen
  testplan: TestPlanProgress
}

export interface SprintFuturo {
  nombre: string
  inicio: string
  fin: string
}

export interface SprintsResult {
  current:  SprintData | null
  anterior: SprintData | null
  futuros:  SprintFuturo[]
}

// ── Historial PDF ─────────────────────────────────────────
export interface PdfFile {
  nombre: string
  fecha: string
  size: string
}

// ── Logs ──────────────────────────────────────────────────
export interface LogFile {
  nombre: string
  fecha: string
  size: string
}

// ── Estado de generación ──────────────────────────────────
export interface GeneracionEstado {
  corriendo: boolean
  ultimo_estado: 'idle' | 'corriendo' | 'ok' | 'error'
  ultimo_mensaje: string
  ultimo_pdf: string
  ultima_ejecucion: string
  ultimo_log: string
}

// ── Filtros por año (nuevos endpoints) ────────────────────
/** Proyecto filtrado por año de primer sprint */
export interface ProjectForYear {
  nombre: string
  id: string
}

// ── Sprint report con work items completos ────────────────
/** Task o Bug con campos completos */
export interface WorkItem {
  id: number
  title: string
  state: string
  type: string        // 'Task' | 'Bug'
  assignedTo: string
}

/** Datos completos de un sprint (actual o anterior) */
export interface SprintDetail {
  name:       string
  startDate:  string | null
  finishDate: string | null
  items:      WorkItem[]
  testplan:   TestPlanProgress
}

/** Respuesta de GET /api/sprint-report */
export interface SprintReportResult {
  firstSprintDate: string | null
  current:         SprintDetail | null
  anterior:        SprintDetail | null
}
