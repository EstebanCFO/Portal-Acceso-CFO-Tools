import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global fetch — el Dashboard y SurveyDetail hacen llamadas al backend.
// Por defecto resuelve con una lista vacía; tests específicos pueden sobrescribir.
global.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ surveys: [], total: 0 }), { status: 200 })
)
