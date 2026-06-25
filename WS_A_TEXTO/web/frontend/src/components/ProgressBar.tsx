/**
 * ProgressBar — muestra el progreso del streaming SSE.
 */
import type { ProgressStep } from '../types'
import { STEP_LABELS } from '../types'

const STEPS: ProgressStep[] = ['saving', 'converting', 'transcribing', 'done']

function stepIndex(step: ProgressStep): number {
  return STEPS.indexOf(step === 'diarizing' ? 'transcribing' : step)
}

interface Props {
  currentStep: ProgressStep
  segmentsReceived: number
  message: string
}

export function ProgressBar({ currentStep, segmentsReceived, message }: Props) {
  const current = stepIndex(currentStep)
  const pct = currentStep === 'done' ? 100
    : Math.min(95, ((current + 1) / STEPS.length) * 100)

  return (
    <div className="sc-progress">
      <div className="sc-progress__bar-wrap">
        <div className="sc-progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="sc-progress__label">
        {message || STEP_LABELS[currentStep]}
        {currentStep === 'transcribing' && segmentsReceived > 0 && (
          <span className="sc-progress__segs"> · {segmentsReceived} segmentos</span>
        )}
      </p>
    </div>
  )
}
