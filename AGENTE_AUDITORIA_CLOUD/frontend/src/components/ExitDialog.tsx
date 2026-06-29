import { useEffect, useRef } from 'react'

export type ExitPhase = 'confirm' | 'shutting' | 'done'

interface Props {
  phase: ExitPhase
  onConfirm: () => void
  onCancel: () => void
}

export const ExitDialog = ({ phase, onConfirm, onCancel }: Props) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Foco inicial en el botón de confirmar + Escape para cancelar (WCAG 2.1.2 / 2.4.3)
  useEffect(() => {
    if (phase === 'confirm') {
      confirmBtnRef.current?.focus()
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [phase, onCancel])

  // ── Sesión finalizada: overlay a pantalla completa ──
  if (phase === 'done') {
    return (
      <div className="exit-overlay" role="status" aria-live="assertive">
        <div className="exit-overlay-card">
          <div className="exit-overlay-icon" aria-hidden="true">✓</div>
          <h2 className="exit-overlay-title">Sesión finalizada</h2>
          <p className="exit-overlay-text">
            Los servicios se cerraron correctamente. Ya podés cerrar esta pestaña.
          </p>
        </div>
      </div>
    )
  }

  // ── Confirmación / cerrando ──
  return (
    <div className="modal-backdrop">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-dialog-title"
        aria-describedby="exit-dialog-desc"
      >
        {phase === 'confirm' && (
          <>
            <h2 id="exit-dialog-title" className="modal-title">¿Finalizar la sesión?</h2>
            <p id="exit-dialog-desc" className="modal-text">
              Se cerrarán todos los servicios locales (frontend, backend y almacenamiento)
              y se liberarán los puertos. El historial de auditorías se conserva.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onCancel}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                ref={confirmBtnRef}
                onClick={onConfirm}
              >
                Finalizar sesión
              </button>
            </div>
          </>
        )}

        {phase === 'shutting' && (
          <div aria-live="polite" aria-busy="true">
            <h2 id="exit-dialog-title" className="modal-title">Cerrando servicios…</h2>
            <p id="exit-dialog-desc" className="modal-text">
              Bajando frontend, backend y almacenamiento. Un momento.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
