import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditForm } from '../components/AuditForm'

describe('AuditForm — accesibilidad WCAG', () => {
  it('tiene un botón de submit accesible', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: /iniciar auditoría/i })).toBeInTheDocument()
  })

  it('todos los inputs tienen label asociado', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    // Modo repo (default): org, project, repo, branch, PAT
    expect(screen.getByLabelText(/organización/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/proyecto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/repositorio/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/token de acceso/i)).toBeInTheDocument()
  })

  it('muestra error accesible cuando faltan campos requeridos', async () => {
    const user = userEvent.setup()
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /iniciar auditoría/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    // El input tiene aria-invalid
    expect(screen.getByLabelText(/organización/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('cambia a modo URL al seleccionar la tab URL', async () => {
    const user = userEvent.setup()
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /url/i, pressed: false }))
    expect(screen.getByLabelText(/url del sitio/i)).toBeInTheDocument()
  })

  it('llama onSubmit con los datos correctos en modo URL', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AuditForm onSubmit={onSubmit} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /url/i, pressed: false }))
    await user.type(screen.getByLabelText(/url del sitio/i), 'https://example.com')
    await user.click(screen.getByRole('button', { name: /iniciar auditoría/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'url', url: expect.objectContaining({ url: 'https://example.com' }) })
    )
  })

  it('deshabilita el formulario cuando disabled=true', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={true} />)
    expect(screen.getByRole('button', { name: /iniciar auditoría/i })).toBeDisabled()
  })
})
