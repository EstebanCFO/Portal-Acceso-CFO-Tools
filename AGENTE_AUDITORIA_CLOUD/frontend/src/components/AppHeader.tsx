interface Props {
  userName?: string
  onExit?: () => void
}

export const AppHeader = ({ userName, onExit }: Props) => (
  <header className="app-header" role="banner">
    <div className="header-logo-badge" aria-hidden="true">CFO</div>
    <div className="header-brand">
      <span className="header-brand-name">CFOTech</span>
      <span className="header-brand-sub">Auditoría de Accesibilidad</span>
    </div>
    <div className="header-spacer" />
    {userName && (
      <span className="header-user" aria-label={`Usuario: ${userName}`}>
        {userName}
      </span>
    )}
    {onExit && (
      <button
        type="button"
        className="header-exit-btn"
        onClick={onExit}
        aria-label="Salir y finalizar la sesión"
      >
        Salir
      </button>
    )}
  </header>
)
