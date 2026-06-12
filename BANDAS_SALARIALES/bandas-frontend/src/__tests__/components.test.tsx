/**
 * components.test.tsx
 * Tests de componentes React de Bandas Salariales (sin MUI — CSS plano DS).
 * Incluye: UploadModal
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UploadModal from '../components/UploadModal'

// ── Mock del cliente API (axios) ──────────────────────────────────────────────
// UploadModal importa uploadExcel de '../api/client'.
// El mock intercepta la llamada para no hacer HTTP real en tests.
vi.mock('../api/client', () => ({
  uploadExcel: vi.fn().mockResolvedValue({
    data: { status: 'ok', message: 'Importado correctamente.' },
  }),
}))

const noop = () => {}

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — cuando open=false
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — cerrado (open=false)', () => {
  it('no renderiza ningún elemento cuando open=false', () => {
    const { container } = render(
      <UploadModal open={false} onClose={noop} onSuccess={noop} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('no muestra el title "Cargar nuevo Excel" cuando está cerrado', () => {
    render(<UploadModal open={false} onClose={noop} onSuccess={noop} />)
    expect(screen.queryByText('Cargar nuevo Excel')).not.toBeInTheDocument()
  })

  it('no renderiza el .modal-overlay cuando open=false', () => {
    const { container } = render(
      <UploadModal open={false} onClose={noop} onSuccess={noop} />
    )
    expect(container.querySelector('.modal-overlay')).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — cuando open=true
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — abierto (open=true)', () => {
  it('renderiza el .modal-overlay cuando open=true', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    expect(container.querySelector('.modal-overlay')).toBeInTheDocument()
  })

  it('renderiza el .modal cuando open=true', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    expect(container.querySelector('.modal')).toBeInTheDocument()
  })

  it('muestra el header "Cargar nuevo Excel"', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    expect(screen.getByText('Cargar nuevo Excel')).toBeInTheDocument()
  })

  it('tiene .modal-header con el título', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    const header = container.querySelector('.modal-header')
    expect(header?.textContent).toBe('Cargar nuevo Excel')
  })

  it('renderiza .modal-body', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    expect(container.querySelector('.modal-body')).toBeInTheDocument()
  })

  it('renderiza .modal-footer', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    expect(container.querySelector('.modal-footer')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — upload zone
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — zona de carga', () => {
  it('muestra el ícono de upload ⬆', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    expect(screen.getByText('⬆')).toBeInTheDocument()
  })

  it('muestra el texto "Arrastra el archivo o hace click"', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    expect(screen.getByText('Arrastra el archivo o hace click')).toBeInTheDocument()
  })

  it('muestra el caption "Solo archivos .xlsx"', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    expect(screen.getByText('Solo archivos .xlsx')).toBeInTheDocument()
  })

  it('incluye un input type=file oculto', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect((input as HTMLInputElement)?.style.display).toBe('none')
  })

  it('el input acepta solo .xlsx', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input?.accept).toBe('.xlsx')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — botones de acción
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — botones', () => {
  it('tiene un botón "Cancelar"', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('tiene un botón "Importar"', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    expect(screen.getByText('Importar')).toBeInTheDocument()
  })

  it('el botón "Importar" está deshabilitado sin archivo seleccionado', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    const importar = screen.getByText('Importar').closest('button')
    expect(importar).toBeDisabled()
  })

  it('el botón "Cancelar" NO está deshabilitado inicialmente', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    const cancelar = screen.getByText('Cancelar').closest('button')
    expect(cancelar).not.toBeDisabled()
  })

  it('el botón "Cancelar" tiene clase btn-ghost', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    const btns = container.querySelectorAll('.btn-ghost')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('el botón "Importar" tiene clase btn-primary', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    const btns = container.querySelectorAll('.btn-primary')
    expect(btns.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — callbacks
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — callback onClose', () => {
  it('llama a onClose al hacer click en "Cancelar"', () => {
    const mockClose = vi.fn()
    render(<UploadModal open onClose={mockClose} onSuccess={noop} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('llama a onClose al hacer click en el overlay (fuera del modal)', () => {
    const mockClose = vi.fn()
    const { container } = render(
      <UploadModal open onClose={mockClose} onSuccess={noop} />
    )
    const overlay = container.querySelector('.modal-overlay')!
    fireEvent.click(overlay)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('NO llama a onClose al hacer click dentro del .modal', () => {
    const mockClose = vi.fn()
    const { container } = render(
      <UploadModal open onClose={mockClose} onSuccess={noop} />
    )
    const modal = container.querySelector('.modal')!
    fireEvent.click(modal)
    expect(mockClose).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — validación de archivo no-xlsx
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — validación de tipo de archivo', () => {
  it('muestra error si se sube un archivo que no es .xlsx', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'documento.pdf', { type: 'application/pdf' })

    // Simula la selección del archivo vía el change handler
    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: () => file },
      configurable: true,
    })
    fireEvent.change(input)

    expect(screen.getByText('El archivo debe ser .xlsx')).toBeInTheDocument()
  })

  it('el mensaje de error tiene clase .alert-error', () => {
    const { container } = render(
      <UploadModal open onClose={noop} onSuccess={noop} />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'test.pdf', { type: 'application/pdf' })

    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: () => file },
      configurable: true,
    })
    fireEvent.change(input)

    expect(container.querySelector('.alert-error')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — texto informativo
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — texto informativo', () => {
  it('muestra el texto sobre la convención de nombres de archivo', () => {
    render(<UploadModal open onClose={noop} onSuccess={noop} />)
    expect(
      screen.getByText(/El periodo se extrae del nombre del archivo/)
    ).toBeInTheDocument()
  })
})
