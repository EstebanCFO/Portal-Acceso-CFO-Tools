import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppHeader } from '../components/AppHeader'

describe('AppHeader — botón Salir', () => {
  it('muestra el botón Salir cuando se pasa onExit', () => {
    render(<AppHeader onExit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /salir/i })).toBeInTheDocument()
  })

  it('no muestra el botón Salir si no hay onExit', () => {
    render(<AppHeader />)
    expect(screen.queryByRole('button', { name: /salir/i })).not.toBeInTheDocument()
  })

  it('llama onExit al hacer click en Salir', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<AppHeader onExit={onExit} />)
    await user.click(screen.getByRole('button', { name: /salir/i }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
