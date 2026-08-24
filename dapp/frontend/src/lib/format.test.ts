import { describe, expect, it } from 'vitest'
import { formatCC, formatCCFull } from '@/lib/format'

describe('formatCC / formatCCFull', () => {
  it('shows full precision where the 2dp formatter would round up', () => {
    expect(formatCC('105.9154321')).toBe('105.92')
    expect(formatCCFull('105.9154321')).toBe('105.9154321')
  })

  it('formats a decimal string exactly at full ledger precision', () => {
    // The bug a double would introduce: this value cannot round-trip past six integer digits.
    expect(formatCCFull('8421337.1234567891')).toBe('8,421,337.1234567891')
  })
})
