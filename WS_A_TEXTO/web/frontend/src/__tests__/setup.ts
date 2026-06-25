/**
 * setup.ts — Sound Catch frontend tests
 * Mock global fetch para tests de cliente API.
 */
import { vi } from 'vitest'

// Mock global fetch antes de cada test
vi.stubGlobal('fetch', vi.fn())
