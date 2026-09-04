import { describe, expect, it } from 'vitest'
import { mergeTokens, type PartialToken } from '#src/utils/mergeTokens'

const amulet = { admin: 'DSO::1220ab', id: 'Amulet' }
const usdc = { admin: 'circle::1220cd', id: 'USDC' }

const row = (instrumentId: typeof amulet, rest: Partial<PartialToken> = {}): PartialToken => ({
  instrumentId,
  ...rest,
})

describe('mergeTokens', () => {
  it('keeps a token no source but the catalogue knows, so a picker can offer it', () => {
    expect(mergeTokens([[row(usdc, { symbol: 'USDC' })], []])).toEqual([
      { instrumentId: usdc, name: 'USDC', symbol: 'USDC' },
    ])
  })

  it('annotates a row with the balance a later source reports', () => {
    const [token] = mergeTokens([
      [row(amulet, { name: 'Amulet', symbol: 'AMT' })],
      [row(amulet, { balance: '12.5', locked: '2' })],
    ])

    expect(token).toEqual({
      balance: '12.5',
      instrumentId: amulet,
      locked: '2',
      name: 'Amulet',
      symbol: 'AMT',
    })
  })

  it('lets a later source win the fields it fills', () => {
    const [token] = mergeTokens([[row(amulet, { symbol: 'CC' })], [row(amulet, { symbol: 'AMT' })]])
    expect(token.symbol).toBe('AMT')
  })

  it('reads an absent field as nothing to say rather than as a correction', () => {
    const [token] = mergeTokens([
      [row(amulet, { name: 'Amulet', symbol: 'AMT' })],
      [row(amulet, { balance: '1' })],
    ])

    expect(token.name).toBe('Amulet')
    expect(token.symbol).toBe('AMT')
  })

  it('names a token nothing named after its own id', () => {
    const [token] = mergeTokens([[row(usdc)]])
    expect([token.name, token.symbol]).toEqual(['USDC', 'USDC'])
  })

  it('tells two registries issuing one id apart', () => {
    const other = { admin: 'other::1220ef', id: 'USDC' }
    expect(mergeTokens([[row(usdc), row(other)]])).toHaveLength(2)
  })

  it('reports nothing for sources that know nothing', () => {
    expect(mergeTokens([[], []])).toEqual([])
  })
})
