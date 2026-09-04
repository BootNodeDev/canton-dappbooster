import { describe, expect, it } from 'vitest'
import { filterTokens } from '#src/components/TokenInput/filterTokens'
import type { Token } from '#src/providers/TokenListProvider/context'

const cc: Token = {
  instrumentId: { admin: 'dso::1220ab', id: 'Amulet' },
  name: 'Canton Coin',
  symbol: 'CC',
}
const weth: Token = {
  instrumentId: { admin: 'bridge::1220cd', id: 'WrappedEther' },
  name: 'Wrapped Ether',
  symbol: 'WETH',
}
const tokens: readonly Token[] = [cc, weth]

describe('filterTokens', () => {
  it('returns the list itself for a blank query', () => {
    expect(filterTokens(tokens, '   ')).toBe(tokens)
  })

  it('matches on name', () => {
    expect(filterTokens(tokens, 'Wrapped Ether')).toEqual([weth])
  })

  it('matches on symbol', () => {
    expect(filterTokens(tokens, 'CC')).toEqual([cc])
  })

  it('matches on the instrument id', () => {
    expect(filterTokens(tokens, 'WrappedEther')).toEqual([weth])
  })

  it('matches on the admin party', () => {
    expect(filterTokens(tokens, 'bridge')).toEqual([weth])
  })

  it('leaves an instrument the query only appears inside alone', () => {
    expect(filterTokens(tokens, 'rappedether')).toEqual([])
  })

  it('ranks what the caller can read ahead of an instrument id prefix', () => {
    const decoy: Token = {
      instrumentId: { admin: 'decoy::1220ef', id: 'cc99' },
      name: 'Decoy',
      symbol: 'DEC',
    }
    expect(filterTokens([decoy, cc], 'cc')).toEqual([cc, decoy])
  })

  it('matches case-insensitively and partially', () => {
    expect(filterTokens(tokens, 'eTH')).toEqual([weth])
  })

  it('ignores the query it was given surrounded by spaces', () => {
    expect(filterTokens(tokens, '  canton  ')).toEqual([cc])
  })

  it('returns nothing when no token matches', () => {
    expect(filterTokens(tokens, 'zzz')).toEqual([])
  })
})
