/**
 * App — orquesta el flujo completo:
 * upload → opciones → transcripción SSE → resultado
 */
import { useEffect, useState } from 'react'
import { Header }        from './components/Header'
import { UploadZone }    from './components/UploadZone'
import { OptionsPanel }  from './components/OptionsPanel'
import { ProgressBar }   from './components/ProgressBar'
import { TranscriptView } from './components/TranscriptView'
import { apiFetchInfo, apiTranscribeStream } from './api/client'
import type { Transcript, TranscribeOptions, ProgressStep, ProgressEvent } from './types'

type AppState = 'idle' | 'processing' | 'done' | 'error'

const DEFAULT_OPTS: TranscribeOptions = {
  lang: '',
  model: 'base',
  fmt:   'txt',
  minConfidence: 0.0,
  diarize: false,
}

export default function App() {
  const [state,       setState]       = useState<AppState>('idle')
  const [file,        setFile]        = useState<File | null>(null)
  const [opts,        setOpts]        = useState<TranscribeOptions>(DEFAULT_OPTS)
  const [step,        setStep]        = useState<ProgressStep>('saving')
  const [stepMsg,     setStepMsg]     = useState('')
  const [segments,    setSegments]    = useState(0)
  const [transcript,  setTranscript]  = useState<Transcript | null>(null)
  const [error,       setError]       = useState('')
  const [elapsed,     setElapsed]     = useState(0)
  const [diarAvail,   setDiarAvail]   = useState(false)
  const [backendOk,   setBackendOk]   = useState<boolean | null>(null)

  // Verificar backend al montar
  useEffect(() => {
    apiFetchInfo()
      .then(info => {
        setBackendOk(true)
        setDiarAvail(info.diarization_available ?? false)
        if (info.default_model) setOpts(o => ({ ...o, model: info.default_model }))
      })
      .catch(() => setBackendOk(false))
  }, [])

  function handleFile(f: File) {
    setFile(f)
    setState('idle')
    setTranscript(null)
    setError('')
  }

  async function handleTranscribe() {
    if (!file) return
    setState('processing')
    setStep('saving')
    setStepMsg('')
    setSegments(0)
    setError('')
    setTranscript(null)

    const t0 = Date.now()

    function onEvent(e: ProgressEvent) {
      if (e.type === 'progress') {
        setStep(e.step ?? 'saving')
        setStepMsg(e.message ?? '')
      } else if (e.type === 'segment') {
        setSegments(n => n + 1)
      }
    }

    try {
      const result = await apiTranscribeStream(file, opts, onEvent)
      setTranscript(result)
      setStep('done')
      setElapsed(Math.round((Date.now() - t0) / 1000))
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  function handleReset() {
    setFile(null)
    setTranscript(null)
    setError('')
    setState('idle')
    setSegments(0)
  }

  const busy = state === 'processing'

  return (
    <div className="sc-root">
      <Header />

      <main className="sc-main">
        {/* Backend offline */}
        {backendOk === false && (
          <div className="sc-alert sc-alert--error">
            Backend no disponible — verificar que el portal esté corriendo en{' '}
            <code>{window.location.origin}</code>
          </div>
        )}

        {/* Panel izquierdo: upload + opciones */}
        <div className="sc-panel">
          <UploadZone onFile={handleFile} disabled={busy} />

          {file && (
            <div className="sc-file-info">
              <span className="sc-file-info__icon">🎵</span>
              <span className="sc-file-info__name" title={file.name}>{file.name}</span>
              <span className="sc-file-info__size">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          )}

          <OptionsPanel
            opts={opts}
            onChange={patch => setOpts(o => ({ ...o, ...patch }))}
            diarizationAvailable={diarAvail}
            disabled={busy}
          />

          <div className="sc-actions sc-actions--main">
            <button
              className="sc-btn sc-btn--primary"
              onClick={handleTranscribe}
              disabled={!file || busy || backendOk === false}
            >
              {busy ? 'Transcribiendo...' : 'Transcribir'}
            </button>
            {(state === 'done' || state === 'error') && (
              <button className="sc-btn sc-btn--ghost" onClick={handleReset}>
                Nueva transcripcion
              </button>
            )}
          </div>

          {/* Progreso */}
          {busy && (
            <ProgressBar
              currentStep={step}
              segmentsReceived={segments}
              message={stepMsg}
            />
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="sc-alert sc-alert--error">{error}</div>
          )}
        </div>

        {/* Panel derecho: resultado */}
        {transcript && state === 'done' && (
          <div className="sc-result-panel">
            <TranscriptView
              transcript={transcript}
              filename={file?.name ?? 'audio'}
              elapsed={elapsed}
            />
          </div>
        )}
      </main>
    </div>
  )
}
