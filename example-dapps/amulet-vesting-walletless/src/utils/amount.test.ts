import { parseAmount } from '@bootnodedev/canton-dappbooster'
import { describe, expect, it } from 'vitest'
import {
  addAmounts,
  compareAmounts,
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

  it('never overstates the exact rational product for a fraction between 0 and 1', () => {
    const total = '8421337.1234567891'
    const totalScaled = parseAmount(total, 10) ?? 0n
    const fractionNumerator = 50000000005n
    const fraction = 0.5 + 5e-11

    const result = multiplyByFraction(total, fraction)

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
