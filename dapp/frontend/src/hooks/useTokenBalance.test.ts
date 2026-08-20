import { describe, expect, it } from 'vitest'
import { sumHoldings } from '@/hooks/useTokenBalance'

describe('sumHoldings', () => {
  it('sums exactly, across standards', () => {
    expect(
      sumHoldings([
        { cid: 'a', amount: '1000', standard: 'cip-0056' },
        { cid: 'b', amount: '250.5', standard: 'cip-0112' },
      ]),
    ).toBe('1250.5')
  })

  it('keeps precision a double would lose', () => {
    expect(
      sumHoldings([
        { cid: 'a', amount: '8421337.1234567891', standard: 'cip-0056' },
        { cid: 'b', amount: '0.0000000001', standard: 'cip-0056' },
      ]),
    ).toBe('8421337.1234567892')
  })

  it('sums no holdings to zero', () => {
    expect(sumHoldings([])).toBe('0')
  })

  it('throws naming the cid when a holding has more decimals than the precision holds', () => {
    expect(() =>
      sumHoldings([{ cid: 'over-precision', amount: '1.12345678912', standard: 'cip-0056' }]),
    ).toThrow(/over-precision/)
  })

  it('throws naming the cid when a holding amount is not a decimal', () => {
    expect(() =>
      sumHoldings([{ cid: 'not-decimal', amount: 'nope', standard: 'cip-0056' }]),
    ).toThrow(/not-decimal/)
  })
})
