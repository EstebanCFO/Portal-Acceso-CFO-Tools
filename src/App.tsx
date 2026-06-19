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
  `http://${_H}:5009`,           // Sound Catch frontend (Vite dev)
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
  const [activeApp, setActiveApp] = useState<App | null>(null)

  // ── "← Volver" en el header del portal ───────────────────────────────────
  // Baja el servidor de la app activa (via launcher) y vuelve al Dashboard.
  async function handleVolver() {
    if (!activeApp) return
    await stopApp(activeApp.id)
    setActiveApp(null)
  }

  // ── "Salir" en el header (sin app activa) ────────────────────────────────
  // 1. Baja todos los subprocesos de las apps (backends + frontends).
  // 2. Apaga el gateway FastAPI (libera el puerto :5174).
  // 3. Cierra la pestaña del browser.
  async function handleSalirPortal() {
    try {
      // /api/shutdown-portal detiene subprocesos Y mata uvicorn después de responder
      await fetch(`${LAUNCHER}/api/shutdown-portal`, { method: 'POST' })
    } catch {
      // Gateway ya no disponible — continuar igual
    }
    window.close()
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
