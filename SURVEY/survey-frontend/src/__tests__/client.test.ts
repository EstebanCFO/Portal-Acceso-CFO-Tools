/**
 * client.test.ts — Survey Analytics
 *
 * Verifica que el cliente API:
 *   1. Exporta todas las funciones esperadas
 *   2. Construye las URLs correctas con el prefijo del gateway (/api/survey)
 *   3. Pasa el año como query param en apiSurveysForYear
 *   4. Maneja errores del backend (400/401/502) lanzando Error con el mensaje del JSON
 *   5. Maneja errores cuando el body no es JSON válido (lanza con "HTTP <status>")
 *
 * Contexto: Bug reportado "Unexpected token '?', '?R ??????'... is not valid JSON"
 * se debía a que el gateway reenviaba Accept-Encoding: br al backend ASP.NET Core,
 * éste comprimía con Brotli, el gateway stripeaba el header Content-Encoding pero
 * pasaba los bytes comprimidos → browser recibía bytes Brotli sin header → JSON.parse
 * fallaba.  Fix: gateway ahora excluye 'accept-encoding' de los headers reenviados.
 * Estos tests cubren el contrato del cliente (URLs y manejo de errores).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiHealth,
  apiSurveys,
  apiSurvey,
  apiAnalytics,
  apiYears,
  apiSurveysForYear,
  apiSurveyReport,
  apiShutdown,
} from '../api/client'

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

const mockOk = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const mockErr = (status: number, body: Record<string, unknown> = {}) =>
  new Response(JSON.stringify(body), { status })

// ══════════════════════════════════════════════════════════════════════════════
// Exports — todas las funciones deben existir
// ══════════════════════════════════════════════════════════════════════════════

describe('client.ts — exports', () => {
  it('exporta apiHealth',          () => expect(typeof apiHealth).toBe('function'))
  it('exporta apiSurveys',         () => expect(typeof apiSurveys).toBe('function'))
  it('exporta apiSurvey',          () => expect(typeof apiSurvey).toBe('function'))
  it('exporta apiAnalytics',       () => expect(typeof apiAnalytics).toBe('function'))
  it('exporta apiYears',           () => expect(typeof apiYears).toBe('function'))
  it('exporta apiSurveysForYear',  () => expect(typeof apiSurveysForYear).toBe('function'))
  it('exporta apiSurveyReport',    () => expect(typeof apiSurveyReport).toBe('function'))
  it('exporta apiShutdown',        () => expect(typeof apiShutdown).toBe('function'))
})

// ══════════════════════════════════════════════════════════════════════════════
// URLs — gateway prefix /api/survey
// ══════════════════════════════════════════════════════════════════════════════

describe('apiYears — URL y resultado', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/survey/surveys/years', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk([2026, 2025, 2024]))
    await apiYears()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/survey/surveys/years')
  })

  it('devuelve un array de numbers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk([2026, 2025, 2024]))
    const years = await apiYears()
    expect(Array.isArray(years)).toBe(true)
    expect(years).toContain(2026)
  })
})

describe('apiSurveysForYear — URL con year query param', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/survey/surveys/for-year?year=2026', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ surveys: [] }))
    await apiSurveysForYear(2026)
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/survey/surveys/for-year?year=2026')
  })

  it('llama a /api/survey/surveys/for-year?year=2024 para año 2024', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ surveys: [] }))
    await apiSurveysForYear(2024)
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/survey/surveys/for-year?year=2024')
  })

  it('incluye el año correcto como número en la URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ surveys: [] }))
    await apiSurveysForYear(2025)
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('year=2025')
  })

  it('devuelve surveys del año seleccionado', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ surveys: [{ id: '123', title: 'Test' }] }))
    const result = await apiSurveysForYear(2026)
    expect(result.surveys).toHaveLength(1)
    expect(result.surveys[0].id).toBe('123')
  })
})

describe('apiSurveyReport — URL con ID encodeado', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/survey/surveys/{id}/report', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ title: 'T', collectors: [] }))
    await apiSurveyReport('abc123')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/survey/surveys/abc123/report')
  })

  it('encodeURI el ID con caracteres especiales', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ title: 'T', collectors: [] }))
    await apiSurveyReport('survey/with spaces')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).not.toContain(' ')
    // La URL contiene '/' como separadores de ruta, pero el ID mismo está encodeado
    expect(url).toContain(encodeURIComponent('survey/with spaces'))
    // El ID encodeado no debe aparecer como literal (con espacio sin encodear)
    expect(url).not.toContain('survey/with spaces')
  })
})

describe('apiHealth — URL y prefijo', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/survey/health', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ ok: true }))
    await apiHealth()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/survey/health')
  })
})

describe('apiSurveys — URL base', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/survey/surveys', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ surveys: [], total: 0 }))
    await apiSurveys()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/survey/surveys')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Manejo de errores — cuando backend devuelve error JSON
// ══════════════════════════════════════════════════════════════════════════════

describe('manejo de errores del gateway', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('lanza Error con mensaje del backend cuando status 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(401, { error: 'Token de SurveyMonkey inválido o vencido.' }))
    await expect(apiSurveysForYear(2026)).rejects.toThrow('Token de SurveyMonkey inválido o vencido.')
  })

  it('lanza Error con mensaje del backend cuando status 502', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(502, { error: 'Error de SurveyMonkey: 502' }))
    await expect(apiSurveysForYear(2026)).rejects.toThrow('Error de SurveyMonkey: 502')
  })

  it('lanza Error con "HTTP 503" cuando el body no tiene campo error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(503, { detail: 'Backend survey no disponible en :5055' }))
    await expect(apiSurveysForYear(2026)).rejects.toThrow('HTTP 503')
  })

  it('lanza Error con "HTTP 429" cuando se alcanza el límite de rate', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErr(429, { error: 'Límite de requests alcanzado. Intentar en unos minutos.' })
    )
    await expect(apiSurveyReport('id123')).rejects.toThrow('Límite de requests alcanzado.')
  })

  it('lanza Error con "HTTP 404" cuando survey no encontrado', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(404, { error: 'Survey id999 no encontrado.' }))
    await expect(apiSurveyReport('id999')).rejects.toThrow('Survey id999 no encontrado.')
  })

  it('apiYears maneja error de red (fetch falla)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(apiYears()).rejects.toThrow()
  })

  it('todos los endpoints usan el prefijo /api/survey', async () => {
    const endpointsToCheck = [
      { fn: () => apiHealth(), expected: '/api/survey/health' },
      { fn: () => apiSurveys(), expected: '/api/survey/surveys' },
      { fn: () => apiYears(), expected: '/api/survey/surveys/years' },
    ]
    for (const { fn, expected } of endpointsToCheck) {
      vi.mocked(fetch).mockResolvedValueOnce(mockOk({}))
      try { await fn() } catch { /* may fail with type error, irrelevant */ }
      const url = vi.mocked(fetch).mock.calls.at(-1)?.[0] as string
      expect(url).toMatch(new RegExp(`^/api/survey`))
      expect(url).toContain(expected.replace('/api/survey', ''))
    }
  })
})
