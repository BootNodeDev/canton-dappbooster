import { describe, expect, it } from 'vitest'
import { isPartyId, PARTY_SEPARATOR } from './partyId'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
const PLAIN = 'viewer1-1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2d05fe52e'

describe('isPartyId', () => {
  it('accepts a party id', () => {
    expect(isPartyId(PARTY)).toBe(true)
  })

  it('rejects an identifier with no separator', () => {
    expect(isPartyId(PLAIN)).toBe(false)
    expect(isPartyId('')).toBe(false)
  })

  it('rejects a single colon', () => {
    expect(isPartyId('nico:1220df94')).toBe(false)
  })

  it('accepts a separator anywhere, including malformed halves', () => {
    // Shape classification, not validation: the explorer router only needs party-vs-hash.
    expect(isPartyId(PARTY_SEPARATOR)).toBe(true)
    expect(isPartyId('alice::')).toBe(true)
    expect(isPartyId('::1220df94')).toBe(true)
    expect(isPartyId('alice::ns::extra')).toBe(true)
  })
})
