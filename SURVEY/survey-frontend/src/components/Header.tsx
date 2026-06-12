/**
 * Header.tsx — DS Header 48px para Survey Analytics.
 * Igual al patrón de las otras apps del ecosistema.
 */

interface Props {
  appName?:  string
  onSalir?:  () => void
  inPortal?: boolean
}

export default function Header({
  appName  = 'Survey Analytics',
  onSalir,
  inPortal = false,
}: Props) {
  if (inPortal) return null

  return (
    <header className="app-header">
      {/* Logo badge CFO */}
      <div className="logo-badge">CFO</div>

      {/* Brand */}
      <div className="header-brand">
        <span className="header-brand-main">CFOTech</span>
        <span className="header-brand-sub">IT Tools</span>
      </div>

      {/* Divisor */}
      <div className="header-divider" />

      {/* App name */}
      <span className="header-app-name">{appName}</span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Botón Salir */}
      {onSalir && (
        <button className="btn-exit" onClick={onSalir}>
          Salir
        </button>
      )}
    </header>
  )
}
