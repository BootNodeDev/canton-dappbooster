import type { LedgerApiParams } from '@bootnodedev/canton-connect'
import { describe, expect, it } from 'vitest'
import { walletSynchronizers } from '@/backend/synchronizer'

const stubLedger = (
  answer: unknown,
): { calls: LedgerApiParams[]; ledgerApi: (params: LedgerApiParams) => Promise<unknown> } => {
  const calls: LedgerApiParams[] = []
  return {
    calls,
    ledgerApi: async (params) => {
      calls.push(params)
      return answer
    },
  }
}

describe('walletSynchronizers', () => {
  it('returns every synchronizer the participant reports', async () => {
    const { ledgerApi } = stubLedger({
      connectedSynchronizers: [
        { synchronizerAlias: 'global', synchronizerId: 'global-domain::1220a' },
        { synchronizerAlias: 'other', synchronizerId: 'other-domain::1220b' },
      ],
    })

    await expect(walletSynchronizers(ledgerApi, 'alice::1')).resolves.toEqual([
      'global-domain::1220a',
      'other-domain::1220b',
    ])
  })

  // A wallet may allowlist the resource against the ledger API's own route list, which a path
  // carrying a query string misses, so the party has to travel in `query`.
  it('asks the route by name and passes the party as a query parameter', async () => {
    const { calls, ledgerApi } = stubLedger({ connectedSynchronizers: [] })

    await walletSynchronizers(ledgerApi, 'alice::1')

    expect(calls).toEqual([
      {
        requestMethod: 'get',
        resource: '/v2/state/connected-synchronizers',
        query: { party: 'alice::1' },
      },
    ])
  })

  it.each([
    ['the key is absent', {}],
    ['the list is empty', { connectedSynchronizers: [] }],
    ['an entry carries no id', { connectedSynchronizers: [{ synchronizerAlias: 'global' }] }],
  ])('reports nothing when %s', async (_case, answer) => {
    const { ledgerApi } = stubLedger(answer)

    await expect(walletSynchronizers(ledgerApi, 'alice::1')).resolves.toEqual([])
  })
})
