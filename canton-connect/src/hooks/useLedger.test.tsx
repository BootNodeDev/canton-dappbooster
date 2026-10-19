// The request path over a session that answers; the guards are covered against the real provider.

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { type LedgerApiParams, useLedger, useLedgerReads } from '#src/hooks/useLedger'
import { testAccount } from '#src/testing/account'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import { toGrant } from '#src/testing/grant'
import { acsPage, acsRow, archived, transactionUpdate } from '#src/testing/ledgerAnswers'
import type { DappSdkMethods } from '#src/types'

const account = testAccount('alice::1220ab')
const request: LedgerApiParams = { requestMethod: 'get', resource: '/v2/parties' }

const liveSession = (ledgerApi: DappSdkMethods['ledgerApi'], withAccount = true) => ({
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

const renderLedger = (ledgerApi: DappSdkMethods['ledgerApi'], withAccount = true) =>
  renderHook(() => useLedger(), liveSession(ledgerApi, withAccount))

const grant = { receiver: 'bob::1220' }

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
      .mockResolvedValueOnce(acsPage(9, [acsRow('00aa', grant)]))
    const { result } = renderLedger(ledgerApi)

    await act(async () => {
      await expect(
        result.current.activeContracts({ templateId: '#app:Main:Grant', decode: toGrant }),
      ).resolves.toEqual({
        contracts: [
          { contractId: '00aa', templateId: 'pkg:Main:Grant', payload: { receiver: 'bob::1220' } },
        ],
        offset: 9,
      })
    })

    expect(ledgerApi).toHaveBeenNthCalledWith(1, {
      requestMethod: 'get',
      resource: '/v2/state/ledger-end',
    })
    expect(ledgerApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        resource: '/v2/state/active-contracts-page',
        body: expect.objectContaining({
          activeAtOffset: 9,
          eventFormat: expect.objectContaining({
            filtersByParty: { 'alice::1220ab': expect.anything() },
          }),
        }),
      }),
    )
  })

  it('gathers every page at the offset the first one was read at', async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce(acsPage(9, [acsRow('00aa', grant)], 'p2'))
      .mockResolvedValueOnce(acsPage(9, [acsRow('00bb', grant)], 'p3'))
      .mockResolvedValueOnce(acsPage(9, [acsRow('00cc', grant)]))
    const { result } = renderLedger(ledgerApi)

    await act(async () => {
      const { contracts, offset } = await result.current.activeContracts({
        templateId: '#app:Main:Grant',
        decode: toGrant,
      })

      expect(contracts.map((contract) => contract.contractId)).toEqual(['00aa', '00bb', '00cc'])
      expect(offset).toBe(9)
    })

    expect(ledgerApi).toHaveBeenCalledTimes(4)
    expect(ledgerApi).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        body: expect.objectContaining({ activeAtOffset: 9, pageToken: 'p2' }),
      }),
    )
    expect(ledgerApi).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        body: expect.objectContaining({ activeAtOffset: 9, pageToken: 'p3' }),
      }),
    )
  })

  it('rejects a failed read as an Error carrying what the wallet answered', async () => {
    const refusal = { code: -32603, message: 'Something went wrong while calling ledgerApi' }
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockRejectedValue(refusal)
    const { result } = renderLedger(ledgerApi)

    await act(async () => {
      const failure = await result.current
        .activeContracts({ templateId: '#app:Main:Grant', decode: toGrant })
        .catch((error: unknown) => error)

      expect(failure).toBeInstanceOf(Error)
      expect(failure).toMatchObject({ message: refusal.message, cause: refusal })
    })
  })

  it('refuses activeContracts when the session reports no party, without asking the ledger', async () => {
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>()
    const { result } = renderLedger(ledgerApi, false)

    await expect(
      result.current.activeContracts({ templateId: '#app:Main:Grant', decode: toGrant }),
    ).rejects.toThrow('no primary account')
    expect(ledgerApi).not.toHaveBeenCalled()
  })
})

describe('useLedgerReads', () => {
  it('follows a template from the cursor up to the ledger end, as the connected party', async () => {
    const ledgerApi = vi
      .fn<DappSdkMethods['ledgerApi']>()
      .mockResolvedValueOnce({ offset: 9 })
      .mockResolvedValueOnce([transactionUpdate(8, [archived('00aa')])])
    const { result } = renderHook(() => useLedgerReads(), liveSession(ledgerApi))

    await act(async () => {
      await expect(
        result.current.transactions({ templateId: '#app:Main:Grant', decode: toGrant }, 7),
      ).resolves.toEqual({
        transactions: [{ offset: 8, events: [{ kind: 'archived', contractId: '00aa' }] }],
        cursor: 8,
      })
    })

    expect(ledgerApi).toHaveBeenNthCalledWith(1, {
      requestMethod: 'get',
      resource: '/v2/state/ledger-end',
    })
    expect(ledgerApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        resource: '/v2/updates',
        body: expect.objectContaining({
          beginExclusive: 7,
          endInclusive: 9,
          updateFormat: {
            includeTransactions: expect.objectContaining({
              eventFormat: expect.objectContaining({
                filtersByParty: { 'alice::1220ab': expect.anything() },
              }),
            }),
          },
        }),
      }),
    )
  })
})
