// client.ts — HTTP client para Proyectos Activos API
import type {
  Periodo, SemaforoGeneral, EjercicioEconomico, ProjectListItem, SemaforoReferencia,
  IngestResult,
} from '../types'

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function postFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  periodos:            ()                                    => get<Periodo[]>('/periodos'),
  semaforoReferencia:  ()                                    => get<SemaforoReferencia[]>('/semaforo/referencia'),
  semaforo:            (period: string, type: string)        => get<SemaforoGeneral>(`/semaforo?period=${period}&type=${type}`),
  proyectos:           ()                                    => get<ProjectListItem[]>('/proyectos'),
  ejercicio:           (projectId: number, period: string)   => get<EjercicioEconomico>(`/proyectos/${projectId}/ejercicio?period=${period}`),
  ingest:              (file: File)                          => postFile<IngestResult>('/ingest', file),
}
