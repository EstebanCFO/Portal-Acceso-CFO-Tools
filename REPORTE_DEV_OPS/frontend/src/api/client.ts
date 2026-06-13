/**
 * client.ts — wrappers tipados para todos los endpoints /api/*
 * El Vite proxy redirige /api → http://localhost:5000 en desarrollo.
 */

import type {
  Org, Proyecto, ProyectoInfo, ProyectoDetalle,
  TestPlan, PdfFile, LogFile, GeneracionEstado,
  SprintsResult,
} from '../types'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`)
  return r.json() as Promise<T>
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`)
  return r.json() as Promise<T>
}

// ── Health ───────────────────────────────────────────────
export const apiHealth = () => get<{ ok: boolean }>('/api/health')

// ── Generación ───────────────────────────────────────────
export const apiGenerar   = () => post<{ ok: boolean; mensaje: string }>('/api/generar')
export const apiEstado    = () => get<GeneracionEstado>('/api/estado')

// ── Organizaciones ───────────────────────────────────────
// Consulta Azure DevOps en el backend (perfil → cuentas del PAT).
// Fallback a AZURE_DEVOPS_ORGS/.env si la API no responde.
export const apiOrgs = () => get<Org[]>('/api/organizaciones')

// ── Proyectos ────────────────────────────────────────────
export const apiProyectos    = (org: string) => get<Proyecto[]>(`/api/proyectos/${encodeURIComponent(org)}`)
export const apiProyectoInfo = (org: string, proyecto: string) =>
  get<ProyectoInfo>(`/api/proyecto_info/${encodeURIComponent(org)}/${encodeURIComponent(proyecto)}`)
export const apiProyectoDetalle = (org: string, proyecto: string) =>
  get<ProyectoDetalle>(`/api/proyecto/${encodeURIComponent(org)}/${encodeURIComponent(proyecto)}`)

// ── Test Plans ───────────────────────────────────────────
export const apiTestPlans = (org: string, proyecto: string) =>
  get<TestPlan[]>(`/api/testplans/${encodeURIComponent(org)}/${encodeURIComponent(proyecto)}`)

// ── Sprints (current + anterior + futuros) ────────────────
// Query params en lugar de path segments para evitar 404 con nombres
// que tienen tildes u otros caracteres no-ASCII (ej: "Migración SUF a SICOT")
export const apiSprints = (org: string, proyecto: string) =>
  get<SprintsResult>(`/api/sprints?org=${encodeURIComponent(org)}&project=${encodeURIComponent(proyecto)}`)

// ── Historial & Logs ─────────────────────────────────────
export const apiHistorial = () => get<PdfFile[]>('/api/historial')
export const apiLogs      = () => get<LogFile[]>('/api/logs')
export const apiLogContenido = (nombre: string) =>
  get<{ nombre: string; contenido: string }>(`/api/logs/${encodeURIComponent(nombre)}`)

// ── Descarga PDF ─────────────────────────────────────────
export const urlDescarga = (nombre: string) => `/api/descargar/${encodeURIComponent(nombre)}`

// ── Salir ────────────────────────────────────────────────
export const apiSalir = () => post<{ ok: boolean }>('/api/salir')
