/**
 * header.test.tsx
 * Tests del componente Header del Reporte DevOps.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renderiza el nombre de app por defecto "Reporte DevOps"', () => {
    render(<Header />)
    expect(screen.getByText('Reporte DevOps')).toBeInTheDocument()
  })

  it('usa la clase .app-header en el elemento raíz', () => {
    const { container } = render(<Header />)
    expect(container.querySelector('.app-header')).toBeInTheDocument()
  })

  it('renderiza .logo-badge con el texto "CFO"', () => {
    const { container } = render(<Header />)
    const badge = container.querySelector('.logo-badge')
    expect(badge).toBeInTheDocument()
    expect(badge?.textContent).toBe('CFO')
  })

  it('renderiza .header-brand-main con "CFOTech"', () => {
    const { container } = render(<Header />)
    const main = container.querySelector('.header-brand-main')
    expect(main?.textContent).toBe('CFOTech')
  })

  it('renderiza .header-brand-sub con "IT Tools"', () => {
    const { container } = render(<Header />)
    const sub = container.querySelector('.header-brand-sub')
    expect(sub?.textContent).toBe('IT Tools')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Header — prop appName
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — prop appName', () => {
  it('muestra el appName recibido por prop', () => {
    render(<Header appName="Otro Modulo" />)
    expect(screen.getByText('Otro Modulo')).toBeInTheDocument()
  })

  it('NO muestra "Reporte DevOps" si se pasa un appName distinto', () => {
    render(<Header appName="Otro Modulo" />)
    expect(screen.queryByText('Reporte DevOps')).not.toBeInTheDocument()
  })

  it('appName vacío usa el valor por defecto "Reporte DevOps"', () => {
    // La prop es opcional; sin ella usa el default
    render(<Header />)
    expect(screen.getByText('Reporte DevOps')).toBeInTheDocument()
  })

  it('renderiza .header-app-name con el appName correcto', () => {
    const { container } = render(<Header appName="Test App" />)
    const el = container.querySelector('.header-app-name')
    expect(el?.textContent).toBe('Test App')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Header — robustez
// ══════════════════════════════════════════════════════════════════════════════

describe('Header — robustez', () => {
  it('no lanza error al renderizar sin props', () => {
    expect(() => render(<Header />)).not.toThrow()
  })

  it('no lanza error al renderizar con appName prop', () => {
    expect(() => render(<Header appName="X" />)).not.toThrow()
  })

  it('siempre renderiza exactamente un .app-header', () => {
    const { container } = render(<Header />)
    expect(container.querySelectorAll('.app-header').length).toBe(1)
  })

  it('siempre renderiza exactamente un .logo-badge', () => {
    const { container } = render(<Header />)
    expect(container.querySelectorAll('.logo-badge').length).toBe(1)
  })
})
