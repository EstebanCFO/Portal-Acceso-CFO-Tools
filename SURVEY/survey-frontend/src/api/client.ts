/**
 * client.ts — wrappers tipados para todos los endpoints /api/*
 * El proxy Vite redirige /api → http://localhost:5055 en desarrollo.
 */

import type {
  SurveyListResponse,
  SurveyDetailResponse,
  SurveyAnalyticsResponse,
  SurveyForYearResponse,
  SurveyReportResponse,
} from '../types'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const msg  = (body as { error?: string }).error ?? `HTTP ${r.status}`
    throw new Error(msg)
  }
  return r.json() as Promise<T>
}

async function post<T>(path: string): Promise<T> {
  const r = await fetch(path, { method: 'POST' })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`)
  return r.json() as Promise<T>
}

// ── Health ────────────────────────────────────────────────────────────────────
export const apiHealth = () => get<{ ok: boolean }>('/api/health')

// ── Surveys (listado general — mantener para compatibilidad) ──────────────────
export const apiSurveys   = ()            => get<SurveyListResponse>('/api/surveys')
export const apiSurvey    = (id: string)  => get<SurveyDetailResponse>(`/api/surveys/${encodeURIComponent(id)}`)
export const apiAnalytics = (id: string)  => get<SurveyAnalyticsResponse>(`/api/surveys/${encodeURIComponent(id)}/analytics`)

// ── AÑO + ENCUESTA dropdown ───────────────────────────────────────────────────
// Años desde appsettings.json (SurveyMonkey:Years)
export const apiYears = () =>
  get<number[]>('/api/surveys/years')

// Encuestas OPEN con actividad en el año seleccionado
export const apiSurveysForYear = (year: number) =>
  get<SurveyForYearResponse>(`/api/surveys/for-year?year=${year}`)

// ── Reporte de una encuesta: collectors + enviados/respondidos/pendientes ──────
export const apiSurveyReport = (id: string) =>
  get<SurveyReportResponse>(`/api/surveys/${encodeURIComponent(id)}/report`)

// ── Shutdown (para portal postMessage) ───────────────────────────────────────
export const apiShutdown = () => post<{ ok: boolean }>('/api/shutdown')
