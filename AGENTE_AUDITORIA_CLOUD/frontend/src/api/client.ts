import type { AuditRequest, AuditResponse, HistoryEntry } from '../types/audit'

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
