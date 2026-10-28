import { rpcErrors } from '@canton-network/core-rpc-errors'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { usePartyType } from '#src/hooks/usePartyType'
import { testAccount } from '#src/testing/account'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import type { Account, DappSdkMethods } from '#src/types'

const party = testAccount('alice::1220ab')

const liveSession = (sdk: Partial<DappSdkMethods>, connectedAccount: Account | undefined) => ({
  wrapper: ({ children }: { children: ReactNode }) => (
    <FakeSessionProvider account={connectedAccount} sdk={sdk} status="connected">
      {children}
    </FakeSessionProvider>
  ),
})

type LedgerAnswer = Awaited<ReturnType<DappSdkMethods['ledgerApi']>>

const answering = (answer: LedgerAnswer) =>
  vi.fn<DappSdkMethods['ledgerApi']>().mockResolvedValue(answer)

describe('usePartyType', () => {
  it('reads the participant id and calls a party under its namespace local', async () => {
    const ledgerApi = answering({ participantId: 'participant::1220ab' })
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, party))

    expect(result.current.isReady).toBe(true)

    await act(async () => {
      await expect(result.current.readPartyType()).resolves.toBe('local')
    })

    expect(ledgerApi).toHaveBeenCalledTimes(1)
    expect(ledgerApi).toHaveBeenCalledWith({
      requestMethod: 'get',
      resource: '/v2/parties/participant-id',
    })
  })

  it('calls a party under another namespace external', async () => {
    const ledgerApi = answering({ participantId: 'participant::1220ff' })
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, party))

    await act(async () => {
      await expect(result.current.readPartyType()).resolves.toBe('external')
    })
  })

  it('hands an Error refusal back as the rejection it was', async () => {
    const refused = rpcErrors.methodNotFound('method not allowed')
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockRejectedValue(refused)
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, party))

    await act(async () => {
      await expect(result.current.readPartyType()).rejects.toBe(refused)
    })
  })

  it('wraps a bare refusal in an Error, the object as its cause', async () => {
    const bare = { status: 'error', error: 3 }
    const ledgerApi = vi.fn<DappSdkMethods['ledgerApi']>().mockRejectedValue(bare)
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, party))

    await act(async () => {
      await expect(result.current.readPartyType()).rejects.toEqual(
        new Error('Wallet request failed', { cause: bare }),
      )
    })
  })

  it('rejects an answer carrying no participant id, the answer as cause', async () => {
    const answer = { parties: [] }
    const ledgerApi = answering(answer)
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, party))

    await act(async () => {
      await expect(result.current.readPartyType()).rejects.toEqual(
        new Error('participant id not found in the ledger answer', { cause: answer }),
      )
    })
  })

  it('refuses over a session that reports no account, without asking the ledger', async () => {
    const ledgerApi = answering({ participantId: 'participant::1220ab' })
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, undefined))

    expect(result.current.isReady).toBe(false)

    await act(async () => {
      await expect(result.current.readPartyType()).rejects.toThrow(
        'wallet reports no primary account',
      )
    })

    expect(ledgerApi).not.toHaveBeenCalled()
  })
})
