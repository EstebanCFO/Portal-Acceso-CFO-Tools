/**
 * surveycard.test.tsx
 * Tests del componente SurveyCard (tarjeta de survey en el Dashboard).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SurveyCard from '../components/SurveyCard'
import type { SurveyItem } from '../types'

const SURVEY: SurveyItem = {
  id:            '123456',
  title:         'Post-Sprint Q1 2026',
  responseCount: 42,
  dateCreated:   '2026-01-15T00:00:00+00:00',
  dateModified:  '2026-03-01T00:00:00+00:00',
}

const SURVEY_NULL_DATES: SurveyItem = {
  id:            '789',
  title:         'Feedback Cliente XYZ',
  responseCount: 0,
  dateCreated:   null,
  dateModified:  null,
}

// ══════════════════════════════════════════════════════════════════════════════
// Renderizado básico
// ══════════════════════════════════════════════════════════════════════════════

describe('SurveyCard — renderizado', () => {
  it('muestra el título del survey', () => {
    render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(screen.getByText('Post-Sprint Q1 2026')).toBeInTheDocument()
  })

  it('muestra el responseCount', () => {
    render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('muestra la etiqueta "resp."', () => {
    render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(screen.getByText('resp.')).toBeInTheDocument()
  })

  it('muestra el ícono 📝', () => {
    render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(screen.getByText('📝')).toBeInTheDocument()
  })

  it('muestra la flecha de navegación →', () => {
    render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(screen.getByText('→')).toBeInTheDocument()
  })

  it('tiene clase .survey-card en el elemento raíz', () => {
    const { container } = render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(container.querySelector('.survey-card')).toBeInTheDocument()
  })

  it('muestra "Modificado:" en la metadata', () => {
    render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(screen.getByText(/Modificado:/)).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Con fechas nulas
// ══════════════════════════════════════════════════════════════════════════════

describe('SurveyCard — fechas nulas', () => {
  it('no rompe cuando dateCreated y dateModified son null', () => {
    expect(() =>
      render(<SurveyCard survey={SURVEY_NULL_DATES} onClick={() => {}} />)
    ).not.toThrow()
  })

  it('muestra "—" cuando la fecha es null', () => {
    render(<SurveyCard survey={SURVEY_NULL_DATES} onClick={() => {}} />)
    expect(screen.getByText(/—/)).toBeInTheDocument()
  })

  it('muestra responseCount 0', () => {
    render(<SurveyCard survey={SURVEY_NULL_DATES} onClick={() => {}} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Interacción — onClick
// ══════════════════════════════════════════════════════════════════════════════

describe('SurveyCard — onClick', () => {
  it('llama a onClick con el id correcto al hacer click', () => {
    const mockClick = vi.fn()
    render(<SurveyCard survey={SURVEY} onClick={mockClick} />)
    fireEvent.click(screen.getByText('Post-Sprint Q1 2026').closest('.survey-card')!)
    expect(mockClick).toHaveBeenCalledWith('123456')
    expect(mockClick).toHaveBeenCalledTimes(1)
  })

  it('llama a onClick con Enter (accesibilidad teclado)', () => {
    const mockClick = vi.fn()
    const { container } = render(<SurveyCard survey={SURVEY} onClick={mockClick} />)
    const card = container.querySelector('.survey-card')!
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(mockClick).toHaveBeenCalledWith('123456')
  })

  it('llama a onClick con Espacio (accesibilidad teclado)', () => {
    const mockClick = vi.fn()
    const { container } = render(<SurveyCard survey={SURVEY} onClick={mockClick} />)
    const card = container.querySelector('.survey-card')!
    fireEvent.keyDown(card, { key: ' ' })
    expect(mockClick).toHaveBeenCalledWith('123456')
  })

  it('NO llama a onClick con otras teclas', () => {
    const mockClick = vi.fn()
    const { container } = render(<SurveyCard survey={SURVEY} onClick={mockClick} />)
    const card = container.querySelector('.survey-card')!
    fireEvent.keyDown(card, { key: 'Tab' })
    expect(mockClick).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Accesibilidad
// ══════════════════════════════════════════════════════════════════════════════

describe('SurveyCard — accesibilidad', () => {
  it('tiene role="button"', () => {
    render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('tiene tabIndex=0 para ser focuseable por teclado', () => {
    const { container } = render(<SurveyCard survey={SURVEY} onClick={() => {}} />)
    const card = container.querySelector('.survey-card')!
    expect(card.getAttribute('tabindex')).toBe('0')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Título largo (truncado con CSS)
// ══════════════════════════════════════════════════════════════════════════════

describe('SurveyCard — título largo', () => {
  it('renderiza un título muy largo sin lanzar error', () => {
    const surveyLongTitle: SurveyItem = {
      ...SURVEY,
      title: 'Este es un título de survey muy largo que debería truncarse con CSS en la tarjeta del dashboard cuando supera el ancho disponible',
    }
    expect(() =>
      render(<SurveyCard survey={surveyLongTitle} onClick={() => {}} />)
    ).not.toThrow()
  })
})
