import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global fetch — los tests que necesiten simular respuestas concretas
// pueden usar: vi.mocked(fetch).mockResolvedValueOnce(...)
global.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
)
