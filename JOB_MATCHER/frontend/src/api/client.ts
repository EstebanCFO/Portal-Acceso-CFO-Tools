/**
 * client.ts — wrappers tipados para todos los endpoints del backend Node.js :5002
 * El Vite proxy redirige las rutas al backend: vite.config.ts
 */

import type { CandidateAnalysis, JDAnalysis, Template } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const r = await fetch(path, { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

// ── Health / Shutdown ─────────────────────────────────────────────────────────

export const apiHealth = (): Promise<{ status: string }> =>
  fetch('/api/health').then(r => r.json() as Promise<{ status: string }>)

export const apiShutdown = (): Promise<{ ok: boolean }> =>
  fetch('/api/shutdown', { method: 'POST' }).then(r => r.json() as Promise<{ ok: boolean }>)

// ── Upload ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  success:       boolean
  text:          string
  summary:       string
  candidateName: string
}

export async function apiUpload(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  return postForm<UploadResult>('/upload', form)
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export interface SummarizeResult {
  success: boolean
  summary: string
}

export function apiSummarize(
  text: string,
  type: 'project' | 'job' | 'propuesta',
): Promise<SummarizeResult> {
  return postJSON('/summarize', { text, type })
}

// ── Job Matcher: analizar candidato ───────────────────────────────────────────

export interface AnalyzeCandidateResult {
  success:  boolean
  analysis: string   // JSON en string — parsear con JSON.parse()
  error?:   string
}

export function apiAnalyzeCandidate(params: {
  candidateName: string
  candidateText: string
  jobText:        string
  projectText?:   string
}): Promise<AnalyzeCandidateResult> {
  return postJSON('/analyze', params)
}

// ── Job Matcher: ChatJob Q&A ──────────────────────────────────────────────────

export interface AskResult {
  success: boolean
  answer:  string
  error?:  string
}

export function apiAskQuestion(params: {
  question:        string
  analysisResult:  CandidateAnalysis | null
  projectContext?: string
  jobDescription?: string
}): Promise<AskResult> {
  return postJSON('/ask-question', params)
}

// ── JD Generator: analizar propuesta ─────────────────────────────────────────

export interface JDAnalyzeResult {
  success:  boolean
  analysis: JDAnalysis
  error?:   string
}

export async function apiJDAnalyze(file: File, contexto?: string): Promise<JDAnalyzeResult> {
  const form = new FormData()
  form.append('propuesta', file)
  if (contexto) form.append('contexto', contexto)
  return postForm<JDAnalyzeResult>('/api/analyze', form)
}

// ── JD Generator: generar DOCX ────────────────────────────────────────────────

export interface GenerateResult {
  blob:     Blob
  filename: string
}

export async function apiJDGenerate(params: {
  file:                   File
  cliente:                string
  rol:                    string
  tipo_perfil:            string
  seniority:              string
  contexto?:              string
  respuestas_refinamiento?: string
  template_id?:           string
}): Promise<GenerateResult> {
  const form = new FormData()
  form.append('propuesta',  params.file)
  form.append('cliente',    params.cliente)
  form.append('rol',        params.rol)
  form.append('tipo_perfil', params.tipo_perfil)
  form.append('seniority',  params.seniority)
  if (params.contexto)               form.append('contexto', params.contexto)
  if (params.respuestas_refinamiento) form.append('respuestas_refinamiento', params.respuestas_refinamiento)
  if (params.template_id)            form.append('template_id', params.template_id)

  const r = await fetch('/api/generate', { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${r.status}`)
  }
  const blob     = await r.blob()
  const cd       = r.headers.get('Content-Disposition') ?? ''
  const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? 'JD.docx'
  return { blob, filename }
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface TemplatesResult {
  templates: Template[]
}

export const apiGetTemplates = (): Promise<TemplatesResult> =>
  fetch('/api/templates').then(r => r.json() as Promise<TemplatesResult>)

export interface SaveTemplateResult {
  success:  boolean
  template: Template
}

export async function apiSaveTemplate(
  file:   File,
  nombre: string,
  perfil: string,
): Promise<SaveTemplateResult> {
  const form = new FormData()
  form.append('template', file)
  form.append('nombre',   nombre)
  form.append('perfil',   perfil)
  return postForm<SaveTemplateResult>('/api/templates', form)
}

export async function apiDeleteTemplate(id: string): Promise<{ success: boolean }> {
  const r = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json() as Promise<{ success: boolean }>
}
