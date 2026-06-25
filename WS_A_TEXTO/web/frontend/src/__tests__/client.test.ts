/**
 * Tests del cliente API — lógica pura + URL routing.
 *
 * Bug documentado: VITE_API_URL="" (string vacío en .env) con el operador ??
 * no hacía fallback → API="" → fetch("/api/info") → gateway devuelve 404 →
 * frontend muestra "Backend no disponible en http://localhost:5174".
 * Fix: operador || en lugar de ?? en client.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatDuration, transcriptToSrt, apiHealth, apiFetchInfo } from '../api/client'
import type { Transcript } from '../types'

// ── Helpers para tests de fetch ────────────────────────────────────────────────
const mockOk = (data: unknown = {}) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }) as Response

// ── Tests de URL del cliente (bug ?? vs ||) ───────────────────────────────────

describe('client.ts — prefijo /api/sound-catch', () => {
  beforeEach(() => vi.mocked(fetch).mockClear())

  it('apiHealth llama a /api/sound-catch/api/health (prefijo correcto)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ status: 'ok', model: 'base' }))
    await apiHealth()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('/api/sound-catch/api/health')
  })

  it('apiFetchInfo llama a /api/sound-catch/api/info (no a /api/info)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockOk({ supported_formats: [], models: [], default_model: 'base',
                default_language: null, diarization_available: false })
    )
    await apiFetchInfo()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    // BUG CHECK: el URL NO debe ser /api/info (que causaba 404 en el gateway).
    // Con VITE_API_URL="" y ??, API quedaba "" → fetch("/api/info") → 404.
    // Con ||, API = "/api/sound-catch" → fetch("/api/sound-catch/api/info") → OK.
    expect(url).not.toBe('/api/info')
    expect(url).toBe('/api/sound-catch/api/info')
  })

  it('el prefijo /api/sound-catch está presente en todos los endpoints', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk({ status: 'ok', model: 'base' }))
    await apiHealth()
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/sound-catch\//)
  })
})

// ── formatDuration ────────────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('muestra segundos para duraciones cortas', () => {
    expect(formatDuration(45)).toBe('45s')
  })

  it('muestra minutos y segundos', () => {
    expect(formatDuration(90)).toBe('1m 30s')
  })

  it('muestra horas minutos y segundos', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s')
  })

  it('maneja cero', () => {
    expect(formatDuration(0)).toBe('0s')
  })
})

// ── transcriptToSrt ────────────────────────────────────────────────────────────
describe('transcriptToSrt', () => {
  const transcript: Transcript = {
    language: 'es',
    language_probability: 0.99,
    duration: 5.0,
    word_count: 5,
    avg_confidence: 0.9,
    text: 'Hola mundo. Esto es una prueba.',
    segments: [
      { start: 0.0, end: 2.0, text: 'Hola mundo.',        confidence: 0.95, speaker: null },
      { start: 2.5, end: 5.0, text: 'Esto es una prueba.', confidence: 0.88, speaker: null },
    ],
  }

  it('genera numeracion correcta', () => {
    const srt = transcriptToSrt(transcript)
    expect(srt).toContain('1\n')
    expect(srt).toContain('2\n')
  })

  it('usa coma como separador de milisegundos (formato SRT)', () => {
    const srt = transcriptToSrt(transcript)
    expect(srt).toContain('00:00:00,000 --> 00:00:02,000')
    expect(srt).toContain('00:00:02,500 --> 00:00:05,000')
  })

  it('incluye el texto de cada segmento', () => {
    const srt = transcriptToSrt(transcript)
    expect(srt).toContain('Hola mundo.')
    expect(srt).toContain('Esto es una prueba.')
  })

  it('retorna string vacio para transcript sin segmentos', () => {
    const empty: Transcript = { ...transcript, segments: [] }
    expect(transcriptToSrt(empty)).toBe('')
  })
})
