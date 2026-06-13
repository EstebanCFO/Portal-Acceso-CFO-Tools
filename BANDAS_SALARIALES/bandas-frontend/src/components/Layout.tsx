import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { pingBackend, shutdownBackend } from '../api/client'
import { DS } from '../theme'
import { IN_PORTAL } from '../App'

// ── Constantes DS ──────────────────────────────────────────────────────────────
const DRAWER_W   = 220
const HDR_HEIGHT = 48

// ── SVG Nav Icons (18×18, Material Design paths, equivalentes a MUI icons) ────
const IcoDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
  </svg>
)
const IcoTable = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M10 10.02h5V21h-5zM17 21h3c1.1 0 2-.9 2-2v-9h-5v11zm3-18H5c-1.1 0-2 .9-2 2v3h19V5c0-1.1-.9-2-2-2zM3 19c0 1.1.9 2 2 2h3V10H3v9z"/>
  </svg>
)
const IcoCompare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"/>
  </svg>
)
const IcoPerson = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
)

interface NavItem { to: string; label: string; Icon: () => JSX.Element }

const NAV: NavItem[] = [
  { to: '/',           label: 'Dashboard',   Icon: IcoDashboard },
  { to: '/tabla',      label: 'Tabla',       Icon: IcoTable     },
  { to: '/historial',  label: 'Comparativo', Icon: IcoCompare   },
  { to: '/empleado',   label: 'Empleado',    Icon: IcoPerson    },
]

// ── BackendStatus ──────────────────────────────────────────────────────────────
function BackendStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    async function check() {
      try { await pingBackend(); setStatus('online') }
      catch { setStatus('offline') }
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  const dotClass = status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'checking'
  const label    = status === 'online' ? 'Backend activo'
                 : status === 'offline' ? 'Sin conexion'
                 : 'Verificando...'

  return (
    <div className="bs-status">
      <div className={`status-dot ${dotClass}`} />
      <span className="bs-status-label">{label}</span>
    </div>
  )
}

// ── Layout principal ───────────────────────────────────────────────────────────
interface Props { children: React.ReactNode }

export default function Layout({ children }: Props) {
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [confirmSalir, setConfirmSalir] = useState(false)
  const [closing,      setClosing]      = useState(false)
  const [shutdownDone, setShutdownDone] = useState(false)
  const location = useLocation()

  // Responsive breakpoint listener
  useEffect(() => {
    const mq      = window.matchMedia(`(max-width: ${DRAWER_W * 2}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // ── Shutdown handler ────────────────────────────────────────────────────────
  async function handleConfirmSalir() {
    setConfirmSalir(false)
    setClosing(true)
    try { await shutdownBackend() } catch { /* server puede cortar antes de responder */ }
    await new Promise(r => setTimeout(r, 500))

    if (IN_PORTAL) {
      // VITE_PORTAL_URL se configura en bandas-frontend/.env (default: http://localhost:5174)
      const portalUrl = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5174'
      window.parent.postMessage(
        { type: 'portal:goHome', appId: 'bandas-salariales' },
        portalUrl,
      )
    } else {
      window.close()
      await new Promise(r => setTimeout(r, 300))
      setShutdownDone(true)
    }
  }

  // ── Nav items list ──────────────────────────────────────────────────────────
  const NavItems = () => (
    <nav style={{ paddingTop: 8 }}>
      {NAV.map(({ to, label, Icon }) => {
        const active = location.pathname === to
        return (
          <Link
            key={to}
            to={to}
            className={`bs-nav-item${active ? ' active' : ''}`}
          >
            <span className="bs-nav-icon"><Icon /></span>
            {label}
          </Link>
        )
      })}
    </nav>
  )

  // ── Portal mode: sidebar visible, header oculto (el portal tiene el suyo) ──
  if (IN_PORTAL) {
    return (
      <div className="bs-root">
        {/* Sidebar sin offset del header — empieza en top:0 */}
        <aside className="bs-sidebar" style={{ top: 0, height: '100vh' }}>
          <NavItems />
        </aside>
        {/* Main con margin-left pero sin margin-top (no hay header propio) */}
        <main className="bs-main with-sidebar" style={{ marginTop: 0 }}>
          {children}
        </main>
      </div>
    )
  }

  // ── Standalone mode ────────────────────────────────────────────────────────
  return (
    <div className="bs-root">
      {/* AppBar */}
      <header className="bs-header">
        <div className="bs-logo">CFO</div>
        <div className="bs-brand">
          <span className="bs-brand-main">CFOTech</span>
          <span className="bs-brand-accent">IT Tools</span>
          <span className="bs-brand-sep">|</span>
          <span className="bs-brand-app">Bandas Salariales DC</span>
        </div>
        <div className="bs-header-spacer" />
        <BackendStatus />
        <button className="btn-exit" onClick={() => setConfirmSalir(true)}>Salir</button>
        {isMobile && (
          <button className="bs-menu-btn" onClick={() => setDrawerOpen(true)}>☰</button>
        )}
      </header>

      {/* Sidebar — permanent on desktop */}
      {!isMobile && (
        <aside className="bs-sidebar" style={{ width: DRAWER_W }}>
          <NavItems />
        </aside>
      )}

      {/* Mobile drawer */}
      {isMobile && drawerOpen && (
        <>
          <div className="bs-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="bs-drawer">
            <NavItems />
          </div>
        </>
      )}

      {/* Main content */}
      <main
        className={`bs-main${!isMobile ? ' with-sidebar' : ''}`}
        style={isMobile ? { marginTop: HDR_HEIGHT } : undefined}
      >
        {children}
      </main>

      {/* Confirm salir modal */}
      {confirmSalir && (
        <div className="modal-overlay" onClick={() => setConfirmSalir(false)}>
          <div className="modal sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {IN_PORTAL ? 'Salir de Bandas Salariales?' : 'Cerrar la aplicacion?'}
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: DS.text2, lineHeight: 1.5 }}>
                {IN_PORTAL
                  ? <>Se va a detener el <strong>backend (.NET :5050)</strong> y vas a volver al portal.</>
                  : <>Se van a detener los servicios del <strong>backend (.NET :5050)</strong> y se cerrara esta pestana.</>
                }
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setConfirmSalir(false)}>Cancelar</button>
              <button className="btn-danger" onClick={handleConfirmSalir}>
                {IN_PORTAL ? 'Salir' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shutdown overlay */}
      {closing && (
        <div className="bs-closing-overlay">
          {!shutdownDone ? (
            <>
              <div className={`spinner spinner-lg`} />
              <p className="bs-closing-text">Cerrando servicios...</p>
            </>
          ) : (
            <>
              <div className="bs-done-circle">✓</div>
              <p className="bs-done-title">Servidor apagado</p>
              <p className="bs-done-sub">Podes cerrar esta pestana</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
