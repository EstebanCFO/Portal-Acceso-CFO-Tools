import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── Mock global de fetch ──────────────────────────────────────────────────────
// AppFrame hace un fetch pre-check de conectividad antes de cargar el iframe.
// En tests (jsdom), no hay red real. Mockeamos fetch para que resuelva con éxito
// por defecto → el iframe carga normalmente en todos los tests existentes.
// Tests que quieran simular "app offline" pueden sobreescribir con:
//   vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
global.fetch = vi.fn().mockResolvedValue(new Response())
