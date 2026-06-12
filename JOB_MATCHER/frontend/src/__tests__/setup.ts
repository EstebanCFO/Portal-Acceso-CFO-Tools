import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global fetch — algunos componentes hacen llamadas al backend.
// Por defecto resuelve con éxito; tests que necesitan simular error pueden usar:
//   vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
global.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
)
