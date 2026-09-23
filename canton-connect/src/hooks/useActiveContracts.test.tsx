// The snapshot, the cursor it leaves, and what the follow does with events. The requests themselves
// are covered in activeContracts.test.ts and transactions.test.ts.

import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useActiveContracts } from '#src/hooks/useActiveContracts'
import { testAccount } from '#src/testing/account'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import type { DappSdkMethods } from '#src/types'
import type { WatchSource } from '#src/watch'

const account = testAccount('alice::1220ab')
const TEMPLATE = '#app:Main:Grant'

type Payload = { receiver: string }

const row = (contractId: string, receiver: string) => ({
  contractEntry: {
    JsActiveContract: {
      createdEvent: { contractId, templateId: 'pkg:Main:Grant', createArgument: { receiver } },
    },
  },
})

const created = (contractId: string, receiver: string) => ({
  CreatedEvent: { contractId, templateId: 'pkg:Main:Grant', createArgument: { receiver } },
})

const archived = (contractId: string) => ({
  ArchivedEvent: { contractId, templateId: 'pkg:Main:Grant' },
})

const update = (offset: number, events: unknown[]) => ({
  update: {
    Transaction: {
      value: { updateId: `u${offset}`, offset, effectiveAt: '2026-03-01T00:00:00Z', events },
    },
  },
})

const renderContracts = (ledgerApi: DappSdkMethods['ledgerApi'], watch?: boolean | WatchSource) =>
  renderHook(() => useActiveContracts<Payload>({ templateId: TEMPLATE, watch }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <FakeSessionProvider account={account} sdk={{ ledgerApi }} status="connected">
        {children}
      </FakeSessionProvider>
    ),
  })

/** A watch the test drives by hand, so no timer decides when a tick happens. */
const manualWatch = (): { source: WatchSource; tick: () => void; stopped: () => boolean } => {
  let fire: (() => void) | undefined
  let stopped = false
  return {
    source: (onTick) => {
      fire = onTick
      return () => {
        stopped = true
      }
    },
    tick: () => fire?.(),
    stopped: () => stopped,
  }
}

describe('useActiveContracts', () => {
  it('reads once and reports the contracts with the payload the caller named', async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce({ activeContracts: [row('00aa', 'bob::1220')] })
    const { result } = renderContracts(ledgerApi)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.contracts).toEqual([
      {
        contractId: '00aa',
        templateId: 'pkg:Main:Grant',
        payload: { receiver: 'bob::1220' },
        createdEventBlob: undefined,
        synchronizerId: undefined,
      },
    ])
    expect(result.current.error).toBeUndefined()
  })

  it('does not watch unless asked', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce({ activeContracts: [] })
    const { result } = renderContracts(ledgerApi)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => watch.tick())

    expect(ledgerApi).toHaveBeenCalledTimes(2)
  })

  it('follows from the offset its own snapshot was taken at, not one read separately', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce({ activeContracts: [] })
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      watch.tick()
    })

    // A tick is the ledger end the page is bounded by, then the page itself.
    expect(ledgerApi).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ body: expect.objectContaining({ beginExclusive: 7 }) }),
    )
  })

  it('adds a created contract and drops an archived one without re-reading', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce({ activeContracts: [row('00aa', 'bob::1220')] })
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([update(9, [created('00bb', 'carol::1220'), archived('00aa')])])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    await act(async () => {
      watch.tick()
    })

    await waitFor(() =>
      expect(result.current.contracts?.map((one) => one.contractId)).toEqual(['00bb']),
    )
    // The snapshot read contracts once; the events alone moved the view after that.
    const contractReads = ledgerApi.mock.calls.filter(
      ([params]) => params.resource === '/v2/state/active-contracts-page',
    )
    expect(contractReads).toHaveLength(1)
  })

  it('resumes the next follow from the last transaction it applied', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce({ activeContracts: [] })
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([update(9, [created('00bb', 'carol::1220')])])
      .mockResolvedValueOnce({ offset: 11 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      watch.tick()
    })
    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    await act(async () => {
      watch.tick()
    })

    expect(ledgerApi).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ body: expect.objectContaining({ beginExclusive: 9 }) }),
    )
  })

  it('leaves the contracts alone when a tick finds nothing', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce({ activeContracts: [row('00aa', 'bob::1220')] })
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    const before = result.current.contracts
    await act(async () => {
      watch.tick()
    })

    expect(result.current.contracts).toBe(before)
  })

  it('re-snapshots rather than following when the caller asked for the blob', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValue({ offset: 7, activeContracts: [] })
    const { result } = renderHook(
      () =>
        useActiveContracts({
          templateId: TEMPLATE,
          includeCreatedEventBlob: true,
          watch: watch.source,
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <FakeSessionProvider account={account} sdk={{ ledgerApi }} status="connected">
            {children}
          </FakeSessionProvider>
        ),
      },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      watch.tick()
    })

    expect(ledgerApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ resource: '/v2/state/active-contracts-page' }),
    )
  })

  it('reports a failed read and stops the watch when the hook goes away', async () => {
    const watch = manualWatch()
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockRejectedValue(new Error('no ledger'))
    const { result, unmount } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.error?.message).toBe('no ledger'))
    expect(result.current.contracts).toBeUndefined()

    unmount()
    expect(watch.stopped()).toBe(true)
  })
})
