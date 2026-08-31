import { WALLET_DISABLED_REASON } from '@canton-network/core-types'
import { describe, expect, it } from 'vitest'
import { selectPrimaryAccount, selectUsableAccounts, toParty } from '#src/walletAccount'

const partyIdsOf = (accounts: { partyId: string }[]): string[] =>
  accounts.map((account) => account.partyId)

describe('selectUsableAccounts', () => {
  it('keeps an allocated account, and one a wallet reports no status for', () => {
    const usable = selectUsableAccounts([
      { partyId: 'allocated::fp', status: 'allocated' },
      { partyId: 'unstated::fp' },
    ])

    expect(partyIdsOf(usable)).toEqual(['allocated::fp', 'unstated::fp'])
  })

  it('drops the statuses that hold no ledger rights', () => {
    const usable = selectUsableAccounts([
      { partyId: 'pending::fp', status: 'initialized' },
      { partyId: 'gone::fp', status: 'removed' },
      { partyId: 'live::fp', status: 'allocated' },
    ])

    expect(partyIdsOf(usable)).toEqual(['live::fp'])
  })

  it('keeps a disabled account whose signing provider went unmatched', () => {
    const usable = selectUsableAccounts([
      {
        partyId: 'unmatched::fp',
        status: 'allocated',
        disabled: true,
        reason: WALLET_DISABLED_REASON.NO_SIGNING_PROVIDER_MATCHED,
      },
    ])

    expect(partyIdsOf(usable)).toEqual(['unmatched::fp'])
  })

  it('drops a disabled account for any other reason, a missing one included', () => {
    const usable = selectUsableAccounts([
      {
        partyId: 'renamespaced::fp',
        status: 'allocated',
        disabled: true,
        reason: WALLET_DISABLED_REASON.PARTICIPANT_NAMESPACE_CHANGED,
      },
      { partyId: 'unexplained::fp', status: 'allocated', disabled: true },
    ])

    expect(usable).toEqual([])
  })
})

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
