import type { Transcript, TranscribeOptions, ProgressEvent } from '../types'

// Prefijo unificado: funciona tanto en dev (Vite proxea /api/sound-catch → :5008)
// como en producción (gateway sirve /api/sound-catch/* inline).
// NOTA: usar || en lugar de ?? — .env puede tener VITE_API_URL="" (string vacío)
// y ?? no hace fallback para strings vacíos (solo para null/undefined).
const API = import.meta.env.VITE_API_URL || '/api/sound-catch'

export async function apiFetchInfo() {
  const res = await fetch(`${API}/api/info`)
  if (!res.ok) throw new Error('No se pudo conectar con el backend')
  return res.json()
}

export async function apiHealth() {
  const res = await fetch(`${API}/api/health`)
  return res.ok
}

/**
 * Transcribe con SSE streaming. Llama onEvent por cada evento del servidor.
 * Devuelve el Transcript final cuando el stream termina.
 */
export async function apiTranscribeStream(
  file: File,
  opts: TranscribeOptions,
  onEvent: (e: ProgressEvent) => void,
): Promise<Transcript> {
  const form = new FormData()
  form.append('file', file)
  form.append('lang', opts.lang)
  form.append('model', opts.model)
  form.append('min_confidence', String(opts.minConfidence))
  form.append('diarize', String(opts.diarize))

  const res = await fetch(`${API}/api/transcribe/stream`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok || !res.body) {
    throw new Error(`Error del servidor: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalTranscript: Transcript | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Parsear líneas SSE completas
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event: ProgressEvent = JSON.parse(line.slice(6))
        onEvent(event)
        if (event.type === 'done' && event.transcript) {
          finalTranscript = event.transcript
        }
        if (event.type === 'error') {
          throw new Error(event.message ?? 'Error desconocido')
        }
      } catch (parseErr) {
        // Ignorar líneas mal formadas
      }
    }
  }

  if (!finalTranscript) throw new Error('El servidor no devolvió resultado')
  return finalTranscript
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function downloadText(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Genera un resumen ejecutivo via SSE. Llama onChunk por cada fragmento de texto.
 * Devuelve cuando el stream termina.
 */
export async function apiSummarizeStream(
  text: string,
  language: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(`${API}/api/summarize/stream`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text, language }),
  })

  if (!res.ok) {
    // FastAPI devuelve { detail: "..." } en errores
    let msg = `Error ${res.status}`
    try { msg = (await res.json()).detail ?? msg } catch { /* noop */ }
    throw new Error(msg)
  }
  if (!res.body) throw new Error('No se recibió stream del servidor')

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'chunk' && event.text) onChunk(event.text as string)
        if (event.type === 'error') throw new Error(event.message ?? 'Error desconocido')
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
      }
    }
  }
}

export function transcriptToSrt(transcript: Transcript): string {
  return transcript.segments.map((seg, i) => {
    const fmt = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0')
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
      const sec = Math.floor(s % 60).toString().padStart(2, '0')
      const ms = Math.round((s % 1) * 1000).toString().padStart(3, '0')
      return `${h}:${m}:${sec},${ms}`
    }
    return `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text}\n`
  }).join('\n')
}
