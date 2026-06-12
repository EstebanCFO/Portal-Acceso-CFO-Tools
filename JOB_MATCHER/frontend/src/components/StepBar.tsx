interface Step {
  label: string
}

interface Props {
  steps:   Step[]
  current: number   // 1-based: paso activo
}

export default function StepBar({ steps, current }: Props) {
  return (
    <div className="step-bar">
      {steps.map((s, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'active' : 'pending'
        return (
          <div key={n} className="step-item">
            {/* Conector izquierdo */}
            {i > 0 && (
              <div className={`step-line ${n <= current ? 'done' : 'pending'}`} />
            )}
            <div className={`step-dot ${state}`}>
              {state === 'done' ? '✓' : n}
            </div>
            <span className={`step-label ${state}`}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
