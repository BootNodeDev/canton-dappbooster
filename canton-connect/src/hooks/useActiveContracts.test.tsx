import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActiveContract } from '#src/activeContracts'
import { useAccount } from '#src/hooks/useAccount'
import { useActiveContracts } from '#src/hooks/useActiveContracts'
import { testAccount } from '#src/testing/account'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import { toGrant } from '#src/testing/grant'
import { acsPage, acsRow, archived, created, transactionUpdate } from '#src/testing/ledgerAnswers'
import { pause } from '#src/testing/pause'
import type { Account, DappSdkMethods } from '#src/types'
import type { WatchSource } from '#src/watch'

type LedgerAnswer = Awaited<ReturnType<DappSdkMethods['ledgerApi']>>

const account = testAccount('alice::1220ab')
const TEMPLATE = '#app:Main:Grant'

const liveSession = (ledgerApi: DappSdkMethods['ledgerApi'], connected: Account | undefined) => {
  const sdk = { ledgerApi }

  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <FakeSessionProvider account={connected} sdk={sdk} status="connected">
        {children}
      </FakeSessionProvider>
    ),
  }
}

const renderContracts = (ledgerApi: DappSdkMethods['ledgerApi'], watch?: boolean | WatchSource) =>
  renderHook(
    () => useActiveContracts({ templateId: TEMPLATE, decode: toGrant, watch }),
    liveSession(ledgerApi, account),
  )

const idsOf = <Payload,>(contracts: ActiveContract<Payload>[] | undefined) =>
  contracts?.map((contract) => contract.contractId)

/** A watch the test ticks by hand, so no timer decides when a follow starts. */
const manualWatch = () => {
  const stop = vi.fn()
  const source = vi.fn<WatchSource>(() => stop)

  return { source, stop, tick: () => source.mock.lastCall?.[0]() }
}

/** An answer the test settles when it chooses, holding a read in flight until then. */
const pending = () => {
  let settle: (answer: LedgerAnswer) => void = () => undefined
  let fail: (reason: unknown) => void = () => undefined
  const answer = new Promise<LedgerAnswer>((resolve, reject) => {
    settle = resolve
    fail = reject
  })

  return {
    answer,
    settle: (value: LedgerAnswer) => settle(value),
    fail: (reason: unknown) => fail(reason),
  }
}

