const STEPS = [
  'Conectando con el repositorio...',
  'Inventariando archivos...',
  'Analizando accesibilidad (WCAG 2.2)...',
  'Verificando cumplimiento ONTI y BCRA...',
  'Generando informe...',
  'Guardando informe en la nube...',
]

interface Props {
  step: string
  stepIndex: number
  totalSteps: number
}

export const ProgressPanel = ({ step, stepIndex, totalSteps }: Props) => (
  <section aria-label="Progreso de la auditoría">
    {/* Región live para lectores de pantalla */}
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      Paso {stepIndex + 1} de {totalSteps}: {step}
    </div>

    <h2 className="card-title">⏳ Auditando...</h2>

    <div role="list">
      {STEPS.map((s, i) => {
        const isDone    = i < stepIndex
        const isActive  = i === stepIndex
        return (
          <div key={s} className="progress-step" role="listitem">
            <span
              className={`progress-dot progress-dot--${isDone ? 'done' : isActive ? 'active' : 'pending'}`}
              aria-hidden="true"
            />
            <span className={`progress-label${isActive ? ' progress-label--active' : ''}`}>
              {isDone && '✔ '}{s}
            </span>
          </div>
        )
      })}
    </div>

    <p className="form-hint" style={{ marginTop: '16px' }}>
      La auditoría puede tardar 2-5 minutos según el tamaño del sitio.
    </p>
  </section>
)
