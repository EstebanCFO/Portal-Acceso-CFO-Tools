import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAudit, getHistory } from '../api/client'
import type { AuditRequest } from '../types/audit'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('runAudit', () => {
  it('POST /api/audit con JSON para tipo repo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ informe_md: '# Test', brechas_resumen: { alta: 1, media: 2, baja: 3 } }),
    })
    const req: AuditRequest = {
      type: 'repo',
      normativas: ['wcag22'],
      repo: { platform: 'azure-devops', org: 'mi-org', project: 'mi-proyecto', repo: 'mi-repo', branch: 'main', pat: 'abc' },
    }
    const result = await runAudit(req)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/audit'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.informe_md).toBe('# Test')
  })

  it('POST /api/audit con FormData para tipo local', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ informe_md: '# Local', brechas_resumen: { alta: 0, media: 1, baja: 0 } }),
    })
    const file = new File(['<html></html>'], 'index.html', { type: 'text/html' })
    const req: AuditRequest = {
      type: 'local',
      normativas: ['wcag22', 'onti'],
      local: { files: [file], name: 'Mi App' },
    }
    const result = await runAudit(req)
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.body).toBeInstanceOf(FormData)
    expect(result.informe_md).toBe('# Local')
  })

  it('lanza error si la respuesta no es ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Internal error' })
    const req: AuditRequest = { type: 'url', normativas: ['wcag22'], url: { url: 'https://example.com', depth: 1 } }
    await expect(runAudit(req)).rejects.toThrow('Internal error')
  })
})

describe('getHistory', () => {
  it('GET /api/history y retorna lista', async () => {
    const mockHistory = [{ nombre_app: 'bancogalicia', fecha: '2026-06-28', version: '', url_md: '', url_json: '', brechas: { alta: 8, media: 12, baja: 10 } }]
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockHistory })
    const result = await getHistory()
    expect(result).toHaveLength(1)
    expect(result[0].nombre_app).toBe('bancogalicia')
  })
})
