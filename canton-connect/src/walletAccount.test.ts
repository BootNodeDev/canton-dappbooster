import { WALLET_DISABLED_REASON } from '@canton-network/core-types'
import { describe, expect, it } from 'vitest'
import { testParty } from '#src/testing/party'
import {
  namespaceOf,
  partyTypeOf,
  selectPrimaryAccount,
  selectUsableAccounts,
  toParty,
  withPartyType,
} from '#src/walletAccount'

type RawAccount = Parameters<typeof toParty>[0]

const raw = (partyId: string, rest: Partial<RawAccount> = {}): RawAccount => ({
  partyId,
  namespace: 'fp',
  signingProviderId: 'test',
  ...rest,
})

const partyIdsOf = (accounts: { partyId: string }[]): string[] =>
  accounts.map((account) => account.partyId)

describe('selectUsableAccounts', () => {
  it('keeps an allocated account, and one a wallet reports no status for', () => {
    const usable = selectUsableAccounts([
      raw('allocated::fp', { status: 'allocated' }),
      raw('unstated::fp'),
    ])

    expect(partyIdsOf(usable)).toEqual(['allocated::fp', 'unstated::fp'])
  })

  it('drops the statuses that hold no ledger rights', () => {
    const usable = selectUsableAccounts([
      raw('pending::fp', { status: 'initialized' }),
      raw('gone::fp', { status: 'removed' }),
      raw('live::fp', { status: 'allocated' }),
    ])

    expect(partyIdsOf(usable)).toEqual(['live::fp'])
  })

  it('keeps a disabled account whose signing provider went unmatched', () => {
    const usable = selectUsableAccounts([
      raw('unmatched::fp', {
        status: 'allocated',
        disabled: true,
        reason: WALLET_DISABLED_REASON.NO_SIGNING_PROVIDER_MATCHED,
      }),
    ])

    expect(partyIdsOf(usable)).toEqual(['unmatched::fp'])
  })

  it('drops a disabled account for any other reason, a missing one included', () => {
    const usable = selectUsableAccounts([
      raw('renamespaced::fp', {
        status: 'allocated',
        disabled: true,
        reason: WALLET_DISABLED_REASON.PARTICIPANT_NAMESPACE_CHANGED,
      }),
      raw('unexplained::fp', { status: 'allocated', disabled: true }),
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
      raw('a::fp', { primary: false }),
      raw('b::fp', { primary: true }),
      raw('c::fp'),
    ])

    expect(primary?.partyId).toBe('b::fp')
  })

  it('falls back to the first entry when nothing is flagged primary', () => {
    const primary = selectPrimaryAccount([raw('a::fp'), raw('b::fp')])

    expect(primary?.partyId).toBe('a::fp')
  })
})

describe('toParty', () => {
  it('maps the wallet account into Party shape and uses the fallback networkId when missing', () => {
    const party = toParty(raw('alice::fp', { hint: 'alice' }), 'canton:local')

    expect(party).toEqual({
      partyId: 'alice::fp',
      networkId: 'canton:local',
      namespace: 'fp',
      signingProviderId: 'test',
      partyType: 'unknown',
      name: 'alice',
    })
  })

  it('prefers the account-supplied networkId when present', () => {
    const party = toParty(
      raw('alice::fp', { networkId: 'canton:prod', publicKey: 'pk' }),
      'canton:local',
    )

    expect(party.networkId).toBe('canton:prod')
    expect(party.publicKey).toBe('pk')
    expect(party.name).toBe(undefined)
  })

  it('passes namespace and signingProviderId through as the wallet states them', () => {
    const party = toParty(
      raw('op::1220aa', { namespace: '1220aa', signingProviderId: 'participant' }),
      'canton:local',
    )

    expect(party.namespace).toBe('1220aa')
    expect(party.signingProviderId).toBe('participant')
  })
})

describe('namespaceOf', () => {
  it('returns what follows the separator, for a party or a participant id', () => {
    expect(namespaceOf('alice::1220ab')).toBe('1220ab')
    expect(namespaceOf('participant::1220ab')).toBe('1220ab')
  })

  it('returns undefined for an id with no separator', () => {
    expect(namespaceOf('participant')).toBe(undefined)
  })
})

describe('partyTypeOf', () => {
  it('is local when the party shares the participant namespace, external otherwise', () => {
    expect(partyTypeOf('1220ab', '1220ab')).toBe('local')
    expect(partyTypeOf('1220cd', '1220ab')).toBe('external')
  })

  it('is unknown until the participant namespace is known', () => {
    expect(partyTypeOf('1220ab', undefined)).toBe('unknown')
  })
})

describe('withPartyType', () => {
  it('returns the same object when the type does not change', () => {
    const party = testParty('alice::1220ab')

    expect(withPartyType(party, undefined)).toBe(party)
  })

  it('returns a retyped copy when it does', () => {
    const party = testParty('alice::1220ab')
    const typed = withPartyType(party, '1220ab')

    expect(typed).not.toBe(party)
    expect(typed.partyType).toBe('local')
    expect(party.partyType).toBe('unknown')
  })
})