describe('useActiveContracts', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads once and reports the contracts with the payload its decode proved', async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
    const { result } = renderContracts(ledgerApi)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.contracts).toEqual([
      { contractId: '00aa', templateId: 'pkg:Main:Grant', payload: { receiver: 'bob::1220' } },
    ])
    expect(result.current.error).toBeUndefined()
  })

  it('reads nothing while the session reports no party', async () => {
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>()
    const { result } = renderHook(
      () => useActiveContracts({ templateId: TEMPLATE, decode: toGrant, watch: true }),
      liveSession(ledgerApi, undefined),
    )

    await act(async () => undefined)

    expect(ledgerApi).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({
      contracts: undefined,
      isLoading: false,
      error: undefined,
    })
  })

  it('follows from the offset its own snapshot was taken at', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, []))
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => watch.tick())

    expect(ledgerApi).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        resource: '/v2/updates',
        body: expect.objectContaining({ beginExclusive: 7, endInclusive: 9 }),
      }),
    )
  })

  it('adds a created contract and drops an archived one without reading the contracts again', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([
        transactionUpdate(9, [created('00bb', { receiver: 'carol::1220' }), archived('00aa')]),
      ])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    await act(async () => watch.tick())

    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00bb']))
    expect(
      ledgerApi.mock.calls.filter(
        ([params]) => params.resource === '/v2/state/active-contracts-page',
      ),
    ).toHaveLength(1)
  })

  it('resumes the next follow from the last transaction it applied', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, []))
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([transactionUpdate(8, [created('00bb', { receiver: 'carol::1220' })])])
      .mockResolvedValueOnce({ offset: 11 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => watch.tick())
    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    await act(async () => watch.tick())

    expect(ledgerApi).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ body: expect.objectContaining({ beginExclusive: 8 }) }),
    )
  })

  it('leaves the contracts untouched when a tick finds nothing', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    const before = result.current.contracts
    await act(async () => watch.tick())

    expect(ledgerApi).toHaveBeenCalledTimes(4)
    expect(result.current.contracts).toBe(before)
  })

  it('moves the cursor to the ledger end when a tick finds nothing', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, []))
      .mockResolvedValueOnce({ offset: 12 })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ offset: 12 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      watch.tick()
      await pause(0)
    })
    await act(async () => {
      watch.tick()
      await pause(0)
    })

    expect(ledgerApi).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        body: expect.objectContaining({ beginExclusive: 12, endInclusive: 12 }),
      }),
    )
  })

  it('adds a created contract it already holds only once', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([transactionUpdate(8, [created('00aa', { receiver: 'bob::1220' })])])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    await act(async () => {
      watch.tick()
      await pause(0)
    })

    expect(idsOf(result.current.contracts)).toEqual(['00aa'])
  })

  it('drops a follow a refetch overtook, so it neither adds to the new list nor rewinds', async () => {
    const watch = manualWatch()
    const ledgerEnd = pending()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockReturnValueOnce(ledgerEnd.answer)
      .mockResolvedValueOnce({ offset: 20 })
      .mockResolvedValueOnce(acsPage(20, [acsRow('00cc', { receiver: 'dave::1220' })]))
      .mockResolvedValueOnce([transactionUpdate(8, [created('00bb', { receiver: 'carol::1220' })])])
      .mockResolvedValueOnce({ offset: 20 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    act(() => watch.tick())
    act(() => result.current.refetch())
    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00cc']))
    await act(async () => {
      ledgerEnd.settle({ offset: 9 })
      await pause(0)
    })
    await act(async () => {
      watch.tick()
      await pause(0)
    })

    expect(idsOf(result.current.contracts)).toEqual(['00cc'])
    expect(ledgerApi).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ body: expect.objectContaining({ beginExclusive: 20 }) }),
    )
  })

  it('starts no follow while the one before it is still in flight', async () => {
    const watch = manualWatch()
    const ledgerEnd = pending()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, []))
      .mockReturnValueOnce(ledgerEnd.answer)
      .mockResolvedValueOnce([transactionUpdate(8, [created('00bb', { receiver: 'carol::1220' })])])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => {
      watch.tick()
      watch.tick()
    })

    expect(ledgerApi).toHaveBeenCalledTimes(3)

    await act(async () => ledgerEnd.settle({ offset: 9 }))

    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00bb']))
    expect(ledgerApi).toHaveBeenCalledTimes(4)
  })

  it('keeps the current contracts while a refetch reads them again', async () => {
    const ledgerEnd = pending()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockReturnValueOnce(ledgerEnd.answer)
      .mockResolvedValueOnce(
        acsPage(9, [
          acsRow('00aa', { receiver: 'bob::1220' }),
          acsRow('00bb', { receiver: 'carol::1220' }),
        ]),
      )
    const { result } = renderContracts(ledgerApi)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    act(() => result.current.refetch())

    expect(result.current.isLoading).toBe(true)
    expect(idsOf(result.current.contracts)).toEqual(['00aa'])

    await act(async () => ledgerEnd.settle({ offset: 9 }))

    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00aa', '00bb']))
    expect(result.current.isLoading).toBe(false)
  })

  it('follows on from the cursor it had when a refetch fails', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockRejectedValueOnce({ code: -32603, message: 'gateway unreachable' })
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([transactionUpdate(8, [created('00bb', { receiver: 'carol::1220' })])])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.error?.message).toBe('gateway unreachable'))
    await act(async () => watch.tick())

    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00aa', '00bb']))
    expect(ledgerApi).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ body: expect.objectContaining({ beginExclusive: 7 }) }),
    )
  })

  it('reads again on the next tick after a first read fails', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockRejectedValueOnce({ code: -32603, message: 'gateway unreachable' })
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.error?.message).toBe('gateway unreachable'))
    await act(async () => watch.tick())

    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00aa']))
    expect(result.current.error).toBeUndefined()
  })

  it('ignores the failure of a read a newer one replaced', async () => {
    const firstLedgerEnd = pending()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockReturnValueOnce(firstLedgerEnd.answer)
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
    const { result } = renderContracts(ledgerApi)

    act(() => result.current.refetch())
    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00aa']))
    await act(async () => {
      firstLedgerEnd.fail({ code: -32603, message: 'gateway unreachable' })
      await pause(0)
    })

    expect(result.current.error).toBeUndefined()
    expect(idsOf(result.current.contracts)).toEqual(['00aa'])
  })

  it('starts a watch source spelled inline once, however often the hook renders', async () => {
    const starts = vi.fn()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, []))
    const { result, rerender } = renderHook(
      () =>
        useActiveContracts({
          templateId: TEMPLATE,
          decode: toGrant,
          watch: () => {
            starts()

            return () => undefined
          },
        }),
      liveSession(ledgerApi, account),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    rerender()
    rerender()
    rerender()

    expect(starts).toHaveBeenCalledTimes(1)
  })

  it('neither reads again nor restarts the watch when decode is spelled inline', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, []))
    const { result, rerender } = renderHook(
      () =>
        useActiveContracts({
          templateId: TEMPLATE,
          decode: (createArgument) => toGrant(createArgument),
          watch: watch.source,
        }),
      liveSession(ledgerApi, account),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    rerender()
    rerender()
    rerender()
    await act(async () => undefined)

    expect(ledgerApi).toHaveBeenCalledTimes(2)
    expect(watch.source).toHaveBeenCalledTimes(1)
    expect(watch.stop).not.toHaveBeenCalled()
  })

  it("never renders the previous party's contracts once the party changes", async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockReturnValueOnce(pending().answer)
    const sdk = { ledgerApi }
    const carol = testAccount('carol::1220cd')
    const renders: { partyId: string | undefined; ids: string[] | undefined }[] = []
    let connected = account
    const { result, rerender } = renderHook(
      () => {
        const { account: rendered } = useAccount()
        const read = useActiveContracts({ templateId: TEMPLATE, decode: toGrant })
        renders.push({ partyId: rendered?.partyId, ids: idsOf(read.contracts) })

        return read
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <FakeSessionProvider account={connected} sdk={sdk} status="connected">
            {children}
          </FakeSessionProvider>
        ),
      },
    )

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    connected = carol
    rerender()

    const asCarol = renders.filter((render) => render.partyId === carol.partyId)
    expect(asCarol.length).toBeGreaterThan(0)
    expect(asCarol.every((render) => render.ids === undefined)).toBe(true)
    expect(result.current.isLoading).toBe(true)
  })

  it('never renders the contracts of the template before once the template changes', async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockReturnValueOnce(pending().answer)
    const renders: { templateId: string; ids: string[] | undefined }[] = []
    const { result, rerender } = renderHook(
      ({ templateId }: { templateId: string }) => {
        const read = useActiveContracts({ templateId, decode: toGrant })
        renders.push({ templateId, ids: idsOf(read.contracts) })

        return read
      },
      { ...liveSession(ledgerApi, account), initialProps: { templateId: TEMPLATE } },
    )

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    rerender({ templateId: '#app:Main:Other' })

    const asOther = renders.filter((render) => render.templateId === '#app:Main:Other')
    expect(asOther.length).toBeGreaterThan(0)
    expect(asOther.every((render) => render.ids === undefined)).toBe(true)
    expect(result.current.isLoading).toBe(true)
  })

  it('reports a failed tick and keeps the contracts it had', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockRejectedValueOnce({ code: -32603, message: 'gateway unreachable' })
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    await act(async () => watch.tick())

    await waitFor(() => expect(result.current.error?.message).toBe('gateway unreachable'))
    expect(idsOf(result.current.contracts)).toEqual(['00aa'])
  })

  it('reads the contracts again on the tick after a failed one', async () => {
    const watch = manualWatch()
    const refusal = { code: -32603, message: 'Something went wrong while calling ledgerApi' }
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockResolvedValueOnce({ offset: 9 })
      .mockRejectedValueOnce(refusal)
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce(acsPage(9, [acsRow('00bb', { receiver: 'carol::1220' })]))
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    await act(async () => watch.tick())
    await waitFor(() => expect(result.current.error?.message).toBe(refusal.message))
    await act(async () => watch.tick())

    await waitFor(() => expect(idsOf(result.current.contracts)).toEqual(['00bb']))
    expect(result.current.error).toBeUndefined()
    expect(ledgerApi).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ resource: '/v2/state/active-contracts-page' }),
    )
  })

  it('clears the error of a failed refetch once a later tick succeeds, even with nothing new', async () => {
    const watch = manualWatch()
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce(acsPage(7, [acsRow('00aa', { receiver: 'bob::1220' })]))
      .mockRejectedValueOnce({ code: -32603, message: 'gateway unreachable' })
      .mockResolvedValueOnce({ offset: 7 })
      .mockResolvedValueOnce([])
    const { result } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.contracts).toHaveLength(1))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.error?.message).toBe('gateway unreachable'))
    await act(async () => {
      watch.tick()
      await pause(0)
    })

    expect(result.current.error).toBeUndefined()
    expect(idsOf(result.current.contracts)).toEqual(['00aa'])
  })

  it('reports a failed read and stops the watch when the hook goes away', async () => {
    const watch = manualWatch()
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockRejectedValue(new Error('no ledger'))
    const { result, unmount } = renderContracts(ledgerApi, watch.source)

    await waitFor(() => expect(result.current.error?.message).toBe('no ledger'))
    expect(result.current.contracts).toBeUndefined()

    unmount()

    expect(watch.stop).toHaveBeenCalled()
  })

  it('follows every 3 seconds when watch is true', async () => {
    vi.useFakeTimers()
    const answers: Record<string, LedgerAnswer> = {
      '/v2/state/ledger-end': { offset: 7 },
      '/v2/state/active-contracts-page': acsPage(7, []),
      '/v2/updates': [],
    }
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>(async ({ resource }) => answers[resource])
    const follows = () =>
      ledgerApi.mock.calls.filter(([params]) => params.resource === '/v2/updates').length
    renderContracts(ledgerApi, true)

    await act(async () => vi.advanceTimersByTimeAsync(2999))
    expect(follows()).toBe(0)

    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(follows()).toBe(1)

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(follows()).toBe(2)
  })
})
