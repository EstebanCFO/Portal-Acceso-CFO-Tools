import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditForm } from '../components/AuditForm'

describe('AuditForm — accesibilidad WCAG', () => {
  it('tiene un botón de submit accesible', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: /iniciar auditoría/i })).toBeInTheDocument()
  })

  it('muestra el selector "Seleccione artefacto para Auditar" con las 3 opciones', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByText(/seleccione artefacto para auditar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /repositorio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /url/i, pressed: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /app local/i })).toBeInTheDocument()
  })

  it('modo Repositorio (default) muestra solo el campo "URL Repositorio"', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByLabelText(/url repositorio/i)).toBeInTheDocument()
    // Ya no existen los campos viejos
    expect(screen.queryByLabelText(/organización/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/token de acceso/i)).not.toBeInTheDocument()
  })

  it('envía type repo con la URL del repositorio', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AuditForm onSubmit={onSubmit} disabled={false} />)
    await user.type(screen.getByLabelText(/url repositorio/i), 'https://dev.azure.com/org/proj/_git/repo')
    await user.click(screen.getByRole('button', { name: /iniciar auditoría/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'repo', repo: { url: 'https://dev.azure.com/org/proj/_git/repo' } })
    )
  })

  it('muestra error accesible cuando falta la URL del repo', async () => {
    const user = userEvent.setup()
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /iniciar auditoría/i }))
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/url repositorio/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('en modo URL muestra el campo con título "URL" (sin profundidad)', async () => {
    const user = userEvent.setup()
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /url/i, pressed: false }))
    expect(screen.getByLabelText('URL', { exact: false })).toBeInTheDocument()
    expect(screen.queryByLabelText(/profundidad/i)).not.toBeInTheDocument()
  })

  it('llama onSubmit con los datos correctos en modo URL', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AuditForm onSubmit={onSubmit} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /url/i, pressed: false }))
    await user.type(screen.getByLabelText('URL', { exact: false }), 'https://example.com')
    await user.click(screen.getByRole('button', { name: /iniciar auditoría/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'url', url: { url: 'https://example.com' } })
    )
  })

  it('en modo App Local mantiene el campo Nombre y el selector de archivos', async () => {
    const user = userEvent.setup()
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /app local/i }))
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/archivos/i)).toBeInTheDocument()
  })

  it('deshabilita el formulario cuando disabled=true', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={true} />)
    // Al deshabilitarse el botón muestra "Auditando..."
    expect(screen.getByRole('button', { name: /auditando|iniciar auditoría/i })).toBeDisabled()
  })
})
