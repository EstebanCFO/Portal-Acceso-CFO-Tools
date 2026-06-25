/**
 * registry.test.ts
 * Valida la integridad del registro de apps.
 * Estos tests deben pasar cada vez que se agrega o modifica una app.
 */
import { describe, it, expect } from 'vitest'
import { APP_REGISTRY, getApp, activeApps, allApps } from '../registry/apps'
import type { App } from '../registry/apps'

// ── Camino feliz ─────────────────────────────────────────────────────────────

describe('APP_REGISTRY — estructura', () => {
  it('es un array no vacío', () => {
    expect(Array.isArray(APP_REGISTRY)).toBe(true)
    expect(APP_REGISTRY.length).toBeGreaterThan(0)
  })

  it('cada app tiene todos los campos requeridos', () => {
    // Campos que deben existir Y ser truthy (no vacíos)
    const required: (keyof App)[] = [
      'id', 'name', 'description', 'icon',
      'url', 'type', 'iconBg', 'iconColor',
      'tags', 'status',
    ]
    // Campos que deben existir pero pueden ser string vacío (p.ej. category opcional)
    const present: (keyof App)[] = ['category']

    for (const app of APP_REGISTRY) {
      for (const field of required) {
        expect(app, `App "${app.id}" falta campo "${field}"`).toHaveProperty(field)
        expect(app[field], `App "${app.id}" campo "${field}" está vacío`).toBeTruthy()
      }
      for (const field of present) {
        expect(app, `App "${app.id}" falta campo "${field}"`).toHaveProperty(field)
      }
    }
  })

  it('todos los IDs son únicos', () => {
    const ids = APP_REGISTRY.map(a => a.id)
    const uniq = new Set(ids)
    expect(uniq.size).toBe(ids.length)
  })

  it('todos los nombres son únicos', () => {
    const names = APP_REGISTRY.map(a => a.name)
    const uniq = new Set(names)
    expect(uniq.size).toBe(names.length)
  })

  it('type solo puede ser "iframe" o "link"', () => {
    for (const app of APP_REGISTRY) {
      expect(['iframe', 'link'], `App "${app.id}" tiene type inválido`).toContain(app.type)
    }
  })

  it('status solo puede ser "active", "maintenance" o "coming-soon"', () => {
    for (const app of APP_REGISTRY) {
      expect(['active', 'maintenance', 'coming-soon'], `App "${app.id}" tiene status inválido`)
        .toContain(app.status)
    }
  })

  it('todas las URLs son http(s) absolutas o rutas relativas del gateway (/apps/)', () => {
    for (const app of APP_REGISTRY) {
      const isAbsolute = /^https?:\/\/.+/.test(app.url)
      const isGatewayPath = app.url.startsWith('/apps/')
      expect(
        isAbsolute || isGatewayPath,
        `App "${app.id}" URL inválida: "${app.url}" debe ser http(s):// o /apps/...`
      ).toBe(true)
    }
  })

  it('tags es un array (puede estar vacío)', () => {
    for (const app of APP_REGISTRY) {
      expect(Array.isArray(app.tags), `App "${app.id}" tags no es array`).toBe(true)
    }
  })

  it('iconBg e iconColor son colores hex válidos', () => {
    const hexColor = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
    for (const app of APP_REGISTRY) {
      expect(app.iconBg,    `App "${app.id}" iconBg inválido`).toMatch(hexColor)
      expect(app.iconColor, `App "${app.id}" iconColor inválido`).toMatch(hexColor)
    }
  })
})

// ── getApp ───────────────────────────────────────────────────────────────────

describe('getApp', () => {
  it('devuelve la app correcta por id', () => {
    for (const app of APP_REGISTRY) {
      expect(getApp(app.id)).toEqual(app)
    }
  })

  it('devuelve undefined para un id inexistente', () => {
    expect(getApp('__no_existe__')).toBeUndefined()
  })

  it('devuelve undefined para string vacío', () => {
    expect(getApp('')).toBeUndefined()
  })
})

// ── activeApps ───────────────────────────────────────────────────────────────

describe('activeApps', () => {
  it('contiene solo apps con status "active"', () => {
    for (const app of activeApps) {
      expect(app.status).toBe('active')
    }
  })

  it('no contiene apps coming-soon ni maintenance', () => {
    const ids = activeApps.map(a => a.id)
    for (const app of APP_REGISTRY.filter(a => a.status !== 'active')) {
      expect(ids).not.toContain(app.id)
    }
  })
})

// ── allApps ──────────────────────────────────────────────────────────────────

describe('allApps', () => {
  it('es igual a APP_REGISTRY', () => {
    expect(allApps).toEqual(APP_REGISTRY)
  })
})

// ── Invariantes de negocio ────────────────────────────────────────────────────

describe('invariantes de negocio', () => {
  it('al menos una app debe estar activa para que el portal sea funcional', () => {
    expect(activeApps.length).toBeGreaterThan(0)
  })

  it('reporte-devops existe, está en el gateway y está activa', () => {
    const app = getApp('reporte-devops')
    expect(app).toBeDefined()
    expect(app?.url).toBe('/apps/reporte-devops/')
    expect(app?.status).toBe('active')
    expect(app?.type).toBe('iframe')
  })

  it('job-matcher existe, está en el gateway y está activa', () => {
    const app = getApp('job-matcher')
    expect(app).toBeDefined()
    expect(app?.url).toBe('/apps/job-matcher/')
    expect(app?.status).toBe('active')
    expect(app?.type).toBe('iframe')
  })

  it('bandas-salariales existe, está en el gateway y está activa', () => {
    const app = getApp('bandas-salariales')
    expect(app).toBeDefined()
    expect(app?.url).toBe('/apps/bandas-salariales/')
    expect(app?.status).toBe('active')
    expect(app?.type).toBe('iframe')
  })

  it('survey existe, está en el gateway y está activa', () => {
    const app = getApp('survey')
    expect(app).toBeDefined()
    expect(app?.url).toBe('/apps/survey/')
    expect(app?.status).toBe('active')
    expect(app?.type).toBe('iframe')
  })

  it('audio-a-texto (sound-catch) existe, está servido inline por el gateway y está activa', () => {
    const app = getApp('sound-catch')
    expect(app).toBeDefined()
    expect(app?.name).toBe('Audio a Texto')
    // URL relativa del gateway unificado (ya no usa puerto :5009 separado)
    expect(app?.url).toBe('/apps/sound-catch/')
    expect(app?.status).toBe('active')
    expect(app?.type).toBe('iframe')
    expect(app?.category).toBe('')
  })
})
