/**
 * Header — sigue el Design System del Portal de Acceso CFOTech.
 * 48px, #0B1526, border-bottom 3px solid #1C2E48.
 *
 * Cuando corre dentro del portal (IN_PORTAL = true) no se renderiza:
 * el portal provee su propio header con "← Volver" — no duplicar navegación.
 *
 * En modo standalone (acceso directo sin portal) se muestra el header completo
 * con botón "Salir" que cierra la ventana.
 */
const IN_PORTAL = window.self !== window.top

export function Header() {
  // Dentro del portal: el portal ya tiene "← Volver" en su header — no mostrar el propio.
  if (IN_PORTAL) return null

  function handleSalir() {
    window.close()
  }

  return (
    <header className="sc-header">
      <div className="sc-header__brand">
        <div className="sc-logo">WA</div>
        <div className="sc-header__title">
          <span className="sc-header__name">WA a Texto</span>
          <span className="sc-header__sub">Transcripcion de Audio</span>
        </div>
      </div>

      <button className="sc-btn-salir" onClick={handleSalir}>
        Salir
      </button>
    </header>
  )
}
