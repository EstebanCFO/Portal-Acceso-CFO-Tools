import type { AuditRequest, AuditResponse, HistoryEntry } from '../types/audit'

export interface DeleteReportArgs {
  nombre_app: string
  fecha: string
  version: string
}

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function runAudit(request: AuditRequest): Promise<AuditResponse> {
  let body: FormData | string
  const headers: HeadersInit = {}

  if (request.type === 'local' && request.local) {
    const fd = new FormData()
    fd.append('type', 'local')
    fd.append('name', request.local.name)
    fd.append('normativas', JSON.stringify(request.normativas))
    for (const file of request.local.files) {
      fd.append('files', file)
    }
    body = fd
    // No Content-Type header — fetch lo setea solo con boundary para FormData
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(request)
  }

  const res = await fetch(`${API_BASE}/audit`, { method: 'POST', headers, body })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }

  return res.json() as Promise<AuditResponse>
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(`${API_BASE}/history`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<HistoryEntry[]>
}

/** Borra un informe del historial (md + json + pdf). */
export async function deleteReport(args: DeleteReportArgs): Promise<void> {
  const qs = new URLSearchParams({
    nombre_app: args.nombre_app,
    fecha: args.fecha,
    version: args.version,
  })
  const res = await fetch(`${API_BASE}/report?${qs}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

/**
 * Baja el stack local (Vite + Azurite + backend). Solo dev.
 * El backend se apaga a sí mismo, así que la conexión puede cortarse: lo
 * tratamos como éxito (resuelve igual).
 */
export async function shutdownServices(): Promise<void> {
  try {
    await fetch(`${API_BASE}/shutdown`, { method: 'POST' })
  } catch {
    // El backend cerró el puerto antes de responder — esperado al apagarse.
  }
}
