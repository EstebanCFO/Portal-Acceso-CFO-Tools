import { useState, useEffect } from 'react'
import Header from './components/Header'
import AppFrame from './components/AppFrame'
import Dashboard from './pages/Dashboard'
import type { App } from './registry/apps'
import './index.css'

// Host configurable — en dev = "localhost"; en red/prod = IP o dominio del servidor.
// Se lee del VITE_HOST definido en el .env raíz del portal.
const _H  = import.meta.env.VITE_HOST          ?? 'localhost'
const _LP = import.meta.env.VITE_LAUNCHER_PORT  ?? '4999'

// Orígenes permitidos para mensajes postMessage de las apps embebidas.
// Se construyen con el mismo host que el portal para funcionar en cualquier entorno.
const ALLOWED_APP_ORIGINS = [
  `http://${_H}:5001`,   // Reporte DevOps frontend
  `http://${_H}:5173`,   // Bandas Salariales frontend
  `http://${_H}:5003`,   // Job Matcher frontend React (FASE 3)
  `http://${_H}:5176`,   // Survey Analytics frontend (FASE 6)
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

/** Pide al launcher que baje TODOS los servidores corriendo. */
async function stopAll(): Promise<void> {
  try {
    await fetch(`${LAUNCHER}/api/stop-all`, { method: 'POST' })
  } catch {}
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
  // Baja TODOS los servidores corrientes antes de cerrar la pestaña.
  async function handleSalirPortal() {
    await stopAll()
    // No cerramos la pestaña — el usuario la cierra manualmente si quiere
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
