import type { FC } from 'react'
import { APP_REGISTRY, type App } from '../registry/apps'

interface Props {
  onSelectApp: (app: App) => void
}

const statusBadge = (status: App['status']) => {
  if (status === 'active')       return <span className="status-badge active">Activa</span>
  if (status === 'maintenance')  return <span className="status-badge maintenance">Mantenimiento</span>
  return <span className="status-badge coming-soon">Próximamente</span>
}

const openBtn = (app: App, onSelect: Props['onSelectApp']) => {
  if (app.status === 'active') {
    return (
      <button className="btn-open navy" onClick={e => { e.stopPropagation(); onSelect(app) }}>
        Abrir →
      </button>
    )
  }
  if (app.status === 'maintenance') {
    return <button className="btn-open muted" disabled>No disponible</button>
  }
  return <button className="btn-open muted" disabled>Próximamente</button>
}

const Dashboard: FC<Props> = ({ onSelectApp }) => {
  const totalApps   = APP_REGISTRY.length
  const activeCount = APP_REGISTRY.filter(a => a.status === 'active').length

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <h1>Portal de Acceso</h1>
        <p>
          {activeCount} de {totalApps} aplicaciones disponibles — hacé clic en una card para abrirla.
        </p>
      </div>

      <div className="app-grid">
        {APP_REGISTRY.map(app => (
          <div
            key={app.id}
            className={`app-card${app.status === 'active' ? ' clickable' : ''}`}
            onClick={() => { if (app.status === 'active') onSelectApp(app) }}
          >
            {/* Header de la card */}
            <div className="app-card-header">
              <div
                className="app-card-icon"
                style={{ background: app.iconBg, color: app.iconColor }}
              >
                {app.icon}
              </div>
              <div className="app-card-info">
                <div className="app-card-name">{app.name}</div>
                <div className="app-card-category">{app.category}</div>
              </div>
            </div>

            {/* Descripción */}
            <p className="app-card-desc">{app.description}</p>

            {/* Footer: tags + status + botón */}
            <div className="app-card-footer">
              <div className="app-card-tags">
                {app.tags.slice(0, 2).map(t => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
              {statusBadge(app.status)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {openBtn(app, onSelectApp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
