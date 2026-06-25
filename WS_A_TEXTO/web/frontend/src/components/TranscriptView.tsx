/**
 * TranscriptView — muestra el resultado de la transcripción con stats,
 * segmentos por hablante, opciones de copia/descarga y Resumen Ejecutivo IA.
 */
import { useState } from 'react'
import type { Transcript } from '../types'
import { downloadText, transcriptToSrt, formatDuration, apiSummarizeStream } from '../api/client'
import { SummaryPanel } from './SummaryPanel'

// Paleta de colores para hablantes
const SPEAKER_COLORS: Record<string, string> = {}
const PALETTE = ['#4FD1B2', '#1B3F8A', '#E6A817', '#E05B5B', '#9B59B6', '#27AE60']
let _colorIdx = 0

function speakerColor(speaker: string): string {
  if (!SPEAKER_COLORS[speaker]) {
    SPEAKER_COLORS[speaker] = PALETTE[_colorIdx++ % PALETTE.length]
  }
  return SPEAKER_COLORS[speaker]
}

type SummaryState = 'idle' | 'loading' | 'done' | 'error'

interface Props {
  transcript: Transcript
  filename:   string
  elapsed:    number
}

export function TranscriptView({ transcript: t, filename, elapsed }: Props) {
  const [copied,       setCopied]       = useState(false)
  const [summaryState, setSummaryState] = useState<SummaryState>('idle')
  const [summaryText,  setSummaryText]  = useState('')
  const [summaryError, setSummaryError] = useState('')

  const hasSpeakers = t.segments.some(s => s.speaker)
  const baseName    = filename.replace(/\.[^.]+$/, '')

  // ── Acciones de transcripción ───────────────────────────────────────────────

  function handleCopy() {
    navigator.clipboard.writeText(t.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload(fmt: string) {
    if (fmt === 'txt')  return downloadText(t.text, `${baseName}.txt`)
    if (fmt === 'srt')  return downloadText(transcriptToSrt(t), `${baseName}.srt`)
    if (fmt === 'json') return downloadText(JSON.stringify(t, null, 2), `${baseName}.json`, 'application/json')
  }

  // ── Resumen Ejecutivo ───────────────────────────────────────────────────────

  async function handleSummary() {
    setSummaryState('loading')
    setSummaryText('')
    setSummaryError('')

    try {
      await apiSummarizeStream(t.text, t.language, (chunk) => {
        setSummaryText(prev => prev + chunk)
      })
      setSummaryState('done')
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err))
      setSummaryState('error')
    }
  }

  const summaryBtnLabel =
    summaryState === 'loading' ? 'Generando…'        :
    summaryState === 'done'    ? '↺ Regenerar'       :
    summaryState === 'error'   ? '↺ Reintentar'      :
                                 '📋 Resumen Ejecutivo'

  return (
    <div className="sc-result">

      {/* Stats */}
      <div className="sc-stats">
        <span className="sc-stat">
          <span className="sc-stat__label">Idioma</span>
          <span className="sc-stat__value">{t.language} ({Math.round(t.language_probability * 100)}%)</span>
        </span>
        <span className="sc-stat">
          <span className="sc-stat__label">Duracion</span>
          <span className="sc-stat__value">{formatDuration(t.duration)}</span>
        </span>
        <span className="sc-stat">
          <span className="sc-stat__label">Palabras</span>
          <span className="sc-stat__value">{t.word_count.toLocaleString()}</span>
        </span>
        <span className="sc-stat">
          <span className="sc-stat__label">Segmentos</span>
          <span className="sc-stat__value">{t.segments.length}</span>
        </span>
        <span className="sc-stat">
          <span className="sc-stat__label">Confianza</span>
          <span className="sc-stat__value">{Math.round(t.avg_confidence * 100)}%</span>
        </span>
        <span className="sc-stat">
          <span className="sc-stat__label">Tiempo</span>
          <span className="sc-stat__value">{elapsed}s</span>
        </span>
      </div>

      {/* Resumen Ejecutivo — acción principal IA */}
      <button
        className="sc-btn sc-btn--ai"
        onClick={handleSummary}
        disabled={summaryState === 'loading'}
      >
        {summaryBtnLabel}
      </button>

      {/* Panel de resumen (visible cuando se generó o está generando) */}
      {summaryState !== 'idle' && (
        <SummaryPanel
          text={summaryText}
          loading={summaryState === 'loading'}
          error={summaryState === 'error' ? summaryError : undefined}
        />
      )}

      {/* Acciones de descarga */}
      <div className="sc-actions">
        <button className="sc-btn sc-btn--secondary" onClick={handleCopy}>
          {copied ? 'Copiado!' : 'Copiar texto'}
        </button>
        <button className="sc-btn sc-btn--secondary" onClick={() => handleDownload('txt')}>
          Descargar TXT
        </button>
        <button className="sc-btn sc-btn--secondary" onClick={() => handleDownload('srt')}>
          Descargar SRT
        </button>
        <button className="sc-btn sc-btn--secondary" onClick={() => handleDownload('json')}>
          Descargar JSON
        </button>
      </div>

      {/* Transcript */}
      <div className="sc-transcript">
        {hasSpeakers ? (
          // Vista por hablante con color-coding
          t.segments.map((seg, i) => {
            const color = seg.speaker ? speakerColor(seg.speaker) : '#888'
            return (
              <div key={i} className="sc-segment">
                <div className="sc-segment__meta">
                  {seg.speaker && (
                    <span className="sc-segment__speaker" style={{ color }}>
                      {seg.speaker}
                    </span>
                  )}
                  <span className="sc-segment__time">
                    {formatDuration(seg.start)} — {formatDuration(seg.end)}
                  </span>
                  <span className="sc-segment__conf" title="Confianza">
                    {Math.round(seg.confidence * 100)}%
                  </span>
                </div>
                <p className="sc-segment__text">{seg.text}</p>
              </div>
            )
          })
        ) : (
          // Vista simple: texto plano
          <p className="sc-transcript__text">{t.text}</p>
        )}
      </div>
    </div>
  )
}
