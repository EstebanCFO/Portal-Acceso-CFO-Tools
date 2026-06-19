/**
 * components.test.tsx
 * Tests de componentes React de Bandas Salariales (sin MUI — CSS plano DS).
 * Incluye: UploadModal
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadModal from '../components/UploadModal'
import { uploadExcel } from '../api/client'

// ── Mock del cliente API (axios) ──────────────────────────────────────────────
// UploadModal importa uploadExcel de '../api/client'.
// El mock intercepta la llamada para no hacer HTTP real en tests.
vi.mock('../api/client', () => ({
  uploadExcel: vi.fn().mockResolvedValue({
    data: { status: 'ok', message: 'Importado correctamente.' },
  }),
}))

const noop = () => {}
const ANIO_ACTUAL = new Date().getFullYear()

// helpers reutilizables
function renderOpen() {
  return render(<UploadModal open onClose={noop} onSuccess={noop} />)
}

function seleccionarArchivo(container: Element, nombre = 'Bandas.xlsx') {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file  = new File(['data'], nombre, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  Object.defineProperty(input, 'files', {
    value: { 0: file, length: 1, item: () => file },
    configurable: true,
  })
  fireEvent.change(input)
  return file
}

function seleccionarMes(container: Element, mes = 'Junio') {
  const selects = container.querySelectorAll('select')
  fireEvent.change(selects[0], { target: { value: mes } })
}

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
    const { container } = renderOpen()
    expect(container.querySelector('.modal-overlay')).toBeInTheDocument()
  })

  it('renderiza el .modal cuando open=true', () => {
    const { container } = renderOpen()
    expect(container.querySelector('.modal')).toBeInTheDocument()
  })

  it('muestra el header "Cargar nuevo Excel"', () => {
    renderOpen()
    expect(screen.getByText('Cargar nuevo Excel')).toBeInTheDocument()
  })

  it('tiene .modal-header con el título', () => {
    const { container } = renderOpen()
    const header = container.querySelector('.modal-header')
    expect(header?.textContent).toBe('Cargar nuevo Excel')
  })

  it('renderiza .modal-body', () => {
    const { container } = renderOpen()
    expect(container.querySelector('.modal-body')).toBeInTheDocument()
  })

  it('renderiza .modal-footer', () => {
    const { container } = renderOpen()
    expect(container.querySelector('.modal-footer')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — zona de carga
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — zona de carga', () => {
  it('muestra el ícono de upload (SVG cloud-upload)', () => {
    const { container } = renderOpen()
    const zone = container.querySelector('.upload-zone')
    expect(zone).toBeInTheDocument()
    expect(zone?.querySelector('svg')).toBeInTheDocument()
  })

  it('muestra el texto "Arrastra el archivo o hace click"', () => {
    renderOpen()
    expect(screen.getByText('Arrastra el archivo o hace click')).toBeInTheDocument()
  })

  it('muestra el caption "Solo archivos .xlsx"', () => {
    renderOpen()
    expect(screen.getByText('Solo archivos .xlsx')).toBeInTheDocument()
  })

  it('incluye un input type=file oculto', () => {
    const { container } = renderOpen()
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect((input as HTMLInputElement)?.style.display).toBe('none')
  })

  it('el input acepta solo .xlsx', () => {
    const { container } = renderOpen()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input?.accept).toBe('.xlsx')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — selector de mes y año
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — selector de mes y año', () => {
  it('renderiza el label "Mes *"', () => {
    renderOpen()
    expect(screen.getByText('Mes *')).toBeInTheDocument()
  })

  it('renderiza el label "Año *"', () => {
    renderOpen()
    expect(screen.getByText('Año *')).toBeInTheDocument()
  })

  it('el selector de mes tiene 13 opciones (placeholder + 12 meses)', () => {
    const { container } = renderOpen()
    const selects = container.querySelectorAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
    // primer select = mes
    expect(selects[0].options.length).toBe(13)
  })

  it('el selector de mes contiene los 12 meses en español', () => {
    const { container } = renderOpen()
    const mesSelect = container.querySelectorAll('select')[0]
    const opciones   = Array.from(mesSelect.options).map(o => o.value)
    expect(opciones).toContain('Enero')
    expect(opciones).toContain('Junio')
    expect(opciones).toContain('Diciembre')
  })

  it('el selector de año incluye el año actual', () => {
    const { container } = renderOpen()
    const anioSelect = container.querySelectorAll('select')[1]
    const opciones   = Array.from(anioSelect.options).map(o => o.value)
    expect(opciones).toContain(String(ANIO_ACTUAL))
  })

  it('el selector de año tiene el año actual seleccionado por defecto', () => {
    const { container } = renderOpen()
    const anioSelect = container.querySelectorAll('select')[1] as HTMLSelectElement
    expect(anioSelect.value).toBe(String(ANIO_ACTUAL))
  })

  it('el selector de mes comienza vacío (sin mes seleccionado)', () => {
    const { container } = renderOpen()
    const mesSelect = container.querySelectorAll('select')[0] as HTMLSelectElement
    expect(mesSelect.value).toBe('')
  })

  it('muestra el aviso "Seleccioná el mes antes de importar" cuando no hay mes', () => {
    renderOpen()
    expect(screen.getByText(/Seleccioná el mes antes de importar/)).toBeInTheDocument()
  })

  it('el aviso de mes desaparece al seleccionar un mes', () => {
    const { container } = renderOpen()
    seleccionarMes(container, 'Junio')
    expect(screen.queryByText(/Seleccioná el mes antes de importar/)).not.toBeInTheDocument()
  })

  it('muestra el texto de confirmación de solapa al seleccionar un mes', () => {
    const { container } = renderOpen()
    seleccionarMes(container, 'Junio')
    expect(screen.getByText(/Se leerá la solapa/)).toBeInTheDocument()
  })

  it('el texto de confirmación incluye el mes seleccionado', () => {
    const { container } = renderOpen()
    seleccionarMes(container, 'Junio')
    // La confirmación menciona el nombre de la solapa
    expect(container.querySelector('p')?.textContent).toContain('Junio')
  })

  it('la solapa mostrada en la confirmación incluye los últimos 2 dígitos del año', () => {
    const { container } = renderOpen()
    seleccionarMes(container, 'Junio')
    const solapaEsperada = `Junio ${String(ANIO_ACTUAL).slice(-2)}`  // e.g. "Junio 26"
    const parrafoSolapa = Array.from(container.querySelectorAll('p'))
      .find(p => p.textContent?.includes('Se leerá la solapa'))
    expect(parrafoSolapa?.textContent).toContain(solapaEsperada)
  })

  it('la confirmación muestra el período correcto (YYYY-MM) para Junio', () => {
    const { container } = renderOpen()
    seleccionarMes(container, 'Junio')
    const textoConfirmacion = Array.from(container.querySelectorAll('p'))
      .find(p => p.textContent?.includes('Período'))?.textContent ?? ''
    expect(textoConfirmacion).toContain(`${ANIO_ACTUAL}-06`)
  })

  it('la confirmación NO se muestra cuando no hay mes seleccionado', () => {
    renderOpen()
    expect(screen.queryByText(/Se leerá la solapa/)).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// UploadModal — botones de acción
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — botones', () => {
  it('tiene un botón "Cancelar"', () => {
    renderOpen()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('tiene un botón "Importar"', () => {
    renderOpen()
    expect(screen.getByText('Importar')).toBeInTheDocument()
  })

  it('el botón "Importar" está deshabilitado sin archivo ni mes', () => {
    renderOpen()
    const importar = screen.getByText('Importar').closest('button')
    expect(importar).toBeDisabled()
  })

  it('el botón "Importar" está deshabilitado con archivo pero sin mes', () => {
    const { container } = renderOpen()
    seleccionarArchivo(container)
    // mes sigue vacío → debe seguir deshabilitado
    const importar = screen.getByText('Importar').closest('button')
    expect(importar).toBeDisabled()
  })

  it('el botón "Importar" está deshabilitado con mes pero sin archivo', () => {
    const { container } = renderOpen()
    seleccionarMes(container, 'Junio')
    // archivo sigue vacío → debe seguir deshabilitado
    const importar = screen.getByText('Importar').closest('button')
    expect(importar).toBeDisabled()
  })

  it('el botón "Importar" se habilita con archivo Y mes seleccionados', () => {
    const { container } = renderOpen()
    seleccionarArchivo(container)
    seleccionarMes(container, 'Junio')
    const importar = screen.getByText('Importar').closest('button')
    expect(importar).not.toBeDisabled()
  })

  it('el botón "Cancelar" NO está deshabilitado inicialmente', () => {
    renderOpen()
    const cancelar = screen.getByText('Cancelar').closest('button')
    expect(cancelar).not.toBeDisabled()
  })

  it('el botón "Cancelar" tiene clase btn-ghost', () => {
    const { container } = renderOpen()
    expect(container.querySelectorAll('.btn-ghost').length).toBeGreaterThan(0)
  })

  it('el botón "Importar" tiene clase btn-primary', () => {
    const { container } = renderOpen()
    expect(container.querySelectorAll('.btn-primary').length).toBeGreaterThan(0)
  })

  it('al importar envía la solapa como "Mes YY" (nombre + últimos 2 dígitos del año)', async () => {
    // La solapa esperada: "Junio" + " " + últimos 2 dígitos del año actual
    const solapaEsperada = `Junio ${String(ANIO_ACTUAL).slice(-2)}`
    const periodoEsperado = `${ANIO_ACTUAL}-06`

    const { container } = renderOpen()
    seleccionarArchivo(container)
    seleccionarMes(container, 'Junio')
    fireEvent.click(screen.getByText('Importar'))

    await waitFor(() => {
      expect(vi.mocked(uploadExcel)).toHaveBeenCalledWith(
        expect.any(File),
        solapaEsperada,
        periodoEsperado,
      )
    })
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
    const { container } = renderOpen()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'documento.pdf', { type: 'application/pdf' })

    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: () => file },
      configurable: true,
    })
    fireEvent.change(input)

    expect(screen.getByText('El archivo debe ser .xlsx')).toBeInTheDocument()
  })

  it('el mensaje de error tiene clase .alert-error', () => {
    const { container } = renderOpen()
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
// UploadModal — estado después de seleccionar archivo .xlsx
// ══════════════════════════════════════════════════════════════════════════════

describe('UploadModal — estado con archivo válido seleccionado', () => {
  it('muestra el nombre del archivo al seleccionar un .xlsx', () => {
    const { container } = renderOpen()
    seleccionarArchivo(container, 'Bandas Junio 2026.xlsx')
    expect(screen.getByText('Bandas Junio 2026.xlsx')).toBeInTheDocument()
  })

  it('muestra el SVG de check al seleccionar un archivo válido', () => {
    const { container } = renderOpen()
    seleccionarArchivo(container)
    const zone = container.querySelector('.upload-zone.has-file')
    expect(zone).toBeInTheDocument()
    expect(zone?.querySelector('svg')).toBeInTheDocument()
  })

  it('agrega clase .has-file a la zona de carga', () => {
    const { container } = renderOpen()
    seleccionarArchivo(container)
    expect(container.querySelector('.upload-zone.has-file')).toBeInTheDocument()
  })
})
