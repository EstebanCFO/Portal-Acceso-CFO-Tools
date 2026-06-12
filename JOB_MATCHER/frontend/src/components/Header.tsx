import { useEffect, useState } from 'react'
import { apiHealth } from '../api/client'

type ApiStatus = 'checking' | 'online' | 'offline'

interface Props {
  onSalir: () => void
}

export default function Header({ onSalir }: Props) {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        await apiHealth()
        if (!cancelled) setStatus('online')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }

    check()
    const id = setInterval(check, 10_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const dotClass = `api-dot ${status}`
  const label    = status === 'online'  ? 'Sistema listo'
                 : status === 'offline' ? 'Servidor no disponible'
                 : 'Verificando...'

  return (
    <header className="app-header">
      {/* Logo badge */}
      <div className="header-logo-badge">
        <span>CFO</span>
      </div>

      {/* Brand */}
      <div className="header-brand">
        <span className="b1">CFOTech</span>
        <span className="b2">IT Tools</span>
      </div>

      {/* Divider */}
      <div className="header-divider" />

      {/* App name */}
      <span className="header-app-name">Job Matcher</span>

      <div className="header-spacer" />

      {/* API status */}
      <div className="api-status">
        <div className={dotClass} />
        <span className="api-label">{label}</span>
      </div>

      {/* Salir */}
      <button className="btn-exit" onClick={onSalir}>
        Salir
      </button>
    </header>
  )
}
