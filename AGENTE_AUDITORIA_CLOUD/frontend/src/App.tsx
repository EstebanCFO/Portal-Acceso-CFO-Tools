import { useState } from 'react'
import { SkipLink } from './components/SkipLink'
import { AppHeader } from './components/AppHeader'

// Fases de la UI
type Phase = 'form' | 'progress' | 'results'

export const App = () => {
  const [phase] = useState<Phase>('form')

  return (
    <>
      <SkipLink />
      <AppHeader />
      <main id="main" className="app-main">
        <p>Fase actual: {phase}</p>
      </main>
    </>
  )
}
