/**
 * uploadzone.test.tsx
 * Tests del componente UploadZone (drag & drop para archivos).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UploadZone from '../components/UploadZone'

const noop = () => {}

// ══════════════════════════════════════════════════════════════════════════════
// Estado idle — sin archivo cargado, sin loading
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadZone — estado idle', () => {
  it('muestra el label recibido por prop', () => {
    render(<UploadZone label="Sube el Job Description" onFiles={noop} />)
    expect(screen.getByText('Sube el Job Description')).toBeInTheDocument()
  })

  it('muestra el hint si se proporciona', () => {
    render(<UploadZone label="Test" hint="Formato PDF o DOCX" onFiles={noop} />)
    expect(screen.getByText('Formato PDF o DOCX')).toBeInTheDocument()
  })

  it('muestra el ícono por defecto 📄', () => {
    render(<UploadZone label="Test" onFiles={noop} />)
    expect(screen.getByText('📄')).toBeInTheDocument()
  })

  it('muestra el ícono personalizado cuando se proporciona', () => {
    render(<UploadZone label="Test" icon="📎" onFiles={noop} />)
    expect(screen.getByText('📎')).toBeInTheDocument()
  })

  it('muestra los tipos de archivo aceptados (derivados del prop accept)', () => {
    const { container } = render(
      <UploadZone label="Test" accept=".pdf,.docx" onFiles={noop} />
    )
    // El componente muestra accept.split(',').join(' · ')
    expect(container.textContent).toContain('.pdf · .docx')
  })

  it('tiene clase .upload-zone en el elemento raíz', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    expect(container.querySelector('.upload-zone')).toBeInTheDocument()
  })

  it('NO tiene clase "ready" cuando no hay filename', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    expect(container.querySelector('.upload-zone')?.className).not.toContain('ready')
  })

  it('NO tiene clase "loading" en estado normal', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    expect(container.querySelector('.upload-zone')?.className).not.toContain('loading')
  })

  it('incluye un input type="file" oculto', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect((input as HTMLInputElement)?.style.display).toBe('none')
  })

  it('el input tiene el atributo accept correcto', () => {
    const { container } = render(<UploadZone label="Test" accept=".pdf" onFiles={noop} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input?.accept).toBe('.pdf')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Estado ready — hay un archivo seleccionado (prop filename)
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadZone — estado ready (con filename)', () => {
  it('muestra el ícono ✅ cuando hay filename', () => {
    render(<UploadZone label="Test" filename="cv.pdf" onFiles={noop} />)
    expect(screen.getByText('✅')).toBeInTheDocument()
  })

  it('muestra el nombre del archivo', () => {
    render(<UploadZone label="Test" filename="curriculum_vitae.docx" onFiles={noop} />)
    expect(screen.getByText('curriculum_vitae.docx')).toBeInTheDocument()
  })

  it('muestra "Clic para reemplazar"', () => {
    render(<UploadZone label="Test" filename="doc.pdf" onFiles={noop} />)
    expect(screen.getByText('Clic para reemplazar')).toBeInTheDocument()
  })

  it('NO muestra el label original cuando hay filename', () => {
    render(<UploadZone label="Sube tu CV" filename="cv.pdf" onFiles={noop} />)
    expect(screen.queryByText('Sube tu CV')).not.toBeInTheDocument()
  })

  it('tiene clase "ready" cuando hay filename', () => {
    const { container } = render(
      <UploadZone label="Test" filename="cv.pdf" onFiles={noop} />
    )
    expect(container.querySelector('.upload-zone')?.className).toContain('ready')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Estado loading
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadZone — estado loading', () => {
  it('muestra el texto "Procesando..." cuando loading=true y hay filename', () => {
    render(<UploadZone label="Test" filename="cv.pdf" loading onFiles={noop} />)
    expect(screen.getByText(/Procesando/)).toBeInTheDocument()
  })

  it('muestra "Procesando archivo..." cuando loading=true sin filename', () => {
    render(<UploadZone label="Test" loading onFiles={noop} />)
    expect(screen.getByText(/Procesando/)).toBeInTheDocument()
  })

  it('incluye el nombre del archivo en el texto "Procesando" si hay filename', () => {
    render(<UploadZone label="Test" filename="mi_cv.pdf" loading onFiles={noop} />)
    expect(screen.getByText(/mi_cv\.pdf/)).toBeInTheDocument()
  })

  it('renderiza el spinner .spinner-sm cuando loading=true', () => {
    const { container } = render(<UploadZone label="Test" loading onFiles={noop} />)
    expect(container.querySelector('.spinner-sm')).toBeInTheDocument()
  })

  it('tiene clase "loading" cuando loading=true', () => {
    const { container } = render(<UploadZone label="Test" loading onFiles={noop} />)
    expect(container.querySelector('.upload-zone')?.className).toContain('loading')
  })

  it('NO muestra el label cuando está en loading', () => {
    render(<UploadZone label="Sube tu CV" loading onFiles={noop} />)
    expect(screen.queryByText('Sube tu CV')).not.toBeInTheDocument()
  })

  it('NO muestra ✅ cuando loading=true (loading tiene prioridad sobre filename)', () => {
    render(<UploadZone label="Test" filename="cv.pdf" loading onFiles={noop} />)
    expect(screen.queryByText('✅')).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Callback onFiles — drag & drop
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadZone — callback onFiles (drag & drop)', () => {
  it('llama a onFiles al soltar un archivo por drag & drop', () => {
    const mockOnFiles = vi.fn()
    const { container } = render(<UploadZone label="Test" onFiles={mockOnFiles} />)
    const zone = container.querySelector('.upload-zone')!
    const file = new File(['contenido'], 'test.pdf', { type: 'application/pdf' })

    fireEvent.dragOver(zone, { dataTransfer: { files: [file] } })
    fireEvent.drop(zone, {
      dataTransfer: { files: { 0: file, length: 1, item: () => file } },
    })

    expect(mockOnFiles).toHaveBeenCalledTimes(1)
  })

  it('NO llama a onFiles si loading=true al soltar', () => {
    const mockOnFiles = vi.fn()
    const { container } = render(
      <UploadZone label="Test" loading onFiles={mockOnFiles} />
    )
    const zone = container.querySelector('.upload-zone')!
    const file = new File(['x'], 'test.pdf')

    fireEvent.drop(zone, {
      dataTransfer: { files: { 0: file, length: 1, item: () => file } },
    })

    expect(mockOnFiles).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Clase "drag" — se añade/quita con dragOver/dragLeave
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadZone — clase drag', () => {
  it('agrega clase "drag" al hacer dragOver', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    const zone = container.querySelector('.upload-zone')!

    fireEvent.dragOver(zone)

    expect(zone.className).toContain('drag')
  })

  it('quita clase "drag" al hacer dragLeave', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    const zone = container.querySelector('.upload-zone')!

    fireEvent.dragOver(zone)
    fireEvent.dragLeave(zone)

    expect(zone.className).not.toContain('drag')
  })

  it('quita clase "drag" después del drop', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    const zone = container.querySelector('.upload-zone')!
    const file = new File(['x'], 'test.pdf')

    fireEvent.dragOver(zone)
    fireEvent.drop(zone, {
      dataTransfer: { files: { 0: file, length: 1, item: () => file } },
    })

    expect(zone.className).not.toContain('drag')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// multiple — prop para input
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadZone — prop multiple', () => {
  it('el input NO tiene multiple por defecto', () => {
    const { container } = render(<UploadZone label="Test" onFiles={noop} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input?.multiple).toBe(false)
  })

  it('el input tiene multiple cuando la prop es true', () => {
    const { container } = render(<UploadZone label="Test" multiple onFiles={noop} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input?.multiple).toBe(true)
  })
})
