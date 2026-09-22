// The request path over a session that answers; the guards are covered against the real provider.

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { type LedgerApiParams, useLedger } from '#src/hooks/useLedger'
import { testAccount } from '#src/testing/account'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import type { DappSdkMethods } from '#src/types'

const account = testAccount('alice::1220ab')
const request: LedgerApiParams = { requestMethod: 'get', resource: '/v2/parties' }

const renderLedger = (ledgerApi: DappSdkMethods['ledgerApi'], withAccount = true) =>
  renderHook(() => useLedger(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <FakeSessionProvider
        account={withAccount ? account : undefined}
        sdk={{ ledgerApi }}
        status="connected"
      >
        {children}
      </FakeSessionProvider>
    ),
  })

describe('useLedger', () => {
  it('passes the request to the sdk and hands its answer back untouched', async () => {
    const answer = { parties: [] }
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockResolvedValue(answer)
    const { result } = renderLedger(ledgerApi)

    expect(result.current.isReady).toBe(true)

    await act(async () => {
      await expect(result.current.ledgerApi(request)).resolves.toBe(answer)
    })

    expect(ledgerApi).toHaveBeenCalledWith(request)
  })

  it("reads the ledger end, then the connected party's contracts at that offset", async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: '00aa',
                templateId: 'pkg:Main:Grant',
                createArgument: { receiver: 'bob::1220' },
              },
            },
          },
        },
      ])
    const { result } = renderLedger(ledgerApi)

    await act(async () => {
      await expect(
        result.current.activeContracts<{ receiver: string }>({ templateId: '#app:Main:Grant' }),
      ).resolves.toEqual([
        {
          contractId: '00aa',
          templateId: 'pkg:Main:Grant',
          payload: { receiver: 'bob::1220' },
          createdEventBlob: undefined,
          synchronizerId: undefined,
        },
      ])
    })

    expect(ledgerApi).toHaveBeenNthCalledWith(1, {
      requestMethod: 'get',
      resource: '/v2/state/ledger-end',
    })
    expect(ledgerApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        resource: '/v2/state/active-contracts',
        body: expect.objectContaining({
          activeAtOffset: 9,
          eventFormat: expect.objectContaining({
            filtersByParty: expect.objectContaining({ 'alice::1220ab': expect.anything() }),
          }),
        }),
      }),
    )
  })

  it('reads as another party when told to, session party or not', async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([])
    const { result } = renderLedger(ledgerApi, false)

    await act(async () => {
      await expect(
        result.current.activeContracts({
          templateId: '#app:Main:Factory',
          party: 'operator::1220',
        }),
      ).resolves.toEqual([])
    })

    expect(ledgerApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.objectContaining({
          eventFormat: expect.objectContaining({
            filtersByParty: expect.objectContaining({ 'operator::1220': expect.anything() }),
          }),
        }),
      }),
    )
  })

  it('reads an interface as the connected party and hands the views back', async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: '00aa',
                templateId: 'pkg:Amulet',
                interfaceViews: [{ viewStatus: { code: 0 }, viewValue: { amount: '3' } }],
              },
            },
          },
        },
      ])
    const { result } = renderLedger(ledgerApi)

    await act(async () => {
      await expect(
        result.current.activeContractsByInterface<{ amount: string }>({
          interfaceId: '#token:Holding',
        }),
      ).resolves.toEqual([{ contractId: '00aa', templateId: 'pkg:Amulet', view: { amount: '3' } }])
    })

    expect(ledgerApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.objectContaining({
          activeAtOffset: 9,
          eventFormat: expect.objectContaining({
            filtersByParty: expect.objectContaining({ 'alice::1220ab': expect.anything() }),
          }),
        }),
      }),
    )
  })

  it('refuses activeContracts when the session reports no party', async () => {
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>()
    const { result } = renderLedger(ledgerApi, false)

    await expect(result.current.activeContracts({ templateId: '#app:Main:Grant' })).rejects.toThrow(
      'no primary account',
    )
    expect(ledgerApi).not.toHaveBeenCalled()
  })
})
