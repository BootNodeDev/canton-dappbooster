import { describe, expect, it } from 'vitest'
import { hueOf } from './hue'

describe('hueOf', () => {
  it('answers the same hue for the same symbol', () => {
    expect(hueOf('USDC')).toBe(hueOf('USDC'))
  })

  it('stays inside the hue circle', () => {
    for (const symbol of ['C', 'CC', 'USDC', 'WBTC', 'MK42', '✳︎']) {
      expect(hueOf(symbol)).toBeGreaterThanOrEqual(0)
      expect(hueOf(symbol)).toBeLessThan(360)
    }
  })

  it('tells neighbouring symbols apart', () => {
    expect(hueOf('MK1')).not.toBe(hueOf('MK2'))
    expect(hueOf('CC')).not.toBe(hueOf('USDC'))
  })

  it('answers a hue for a symbol it was given nothing of', () => {
    expect(hueOf('')).toBe(0)
  })
})
