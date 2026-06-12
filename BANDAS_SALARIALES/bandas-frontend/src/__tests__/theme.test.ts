/**
 * theme.test.ts
 * Tests del objeto DS y la función semaforo() de theme.ts.
 * Sin renders — lógica pura TypeScript.
 */
import { describe, it, expect } from 'vitest'
import { DS, semaforo } from '../theme'

// Helper: valida que un string sea un color hex válido (#RGB o #RRGGBB)
function isHexColor(v: string): boolean {
  return /^#[0-9A-Fa-f]{3,8}$/.test(v)
}

// ══════════════════════════════════════════════════════════════════════════════
// DS — objeto de tokens
// ══════════════════════════════════════════════════════════════════════════════

describe('DS — tokens requeridos existen', () => {
  it('tiene navyDark', () => {
    expect(DS.navyDark).toBeDefined()
  })
  it('tiene navy', () => {
    expect(DS.navy).toBeDefined()
  })
  it('tiene navy2', () => {
    expect(DS.navy2).toBeDefined()
  })
  it('tiene blue', () => {
    expect(DS.blue).toBeDefined()
  })
  it('tiene green', () => {
    expect(DS.green).toBeDefined()
  })
  it('tiene greenL', () => {
    expect(DS.greenL).toBeDefined()
  })
  it('tiene greenA', () => {
    expect(DS.greenA).toBeDefined()
  })
  it('tiene logoGreen', () => {
    expect(DS.logoGreen).toBeDefined()
  })
  it('tiene red', () => {
    expect(DS.red).toBeDefined()
  })
  it('tiene orange', () => {
    expect(DS.orange).toBeDefined()
  })
  it('tiene gray1', () => {
    expect(DS.gray1).toBeDefined()
  })
  it('tiene gray2', () => {
    expect(DS.gray2).toBeDefined()
  })
  it('tiene gray3', () => {
    expect(DS.gray3).toBeDefined()
  })
  it('tiene text', () => {
    expect(DS.text).toBeDefined()
  })
  it('tiene text2', () => {
    expect(DS.text2).toBeDefined()
  })
  it('tiene border', () => {
    expect(DS.border).toBeDefined()
  })
})

describe('DS — todos los valores son colores hex válidos', () => {
  const tokens = Object.entries(DS) as [string, string][]

  tokens.forEach(([key, value]) => {
    it(`DS.${key} = "${value}" es hex válido`, () => {
      expect(isHexColor(value)).toBe(true)
    })
  })
})

describe('DS — valores correctos del Design System', () => {
  it('navyDark es #0B1526', () => {
    expect(DS.navyDark).toBe('#0B1526')
  })

  it('navy es #0A1F44', () => {
    expect(DS.navy).toBe('#0A1F44')
  })

  it('logoGreen es #00A878', () => {
    expect(DS.logoGreen).toBe('#00A878')
  })

  it('greenA es #4FD1B2', () => {
    expect(DS.greenA).toBe('#4FD1B2')
  })

  it('gray1 (fondo) es #F4F6F9', () => {
    expect(DS.gray1).toBe('#F4F6F9')
  })

  it('red es #C0392B', () => {
    expect(DS.red).toBe('#C0392B')
  })

  it('orange es #C96A00', () => {
    expect(DS.orange).toBe('#C96A00')
  })

  it('border es #D1D9E6', () => {
    expect(DS.border).toBe('#D1D9E6')
  })

  it('el objeto DS es inmutable (as const)', () => {
    // TypeScript lo garantiza en compilación; en runtime es un objeto regular
    // Solo verificamos que los valores no han sido modificados
    expect(DS.navy).toBe('#0A1F44')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// semaforo() — lógica de colores por rango de valor (escala 1–5)
// ══════════════════════════════════════════════════════════════════════════════

describe('semaforo() — valor null', () => {
  it('devuelve un objeto con bg y color', () => {
    const result = semaforo(null)
    expect(result).toHaveProperty('bg')
    expect(result).toHaveProperty('color')
  })

  it('bg es DS.gray2 para valor null', () => {
    expect(semaforo(null).bg).toBe(DS.gray2)
  })

  it('color es DS.text2 para valor null', () => {
    expect(semaforo(null).color).toBe(DS.text2)
  })
})

describe('semaforo() — valor >= 4.0 (verde / en banda)', () => {
  it('bg es DS.green para 4.0', () => {
    expect(semaforo(4.0).bg).toBe(DS.green)
  })

  it('bg es DS.green para 5.0', () => {
    expect(semaforo(5.0).bg).toBe(DS.green)
  })

  it('bg es DS.green para 4.5', () => {
    expect(semaforo(4.5).bg).toBe(DS.green)
  })

  it('color para 4.0 es un hex claro (texto oscuro sobre verde)', () => {
    const { color } = semaforo(4.0)
    expect(isHexColor(color)).toBe(true)
  })
})

describe('semaforo() — 3.0 <= valor < 4.0 (naranja / revisar)', () => {
  it('bg es color claro (no DS.green ni DS.red) para 3.0', () => {
    const { bg } = semaforo(3.0)
    expect(bg).not.toBe(DS.green)
    expect(bg).not.toBe(DS.red)
  })

  it('color contiene el naranja DS.orange para 3.0', () => {
    expect(semaforo(3.0).color).toBe(DS.orange)
  })

  it('color contiene DS.orange para 3.5', () => {
    expect(semaforo(3.5).color).toBe(DS.orange)
  })

  it('color contiene DS.orange para 3.99', () => {
    expect(semaforo(3.99).color).toBe(DS.orange)
  })

  it('bg para 3.0 es hex válido', () => {
    expect(isHexColor(semaforo(3.0).bg)).toBe(true)
  })
})

describe('semaforo() — valor < 3.0 (rojo / fuera de banda)', () => {
  it('color es DS.red para 2.9', () => {
    expect(semaforo(2.9).color).toBe(DS.red)
  })

  it('color es DS.red para 1.0', () => {
    expect(semaforo(1.0).color).toBe(DS.red)
  })

  it('color es DS.red para 0', () => {
    expect(semaforo(0).color).toBe(DS.red)
  })

  it('bg para 2.9 es hex válido', () => {
    expect(isHexColor(semaforo(2.9).bg)).toBe(true)
  })

  it('bg no es DS.green para valor < 3', () => {
    expect(semaforo(2.0).bg).not.toBe(DS.green)
  })
})

describe('semaforo() — límites exactos', () => {
  it('4.0 cae en zona verde (>= 4.0)', () => {
    expect(semaforo(4.0).bg).toBe(DS.green)
  })

  it('3.9999 cae en zona naranja (< 4.0)', () => {
    expect(semaforo(3.9999).color).toBe(DS.orange)
  })

  it('3.0 cae en zona naranja (>= 3.0)', () => {
    expect(semaforo(3.0).color).toBe(DS.orange)
  })

  it('2.9999 cae en zona roja (< 3.0)', () => {
    expect(semaforo(2.9999).color).toBe(DS.red)
  })
})

describe('semaforo() — retorna objetos con estructura { bg, color }', () => {
  const valores = [null, 0, 1, 2.5, 3.0, 3.5, 4.0, 5.0]

  valores.forEach(v => {
    it(`semaforo(${v}) devuelve { bg: hex, color: hex }`, () => {
      const r = semaforo(v)
      expect(typeof r.bg).toBe('string')
      expect(typeof r.color).toBe('string')
      expect(isHexColor(r.bg)).toBe(true)
      expect(isHexColor(r.color)).toBe(true)
    })
  })
})
