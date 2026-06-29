import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsPanel } from '../components/ResultsPanel'
import type { AuditResponse } from '../types/audit'

const mockResult: AuditResponse = {
  informe_md: '# Informe\n\n## Brechas\n- Brecha 1\n- Brecha 2',
  informe_json: '{}',
  brechas_resumen: { alta: 3, media: 5, baja: 2 },
  blob_url_md: 'https://storage.azure.com/reports/test.md',
  blob_url_json: 'https://storage.azure.com/reports/test.json',
  blob_url_pdf: 'https://storage.azure.com/reports/test.pdf',
  nombre_app: 'bancogalicia',
  fecha: '2026-06-28',
}

describe('ResultsPanel', () => {
  it('muestra resumen de brechas con badges de severidad', () => {
    render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    expect(screen.getByText('3 Altas')).toBeInTheDocument()
    expect(screen.getByText('5 Medias')).toBeInTheDocument()
    expect(screen.getByText('2 Bajas')).toBeInTheDocument()
  })

  it('tiene un link de descarga PDF accesible y no MD/JSON', () => {
    render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    const pdfLink = screen.getByRole('link', { name: /descargar informe pdf/i })
    expect(pdfLink).toHaveAttribute('href', mockResult.blob_url_pdf)
    expect(screen.queryByRole('link', { name: /markdown/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /json/i })).not.toBeInTheDocument()
  })

  it('mantiene la vista previa "Ver informe" en pantalla', () => {
    render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    expect(screen.getByText(/ver informe/i)).toBeInTheDocument()
  })

  it('tiene region aria-live para anunciar resultado', () => {
    const { container } = render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    const liveRegion = container.querySelector('[aria-live]')
    expect(liveRegion).toBeInTheDocument()
  })
})
