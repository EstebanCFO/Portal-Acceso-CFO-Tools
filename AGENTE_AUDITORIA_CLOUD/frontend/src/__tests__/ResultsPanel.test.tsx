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

  it('tiene links de descarga accesibles con text descriptivo', () => {
    render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    const mdLink = screen.getByRole('link', { name: /descargar informe markdown/i })
    const jsonLink = screen.getByRole('link', { name: /descargar informe json/i })
    expect(mdLink).toHaveAttribute('href', mockResult.blob_url_md)
    expect(jsonLink).toHaveAttribute('href', mockResult.blob_url_json)
  })

  it('tiene region aria-live para anunciar resultado', () => {
    const { container } = render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    const liveRegion = container.querySelector('[aria-live]')
    expect(liveRegion).toBeInTheDocument()
  })
})
