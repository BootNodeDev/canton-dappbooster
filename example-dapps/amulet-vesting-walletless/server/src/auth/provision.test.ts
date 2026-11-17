import { describe, expect, it } from 'vitest'
import { provisionParty, releaseParties } from '#server/auth/provision'
import type { LedgerApiParams } from '#server/ledger/wallet'

describe('provisionParty', () => {
  it('allocates a party, then grants the service user the right to act as it', async () => {
    const calls: LedgerApiParams[] = []
    const ledgerApi = async (params: LedgerApiParams): Promise<unknown> => {
      calls.push(params)
      return params.resource === '/v2/parties' ? { partyDetails: { party: 'wl-bob-s::abc' } } : {}
    }

    const partyId = await provisionParty(ledgerApi, 'svc@clients', 'bob', 's')

    expect(partyId).toBe('wl-bob-s::abc')
    expect(calls.map((call) => call.resource)).toEqual([
      '/v2/parties',
      '/v2/users/{user-id}/rights',
    ])
    expect(calls[1]?.path).toEqual({ 'user-id': 'svc@clients' })
    expect(calls[1]?.body).toEqual({
      userId: 'svc@clients',
      rights: [{ kind: { CanActAs: { value: { party: 'wl-bob-s::abc' } } } }],
      identityProviderId: '',
    })
  })

  it('grants nothing when the participant names no party', async () => {
    const calls: string[] = []
    const ledgerApi = async (params: LedgerApiParams): Promise<unknown> => {
      calls.push(params.resource)
      return {}
    }
    await expect(provisionParty(ledgerApi, 'svc@clients', 'bob', 's')).rejects.toThrow(/no party/)
    expect(calls).toEqual(['/v2/parties'])
  })
})

describe('releaseParties', () => {
  it('revokes every party in one request to the service user', async () => {
    const calls: LedgerApiParams[] = []
    const ledgerApi = async (params: LedgerApiParams): Promise<unknown> => {
      calls.push(params)
      return { newlyRevokedRights: [] }
    }

    await releaseParties(ledgerApi, 'svc@clients', ['wl-a::abc', 'wl-b::abc'])

    expect(calls).toEqual([
      {
        requestMethod: 'patch',
        resource: '/v2/users/{user-id}/rights',
        path: { 'user-id': 'svc@clients' },
        body: {
          userId: 'svc@clients',
          rights: [
            { kind: { CanActAs: { value: { party: 'wl-a::abc' } } } },
            { kind: { CanActAs: { value: { party: 'wl-b::abc' } } } },
          ],
          identityProviderId: '',
        },
      },
    ])
  })
})
