import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout    from './components/Layout'
import Dashboard from './pages/Dashboard'
import Tabla     from './pages/Tabla'
import Historial from './pages/Historial'
import Empleado  from './pages/Empleado'

// IN_PORTAL: true cuando la app corre embebida en el portal (iframe cross-origin).
// Evaluación estática: no cambia durante el ciclo de vida de la app.
export const IN_PORTAL = window.self !== window.top

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/tabla"     element={<Tabla />}     />
          <Route path="/historial" element={<Historial />} />
          <Route path="/empleado"  element={<Empleado />}  />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
