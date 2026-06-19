import axios from 'axios'
import type {
  DashboardKpis, ImportacionRow, BandaSalarial,
  EmpleadoDetalle, EmpleadoBusqueda, ComparativoRow, UploadResult,
} from '../types'

// Prefijo unificado: funciona en dev (Vite proxy) y prod (gateway).
// El gateway mapea /api/bandas-salariales/{path} → :5050/api/{path}.
const api = axios.create({ baseURL: '/api/bandas-salariales' })

export const getDashboard    = ()       => api.get<DashboardKpis>('/dashboard')
export const getSnapshots    = ()       => api.get<ImportacionRow[]>('/snapshots')
export const getEmpleados    = (id: number) =>
  api.get<BandaSalarial[]>(`/snapshots/${id}/empleados`)
export const getEmpleado     = (cuil: string) =>
  api.get<EmpleadoDetalle>(`/empleados/${encodeURIComponent(cuil)}`)
export const buscarEmpleados = (q: string) =>
  api.get<EmpleadoBusqueda[]>('/empleados/buscar', { params: { q } })
export const getComparativo  = (a: number, b: number) =>
  api.get<ComparativoRow[]>('/empleados/comparativo', { params: { a, b } })
export const deleteSnapshot  = (id: number) =>
  api.delete<{ message: string }>(`/snapshots/${id}`)

export const uploadExcel = (file: File, solapa?: string, periodo?: string) => {
  const fd = new FormData()
  fd.append('excel', file)
  if (solapa)  fd.append('solapa',  solapa)
  if (periodo) fd.append('periodo', periodo)
  return api.post<UploadResult>('/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const pingBackend     = () => api.get<{ status: string }>('/health', { timeout: 3000 })
export const shutdownBackend = () =>
  api.post<{ message: string }>('/shutdown', {}, { timeout: 3000 })
