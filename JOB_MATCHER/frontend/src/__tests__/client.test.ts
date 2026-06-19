/**
 * client.test.ts — Job Matcher
 *
 * Verifica que el cliente API:
 *   1. Exporta todas las funciones esperadas
 *   2. Construye las URLs correctas con el prefijo del gateway (/api/job-matcher)
 *   3. apiUpload usa el endpoint /api/job-matcher/upload (rutas mixtas, sin /api/)
 *   4. apiHealth usa /api/job-matcher/api/health (rutas con /api/)
 *   5. Maneja errores del backend lanzando Error con el mensaje del JSON
 *
 * Contexto: Bug reportado "Unexpected token ' ', \" P ??5???\" ... is not valid JSON"
 * al subir documentación.  La causa raíz era que Node.js (compression middleware)
 * comprimía la respuesta con gzip, el gateway stripeaba Content-Encoding pero
 * pasaba los bytes comprimidos → browser recibía gzip sin header → JSON.parse fallaba.
 * Fix: gateway ahora excluye 'accept-encoding' de headers reenviados al backend.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiHealth,
  apiShutdown,
  apiUpload,
  apiSummarize,
  apiAnalyzeCandidate,
  apiAskQuestion,
  apiJDAnalyze,
  apiJDGenerate,
  apiGetTemplates,
  apiSaveTemplate,
  apiDeleteTemplate,
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

const fakeFile = (name = 'test.pdf', type = 'application/pdf') =>
  new File(['dummy content'], name, { type })

// ══════════════════════════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════════════════════════

describe('client.ts — exports', () => {
  it('exporta apiHealth',           () => expect(typeof apiHealth).toBe('function'))
  it('exporta apiShutdown',         () => expect(typeof apiShutdown).toBe('function'))
  it('exporta apiUpload',           () => expect(typeof apiUpload).toBe('function'))
  it('exporta apiSummarize',        () => expect(typeof apiSummarize).toBe('function'))
  it('exporta apiAnalyzeCandidate', () => expect(typeof apiAnalyzeCandidate).toBe('function'))
  it('exporta apiAskQuestion',      () => expect(typeof apiAskQuestion).toBe('function'))
  it('exporta apiJDAnalyze',        () => expect(typeof apiJDAnalyze).toBe('function'))
  it('exporta apiJDGenerate',       () => expect(typeof apiJDGenerate).toBe('function'))
  it('exporta apiGetTemplates',     () => expect(typeof apiGetTemplates).toBe('function'))
  it('exporta apiSaveTemplate',     () => expect(typeof apiSaveTemplate).toBe('function'))
  it('exporta apiDeleteTemplate',   () => expect(typeof apiDeleteTemplate).toBe('function'))
})

// ══════════════════════════════════════════════════════════════════════════════
// URLs — prefijo /api/job-matcher + rutas mixtas
// ══════════════════════════════════════════════════════════════════════════════

describe('apiHealth — ruta con /api/ dentro del prefijo', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/job-matcher/api/health', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ status: 'ok' }))
    await apiHealth()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/job-matcher/api/health')
  })
})

describe('apiUpload — ruta sin /api/ (ruta mixta del backend)', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/job-matcher/upload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ success: true, text: 'contenido', summary: 'resumen', candidateName: 'Juan' })
    )
    await apiUpload(fakeFile())
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/job-matcher/upload')
  })

  it('usa POST con FormData', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ success: true, text: '', summary: '', candidateName: '' })
    )
    await apiUpload(fakeFile('cv.pdf'))
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/job-matcher/upload')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
  })

  it('devuelve el resultado de la subida', async () => {
    const expected = { success: true, text: 'texto extraído', summary: 'resumen', candidateName: 'Ana García' }
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(expected))
    const result = await apiUpload(fakeFile('cv.docx'))
    expect(result.success).toBe(true)
    expect(result.candidateName).toBe('Ana García')
  })
})

describe('apiJDAnalyze — ruta /api/job-matcher/api/analyze', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/job-matcher/api/analyze', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ success: true, analysis: {} })
    )
    await apiJDAnalyze(fakeFile('propuesta.pdf'))
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/job-matcher/api/analyze')
  })
})

describe('apiSummarize — ruta /api/job-matcher/summarize', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/job-matcher/summarize con método POST', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ success: true, summary: 'resumen' }))
    await apiSummarize('texto largo', 'job')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/job-matcher/summarize')
    expect((init as RequestInit).method).toBe('POST')
  })
})

describe('apiGetTemplates — ruta /api/job-matcher/api/templates', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('llama a /api/job-matcher/api/templates', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ templates: [] }))
    await apiGetTemplates()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/job-matcher/api/templates')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Manejo de errores
// ══════════════════════════════════════════════════════════════════════════════

describe('manejo de errores en apiUpload', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('lanza Error con mensaje del backend en 503', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(503, { error: 'Backend no disponible' }))
    await expect(apiUpload(fakeFile())).rejects.toThrow('Backend no disponible')
  })

  it('lanza Error con "HTTP 500" cuando no hay campo error en el body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(500, {}))
    await expect(apiUpload(fakeFile())).rejects.toThrow('HTTP 500')
  })

  it('lanza Error cuando el archivo es muy grande (413)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(413, { error: 'Archivo demasiado grande' }))
    await expect(apiUpload(fakeFile())).rejects.toThrow('Archivo demasiado grande')
  })
})

describe('manejo de errores en apiAnalyzeCandidate', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('lanza Error cuando Claude no está disponible (503)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(503, { error: 'Claude API no disponible' }))
    await expect(
      apiAnalyzeCandidate({ candidateName: 'Test', candidateText: 'cv', jobText: 'jd' })
    ).rejects.toThrow('Claude API no disponible')
  })

  it('lanza Error con "HTTP 504" cuando el gateway hace timeout (operación larga de IA)', async () => {
    // El gateway tiene read=300s para Claude API, pero si aun así supera ese límite,
    // devuelve 504. El frontend debe propagarlo como Error limpio (no quedarse en spinner).
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErr(504, { detail: 'Backend job-matcher tardó demasiado en responder.' })
    )
    await expect(
      apiAnalyzeCandidate({ candidateName: 'Test', candidateText: 'cv', jobText: 'jd' })
    ).rejects.toThrow('HTTP 504')
  })

  it('lanza Error "HTTP 504" cuando el body no tiene campo "error" (fastapi detail)', async () => {
    // FastAPI devuelve {"detail": "..."} pero el cliente busca "error".
    // El fallback `HTTP ${status}` garantiza que siempre se lanza un Error descriptivo.
    vi.mocked(fetch).mockResolvedValueOnce(mockErr(504, {}))
    await expect(
      apiAnalyzeCandidate({ candidateName: 'Test', candidateText: 'cv', jobText: 'jd' })
    ).rejects.toThrow('HTTP 504')
  })

  it('lanza Error cuando el backend aún está iniciando (503 sin campo error)', async () => {
    // El gateway devuelve 503 con {"detail": "..."} cuando el backend está en 'launching'.
    // El cliente no tiene campo "error" → lanza "HTTP 503".
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErr(503, { detail: 'Backend job-matcher aún iniciando — esperá unos segundos.' })
    )
    await expect(
      apiAnalyzeCandidate({ candidateName: 'Test', candidateText: 'cv', jobText: 'jd' })
    ).rejects.toThrow('HTTP 503')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Todos los endpoints usan el prefijo /api/job-matcher
// ══════════════════════════════════════════════════════════════════════════════

describe('prefijo /api/job-matcher en todos los endpoints', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('apiHealth comienza con /api/job-matcher', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ status: 'ok' }))
    await apiHealth()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/job-matcher\//)
  })

  it('apiGetTemplates comienza con /api/job-matcher', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ templates: [] }))
    await apiGetTemplates()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/job-matcher\//)
  })
})
