// The rule over a session that answers; a refusal reaches the caller as the rejection it was.

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { usePartyType } from '#src/hooks/usePartyType'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import { testParty } from '#src/testing/party'
import type { Party, WalletSdk } from '#src/types'

const party = testParty('alice::1220ab')

const liveSession = (sdk: Partial<WalletSdk>, connectedParty: Party | undefined) => ({
  wrapper: ({ children }: { children: ReactNode }) => (
    <FakeSessionProvider party={connectedParty} sdk={sdk} status="connected">
      {children}
    </FakeSessionProvider>
  ),
})

type LedgerAnswer = Awaited<ReturnType<WalletSdk['ledgerApi']>>

const answering = (answer: LedgerAnswer) =>
  vi.fn<WalletSdk['ledgerApi']>().mockResolvedValue(answer)

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

  it('hands a refusal back as the rejection it was', async () => {
    const refused = new Error('RPC error: -32601 - method not allowed')
    const ledgerApi = vi.fn<WalletSdk['ledgerApi']>().mockRejectedValue(refused)
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, party))

    await act(async () => {
      await expect(result.current.readPartyType()).rejects.toBe(refused)
    })
  })

  it('rejects an answer carrying no participant id', async () => {
    const ledgerApi = answering({ parties: [] })
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, party))

    await act(async () => {
      await expect(result.current.readPartyType()).rejects.toThrow(
        'participant id not found in {"parties":[]}',
      )
    })
  })

  it('refuses over a session that reports no party, without asking the ledger', async () => {
    const ledgerApi = answering({ participantId: 'participant::1220ab' })
    const { result } = renderHook(() => usePartyType(), liveSession({ ledgerApi }, undefined))

    expect(result.current.isReady).toBe(false)

    await act(async () => {
      await expect(result.current.readPartyType()).rejects.toThrow('wallet reports no usable party')
    })

    expect(ledgerApi).not.toHaveBeenCalled()
  })
})
