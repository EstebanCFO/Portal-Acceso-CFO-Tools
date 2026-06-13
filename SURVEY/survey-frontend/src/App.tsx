import { useState } from 'react'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import { apiShutdown } from './api/client'

// Detecta si la app corre dentro del iframe del portal CFOTech
export const IN_PORTAL = window.self !== window.top

export default function App() {
  const [saliendo, setSaliendo] = useState(false)

  async function handleSalir() {
    if (saliendo) return
    setSaliendo(true)
    try { await apiShutdown() } catch { /* servidor puede no estar corriendo */ }
    if (IN_PORTAL) {
      const portalUrl = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5174'
      window.parent.postMessage(
        { type: 'portal:goHome', appId: 'survey' },
        portalUrl,
      )
    } else {
      setTimeout(() => window.close(), 600)
    }
  }

  if (saliendo) {
    return (
      <div className="sv-closing">
        <div className="spinner spinner-md" />
        <p>Cerrando Survey Analytics...</p>
      </div>
    )
  }

  return (
    <div className="sv-root">
      <Header inPortal={IN_PORTAL} onSalir={handleSalir} />
      <main className={`sv-main${IN_PORTAL ? ' portal-mode' : ''}`}>
        <Dashboard />
      </main>
    </div>
  )
}
