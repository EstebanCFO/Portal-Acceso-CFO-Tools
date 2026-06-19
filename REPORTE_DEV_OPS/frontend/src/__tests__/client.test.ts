/**
 * client.test.ts
 * Verifica que el cliente API exporta las funciones esperadas y construye
 * correctamente las URLs con encodeURIComponent.
 *
 * No hace llamadas HTTP reales — fetch está mockeado en setup.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiHealth,
  apiGenerar,
  apiEstado,
  apiOrgs,
  apiProyectos,
  apiProyectoInfo,
  apiProyectoDetalle,
  apiTestPlans,
  apiHistorial,
  apiLogs,
  apiLogContenido,
  urlDescarga,
  apiSalir,
} from '../api/client'

// ══════════════════════════════════════════════════════════════════════════════
// Exports — todas las funciones deben existir y ser llamables
// ══════════════════════════════════════════════════════════════════════════════

describe('client.ts — exports', () => {
  it('exporta apiHealth como función', () => {
    expect(typeof apiHealth).toBe('function')
  })

  it('exporta apiGenerar como función', () => {
    expect(typeof apiGenerar).toBe('function')
  })

  it('exporta apiEstado como función', () => {
    expect(typeof apiEstado).toBe('function')
  })

  it('exporta apiOrgs como función', () => {
    expect(typeof apiOrgs).toBe('function')
  })

  it('exporta apiProyectos como función', () => {
    expect(typeof apiProyectos).toBe('function')
  })

  it('exporta apiProyectoInfo como función', () => {
    expect(typeof apiProyectoInfo).toBe('function')
  })

  it('exporta apiProyectoDetalle como función', () => {
    expect(typeof apiProyectoDetalle).toBe('function')
  })

  it('exporta apiTestPlans como función', () => {
    expect(typeof apiTestPlans).toBe('function')
  })

  it('exporta apiHistorial como función', () => {
    expect(typeof apiHistorial).toBe('function')
  })

  it('exporta apiLogs como función', () => {
    expect(typeof apiLogs).toBe('function')
  })

  it('exporta apiLogContenido como función', () => {
    expect(typeof apiLogContenido).toBe('function')
  })

  it('exporta urlDescarga como función', () => {
    expect(typeof urlDescarga).toBe('function')
  })

  it('exporta apiSalir como función', () => {
    expect(typeof apiSalir).toBe('function')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// urlDescarga — construye URL correcta (sin llamadas HTTP)
// ══════════════════════════════════════════════════════════════════════════════

describe('urlDescarga — construcción de URL', () => {
  it('construye la ruta base /api/reporte-devops/descargar/<nombre>', () => {
    const url = urlDescarga('informe_20260611.pdf')
    expect(url).toBe('/api/reporte-devops/descargar/informe_20260611.pdf')
  })

  it('encodea correctamente nombres con espacios', () => {
    const url = urlDescarga('informe junio 2026.pdf')
    expect(url).toContain(encodeURIComponent('informe junio 2026.pdf'))
    expect(url).not.toContain(' ')
  })

  it('encodea caracteres especiales en el nombre', () => {
    const nombre = 'informe/test&data.pdf'
    const url = urlDescarga(nombre)
    expect(url).toBe(`/api/reporte-devops/descargar/${encodeURIComponent(nombre)}`)
  })

  it('devuelve string que empieza con /api/reporte-devops/descargar/', () => {
    const url = urlDescarga('cualquier.pdf')
    expect(url).toMatch(/^\/api\/reporte-devops\/descargar\//)
  })

  it('no modifica nombres simples sin caracteres especiales', () => {
    const url = urlDescarga('reporte.pdf')
    expect(url).toBe('/api/reporte-devops/descargar/reporte.pdf')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Funciones con parámetros — verificar que llaman a fetch con la URL correcta
// ══════════════════════════════════════════════════════════════════════════════

describe('apiProyectos — URL con encodeURIComponent', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear()
  })

  it('llama a fetch con la org encodeada en la URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await apiProyectos('CFOTech Org')
    const url = (vi.mocked(fetch).mock.calls[0][0] as string)
    expect(url).toContain(encodeURIComponent('CFOTech Org'))
    expect(url).not.toContain(' ')
  })

  it('llama a la ruta /api/reporte-devops/proyectos/<org>', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await apiProyectos('miOrg')
    const url = (vi.mocked(fetch).mock.calls[0][0] as string)
    expect(url).toBe('/api/reporte-devops/proyectos/miOrg')
  })
})

describe('apiLogContenido — URL con encodeURIComponent', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear()
  })

  it('llama a fetch con el nombre del log encodeado', async () => {
    const nombre = 'Trace 11-06-2026 10:30.log'
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ nombre, contenido: '' }), { status: 200 })
    )
    await apiLogContenido(nombre)
    const url = (vi.mocked(fetch).mock.calls[0][0] as string)
    expect(url).toContain(encodeURIComponent(nombre))
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Funciones POST — usan método POST
// ══════════════════════════════════════════════════════════════════════════════

describe('apiGenerar — método POST', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear()
  })

  it('llama a fetch con method POST', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, mensaje: 'Iniciado' }), { status: 200 })
    )
    await apiGenerar()
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(options?.method).toBe('POST')
  })
})

describe('apiSalir — método POST', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear()
  })

  it('llama a fetch con method POST', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    )
    await apiSalir()
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(options?.method).toBe('POST')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Manejo de errores HTTP
// ══════════════════════════════════════════════════════════════════════════════

describe('client.ts — manejo de errores HTTP', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear()
  })

  it('apiHealth lanza error si el servidor responde 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Error', { status: 500 })
    )
    await expect(apiHealth()).rejects.toThrow('HTTP 500')
  })

  it('apiOrgs lanza error si el servidor responde 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    )
    await expect(apiOrgs()).rejects.toThrow('HTTP 404')
  })

  it('apiEstado lanza error si el servidor responde 503', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Service Unavailable', { status: 503 })
    )
    await expect(apiEstado()).rejects.toThrow('HTTP 503')
  })
})
