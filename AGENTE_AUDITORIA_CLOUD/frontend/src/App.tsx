import { useState } from 'react'
import { SkipLink } from './components/SkipLink'
import { AppHeader } from './components/AppHeader'
import { AuditForm } from './components/AuditForm'
import { ProgressPanel } from './components/ProgressPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { runAudit } from './api/client'
import type { AuditRequest, AuditStatus } from './types/audit'

export const App = () => {
  const [status, setStatus] = useState<AuditStatus>({ phase: 'idle' })

  const handleSubmit = async (req: AuditRequest) => {
    setStatus({ phase: 'loading', step: 'Conectando...', stepIndex: 0, totalSteps: 6 })
    try {
      // Simular progreso visual durante la llamada (la Azure Function no hace streaming)
      const progressSteps = [
        'Conectando con el repositorio...',
        'Inventariando archivos...',
        'Analizando accesibilidad (WCAG 2.2)...',
        'Verificando cumplimiento ONTI y BCRA...',
        'Generando informe...',
        'Guardando informe en la nube...',
      ]
      let stepIdx = 0
      const timer = setInterval(() => {
        stepIdx = Math.min(stepIdx + 1, progressSteps.length - 1)
        setStatus({ phase: 'loading', step: progressSteps[stepIdx], stepIndex: stepIdx, totalSteps: progressSteps.length })
      }, 8000) // avanza cada 8s durante los ~48s esperados

      const result = await runAudit(req)
      clearInterval(timer)
      setStatus({ phase: 'done', result })
    } catch (err) {
      setStatus({ phase: 'error', message: err instanceof Error ? err.message : 'Error desconocido' })
    }
  }

  return (
    <>
      <SkipLink />
      <AppHeader />
      <main id="main" className="app-main">

        {status.phase === 'error' && (
          <div className="banner banner--error" role="alert" aria-live="assertive">
            <strong>Error:</strong> {status.message}
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: '12px' }}
              onClick={() => setStatus({ phase: 'idle' })}
            >
              Reintentar
            </button>
          </div>
        )}

        {(status.phase === 'idle' || status.phase === 'error') && (
          <>
            <div className="card">
              <h1 className="card-title">Auditoría de Accesibilidad</h1>
              <AuditForm
                onSubmit={handleSubmit}
                disabled={false}
              />
            </div>
            <div className="card">
              <HistoryPanel />
            </div>
          </>
        )}

        {status.phase === 'loading' && (
          <div className="card">
            <ProgressPanel
              step={status.step}
              stepIndex={status.stepIndex}
              totalSteps={status.totalSteps}
            />
          </div>
        )}

        {status.phase === 'done' && (
          <div className="card">
            <ResultsPanel
              result={status.result}
              onReset={() => setStatus({ phase: 'idle' })}
            />
          </div>
        )}

      </main>
    </>
  )
}
