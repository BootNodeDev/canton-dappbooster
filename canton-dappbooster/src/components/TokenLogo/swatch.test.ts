import { describe, expect, it } from 'vitest'
import { SWATCH_COUNT, swatchOf } from './swatch'

describe('swatchOf', () => {
  it('answers the same swatch for the same symbol', () => {
    expect(swatchOf('USDC')).toBe(swatchOf('USDC'))
  })

  it('stays inside the palette', () => {
    for (const symbol of ['C', 'CC', 'USDC', 'WBTC', 'MK42', '✳︎', '']) {
      expect(swatchOf(symbol)).toBeGreaterThanOrEqual(1)
      expect(swatchOf(symbol)).toBeLessThanOrEqual(SWATCH_COUNT)
    }
  })

  it('tells neighbouring symbols apart', () => {
    expect(swatchOf('MK1')).not.toBe(swatchOf('MK2'))
    expect(swatchOf('CC')).not.toBe(swatchOf('USDC'))
  })

  it('answers a swatch for a symbol it was given nothing of', () => {
    expect(swatchOf('')).toBe(1)
  })
})
