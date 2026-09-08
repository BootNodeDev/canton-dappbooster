import { describe, expect, it } from 'vitest'
import { formatToken, formatTokenCompact, formatTokenFull } from '@/utils/format'

describe('formatToken / formatTokenFull', () => {
  it('shows full precision where the 2dp formatter would round up', () => {
    expect(formatToken('105.9154321')).toBe('105.92')
    expect(formatToken('0')).toBe('0.00')
    expect(formatToken('1234.5')).toBe('1,234.50')
    expect(formatTokenFull('105.9154321')).toBe('105.9154321')
  })

  it('formats a decimal string exactly at full ledger precision', () => {
    // The bug a double would introduce: this value cannot round-trip past six integer digits.
    expect(formatTokenFull('8421337.1234567891')).toBe('8,421,337.1234567891')
  })
})

describe('formatTokenCompact', () => {
  it('leaves an ordinary amount exact', () => {
    expect(formatTokenCompact('9999.5')).toBe('9,999.50')
  })

  it('abbreviates from ten thousand up', () => {
    expect(formatTokenCompact('12345')).toBe('12.35K')
    expect(formatTokenCompact('1500000')).toBe('1.5M')
    expect(formatTokenCompact('9999999999.99')).toBe('10B')
    expect(formatTokenCompact('2000000000000')).toBe('2T')
  })
})
