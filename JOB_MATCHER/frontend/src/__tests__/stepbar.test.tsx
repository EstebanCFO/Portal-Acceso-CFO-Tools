/**
 * stepbar.test.tsx
 * Tests del componente StepBar (barra de progreso por pasos).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StepBar from '../components/StepBar'

const STEPS = [
  { label: 'Carga JD' },
  { label: 'Carga CVs' },
  { label: 'Análisis' },
]

// ══════════════════════════════════════════════════════════════════════════════
// Labels — siempre se muestran
// ══════════════════════════════════════════════════════════════════════════════

describe('StepBar — labels', () => {
  it('renderiza todos los labels recibidos', () => {
    render(<StepBar steps={STEPS} current={1} />)
    expect(screen.getByText('Carga JD')).toBeInTheDocument()
    expect(screen.getByText('Carga CVs')).toBeInTheDocument()
    expect(screen.getByText('Análisis')).toBeInTheDocument()
  })

  it('labels tienen clase step-label', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    const labels = container.querySelectorAll('.step-label')
    expect(labels.length).toBe(3)
  })

  it('renderiza el contenedor .step-bar', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    expect(container.querySelector('.step-bar')).toBeInTheDocument()
  })

  it('renderiza un .step-item por cada paso', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    expect(container.querySelectorAll('.step-item').length).toBe(3)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Estados de los dots: done / active / pending
// ══════════════════════════════════════════════════════════════════════════════

describe('StepBar — estado con current=1 (paso 1 activo)', () => {
  it('el paso 1 tiene clase step-dot active', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[0].className).toContain('active')
  })

  it('el paso 2 tiene clase step-dot pending', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[1].className).toContain('pending')
  })

  it('el paso 3 tiene clase step-dot pending', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[2].className).toContain('pending')
  })

  it('el dot del paso 1 muestra "1" (no ✓)', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[0].textContent).toBe('1')
  })
})

describe('StepBar — estado con current=2 (paso 2 activo)', () => {
  it('el paso 1 tiene clase step-dot done', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[0].className).toContain('done')
  })

  it('el paso 2 tiene clase step-dot active', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[1].className).toContain('active')
  })

  it('el paso 3 tiene clase step-dot pending', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[2].className).toContain('pending')
  })

  it('el dot del paso 1 (done) muestra "✓"', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[0].textContent).toBe('✓')
  })

  it('el dot del paso 2 (active) muestra "2"', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[1].textContent).toBe('2')
  })
})

describe('StepBar — estado con current=3 (último paso activo)', () => {
  it('los pasos 1 y 2 tienen clase done', () => {
    const { container } = render(<StepBar steps={STEPS} current={3} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[0].className).toContain('done')
    expect(dots[1].className).toContain('done')
  })

  it('el paso 3 tiene clase active', () => {
    const { container } = render(<StepBar steps={STEPS} current={3} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[2].className).toContain('active')
  })

  it('los pasos 1 y 2 muestran ✓', () => {
    const { container } = render(<StepBar steps={STEPS} current={3} />)
    const dots = container.querySelectorAll('.step-dot')
    expect(dots[0].textContent).toBe('✓')
    expect(dots[1].textContent).toBe('✓')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Labels — clases según estado
// ══════════════════════════════════════════════════════════════════════════════

describe('StepBar — clases de step-label', () => {
  it('label del paso activo tiene clase active', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const labels = container.querySelectorAll('.step-label')
    expect(labels[1].className).toContain('active')
  })

  it('label del paso done tiene clase done', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const labels = container.querySelectorAll('.step-label')
    expect(labels[0].className).toContain('done')
  })

  it('label del paso pendiente tiene clase pending', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const labels = container.querySelectorAll('.step-label')
    expect(labels[2].className).toContain('pending')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Conectores (step-line) entre pasos
// ══════════════════════════════════════════════════════════════════════════════

describe('StepBar — conectores step-line', () => {
  it('no hay conector antes del primer paso', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    const items = container.querySelectorAll('.step-item')
    // El primer item NO debe tener .step-line
    expect(items[0].querySelector('.step-line')).toBeNull()
  })

  it('hay conectores antes del paso 2 y 3', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    const items = container.querySelectorAll('.step-item')
    expect(items[1].querySelector('.step-line')).toBeInTheDocument()
    expect(items[2].querySelector('.step-line')).toBeInTheDocument()
  })

  it('conector antes del paso 2 es "done" cuando current >= 2', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const items = container.querySelectorAll('.step-item')
    const line = items[1].querySelector('.step-line')
    expect(line?.className).toContain('done')
  })

  it('conector antes del paso 3 es "pending" cuando current = 2', () => {
    const { container } = render(<StepBar steps={STEPS} current={2} />)
    const items = container.querySelectorAll('.step-item')
    const line = items[2].querySelector('.step-line')
    expect(line?.className).toContain('pending')
  })

  it('conector antes del paso 3 es "done" cuando current = 3', () => {
    const { container } = render(<StepBar steps={STEPS} current={3} />)
    const items = container.querySelectorAll('.step-item')
    const line = items[2].querySelector('.step-line')
    expect(line?.className).toContain('done')
  })

  it('total de conectores = (pasos - 1)', () => {
    const { container } = render(<StepBar steps={STEPS} current={1} />)
    expect(container.querySelectorAll('.step-line').length).toBe(2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Casos extremos
// ══════════════════════════════════════════════════════════════════════════════

describe('StepBar — casos extremos', () => {
  it('funciona con un único paso', () => {
    render(<StepBar steps={[{ label: 'Único' }]} current={1} />)
    expect(screen.getByText('Único')).toBeInTheDocument()
  })

  it('un único paso no tiene conectores', () => {
    const { container } = render(<StepBar steps={[{ label: 'Solo' }]} current={1} />)
    expect(container.querySelectorAll('.step-line').length).toBe(0)
  })

  it('no lanza error al renderizar 5 pasos', () => {
    const fiveSteps = Array.from({ length: 5 }, (_, i) => ({ label: `Paso ${i + 1}` }))
    expect(() => render(<StepBar steps={fiveSteps} current={3} />)).not.toThrow()
  })
})
