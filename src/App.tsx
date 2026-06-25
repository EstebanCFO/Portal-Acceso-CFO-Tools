import { useState, useEffect } from 'react'
import Header from './components/Header'
import AppFrame from './components/AppFrame'
import Dashboard from './pages/Dashboard'
import type { App } from './registry/apps'
import './index.css'

// Host configurable — en dev = "localhost"; en red/prod = IP o dominio del servidor.
// Se lee del VITE_HOST definido en el .env raíz del portal.
const _H  = import.meta.env.VITE_HOST          ?? 'localhost'
// VITE_LAUNCHER_PORT apunta al gateway unificado (:5174) o al launcher legacy (:4999)
const _LP = import.meta.env.VITE_LAUNCHER_PORT  ?? '5174'

// Orígenes permitidos para mensajes postMessage de las apps embebidas.
// Incluye:
//   · mismo origen del portal (apps servidas inline desde el gateway)
//   · puertos directos (apps en modo dev con su propio Vite)
const ALLOWED_APP_ORIGINS = [
  window.location.origin,         // apps servidas por el gateway (mismo origen)
  `http://${_H}:5001`,           // Reporte DevOps frontend (Vite dev)
  `http://${_H}:5173`,           // Bandas Salariales frontend (Vite dev)
  `http://${_H}:5003`,           // Job Matcher frontend (Vite dev)
  `http://${_H}:5176`,           // Survey Analytics frontend (Vite dev)
  `http://${_H}:5009`,           // WS_A_TEXTO frontend (Vite dev)
]

const LAUNCHER = `http://${_H}:${_LP}`

/** Pide al launcher que baje los servidores de UNA app. */
async function stopApp(appId: string): Promise<void> {
  try {
    await fetch(`${LAUNCHER}/api/stop/${appId}`, { method: 'POST' })
  } catch {
    // Launcher no disponible — continuar igual (los procesos morirán solos)
  }
}

export default function App() {
  const [activeApp,    setActiveApp]    = useState<App | null>(null)
  // portalStopped: true después de hacer clic en "Salir" → muestra overlay de cierre.
  // window.close() es bloqueado por los browsers modernos cuando la pestaña no fue
  // abierta por script (window.open), así que mostramos una pantalla de confirmación
  // en lugar de intentar cerrar la pestaña programáticamente.
  const [portalStopped, setPortalStopped] = useState(false)

  // ── "← Volver" en el header del portal ───────────────────────────────────
  // Baja el servidor de la app activa (via launcher) y vuelve al Dashboard.
  async function handleVolver() {
    if (!activeApp) return
    await stopApp(activeApp.id)
    setActiveApp(null)
  }

  // ── "Salir" en el header (sin app activa) ────────────────────────────────
  // Detiene los subprocesos de las apps y muestra un overlay de cierre.
  // NO mata el gateway (shutdown-portal): eso causaba que la pestaña quedara
  // conectada a un servidor muerto, y window.close() es bloqueado por los
  // browsers modernos cuando la pestaña no fue abierta con window.open().
  async function handleSalirPortal() {
    setPortalStopped(true)
    try {
      await fetch(`${LAUNCHER}/api/stop-all`, { method: 'POST' })
    } catch {
      // Gateway no disponible o ya caído — igual mostramos el overlay
    }
  }

  // ── beforeunload — seguro de cierre ──────────────────────────────────────
  // sendBeacon garantiza el envío incluso cuando la página está descargando.
  // Cubre: cerrar pestaña, F5, navegación externa — sin esperar respuesta.
  useEffect(() => {
    const onUnload = () => navigator.sendBeacon(`${LAUNCHER}/api/stop-all`)
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // ── Escucha mensajes de apps embebidas (iframes) ──────────────────────────
  // Protocolo: app envía { type: 'portal:goHome', appId: '...' }
  // El portal pide al launcher que baje los servidores y vuelve al Dashboard.
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      // Validar origen — solo aceptamos mensajes de apps registradas
      if (!ALLOWED_APP_ORIGINS.includes(e.origin)) return
      if (e.data?.type !== 'portal:goHome') return

      const appId = e.data.appId as string | undefined

      // Pedir al launcher que detenga backend + frontend de la app
      if (appId) await stopApp(appId)

      // Navegar al Dashboard
      setActiveApp(null)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Overlay "portal detenido" ─────────────────────────────────────────────
  // Se muestra tras hacer clic en "Salir". El gateway sigue corriendo en background;
  // el usuario cierra la pestaña manualmente (Ctrl+W / Cmd+W).
  if (portalStopped) {
    return (
      <div
        className="portal-root"
        style={{
          background: 'var(--navy-dark, #0B1526)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 20,
          color: '#fff',
          textAlign: 'center',
          padding: 32,
        }}
        aria-label="Portal detenido"
      >
        <div style={{ fontSize: 52, lineHeight: 1 }}>✅</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Sesión finalizada</h2>
        <p style={{ margin: 0, color: 'rgba(255,255,255,.60)', fontSize: 14, maxWidth: 340 }}>
          Los servicios han sido detenidos.<br />
          Podés cerrar esta pestaña cuando quieras.
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,.30)', letterSpacing: '.5px' }}>
          Ctrl+W &nbsp;/&nbsp; Cmd+W
        </p>
        <button
          style={{
            marginTop: 8,
            padding: '8px 24px',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,.22)',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
          onClick={() => setPortalStopped(false)}
        >
          ← Volver al portal
        </button>
      </div>
    )
  }

  return (
    <div className="portal-root">
      <Header
        onSelectApp={app => setActiveApp(app)}
        activeApp={activeApp}
        onVolver={handleVolver}
        onSalirPortal={handleSalirPortal}
      />

      <main className="portal-body">
        {activeApp
          ? <AppFrame app={activeApp} />
          : <Dashboard onSelectApp={app => setActiveApp(app)} />
        }
      </main>
    </div>
  )
}
