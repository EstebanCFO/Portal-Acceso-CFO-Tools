/**
 * client.ts — wrappers tipados para todos los endpoints /api/*
 *
 * Prefijo unificado: /api/survey
 * El gateway mapea /api/survey/{path} → localhost:5055/api/{path}.
 * Dev (Vite proxy): /api/survey → rewrite → :5055/api
 */

import type {
  SurveyListResponse,
  SurveyDetailResponse,
  SurveyAnalyticsResponse,
  SurveyForYearResponse,
  SurveyReportResponse,
} from '../types'

const BASE = '/api/survey'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const msg  = (body as { error?: string }).error ?? `HTTP ${r.status}`
    throw new Error(msg)
  }
  return r.json() as Promise<T>
}

async function post<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { method: 'POST' })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`)
  return r.json() as Promise<T>
}

// ── Health ────────────────────────────────────────────────────────────────────
export const apiHealth = () => get<{ ok: boolean }>('/health')

// ── Surveys ───────────────────────────────────────────────────────────────────
export const apiSurveys   = ()            => get<SurveyListResponse>('/surveys')
export const apiSurvey    = (id: string)  => get<SurveyDetailResponse>(`/surveys/${encodeURIComponent(id)}`)
export const apiAnalytics = (id: string)  => get<SurveyAnalyticsResponse>(`/surveys/${encodeURIComponent(id)}/analytics`)

// ── AÑO + ENCUESTA dropdown ───────────────────────────────────────────────────
export const apiYears = () =>
  get<number[]>('/surveys/years')

export const apiSurveysForYear = (year: number) =>
  get<SurveyForYearResponse>(`/surveys/for-year?year=${year}`)

// ── Reporte ───────────────────────────────────────────────────────────────────
export const apiSurveyReport = (id: string) =>
  get<SurveyReportResponse>(`/surveys/${encodeURIComponent(id)}/report`)

// ── Shutdown ──────────────────────────────────────────────────────────────────
export const apiShutdown = () => post<{ ok: boolean }>('/shutdown')
