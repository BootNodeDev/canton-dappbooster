import { describe, expect, it } from 'vitest'
import { selectPrimaryAccount, toParty } from './walletAccount'

describe('selectPrimaryAccount', () => {
  it('returns undefined for an empty list', () => {
    expect(selectPrimaryAccount([])).toBe(undefined)
  })

  it('picks the entry flagged primary', () => {
    const primary = selectPrimaryAccount([
      { partyId: 'a::fp', primary: false },
      { partyId: 'b::fp', primary: true },
      { partyId: 'c::fp' },
    ])
    expect(primary?.partyId).toBe('b::fp')
  })

  it('falls back to the first entry when nothing is flagged primary', () => {
    const primary = selectPrimaryAccount([{ partyId: 'a::fp' }, { partyId: 'b::fp' }])
    expect(primary?.partyId).toBe('a::fp')
  })
})

describe('toParty', () => {
  it('maps the wallet account into Party shape and uses the fallback network when missing', () => {
    const party = toParty({ partyId: 'alice::fp', hint: 'alice' }, 'canton:local')
    expect(party).toEqual({ partyId: 'alice::fp', network: 'canton:local', name: 'alice' })
  })

  it('prefers the account-supplied networkId when present', () => {
    const party = toParty(
      { partyId: 'alice::fp', networkId: 'canton:prod', publicKey: 'pk' },
      'canton:local',
    )
    expect(party.network).toBe('canton:prod')
    expect(party.publicKey).toBe('pk')
    expect(party.name).toBe(undefined)
  })
})
