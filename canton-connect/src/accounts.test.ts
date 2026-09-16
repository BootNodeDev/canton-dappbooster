import { WALLET_DISABLED_REASON } from '@canton-network/core-types'
import { describe, expect, it } from 'vitest'
import { getPrimaryAccount, isUsableAccount } from '#src/accounts'

type RawAccount = Parameters<typeof isUsableAccount>[0]

const raw = (partyId: string, rest: Partial<RawAccount> = {}): RawAccount => ({
  primary: false,
  partyId,
  status: 'allocated',
  hint: partyId,
  publicKey: 'test-public-key',
  namespace: 'fp',
  networkId: 'canton:local',
  signingProviderId: 'test',
  ...rest,
})

describe('isUsableAccount', () => {
  it('accepts an allocated account, and one a wallet reports no status for', () => {
    expect(isUsableAccount(raw('allocated::fp', { status: 'allocated' }))).toBe(true)
    expect(isUsableAccount(raw('unstated::fp'))).toBe(true)
  })

  it('refuses the statuses that hold no ledger rights', () => {
    expect(isUsableAccount(raw('pending::fp', { status: 'initialized' }))).toBe(false)
    expect(isUsableAccount(raw('gone::fp', { status: 'removed' }))).toBe(false)
    expect(isUsableAccount(raw('live::fp', { status: 'allocated' }))).toBe(true)
  })

  it('accepts a disabled account whose signing provider went unmatched', () => {
    const unmatched = raw('unmatched::fp', {
      status: 'allocated',
      disabled: true,
      reason: WALLET_DISABLED_REASON.NO_SIGNING_PROVIDER_MATCHED,
    })

    expect(isUsableAccount(unmatched)).toBe(true)
  })

  it('refuses a disabled account for any other reason, a missing one included', () => {
    const renamespaced = raw('renamespaced::fp', {
      status: 'allocated',
      disabled: true,
      reason: WALLET_DISABLED_REASON.PARTICIPANT_NAMESPACE_CHANGED,
    })

    expect(isUsableAccount(renamespaced)).toBe(false)
    expect(isUsableAccount(raw('unexplained::fp', { status: 'allocated', disabled: true }))).toBe(
      false,
    )
  })
})

describe('getPrimaryAccount', () => {
  it('returns undefined for an empty list', () => {
    expect(getPrimaryAccount([])).toBe(undefined)
  })

  it('picks the entry flagged primary', () => {
    const primary = getPrimaryAccount([
      raw('a::fp', { primary: false }),
      raw('b::fp', { primary: true }),
      raw('c::fp', { primary: false }),
    ])

    expect(primary?.partyId).toBe('b::fp')
  })

  it('reports none where nothing is flagged primary, rather than promoting one', () => {
    expect(getPrimaryAccount([raw('a::fp'), raw('b::fp')])).toBe(undefined)
  })

  it('returns the flagged account even where it cannot transact', () => {
    const primary = getPrimaryAccount([
      raw('dead::fp', { primary: true, status: 'removed' }),
      raw('live::fp', { primary: false }),
    ])

    expect(primary?.partyId).toBe('dead::fp')
    expect(primary === undefined ? true : isUsableAccount(primary)).toBe(false)
  })
})
