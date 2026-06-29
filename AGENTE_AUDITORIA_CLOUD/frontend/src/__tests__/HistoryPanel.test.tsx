import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryPanel } from '../components/HistoryPanel'
import * as client from '../api/client'
import type { HistoryEntry } from '../types/audit'

const entry: HistoryEntry = {
  nombre_app: 'bancogalicia', fecha: '2026-06-28', version: 'v2',
  url_md: 'http://x/test.md', url_json: 'http://x/test.json', url_pdf: 'http://x/test.pdf',
  brechas: { alta: 3, media: 5, baja: 2 },
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('HistoryPanel', () => {
  it('muestra un link de descarga PDF por informe', async () => {
    vi.spyOn(client, 'getHistory').mockResolvedValue([entry])
    render(<HistoryPanel />)
    const pdf = await screen.findByRole('link', { name: /descargar pdf de bancogalicia/i })
    expect(pdf).toHaveAttribute('href', entry.url_pdf)
  })

  it('tiene un botón papelera que borra el informe y la línea', async () => {
    const user = userEvent.setup()
    vi.spyOn(client, 'getHistory').mockResolvedValue([entry])
    const del = vi.spyOn(client, 'deleteReport').mockResolvedValue()

    render(<HistoryPanel />)
    await screen.findByText('bancogalicia')

    await user.click(screen.getByRole('button', { name: /eliminar informe de bancogalicia/i }))

    expect(del).toHaveBeenCalledWith({ nombre_app: 'bancogalicia', fecha: '2026-06-28', version: 'v2' })
    await waitFor(() => expect(screen.queryByText('bancogalicia')).not.toBeInTheDocument())
  })
})
