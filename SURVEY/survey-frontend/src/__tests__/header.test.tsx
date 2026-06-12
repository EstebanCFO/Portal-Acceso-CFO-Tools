/**
 * header.test.tsx
 * Tests del componente Header de Survey Analytics.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Header from '../components/Header'

// ══════════════════════════════════════════════════════════════════════════════
// Header — sin props (valores por defecto)
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — valores por defecto', () => {
  it('renderiza el badge "CFO"', () => {
    render(<Header />)
    expect(screen.getByText('CFO')).toBeInTheDocument()
  })

  it('renderiza "CFOTech"', () => {
    render(<Header />)
    expect(screen.getByText('CFOTech')).toBeInTheDocument()
  })

  it('renderiza "IT Tools"', () => {
    render(<Header />)
    expect(screen.getByText('IT Tools')).toBeInTheDocument()
  })

  it('renderiza el appName por defecto "Survey Analytics"', () => {
    render(<Header />)
    expect(screen.getByText('Survey Analytics')).toBeInTheDocument()
  })

  it('tiene clase .app-header en el elemento raíz', () => {
    const { container } = render(<Header />)
    expect(container.querySelector('.app-header')).toBeInTheDocument()
  })

  it('.logo-badge contiene "CFO"', () => {
    const { container } = render(<Header />)
    expect(container.querySelector('.logo-badge')?.textContent).toBe('CFO')
  })

  it('.header-brand-main contiene "CFOTech"', () => {
    const { container } = render(<Header />)
    expect(container.querySelector('.header-brand-main')?.textContent).toBe('CFOTech')
  })

  it('.header-brand-sub contiene "IT Tools"', () => {
    const { container } = render(<Header />)
    expect(container.querySelector('.header-brand-sub')?.textContent).toBe('IT Tools')
  })

  it('sin onSalir: NO renderiza el botón Salir', () => {
    render(<Header />)
    expect(screen.queryByText('Salir')).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Header — prop appName
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — prop appName', () => {
  it('muestra el appName personalizado', () => {
    render(<Header appName="Mi Survey App" />)
    expect(screen.getByText('Mi Survey App')).toBeInTheDocument()
  })

  it('.header-app-name tiene el texto correcto', () => {
    const { container } = render(<Header appName="Test App" />)
    expect(container.querySelector('.header-app-name')?.textContent).toBe('Test App')
  })

  it('NO muestra "Survey Analytics" cuando se pasa appName distinto', () => {
    render(<Header appName="Otro" />)
    expect(screen.queryByText('Survey Analytics')).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Header — prop onSalir
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — prop onSalir', () => {
  it('con onSalir: renderiza botón "Salir"', () => {
    render(<Header onSalir={() => {}} />)
    expect(screen.getByText('Salir')).toBeInTheDocument()
  })

  it('el botón Salir tiene clase btn-exit', () => {
    const { container } = render(<Header onSalir={() => {}} />)
    expect(container.querySelector('.btn-exit')).toBeInTheDocument()
  })

  it('hace click en Salir llama a onSalir', () => {
    const mock = vi.fn()
    render(<Header onSalir={mock} />)
    fireEvent.click(screen.getByText('Salir'))
    expect(mock).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Header — prop inPortal
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — prop inPortal', () => {
  it('cuando inPortal=true retorna null (no renderiza nada)', () => {
    const { container } = render(<Header inPortal />)
    expect(container.firstChild).toBeNull()
  })

  it('cuando inPortal=false (default) renderiza el header', () => {
    const { container } = render(<Header inPortal={false} />)
    expect(container.querySelector('.app-header')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Header — robustez
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — robustez', () => {
  it('no lanza error al renderizar sin props', () => {
    expect(() => render(<Header />)).not.toThrow()
  })

  it('no lanza error con todas las props', () => {
    expect(() => render(<Header appName="X" onSalir={() => {}} inPortal={false} />)).not.toThrow()
  })

  it('solo un .app-header por render', () => {
    const { container } = render(<Header />)
    expect(container.querySelectorAll('.app-header').length).toBe(1)
  })
})
