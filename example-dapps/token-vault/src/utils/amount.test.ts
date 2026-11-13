import { describe, expect, it } from 'vitest'
import { canonicalAmount, isPositive } from '@/utils/amount'

describe('canonicalAmount', () => {
  it('drops the padding a ledger Decimal carries', () => {
    expect(canonicalAmount('1000.0000000000')).toBe('1000')
    expect(canonicalAmount('25.50')).toBe('25.5')
    expect(canonicalAmount('1000.')).toBe('1000')
  })

  it.each(['', 'lots', '0.00000000001'])('throws on %j rather than sending zero', (value) => {
    expect(() => canonicalAmount(value)).toThrow(/Not a valid amount/)
  })
})

describe('isPositive', () => {
  it.each([
    ['1', true],
    ['0.0000000001', true],
    ['0', false],
    ['', false],
    ['abc', false],
  ])('reads %j as %s', (value, expected) => {
    expect(isPositive(value)).toBe(expected)
  })
})
