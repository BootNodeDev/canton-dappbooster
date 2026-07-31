import { describe, expect, it } from 'vitest'
import { selectPrimaryAccount, toParties, toParty } from './walletAccount'

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
  it('maps the wallet account into Party shape and uses the fallback networkId when missing', () => {
    const party = toParty({ partyId: 'alice::fp', hint: 'alice' }, 'canton:local')
    expect(party).toEqual({ partyId: 'alice::fp', networkId: 'canton:local', name: 'alice' })
  })

  it('prefers the account-supplied networkId when present', () => {
    const party = toParty(
      { partyId: 'alice::fp', networkId: 'canton:prod', publicKey: 'pk' },
      'canton:local',
    )
    expect(party.networkId).toBe('canton:prod')
    expect(party.publicKey).toBe('pk')
    expect(party.name).toBe(undefined)
  })
})

describe('toParties', () => {
  it('drops accounts whose status is not allocated', () => {
    const parties = toParties(
      [
        { partyId: 'alice::1', status: 'allocated' },
        { partyId: 'bob::2', status: 'initialized' },
        { partyId: 'carol::3', status: 'removed' },
      ],
      'canton:local',
    )

    expect(parties.map((party) => party.partyId)).toEqual(['alice::1'])
  })

  it('keeps an account that reports no status at all', () => {
    const parties = toParties([{ partyId: 'alice::1' }], 'canton:local')

    expect(parties.map((party) => party.partyId)).toEqual(['alice::1'])
  })

  it('keeps a disabled account — disabled is a signing-provider note, not a usability flag', () => {
    const parties = toParties(
      [{ partyId: 'alice::1', status: 'allocated', disabled: true }],
      'canton:local',
    )

    expect(parties.map((party) => party.partyId)).toEqual(['alice::1'])
  })

  it('puts the primary account first and keeps the wallet order otherwise', () => {
    const parties = toParties(
      [
        { partyId: 'bob::2', status: 'allocated' },
        { partyId: 'alice::1', status: 'allocated', primary: true },
        { partyId: 'carol::3', status: 'allocated' },
      ],
      'canton:local',
    )

    expect(parties.map((party) => party.partyId)).toEqual(['alice::1', 'bob::2', 'carol::3'])
  })

  it('falls back to wallet order when nothing is flagged primary', () => {
    const parties = toParties(
      [
        { partyId: 'bob::2', status: 'allocated' },
        { partyId: 'alice::1', status: 'allocated' },
      ],
      'canton:local',
    )

    expect(parties.map((party) => party.partyId)).toEqual(['bob::2', 'alice::1'])
  })

  it('applies the networkId fallback per account', () => {
    const parties = toParties(
      [
        { partyId: 'alice::1', status: 'allocated' },
        { partyId: 'bob::2', status: 'allocated', networkId: 'canton:devnet' },
      ],
      'canton:local',
    )

    expect(parties.map((party) => party.networkId)).toEqual(['canton:local', 'canton:devnet'])
  })

  it('returns an empty list when every account is unusable', () => {
    expect(toParties([{ partyId: 'alice::1', status: 'initialized' }], 'canton:local')).toEqual([])
  })
})
