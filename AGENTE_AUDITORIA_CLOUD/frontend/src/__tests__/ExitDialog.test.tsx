import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExitDialog } from '../components/ExitDialog'

describe('ExitDialog', () => {
  it('en fase confirm muestra un diálogo accesible con confirmar y cancelar', () => {
    render(<ExitDialog phase="confirm" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: /finalizar sesión/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })

  it('confirmar llama onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ExitDialog phase="confirm" onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /finalizar sesión/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancelar llama onCancel', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ExitDialog phase="confirm" onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape llama onCancel en fase confirm', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ExitDialog phase="confirm" onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('en fase shutting anuncia que está cerrando y no permite cancelar', () => {
    render(<ExitDialog phase="shutting" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/cerrando/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument()
  })

  it('en fase done muestra el overlay de sesión finalizada con aria-live', () => {
    const { container } = render(<ExitDialog phase="done" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/sesión finalizada/i)).toBeInTheDocument()
    expect(container.querySelector('[aria-live]')).toBeInTheDocument()
  })
})
