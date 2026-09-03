import { describe, expect, it } from 'vitest'
import { formatFigure, formatFigureCompact, formatFigureFull } from '@/utils/format'

describe('formatFigure / formatFigureFull', () => {
  it('shows full precision where the 2dp formatter would round up', () => {
    expect(formatFigure('105.9154321')).toBe('105.92')
    expect(formatFigure('0')).toBe('0.00')
    expect(formatFigure('1234.5')).toBe('1,234.50')
    expect(formatFigureFull('105.9154321')).toBe('105.9154321')
  })

  it('formats a decimal string exactly at full ledger precision', () => {
    // The bug a double would introduce: this value cannot round-trip past six integer digits.
    expect(formatFigureFull('8421337.1234567891')).toBe('8,421,337.1234567891')
  })
})

describe('formatFigureCompact', () => {
  it('leaves an ordinary amount exact', () => {
    expect(formatFigureCompact('9999.5')).toBe('9,999.50')
  })

  it('abbreviates from ten thousand up', () => {
    expect(formatFigureCompact('12345')).toBe('12.35K')
    expect(formatFigureCompact('1500000')).toBe('1.5M')
    expect(formatFigureCompact('9999999999.99')).toBe('10B')
    expect(formatFigureCompact('2000000000000')).toBe('2T')
  })
})
