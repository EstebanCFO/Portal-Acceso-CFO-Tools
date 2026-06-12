import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global fetch — los componentes hacen polling al backend en useEffect.
// Por defecto resuelve con éxito; tests específicos pueden sobrescribir con:
//   vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
global.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), { status: 200 })
)
