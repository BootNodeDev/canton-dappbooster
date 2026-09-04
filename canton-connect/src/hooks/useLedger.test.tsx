// The request path over a session that answers; the guards are covered against the real provider.

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { type LedgerApiParams, useLedger } from '#src/hooks/useLedger'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import { testParty } from '#src/testing/party'
import type { WalletSdk } from '#src/types'

const party = testParty('alice::1220ab')
const request: LedgerApiParams = { requestMethod: 'get', resource: '/v2/parties' }

describe('useLedger', () => {
  it('passes the request to the sdk and hands its answer back untouched', async () => {
    const answer = { parties: [] }
    const ledgerApi = vi.fn<WalletSdk['ledgerApi']>().mockResolvedValue(answer)
    const sdk = { ledgerApi }
    const { result } = renderHook(() => useLedger(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <FakeSessionProvider party={party} sdk={sdk} status="connected">
          {children}
        </FakeSessionProvider>
      ),
    })

    expect(result.current.isReady).toBe(true)

    await act(async () => {
      await expect(result.current.ledgerApi(request)).resolves.toBe(answer)
    })

    expect(ledgerApi).toHaveBeenCalledWith(request)
  })
})
