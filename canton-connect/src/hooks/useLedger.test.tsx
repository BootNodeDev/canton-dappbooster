// The request path over a live session; the guards are covered against the real provider.

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { type LedgerApiParams, useLedger } from '#src/hooks/useLedger'
import { testAccount } from '#src/testing/account'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import type { DappSdkMethods } from '#src/types'

const account = testAccount('alice::1220ab')
const request: LedgerApiParams = { requestMethod: 'get', resource: '/v2/parties' }

const liveSession = (sdk: Partial<DappSdkMethods>) => ({
  wrapper: ({ children }: { children: ReactNode }) => (
    <FakeSessionProvider account={account} sdk={sdk} status="connected">
      {children}
    </FakeSessionProvider>
  ),
})

describe('useLedger', () => {
  it('passes the request to the sdk and hands its answer back untouched', async () => {
    const answer = { parties: [] }
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockResolvedValue(answer)
    const { result } = renderHook(() => useLedger(), liveSession({ ledgerApi }))

    expect(result.current.isReady).toBe(true)

    await act(async () => {
      await expect(result.current.ledgerApi(request)).resolves.toBe(answer)
    })

    expect(ledgerApi).toHaveBeenCalledWith(request)
  })

  it('wraps a bare refusal in an Error, the object as its cause', async () => {
    const bare = { status: 'error', error: 3 }
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockRejectedValue(bare)
    const { result } = renderHook(() => useLedger(), liveSession({ ledgerApi }))

    await act(async () => {
      await expect(result.current.ledgerApi(request)).rejects.toEqual(
        new Error('Wallet request failed', { cause: bare }),
      )
    })
  })
})
