import { useState } from 'react'
import SemaforoGeneral from './pages/SemaforoGeneral'
import EjercicioEconomico from './pages/EjercicioEconomico'

// Detecta si la app corre dentro del portal como iframe
export const IN_PORTAL = window.self !== window.top

type View =
  | { page: 'semaforo' }
  | { page: 'ejercicio'; projectId: number; period: string; projectName: string; clientName: string }

export default function App() {
  const [view, setView] = useState<View>({ page: 'semaforo' })

  function handleSelectProject(
    projectId: number,
    period: string,
    projectName: string,
    clientName: string,
  ) {
    setView({ page: 'ejercicio', projectId, period, projectName, clientName })
  }

  function handleBack() {
    setView({ page: 'semaforo' })
  }

  function handleSalir() {
    const portalUrl = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5174'
    window.parent.postMessage({ type: 'portal:goHome', appId: 'proyectos-activos' }, portalUrl)
    if (!IN_PORTAL) window.close()
  }

  if (view.page === 'ejercicio') {
    return (
      <EjercicioEconomico
        projectId={view.projectId}
        period={view.period}
        projectName={view.projectName}
        clientName={view.clientName}
        onBack={handleBack}
        onSalir={handleSalir}
      />
    )
  }

  return (
    <SemaforoGeneral
      onSelectProject={handleSelectProject}
      onSalir={handleSalir}
    />
  )
}
