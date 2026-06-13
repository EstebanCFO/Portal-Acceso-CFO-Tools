import { useState } from 'react'
import Header      from './components/Header'
import JobMatcher  from './pages/JobMatcher'
import JDGenerator from './pages/JDGenerator'

type Tab = 'matcher' | 'jdgen'

// Detecta modo iframe (portal) — evaluación estática, no cambia en runtime.
const IN_PORTAL = window.self !== window.top

export default function App() {
  const [tab, setTab] = useState<Tab>('matcher')

  return (
    <div className="app-root">

      {/* DS Header — solo en modo standalone */}
      {!IN_PORTAL && <Header />}

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
      </div>

      {/* Contenido principal */}
      <div className="app-content">
        {tab === 'matcher' ? <JobMatcher /> : <JDGenerator />}
      </div>
    </div>
  )
}
