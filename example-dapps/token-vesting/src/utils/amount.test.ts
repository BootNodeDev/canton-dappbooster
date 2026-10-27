import { parseAmount } from '@bootnodedev/canton-dappbooster'
import { describe, expect, it } from 'vitest'
import {
  addAmounts,
  canonicalAmount,
  compareAmounts,
  multiplyAmounts,
  multiplyByFraction,
  roundAmount,
  subtractAmounts,
} from '@/utils/amount'

describe('addAmounts', () => {
  it('adds without float drift', () => {
    expect(addAmounts('0.1', '0.2')).toBe('0.3')
    expect(addAmounts('8421337.1234567891', '0.0000000001')).toBe('8421337.1234567892')
  })

  it('adds nothing to zero', () => {
    expect(addAmounts()).toBe('0')
  })
})

describe('subtractAmounts', () => {
  it('subtracts exactly and floors at zero', () => {
    expect(subtractAmounts('1.5', '0.5')).toBe('1')
    expect(subtractAmounts('0.5', '1.5')).toBe('0')
  })
})

describe('multiplyByFraction', () => {
  it('scales an amount by a vesting fraction', () => {
    expect(multiplyByFraction('120000', 0.5)).toBe('60000')
    expect(multiplyByFraction('120000', 0)).toBe('0')
    expect(multiplyByFraction('120000', 1)).toBe('120000')
  })

  it('never exceeds the total at full vesting', () => {
    expect(multiplyByFraction('8421337.1234567891', 1)).toBe('8421337.1234567891')
  })

  it('never overstates the true product for a fraction strictly between 0 and 1', () => {
    const total = '8421337.1234567891'
    const totalScaled = parseAmount(total, 10) ?? 0n
    // 0.5 + 5e-11 as an exact rational (50000000005 / 1e11), not derived from the float addition
    // below, so the ground truth here owes nothing to the float rounding under test.
    const fractionNumerator = 50000000005n
    const fraction = 0.5 + 5e-11

    const result = multiplyByFraction(total, fraction)

    // Compare at a common scale (1e10 * 1e11 = 1e21) so neither side rounds before the comparison.
    const resultAtCommonScale = (parseAmount(result, 10) ?? 0n) * 100000000000n
    const trueProductAtCommonScale = totalScaled * fractionNumerator
    expect(resultAtCommonScale <= trueProductAtCommonScale).toBe(true)
  })
})

describe('compareAmounts', () => {
  it('orders by value, not by string', () => {
    expect(compareAmounts('9', '10')).toBeLessThan(0)
    expect(compareAmounts('1.50', '1.5')).toBe(0)
  })
})

describe('multiplyAmounts', () => {
  it('multiplies two decimal strings exactly', () => {
    expect(multiplyAmounts('1000', '0.091012')).toBe('91.012')
  })
})

describe('canonicalAmount', () => {
  it('normalizes an equivalent decimal to its canonical form', () => {
    expect(canonicalAmount('1000.')).toBe('1000')
    expect(canonicalAmount('1.50')).toBe('1.5')
  })

  it('throws naming the value rather than folding a malformed amount to zero', () => {
    expect(() => canonicalAmount('12.3.4')).toThrow('12.3.4')
    // More decimal places than the token's precision (10dp) allows.
    expect(() => canonicalAmount('1.12345678901')).toThrow('1.12345678901')
    expect(() => canonicalAmount('abc')).toThrow()
  })
})

describe('roundAmount', () => {
  it('rounds half up to the given precision', () => {
    expect(roundAmount('105.9154321', 2)).toBe('105.92')
    expect(roundAmount('105.914', 2)).toBe('105.91')
  })

  it('drops a fraction that rounds away entirely', () => {
    expect(roundAmount('100.001', 2)).toBe('100')
  })

  it('is a no-op at or above the module precision', () => {
    expect(roundAmount('8421337.1234567891', 10)).toBe('8421337.1234567891')
  })
})
