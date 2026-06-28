export type ResourceType = 'repo' | 'url' | 'local'
export type Platform = 'azure-devops' | 'github'
export type Normativa = 'wcag22' | 'onti' | 'bcra'

export interface RepoInput {
  platform: Platform
  org: string
  project: string
  repo: string
  branch: string
  pat: string
}

export interface UrlInput {
  url: string
  depth: 1 | 2
}

export interface LocalInput {
  files: File[]
  name: string
}

export interface AuditRequest {
  type: ResourceType
  normativas: Normativa[]
  repo?: RepoInput
  url?: UrlInput
  local?: LocalInput
}

export interface BreachCount {
  alta: number
  media: number
  baja: number
}

export interface AuditResponse {
  informe_md: string
  informe_json: string
  brechas_resumen: BreachCount
  blob_url_md: string
  blob_url_json: string
  nombre_app: string
  fecha: string
}

export interface HistoryEntry {
  nombre_app: string
  fecha: string
  version: string
  url_md: string
  url_json: string
  brechas: BreachCount
}

export type AuditStatus =
  | { phase: 'idle' }
  | { phase: 'loading'; step: string; stepIndex: number; totalSteps: number }
  | { phase: 'done'; result: AuditResponse }
  | { phase: 'error'; message: string }
