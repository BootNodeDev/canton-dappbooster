import { describe, expect, it } from 'vitest'
import type { Token } from '../../providers/TokenListProvider/context'
import { filterTokens } from './filterTokens'

const cc: Token = { id: '0xaaa1', name: 'Canton Coin', symbol: 'CC' }
const weth: Token = { id: '0xbbb2', name: 'Wrapped Ether', symbol: 'WETH' }
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

  it('matches on id', () => {
    expect(filterTokens(tokens, '0xbbb2')).toEqual([weth])
  })

  it('leaves an id the query only appears inside alone', () => {
    expect(filterTokens(tokens, 'bbb')).toEqual([])
  })

  it('ranks what the caller can read ahead of an id prefix', () => {
    const decoy: Token = { id: 'cc99', name: 'Decoy', symbol: 'DEC' }
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
