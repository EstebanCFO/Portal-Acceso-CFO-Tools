import { useState } from 'react'
import Header      from './components/Header'
import JobMatcher  from './pages/JobMatcher'
import JDGenerator from './pages/JDGenerator'
import { apiShutdown } from './api/client'

type Tab = 'matcher' | 'jdgen'

// Detecta modo iframe (portal) — evaluación estática, no cambia en runtime.
const IN_PORTAL = window.self !== window.top

export default function App() {
  const [tab,       setTab]      = useState<Tab>('matcher')
  const [showModal, setShowModal] = useState(false)
  const [exiting,   setExiting]  = useState(false)

  async function handleSalir() {
    if (exiting) return
    setExiting(true)
    setShowModal(false)
    try { await apiShutdown() } catch { /* normal: el server corta antes de responder */ }
    if (IN_PORTAL) {
      window.parent.postMessage(
        { type: 'portal:goHome', appId: 'job-matcher' },
        'http://localhost:5174',
      )
    } else {
      setTimeout(() => window.close(), 600)
    }
  }

  return (
    <div className="app-root">

      {/* DS Header — solo en modo standalone */}
      {!IN_PORTAL && <Header onSalir={() => setShowModal(true)} />}

      {/* Tab bar — siempre visible */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'matcher' ? 'active' : ''}`}
          onClick={() => setTab('matcher')}
        >
          🔍 Job Matcher
        </button>
        <button
          className={`tab-btn ${tab === 'jdgen' ? 'active' : ''}`}
          onClick={() => setTab('jdgen')}
        >
          📝 JD Generator
        </button>

        <div className="tab-spacer" />

        {/* Salir en modo portal vive en la tab bar */}
        {IN_PORTAL && (
          <button className="btn-exit" onClick={() => setShowModal(true)}>
            Salir
          </button>
        )}
      </div>

      {/* Contenido principal */}
      <div className="app-content">
        {tab === 'matcher' ? <JobMatcher /> : <JDGenerator />}
      </div>

      {/* Modal: confirmar salir */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {IN_PORTAL ? 'Salir de Job Matcher?' : 'Cerrar CFOTech IT Tools'}
            </div>
            <div className="modal-body">
              {IN_PORTAL
                ? <>Se va a detener el <strong>servidor Node.js (:5002)</strong> y vas a volver al portal.</>
                : <>Se va a detener el <strong>servidor Node.js (:5002)</strong>, cerrar todas las conexiones activas y cerrar el navegador. ¿Confirmás que querés salir?</>
              }
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-navy"
                style={{ background: 'var(--red)' }}
                onClick={handleSalir}
                disabled={exiting}
              >
                {exiting ? 'Cerrando...' : IN_PORTAL ? 'Salir' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de cierre */}
      {exiting && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-msg">Cerrando servidor...</div>
          <div className="loading-detail">Por favor esperá</div>
        </div>
      )}
    </div>
  )
}
