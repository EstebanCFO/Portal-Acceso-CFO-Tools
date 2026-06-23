/**
 * client.ts — wrappers tipados para todos los endpoints /api/*
 *
 * Prefijo unificado: funciona tanto en dev (Vite proxea /api/reporte-devops → :5000)
 * como en producción (gateway sirve /api/reporte-devops/* inline).
 */

import type {
  Org, Proyecto, ProyectoInfo, ProyectoDetalle,
  TestPlan, PdfFile, LogFile, GeneracionEstado,
  SprintsResult, ProjectForYear, SprintReportResult, FullReportEntry,
  OrgHabilitada,
} from '../types'

const BASE = '/api/reporte-devops'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`)
  return r.json() as Promise<T>
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`)
  return r.json() as Promise<T>
}

// ── Health ───────────────────────────────────────────────
export const apiHealth = () => get<{ ok: boolean }>('/health')

// ── Generación ───────────────────────────────────────────
export const apiGenerar   = () => post<{ ok: boolean; mensaje: string }>('/generar')
export const apiEstado    = () => get<GeneracionEstado>('/estado')

// ── Organizaciones ───────────────────────────────────────
export const apiOrgs = () => get<Org[]>('/organizaciones')

/** Solo las orgs marcadas como "activa" en la DB local (sin llamada Azure) */
export const apiOrgsActivas = () => get<Org[]>('/organizaciones-activas')

// ── Proyectos ────────────────────────────────────────────
export const apiProyectos    = (org: string) => get<Proyecto[]>(`/proyectos/${encodeURIComponent(org)}`)
export const apiProyectoInfo = (org: string, proyecto: string) =>
  get<ProyectoInfo>(`/proyecto_info/${encodeURIComponent(org)}/${encodeURIComponent(proyecto)}`)
export const apiProyectoDetalle = (org: string, proyecto: string) =>
  get<ProyectoDetalle>(`/proyecto/${encodeURIComponent(org)}/${encodeURIComponent(proyecto)}`)

// ── Test Plans ───────────────────────────────────────────
export const apiTestPlans = (org: string, proyecto: string) =>
  get<TestPlan[]>(`/testplans/${encodeURIComponent(org)}/${encodeURIComponent(proyecto)}`)

// ── Sprints ──────────────────────────────────────────────
export const apiSprints = (org: string, proyecto: string) =>
  get<SprintsResult>(`/sprints?org=${encodeURIComponent(org)}&project=${encodeURIComponent(proyecto)}`)

// ── Historial & Logs ─────────────────────────────────────
export const apiHistorial = () => get<PdfFile[]>('/historial')
export const apiLogs      = () => get<LogFile[]>('/logs')
export const apiLogContenido = (nombre: string) =>
  get<{ nombre: string; contenido: string }>(`/logs/${encodeURIComponent(nombre)}`)

// ── Descarga PDF ─────────────────────────────────────────
export const urlDescarga = (nombre: string) => `${BASE}/descargar/${encodeURIComponent(nombre)}`

// ── Salir ────────────────────────────────────────────────
export const apiSalir = () => post<{ ok: boolean }>('/salir')

// ── Filtros por año (nuevos endpoints) ───────────────────
/** Orgs que tienen ≥ 1 proyecto con primer sprint en el año dado */
export const apiOrgsForYear = (year: number) =>
  get<Org[]>(`/orgs-for-year/${year}`)

/** Proyectos de una org cuyo primer sprint tiene startDate en el año dado */
export const apiProjectsForYear = (org: string, year: number) =>
  get<ProjectForYear[]>(
    `/projects-for-year/${encodeURIComponent(org)}/${year}`,
  )

/** Sprint actual + anterior con work items detallados */
export const apiSprintReport = (org: string, project: string) =>
  get<SprintReportResult>(
    `/sprint-report?org=${encodeURIComponent(org)}&project=${encodeURIComponent(project)}`,
  )

/** Consulta Full: sprint actual + anterior para los 9 clientes del MAPEO_FULL */
export const apiFullReport = (year: number) =>
  get<FullReportEntry[]>(`/full-report?year=${year}`)

// ── Organizaciones Habilitadas ─────────────────────────────────
/** Orgs de Azure + su estado (activa/inactiva) desde DB local */
export const apiOrgsHabilitadas = () =>
  get<OrgHabilitada[]>('/organizaciones-habilitadas')

/** Guarda el estado de cada org en la DB local */
export const apiGuardarOrgsHabilitadas = (
  orgs: Array<{ nombre: string; estado: string }>,
) => post<{ ok: boolean; guardadas: number }>('/organizaciones-habilitadas', orgs)
