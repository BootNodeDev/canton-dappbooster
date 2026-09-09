import { describe, expect, it } from 'vitest'
import { formatFigure } from '#src/components/TokenInput/formatFigure'

describe('formatFigure', () => {
  it('carries two decimals by default, rounding half up', () => {
    expect(formatFigure('1234.5')).toBe('1,234.50')
    expect(formatFigure('0')).toBe('0.00')
    expect(formatFigure('105.9154321')).toBe('105.92')
  })

  it('reports nothing for an amount it cannot read', () => {
    expect(formatFigure(undefined)).toBeUndefined()
    expect(formatFigure('')).toBeUndefined()
    expect(formatFigure('abc')).toBeUndefined()
  })

  it('takes the places the caller asks for', () => {
    expect(formatFigure('1234.5678', { places: 0 })).toBe('1,235')
    expect(formatFigure('1234.5678', { places: 4 })).toBe('1,234.5678')
    expect(formatFigure('1234.5', { places: 4 })).toBe('1,234.5000')
  })

  it('clamps the places to what an amount can hold', () => {
    expect(formatFigure('1.5', { places: 99 })).toBe(formatFigure('1.5', { places: 10 }))
    expect(formatFigure('1.5', { places: -1 })).toBe(formatFigure('1.5', { places: 0 }))
  })

  it('groups under the locale it is given', () => {
    expect(formatFigure('1234.5', { locale: 'de-DE' })).toBe('1.234,50')
  })
})
