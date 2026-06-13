/**
 * components.test.tsx
 * Tests de Header, AppFrame y Dashboard.
 * Actualizado: header sin nav pills, launcher mockeado independientemente de fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import Header from '../components/Header'
import AppFrame from '../components/AppFrame'
import Dashboard from '../pages/Dashboard'
import PortalApp from '../App'
import { APP_REGISTRY, activeApps } from '../registry/apps'
import type { App } from '../registry/apps'

// ── Mock del launcher ─────────────────────────────────────────────────────────
// Aislamos isLauncherAvailable / launchApp / getLaunchStatus del fetch global
// para poder controlar cada escenario sin que las llamadas al launcher
// interfieran con el mock de fetch del preflight.
vi.mock('../api/launcher', () => ({
  isLauncherAvailable: vi.fn(),
  launchApp:           vi.fn().mockResolvedValue(undefined),
  getLaunchStatus:     vi.fn().mockResolvedValue({
    backend: 'pending', frontend: 'pending',
    done: false, error: null,
    backendLabel: 'Backend', frontendLabel: 'Frontend',
  }),
}))

import { isLauncherAvailable, launchApp, getLaunchStatus } from '../api/launcher'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const APP_ACTIVE: App = {
  id: 'test-active', name: 'Test Activa', description: 'Desc activa',
  icon: '🧪', url: 'http://localhost:9999', type: 'iframe',
  iconBg: '#EEF2F8', iconColor: '#0A1F44',
  tags: ['Test'], status: 'active', category: 'Testing',
}

const APP_COMING: App = {
  ...APP_ACTIVE,
  id: 'test-coming', name: 'Test Próximo', status: 'coming-soon',
}

const APP_MAINT: App = {
  ...APP_ACTIVE,
  id: 'test-maint', name: 'Test Mantenimiento', status: 'maintenance',
}

const APP_LINK: App = {
  ...APP_ACTIVE,
  id: 'test-link', name: 'Test Link', type: 'link',
}

// ══════════════════════════════════════════════════════════════════════════════
// Header
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — camino feliz', () => {
  it('renderiza el logo con texto "CFO"', () => {
    render(<Header onSelectApp={vi.fn()} />)
    expect(screen.getByText('CFO')).toBeInTheDocument()
  })

  it('renderiza "CFOTech" e "IT Tools"', () => {
    render(<Header onSelectApp={vi.fn()} />)
    expect(screen.getByText('CFOTech')).toBeInTheDocument()
    expect(screen.getByText('IT Tools')).toBeInTheDocument()
  })

  it('renderiza el botón Salir', () => {
    render(<Header onSelectApp={vi.fn()} />)
    expect(screen.getByText('Salir')).toBeInTheDocument()
  })

  it('click en el logo llama onSelectApp(null)', () => {
    const onSelect = vi.fn()
    render(<Header onSelectApp={onSelect} />)
    fireEvent.click(screen.getByText('CFOTech').closest('.header-logo')!)
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('NO renderiza nav pills', () => {
    render(<Header onSelectApp={vi.fn()} />)
    expect(document.querySelector('.nav-pill')).not.toBeInTheDocument()
    expect(document.querySelector('.header-nav')).not.toBeInTheDocument()
  })

  it('NO renderiza los nombres de las apps del registry', () => {
    render(<Header onSelectApp={vi.fn()} />)
    for (const app of APP_REGISTRY) {
      expect(screen.queryByText(app.name)).not.toBeInTheDocument()
    }
  })
})

describe('Header — manejo de errores', () => {
  it('renderiza sin errores con onSelectApp como no-op', () => {
    expect(() =>
      render(<Header onSelectApp={vi.fn()} />)
    ).not.toThrow()
  })
})

describe('Header — botón Volver (con app activa)', () => {
  it('cuando activeApp existe, muestra "← Volver" y NO muestra "Salir"', () => {
    render(<Header onSelectApp={vi.fn()} activeApp={APP_ACTIVE} onVolver={vi.fn()} />)
    expect(screen.getByText(/volver/i)).toBeInTheDocument()
    expect(screen.queryByText('Salir')).not.toBeInTheDocument()
  })

  it('click en "← Volver" llama a onVolver (para bajar servidor y volver al Dashboard)', () => {
    const onVolver = vi.fn()
    render(<Header onSelectApp={vi.fn()} activeApp={APP_ACTIVE} onVolver={onVolver} />)
    fireEvent.click(screen.getByText(/volver/i))
    expect(onVolver).toHaveBeenCalledTimes(1)
  })

  it('sin activeApp, muestra "Salir" y NO muestra "← Volver"', () => {
    render(<Header onSelectApp={vi.fn()} />)
    expect(screen.getByText('Salir')).toBeInTheDocument()
    expect(screen.queryByText(/volver/i)).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// AppFrame
// ══════════════════════════════════════════════════════════════════════════════

describe('AppFrame — camino feliz', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(new Response())
    vi.mocked(isLauncherAvailable).mockResolvedValue(false)
  })

  it('app "active" + type "iframe" renderiza un <iframe>', () => {
    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    expect(container.querySelector('iframe')).toBeInTheDocument()
  })

  it('el iframe tiene el src correcto', () => {
    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    const iframe = container.querySelector('iframe')
    expect(iframe?.src).toContain(APP_ACTIVE.url)
  })

  it('muestra el overlay de carga inmediatamente al montar', () => {
    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    // launching = true desde el inicio: el overlay .frame-loading-only aparece de inmediato
    expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()
  })

  it('app type "link" renderiza botón "Abrir en nueva pestaña", sin iframe', () => {
    const { container } = render(<AppFrame app={APP_LINK} />)
    expect(screen.getByText(/abrir en nueva pestaña/i)).toBeInTheDocument()
    expect(container.querySelector('iframe')).not.toBeInTheDocument()
  })
})

describe('AppFrame — estado offline (servidor no responde, launcher no disponible)', () => {
  beforeEach(() => {
    // Preflight fetch falla (servidor no corre)
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    // Launcher tampoco está disponible → muestra pantalla offline
    vi.mocked(isLauncherAvailable).mockResolvedValue(false)
  })

  it('muestra pantalla offline cuando fetch falla y launcher no está disponible', async () => {
    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    await waitFor(() =>
      expect(container.querySelector('.frame-offline')).toBeInTheDocument()
    )
  })

  it('pantalla offline muestra el nombre de la app', async () => {
    render(<AppFrame app={APP_ACTIVE} />)
    await waitFor(() =>
      expect(screen.getByText(`${APP_ACTIVE.name} no está disponible`)).toBeInTheDocument()
    )
  })

  it('pantalla offline NO muestra iframe', async () => {
    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    await waitFor(() =>
      expect(container.querySelector('.frame-offline')).toBeInTheDocument()
    )
    expect(container.querySelector('iframe')).not.toBeInTheDocument()
  })

  it('pantalla offline NO muestra la URL técnica de la app', async () => {
    render(<AppFrame app={APP_ACTIVE} />)
    await waitFor(() =>
      expect(screen.getByText(/no está disponible/i)).toBeInTheDocument()
    )
    // La URL técnica específica de la app no debe mostrarse
    expect(screen.queryByText(/localhost:9999/i)).not.toBeInTheDocument()
  })

  it('botón Reintentar existe en pantalla offline', async () => {
    render(<AppFrame app={APP_ACTIVE} />)
    await waitFor(() =>
      expect(screen.getByText(/reintentar/i)).toBeInTheDocument()
    )
  })

  it('botón Reintentar sale del estado offline cuando el servidor responde', async () => {
    // Primera pasada: falla → offline. Retry: resuelve → sale del offline.
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(new Response())
    // En el retry el launcher tampoco está disponible (misma condición)
    vi.mocked(isLauncherAvailable).mockResolvedValue(false)

    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    await waitFor(() =>
      expect(container.querySelector('.frame-offline')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByText(/reintentar/i))
    // Tras el retry, el preflight resuelve → ya no muestra offline
    await waitFor(() =>
      expect(container.querySelector('.frame-offline')).not.toBeInTheDocument()
    )
  })

  it('botón "Abrir en nueva pestaña" existe en pantalla offline', async () => {
    render(<AppFrame app={APP_ACTIVE} />)
    await waitFor(() =>
      expect(screen.getByText(/abrir en nueva pestaña/i)).toBeInTheDocument()
    )
  })
})

describe('AppFrame — estados especiales', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(new Response())
    vi.mocked(isLauncherAvailable).mockResolvedValue(false)
  })
  it('app "coming-soon" renderiza pantalla coming-soon, sin iframe', () => {
    const { container } = render(<AppFrame app={APP_COMING} />)
    expect(container.querySelector('.frame-coming-soon')).toBeInTheDocument()
    expect(container.querySelector('iframe')).not.toBeInTheDocument()
  })

  it('pantalla coming-soon muestra el nombre de la app', () => {
    render(<AppFrame app={APP_COMING} />)
    expect(screen.getByText(APP_COMING.name)).toBeInTheDocument()
  })

  it('app "maintenance" renderiza pantalla de mantenimiento, sin iframe', () => {
    const { container } = render(<AppFrame app={APP_MAINT} />)
    expect(container.querySelector('.frame-error')).toBeInTheDocument()
    expect(container.querySelector('iframe')).not.toBeInTheDocument()
  })

  it('pantalla mantenimiento muestra texto "mantenimiento"', () => {
    render(<AppFrame app={APP_MAINT} />)
    const elems = screen.getAllByText(/mantenimiento/i)
    expect(elems.length).toBeGreaterThan(0)
  })

  it('al cambiar app, el estado vuelve al overlay de carga', () => {
    const { rerender, container } = render(<AppFrame app={APP_ACTIVE} />)
    // Estado inicial: overlay visible
    expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()
    // Cambio de app → resetea a launching → overlay vuelve a aparecer
    rerender(<AppFrame app={{ ...APP_ACTIVE, id: 'test-otro', url: 'http://localhost:9998' }} />)
    expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// AppFrame — path del launcher (fetch falla → launcher levanta la app)
// Usa fake timers para controlar el timeout del preflight (1500ms) y el
// polling del estado (800ms) sin esperar tiempos reales.
// ══════════════════════════════════════════════════════════════════════════════

describe('AppFrame — launcher disponible', () => {
  // vi.advanceTimersByTimeAsync avanza el reloj Y flushea las Promises intermedias
  // (await isLauncherAvailable, await launchApp, await getLaunchStatus).
  // Usarlo dentro de act() asegura que React procese todos los state updates.

  beforeEach(() => {
    vi.useFakeTimers()
    // App NO está corriendo: preflight siempre falla de inmediato
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    vi.mocked(isLauncherAvailable).mockResolvedValue(true)
    vi.mocked(launchApp).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('llama a launchApp con el id correcto cuando el launcher está disponible', async () => {
    vi.mocked(getLaunchStatus).mockResolvedValue({
      backend: 'launching', frontend: 'pending',
      done: false, error: null,
      backendLabel: 'Backend', frontendLabel: 'Frontend',
    })

    render(<AppFrame app={APP_ACTIVE} />)

    // Avanzar más allá del timeout del preflight (1500ms) + flush async chain
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })

    expect(vi.mocked(launchApp)).toHaveBeenCalledWith(APP_ACTIVE.id)
  })

  it('el overlay de carga permanece mientras el launcher trabaja (done=false)', async () => {
    vi.mocked(getLaunchStatus).mockResolvedValue({
      backend: 'launching', frontend: 'pending',
      done: false, error: null,
      backendLabel: 'Backend', frontendLabel: 'Frontend',
    })

    const { container } = render(<AppFrame app={APP_ACTIVE} />)

    // Overlay visible de inmediato
    expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()

    // Avanzar: preflight timeout + dos polls
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })

    // Launcher aún no terminó → overlay sigue visible (ni offline)
    expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()
    expect(container.querySelector('.frame-offline')).not.toBeInTheDocument()
  })

  it('cuando done=true, el overlay persiste durante la carga del iframe y desaparece al onLoad', async () => {
    vi.mocked(getLaunchStatus).mockResolvedValue({
      backend: 'ready', frontend: 'ready',
      done: true, error: null,
      backendLabel: 'Backend', frontendLabel: 'Frontend',
    })

    const { container } = render(<AppFrame app={APP_ACTIVE} />)

    // Overlay visible de inmediato (fase launching)
    expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()

    // Avanzar: preflight timeout (1500ms) + primer poll (800ms) + flush Promises
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })

    // done:true → launching=false, pero loading=true → overlay sigue presente
    // El overlay unificado cubre tanto la fase launching como la carga del iframe
    expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()
    expect(container.querySelector('.frame-offline')).not.toBeInTheDocument()

    // El iframe dispara onLoad → loading=false → overlay desaparece
    const iframe = container.querySelector('iframe')!
    await act(async () => { fireEvent.load(iframe) })

    expect(container.querySelector('.frame-loading-only')).not.toBeInTheDocument()
  })

  it('cuando s.error es truthy, muestra pantalla offline', async () => {
    vi.mocked(getLaunchStatus).mockResolvedValue({
      backend: 'error', frontend: 'pending',
      done: false, error: 'Backend no respondió en 15s',
      backendLabel: 'Backend', frontendLabel: 'Frontend',
    })

    const { container } = render(<AppFrame app={APP_ACTIVE} />)

    // Avanzar: preflight timeout + primer poll + flush
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })

    // Launcher reportó error → pantalla offline, overlay ya no visible
    expect(container.querySelector('.frame-offline')).toBeInTheDocument()
    expect(container.querySelector('.frame-loading-only')).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════════════════════════

describe('Dashboard — camino feliz', () => {
  it('renderiza una card por cada app del registry', () => {
    render(<Dashboard onSelectApp={vi.fn()} />)
    for (const app of APP_REGISTRY) {
      expect(screen.getByText(app.name)).toBeInTheDocument()
    }
  })

  it('apps activas muestran botón "Abrir →"', () => {
    render(<Dashboard onSelectApp={vi.fn()} />)
    const abrirBtns = screen.getAllByText('Abrir →')
    expect(abrirBtns.length).toBe(activeApps.length)
  })

  it('apps coming-soon muestran botón "Próximamente" deshabilitado', () => {
    const comingSoon = APP_REGISTRY.filter(a => a.status === 'coming-soon')
    if (comingSoon.length === 0) return   // ninguna app en coming-soon actualmente
    render(<Dashboard onSelectApp={vi.fn()} />)
    const btns = screen.getAllByText('Próximamente')
      .filter(el => el.tagName === 'BUTTON')
    expect(btns.length).toBeGreaterThan(0)
    btns.forEach(btn => expect(btn).toBeDisabled())
  })

  it('click en "Abrir →" de app activa llama onSelectApp', () => {
    const onSelect = vi.fn()
    render(<Dashboard onSelectApp={onSelect} />)
    const [firstBtn] = screen.getAllByText('Abrir →')
    fireEvent.click(firstBtn)
    expect(onSelect).toHaveBeenCalledTimes(1)
    const calledWith: App = onSelect.mock.calls[0][0]
    expect(calledWith.status).toBe('active')
  })

  it('click en card activa llama onSelectApp', () => {
    const onSelect = vi.fn()
    render(<Dashboard onSelectApp={onSelect} />)
    const active = activeApps[0]
    if (!active) return
    const card = screen.getByText(active.name).closest('.app-card')!
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledWith(active)
  })

  it('muestra el conteo correcto de apps activas', () => {
    render(<Dashboard onSelectApp={vi.fn()} />)
    const text = screen.getByText(new RegExp(`${activeApps.length} de ${APP_REGISTRY.length}`))
    expect(text).toBeInTheDocument()
  })
})

describe('Dashboard — manejo de errores', () => {
  it('click en card coming-soon NO llama onSelectApp', () => {
    const onSelect = vi.fn()
    render(<Dashboard onSelectApp={onSelect} />)
    const coming = APP_REGISTRY.find(a => a.status === 'coming-soon')
    if (!coming) return
    const card = screen.getByText(coming.name).closest('.app-card')!
    fireEvent.click(card)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renderiza sin errores aunque no haya apps activas', () => {
    vi.doMock('../registry/apps', () => ({
      APP_REGISTRY: [{ ...APP_COMING }],
      activeApps: [],
      allApps: [{ ...APP_COMING }],
      getApp: () => undefined,
    }))
    expect(() => render(<Dashboard onSelectApp={vi.fn()} />)).not.toThrow()
    vi.resetModules()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Botón Abrir — parametrizado por cada app activa del registry
// ══════════════════════════════════════════════════════════════════════════════

describe('Dashboard — botón Abrir · por tarjeta activa', () => {
  activeApps.forEach(app => {
    describe(`[${app.name}]`, () => {
      it('la card renderiza el botón "Abrir →"', () => {
        render(<Dashboard onSelectApp={vi.fn()} />)
        const card = screen.getByText(app.name).closest('.app-card')!
        expect(within(card).getByText('Abrir →')).toBeInTheDocument()
      })

      it('click en "Abrir →" llama onSelectApp exactamente con esta app', () => {
        const onSelect = vi.fn()
        render(<Dashboard onSelectApp={onSelect} />)
        const card = screen.getByText(app.name).closest('.app-card')!
        fireEvent.click(within(card).getByText('Abrir →'))
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith(app)
      })

      it('click en la card llama onSelectApp exactamente con esta app', () => {
        const onSelect = vi.fn()
        render(<Dashboard onSelectApp={onSelect} />)
        const card = screen.getByText(app.name).closest('.app-card')!
        fireEvent.click(card)
        expect(onSelect).toHaveBeenCalledWith(app)
      })

      it('el objeto recibido por onSelectApp tiene id, url y status correctos', () => {
        const onSelect = vi.fn()
        render(<Dashboard onSelectApp={onSelect} />)
        const card = screen.getByText(app.name).closest('.app-card')!
        fireEvent.click(within(card).getByText('Abrir →'))
        const received: App = onSelect.mock.calls[0][0]
        expect(received.id).toBe(app.id)
        expect(received.url).toBe(app.url)
        expect(received.status).toBe('active')
      })
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Header — botón Salir con onSalirPortal
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — botón Salir con onSalirPortal', () => {
  it('cuando onSalirPortal está definido, click en "Salir" lo llama', () => {
    const onSalir = vi.fn()
    render(<Header onSelectApp={vi.fn()} onSalirPortal={onSalir} />)
    fireEvent.click(screen.getByText('Salir'))
    expect(onSalir).toHaveBeenCalledTimes(1)
  })

  it('cuando onSalirPortal NO está definido, click en "Salir" llama window.close()', () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
    render(<Header onSelectApp={vi.fn()} />)
    fireEvent.click(screen.getByText('Salir'))
    expect(closeSpy).toHaveBeenCalledTimes(1)
    closeSpy.mockRestore()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// AppFrame — tarjeta de lanzamiento (splash card)
// ══════════════════════════════════════════════════════════════════════════════

describe('AppFrame — overlay de carga simplificado', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(new Response())
    vi.mocked(isLauncherAvailable).mockResolvedValue(false)
  })

  it('el overlay .frame-loading-only contiene el reloj animado (.launch-clock)', () => {
    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    const overlay = container.querySelector('.frame-loading-only')!
    expect(overlay).toBeInTheDocument()
    expect(overlay.querySelector('.launch-clock')).toBeInTheDocument()
  })

  it('el overlay NO muestra texto de título ni pasos de lanzamiento', () => {
    render(<AppFrame app={APP_ACTIVE} />)
    // Diseño simplificado: solo el reloj, sin card, sin labels
    expect(screen.queryByText(`Iniciando ${APP_ACTIVE.name}`)).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// AppFrame — overlay durante lanzamiento: diseño simplificado (solo reloj)
// Verifica que el overlay es limpio: sin pasos, sin labels, sin badge de estado.
// ══════════════════════════════════════════════════════════════════════════════

describe('AppFrame — overlay durante lanzamiento (sin pasos visibles)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    vi.mocked(isLauncherAvailable).mockResolvedValue(true)
    vi.mocked(launchApp).mockResolvedValue(undefined)
  })
  afterEach(() => { vi.useRealTimers() })

  it('mientras el launcher trabaja NO se muestran .launch-step', async () => {
    vi.mocked(getLaunchStatus).mockResolvedValue({
      backend: 'launching', frontend: 'pending',
      done: false, error: null,
      backendLabel: 'API Node.js', frontendLabel: 'Frontend React',
    })

    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })

    // Diseño simplificado: los pasos de backend/frontend no se muestran en el overlay
    expect(container.querySelectorAll('.launch-step')).toHaveLength(0)
  })

  it('durante el lanzamiento el overlay sigue mostrando el .launch-clock', async () => {
    vi.mocked(getLaunchStatus).mockResolvedValue({
      backend: 'launching', frontend: 'pending',
      done: false, error: null,
      backendLabel: 'Backend', frontendLabel: 'Frontend',
    })

    const { container } = render(<AppFrame app={APP_ACTIVE} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })

    expect(container.querySelector('.frame-loading-only .launch-clock')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// App (portal root) — beforeunload dispara sendBeacon a stop-all
// ══════════════════════════════════════════════════════════════════════════════

describe('App — stop-all al cerrar el portal', () => {
  it('beforeunload llama navigator.sendBeacon con /api/stop-all', () => {
    const sendBeaconMock = vi.fn()
    // jsdom no implementa sendBeacon — lo definimos antes del render
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock, writable: true, configurable: true,
    })

    render(<PortalApp />)
    fireEvent(window, new Event('beforeunload'))

    expect(sendBeaconMock).toHaveBeenCalledWith('http://localhost:4999/api/stop-all')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// AppFrame embebido — parametrizado por cada app activa del registry
// Verifica que el iframe se monta correctamente para cada app que debe embeberse
// ══════════════════════════════════════════════════════════════════════════════

describe('AppFrame — modo embebido · por app activa', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(new Response())
    vi.mocked(isLauncherAvailable).mockResolvedValue(false)
  })

  activeApps.forEach(app => {
    describe(`[${app.name}] type="${app.type}" → ${app.url}`, () => {

      if (app.type === 'iframe') {
        it('renderiza un <iframe> (no pantalla coming-soon ni link)', () => {
          const { container } = render(<AppFrame app={app} />)
          expect(container.querySelector('iframe')).toBeInTheDocument()
          expect(container.querySelector('.frame-coming-soon')).not.toBeInTheDocument()
        })

        it(`el src del iframe apunta a ${app.url}`, () => {
          const { container } = render(<AppFrame app={app} />)
          const iframe = container.querySelector('iframe')!
          expect(iframe.src).toContain(app.url)
        })

        it('el iframe tiene el atributo title con el nombre de la app', () => {
          const { container } = render(<AppFrame app={app} />)
          const iframe = container.querySelector('iframe')!
          expect(iframe.title).toBe(app.name)
        })

        it('el sandbox incluye allow-scripts y allow-same-origin', () => {
          const { container } = render(<AppFrame app={app} />)
          const iframe = container.querySelector('iframe')!
          expect(iframe.getAttribute('sandbox')).toContain('allow-scripts')
          expect(iframe.getAttribute('sandbox')).toContain('allow-same-origin')
        })

        it('el sandbox incluye allow-forms y allow-popups (necesario para la app)', () => {
          const { container } = render(<AppFrame app={app} />)
          const iframe = container.querySelector('iframe')!
          expect(iframe.getAttribute('sandbox')).toContain('allow-forms')
          expect(iframe.getAttribute('sandbox')).toContain('allow-popups')
        })

        it('el iframe comienza visible (display !== "none") — no hay bloqueo X-Frame-Options al montar', () => {
          const { container } = render(<AppFrame app={app} />)
          const iframe = container.querySelector('iframe') as HTMLIFrameElement
          // display:'none' solo se pone cuando errored=true (X-Frame-Options DENY detectado)
          expect(iframe.style.display).not.toBe('none')
        })

        it('muestra el overlay de carga al montar (launching inmediato)', () => {
          const { container } = render(<AppFrame app={app} />)
          // El overlay .frame-loading-only aparece de inmediato, antes del preflight
          expect(container.querySelector('.frame-loading-only')).toBeInTheDocument()
        })

      } else {
        // type: 'link' — debe abrir en nueva pestaña, no en iframe
        it('type "link" — NO renderiza <iframe>', () => {
          const { container } = render(<AppFrame app={app} />)
          expect(container.querySelector('iframe')).not.toBeInTheDocument()
        })

        it('type "link" — muestra botón "Abrir en nueva pestaña"', () => {
          render(<AppFrame app={app} />)
          expect(screen.getByText(/abrir en nueva pestaña/i)).toBeInTheDocument()
        })
      }
    })
  })
})
