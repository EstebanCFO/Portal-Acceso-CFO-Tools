import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global fetch — Layout/Header hacen polling al backend con pingBackend().
// Por defecto resuelve con éxito.
global.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), { status: 200 })
)
