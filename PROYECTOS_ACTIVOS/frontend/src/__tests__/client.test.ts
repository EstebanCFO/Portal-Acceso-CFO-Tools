/**
 * client.test.ts — Proyectos Activos
 *
 * Verifica que el cliente API:
 *   1. Exporta todas las funciones del objeto `api`
 *   2. Construye las URLs correctas con el prefijo del gateway (/api/proyectos-activos/api)
 *   3. api.ingest usa POST con FormData
 *   4. Maneja errores HTTP lanzando Error con "HTTP NNN"
 *
 * Nota de prefijo: Vitest carga el .env del frontend →
 *   VITE_API_URL = '/api/proyectos-activos'
 *   API_BASE     = '/api/proyectos-activos/api'
 * Esto replica exactamente el comportamiento en producción vía gateway.
 * El gateway proxy: /api/proyectos-activos/api/* → backend :5010/api/*
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockOk = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const mockErr = (status: number, body: Record<string, unknown> = {}) =>
  new Response(JSON.stringify(body), { status })

const fakeFile = (name = 'Proyectos Activos 2026.xlsx') =>
  new File(['dummy content'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

// ── Exports ───────────────────────────────────────────────────────────────────

describe('api — exports', () => {
  it('api.periodos es función',           () => expect(typeof api.periodos).toBe('function'))
  it('api.semaforoReferencia es función', () => expect(typeof api.semaforoReferencia).toBe('function'))
  it('api.semaforo es función',           () => expect(typeof api.semaforo).toBe('function'))
  it('api.proyectos es función',          () => expect(typeof api.proyectos).toBe('function'))
  it('api.ejercicio es función',          () => expect(typeof api.ejercicio).toBe('function'))
  it('api.ingest es función',             () => expect(typeof api.ingest).toBe('function'))
})

// ── api.periodos ──────────────────────────────────────────────────────────────

describe('api.periodos — GET /api/periodos', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a GET /api/proyectos-activos/api/periodos', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk([]))
    await api.periodos()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/proyectos-activos/api/periodos')
  })

  it('devuelve un array (puede ser vacío)', async () => {
    const data = [
      { period_date: '2026-06-01', label: 'Jun 2026' },
      { period_date: '2026-05-01', label: 'May 2026' },
    ]
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(data))
    const result = await api.periodos()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('Jun 2026')
  })

  it('lanza Error "HTTP 503" cuando el backend no está disponible', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(503))
    await expect(api.periodos()).rejects.toThrow('HTTP 503')
  })
})

// ── api.semaforo ──────────────────────────────────────────────────────────────

describe('api.semaforo — GET /api/semaforo con query params', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('construye la URL con period y type=ACUMULADO', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ period_date: '2026-06-01', semaforo_type: 'ACUMULADO', proyectos: [], dc_metrics: null, referencia: [] })
    )
    await api.semaforo('2026-06-01', 'ACUMULADO')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/proyectos-activos/api/semaforo?period=2026-06-01&type=ACUMULADO')
  })

  it('construye la URL con type=MENSUAL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ period_date: '2026-06-01', semaforo_type: 'MENSUAL', proyectos: [], dc_metrics: null, referencia: [] })
    )
    await api.semaforo('2026-06-01', 'MENSUAL')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('type=MENSUAL')
  })

  it('incluye el período en la URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ period_date: '2026-05-01', semaforo_type: 'ACUMULADO', proyectos: [], dc_metrics: null, referencia: [] })
    )
    await api.semaforo('2026-05-01', 'ACUMULADO')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('period=2026-05-01')
  })

  it('lanza Error "HTTP 404" cuando no hay datos para ese período', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(404, { detail: 'No hay datos cargados aún.' }))
    await expect(api.semaforo('2026-01-01', 'ACUMULADO')).rejects.toThrow('HTTP 404')
  })

  it('lanza Error "HTTP 422" cuando el período tiene formato inválido', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(422, { detail: 'Período inválido' }))
    await expect(api.semaforo('no-es-fecha', 'ACUMULADO')).rejects.toThrow('HTTP 422')
  })
})

// ── api.semaforoReferencia ────────────────────────────────────────────────────

describe('api.semaforoReferencia — GET /api/semaforo/referencia', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a GET /api/proyectos-activos/api/semaforo/referencia', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk([]))
    await api.semaforoReferencia()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/proyectos-activos/api/semaforo/referencia')
  })

  it('devuelve array con umbrales de color', async () => {
    const data = [
      { color_label: 'ROJO', color_hex: '#E53E3E', threshold_min: 0, threshold_max: 0.0499, description: 'Hasta 4.99%', sort_order: 1 },
      { color_label: 'VERDE_FUERTE', color_hex: '#276749', threshold_min: 0.31, threshold_max: null, description: '≥ 31%', sort_order: 5 },
    ]
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(data))
    const result = await api.semaforoReferencia()
    expect(result).toHaveLength(2)
    expect(result[0].color_label).toBe('ROJO')
    expect(result[1].color_hex).toBe('#276749')
  })
})

// ── api.proyectos ─────────────────────────────────────────────────────────────

describe('api.proyectos — GET /api/proyectos', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a GET /api/proyectos-activos/api/proyectos', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk([]))
    await api.proyectos()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/proyectos-activos/api/proyectos')
  })

  it('devuelve lista de proyectos', async () => {
    const data = [
      { id: 1, name: 'IRSA VENTAS', sheet_name: 'IRSA VENTAS REAL', tipo: 'Proy', is_active: true, client_name: 'IRSA' },
    ]
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(data))
    const result = await api.proyectos()
    expect(result[0].name).toBe('IRSA VENTAS')
    expect(result[0].client_name).toBe('IRSA')
  })
})

// ── api.ejercicio ─────────────────────────────────────────────────────────────

describe('api.ejercicio — GET /api/proyectos/:id/ejercicio', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('construye la URL con project_id y period', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({
      project_id: 1, project_name: 'IRSA VENTAS', client_name: 'IRSA',
      sheet_name: 'IRSA VENTAS REAL', tipo: 'Proy', period_date: '2026-06-01',
      recursos: [], financials: null, history: [],
      total_recursos: 0, total_horas: 0, costo_total_recursos: 0,
    }))
    await api.ejercicio(1, '2026-06-01')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/proyectos-activos/api/proyectos/1/ejercicio?period=2026-06-01')
  })

  it('usa el project_id correcto en la URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({
      project_id: 42, project_name: 'CLARO VENTAS', client_name: 'CLARO',
      sheet_name: 'CLARO VENTAS REAL', tipo: 'Proy', period_date: '2026-06-01',
      recursos: [], financials: null, history: [],
      total_recursos: 0, total_horas: 0, costo_total_recursos: 0,
    }))
    await api.ejercicio(42, '2026-06-01')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('/api/proyectos/42/ejercicio')
  })

  it('lanza Error "HTTP 404" cuando el proyecto no existe', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(404, { detail: 'Proyecto 999 no encontrado.' }))
    await expect(api.ejercicio(999, '2026-06-01')).rejects.toThrow('HTTP 404')
  })

  it('lanza Error "HTTP 500" en error genérico del backend', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(500))
    await expect(api.ejercicio(1, '2026-06-01')).rejects.toThrow('HTTP 500')
  })
})

// ── api.ingest ────────────────────────────────────────────────────────────────

describe('api.ingest — POST /api/ingest con FormData', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a POST /api/proyectos-activos/api/ingest', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ ok: true, period: '2026-06-01', solapas_real: 15, recursos_total: 120,
               semaforo_acumulado: 18, semaforo_mensual: 18, semaforo_matched: 15,
               semaforo_unmatched: 3, unmatched_names: ['PELLEGRINI', 'COOP.', 'UNILEVER'] })
    )
    await api.ingest(fakeFile())
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/proyectos-activos/api/ingest')
    expect((init as RequestInit).method).toBe('POST')
  })

  it('envía el archivo como FormData con campo "file"', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ ok: true, period: '2026-06-01', solapas_real: 15, recursos_total: 120,
               semaforo_acumulado: 18, semaforo_mensual: 18, semaforo_matched: 15,
               semaforo_unmatched: 0, unmatched_names: [] })
    )
    const file = fakeFile('Proyectos Activos 2026.xlsx')
    await api.ingest(file)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    const body = (init as RequestInit).body
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect(form.get('file')).toBeInstanceOf(File)
    expect((form.get('file') as File).name).toBe('Proyectos Activos 2026.xlsx')
  })

  it('devuelve el IngestResult con las estadísticas del ETL', async () => {
    const expected = {
      ok: true,
      period: '2026-06-01',
      solapas_real: 15,
      recursos_total: 120,
      semaforo_acumulado: 18,
      semaforo_mensual: 18,
      semaforo_matched: 15,
      semaforo_unmatched: 3,
      unmatched_names: ['PELLEGRINI', 'COOPERATIVA EDUCACIONAL', 'UNILEVER'],
    }
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(expected))
    const result = await api.ingest(fakeFile())
    expect(result.ok).toBe(true)
    expect(result.solapas_real).toBe(15)
    expect(result.semaforo_matched).toBe(15)
    expect(result.unmatched_names).toHaveLength(3)
    expect(result.unmatched_names).toContain('PELLEGRINI')
  })

  it('lanza Error "HTTP 422" si el archivo no es .xlsx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErr(422, { detail: 'Solo se aceptan archivos .xlsx' })
    )
    await expect(api.ingest(fakeFile('datos.csv'))).rejects.toThrow('HTTP 422')
  })

  it('lanza Error "HTTP 500" si el ETL falla (Excel malformado)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErr(500, { detail: 'Error en ETL: no se encontró la solapa SEMAFORO GENERAL' })
    )
    await expect(api.ingest(fakeFile('corrupto.xlsx'))).rejects.toThrow('HTTP 500')
  })
})

// ── Prefijo /api en todos los endpoints ───────────────────────────────────────

describe('todos los endpoints usan el prefijo /api/proyectos-activos/api', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('api.periodos empieza con /api/proyectos-activos/api/', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk([]))
    await api.periodos()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/proyectos-activos\/api\//)
  })

  it('api.semaforo empieza con /api/proyectos-activos/api/', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ period_date: '2026-06-01', semaforo_type: 'ACUMULADO', proyectos: [], dc_metrics: null, referencia: [] })
    )
    await api.semaforo('2026-06-01', 'ACUMULADO')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/proyectos-activos\/api\//)
  })

  it('api.ejercicio empieza con /api/proyectos-activos/api/', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({
      project_id: 1, project_name: 'test', client_name: 'test',
      sheet_name: 'test', tipo: 'Proy', period_date: '2026-06-01',
      recursos: [], financials: null, history: [],
      total_recursos: 0, total_horas: 0, costo_total_recursos: 0,
    }))
    await api.ejercicio(1, '2026-06-01')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/proyectos-activos\/api\//)
  })

  it('api.ingest empieza con /api/proyectos-activos/api/', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ ok: true, period: null, solapas_real: 0, recursos_total: 0,
               semaforo_acumulado: 0, semaforo_mensual: 0, semaforo_matched: 0,
               semaforo_unmatched: 0, unmatched_names: [] })
    )
    await api.ingest(fakeFile())
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/proyectos-activos\/api\//)
  })
})
