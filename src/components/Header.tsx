import type { FC } from 'react'
import type { App } from '../registry/apps'

interface Props {
  onSelectApp:     (app: App | null) => void
  /** App actualmente embebida (si hay una activa). */
  activeApp?:      App | null
  /** Llamado al hacer click en "← Volver" — baja el servidor y vuelve al Dashboard. */
  onVolver?:       () => void
  /** Llamado al hacer click en "Salir" — baja todos los servidores y cierra el portal. */
  onSalirPortal?:  () => void
}

const Header: FC<Props> = ({ onSelectApp, activeApp, onVolver, onSalirPortal }) => {
  return (
    <header className="portal-header">

      {/* Logo — click vuelve al dashboard */}
      <div className="header-logo" onClick={() => onSelectApp(null)} title="Volver al portal">
        <span className="logo-badge">CFO</span>
        <span className="header-brand">
          <span className="header-brand-main">CFOTech</span>
          <span className="header-brand-sub">IT Tools</span>
        </span>
      </div>

      {/* Botón derecho:
          · Con app activa → "← Volver" (baja servidor y vuelve al Dashboard)
          · Sin app activa → "Salir" (cierra el portal)  */}
      {activeApp
        ? (
          <button
            className="btn-exit btn-back"
            onClick={onVolver}
            title={`Salir de ${activeApp.name} y volver al portal`}
          >
            ← Volver
          </button>
        )
        : (
          <button
            className="btn-exit"
            onClick={() => onSalirPortal ? onSalirPortal() : window.close()}
            title="Cerrar portal (detiene todos los servidores)"
          >
            Salir
          </button>
        )
      }

    </header>
  )
}

export default Header
