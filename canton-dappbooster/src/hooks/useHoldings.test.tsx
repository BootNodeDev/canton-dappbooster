// The read path over a session that answers; the connect and lock guards are canton-connect's.

import { FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { renderHook, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useHoldings } from '#src/hooks/useHoldings'

const party = { partyId: 'alice::1220ab', networkId: 'canton:local' }
const amulet = { admin: 'DSO::1220ab', id: 'Amulet' }

// Derived from the double rather than from the SDK, which this package does not depend on.
type LedgerApi = NonNullable<
  NonNullable<ComponentProps<typeof FakeSessionProvider>['sdk']>['ledgerApi']
>
type LedgerAnswer = Awaited<ReturnType<LedgerApi>>

const view = (instrumentId: typeof amulet, amount: string, lock: unknown = null) => ({
  viewValue: { owner: party.partyId, instrumentId, amount, lock },
})

const row = (...views: unknown[]) => ({
  contractEntry: { JsActiveContract: { createdEvent: { interfaceViews: views } } },
})

const session = (ledgerApi: LedgerApi, usable = true) => ({
  wrapper: ({ children }: { children: ReactNode }) => (
    <FakeSessionProvider
      party={usable ? party : undefined}
      sdk={{ ledgerApi }}
      status={usable ? 'connected' : 'disconnected'}
    >
      {children}
    </FakeSessionProvider>
  ),
})

const answering = (rows: LedgerAnswer) =>
  vi
    .fn<LedgerApi>()
    .mockImplementation(async (params) =>
      params.resource === '/v2/state/ledger-end' ? { offset: 42 } : rows,
    )

describe('useHoldings', () => {
  it('reads the party holdings and reports one entry per contract', async () => {
    const ledgerApi = answering([row(view(amulet, '10.5')), row(view(amulet, '4'))])
    const { result } = renderHook(() => useHoldings(), session(ledgerApi))

    await waitFor(() => expect(result.current.holdings).toHaveLength(2))
    expect(result.current.holdings).toEqual([
      { amount: '10.5', instrumentId: amulet, isLocked: false },
      { amount: '4', instrumentId: amulet, isLocked: false },
    ])
    expect(result.current.error).toBeUndefined()
  })

  it('asks for every registry at once, by interface and at the ledger end', async () => {
    const ledgerApi = answering([])
    renderHook(() => useHoldings(), session(ledgerApi))

    await waitFor(() => expect(ledgerApi).toHaveBeenCalledTimes(2))
    const [, acs] = ledgerApi.mock.calls.map(([params]) => params)
    expect(acs.body).toMatchObject({
      activeAtOffset: 42,
      filter: {
        filtersByParty: {
          [party.partyId]: {
            cumulative: [
              {
                identifierFilter: {
                  InterfaceFilter: {
                    value: {
                      includeInterfaceView: true,
                      interfaceId:
                        '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding',
                    },
                  },
                },
              },
            ],
          },
        },
      },
    })
  })

  it('reports a locked holding as locked', async () => {
    const ledgerApi = answering([row(view(amulet, '1', { holders: ['escrow::1220cd'] }))])
    const { result } = renderHook(() => useHoldings(), session(ledgerApi))

    await waitFor(() => expect(result.current.holdings?.[0]?.isLocked).toBe(true))
  })

  it('drops a view it cannot read rather than reporting a holding with no amount', async () => {
    const ledgerApi = answering([
      row({ viewValue: { instrumentId: amulet } }),
      row(view(amulet, '2')),
    ])
    const { result } = renderHook(() => useHoldings(), session(ledgerApi))

    await waitFor(() => expect(result.current.holdings).toHaveLength(1))
    expect(result.current.holdings?.[0]?.amount).toBe('2')
  })

  it('reports an empty list for a party that holds nothing', async () => {
    const { result } = renderHook(() => useHoldings(), session(answering([])))
    await waitFor(() => expect(result.current.holdings).toEqual([]))
  })

  it('lands a failed read in error and holds no stale list', async () => {
    const ledgerApi = vi.fn<LedgerApi>().mockRejectedValue(new Error('no route'))
    const { result } = renderHook(() => useHoldings(), session(ledgerApi))

    await waitFor(() => expect(result.current.error?.message).toBe('no route'))
    expect(result.current.holdings).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it('reads nothing while no party is connected', () => {
    const ledgerApi = answering([])
    const { result } = renderHook(() => useHoldings(), session(ledgerApi, false))

    expect(ledgerApi).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('reads again on refetch', async () => {
    const ledgerApi = answering([])
    const { result } = renderHook(() => useHoldings(), session(ledgerApi))

    await waitFor(() => expect(ledgerApi).toHaveBeenCalledTimes(2))
    result.current.refetch()
    await waitFor(() => expect(ledgerApi).toHaveBeenCalledTimes(4))
  })
})
