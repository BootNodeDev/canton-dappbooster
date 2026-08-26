import { describe, expect, it } from 'vitest'
import { formatCC, formatCCCompact, formatCCFull } from '@/utils/format'

describe('formatCC / formatCCFull', () => {
  it('shows full precision where the 2dp formatter would round up', () => {
    expect(formatCC('105.9154321')).toBe('105.92')
    expect(formatCC('0')).toBe('0.00')
    expect(formatCC('1234.5')).toBe('1,234.50')
    expect(formatCCFull('105.9154321')).toBe('105.9154321')
  })

  it('formats a decimal string exactly at full ledger precision', () => {
    // The bug a double would introduce: this value cannot round-trip past six integer digits.
    expect(formatCCFull('8421337.1234567891')).toBe('8,421,337.1234567891')
  })
})

describe('formatCCCompact', () => {
  it('leaves an ordinary amount exact', () => {
    expect(formatCCCompact('9999.5')).toBe('9,999.50')
  })

  it('abbreviates from ten thousand up', () => {
    expect(formatCCCompact('12345')).toBe('12.35K')
    expect(formatCCCompact('1500000')).toBe('1.5M')
    expect(formatCCCompact('9999999999.99')).toBe('10B')
    expect(formatCCCompact('2000000000000')).toBe('2T')
  })
})
