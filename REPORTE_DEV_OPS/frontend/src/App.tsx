import Header from './components/Header'
import ReporteDevOps from './pages/ReporteDevOps'
import './index.css'

// Cuando la app corre embebida en el portal (iframe), ocultamos
// el header propio para evitar doble barra de navegación.
const inPortal = window.self !== window.top

export default function App() {
  return (
    <div className="page-layout">
      {!inPortal && <Header appName="Reporte DevOps" />}
      <ReporteDevOps />
    </div>
  )
}
