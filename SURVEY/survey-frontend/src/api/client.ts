/**
 * client.ts — wrappers tipados para todos los endpoints /api/*
 * El proxy Vite redirige /api → http://localhost:5055 en desarrollo.
 */

import type {
  SurveyListResponse,
  SurveyDetailResponse,
  SurveyAnalyticsResponse,
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

// ── Surveys ───────────────────────────────────────────────────────────────────
export const apiSurveys  = ()            => get<SurveyListResponse>('/api/surveys')
export const apiSurvey   = (id: string) => get<SurveyDetailResponse>(`/api/surveys/${encodeURIComponent(id)}`)
export const apiAnalytics = (id: string) => get<SurveyAnalyticsResponse>(`/api/surveys/${encodeURIComponent(id)}/analytics`)

// ── Shutdown (para portal postMessage) ───────────────────────────────────────
export const apiShutdown = () => post<{ ok: boolean }>('/api/shutdown')
