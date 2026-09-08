// The hook's own state, over a session that answers: the `sdk` opt-in on FakeSessionProvider is
// what makes a resolving signMessage reachable at all.

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSignMessage } from '#src/hooks/useSignMessage'
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

describe('useSignMessage', () => {
  it('publishes the signature the wallet answered with', async () => {
    const signMessage = vi.fn<WalletSdk['signMessage']>().mockResolvedValue({ signature: 'sig' })
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }, party))

    await act(async () => {
      await expect(result.current.signMessage('hello')).resolves.toBe('sig')
    })

    expect(signMessage).toHaveBeenCalledWith({ message: 'hello' })
    expect(result.current.signature).toBe('sig')
    expect(result.current.error).toBeUndefined()
    expect(result.current.isPending).toBe(false)
  })

  it('captures the wallet refusal and rethrows it', async () => {
    const refused = new Error('user refused to sign')
    const signMessage = vi.fn<WalletSdk['signMessage']>().mockRejectedValue(refused)
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }, party))

    await act(async () => {
      await expect(result.current.signMessage('hello')).rejects.toBe(refused)
    })

    expect(result.current.error).toBe(refused)
    expect(result.current.signature).toBeUndefined()
    expect(result.current.isPending).toBe(false)
  })

  it('publishes a refusal that arrived as a JSON-RPC object as an Error', async () => {
    const rpcError = { code: 4001, message: 'user refused to sign' }
    const signMessage = vi.fn<WalletSdk['signMessage']>().mockRejectedValue(rpcError)
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }, party))

    await act(async () => {
      await expect(result.current.signMessage('hello')).rejects.toBeInstanceOf(Error)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('user refused to sign')
    expect(result.current.error?.cause).toBe(rpcError)
  })

  it('forgets a signature, and a refusal, on reset', async () => {
    const refused = new Error('user refused to sign')
    const signMessage = vi
      .fn<WalletSdk['signMessage']>()
      .mockResolvedValueOnce({ signature: 'sig' })
      .mockRejectedValueOnce(refused)
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }, party))

    await act(async () => {
      await result.current.signMessage('hello')
    })

    expect(result.current.signature).toBe('sig')

    act(() => {
      result.current.reset()
    })

    expect(result.current.signature).toBeUndefined()

    await act(async () => {
      await expect(result.current.signMessage('hello')).rejects.toBe(refused)
    })

    expect(result.current.error).toBe(refused)

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeUndefined()
  })

  it('refuses a signature over a session that reports no party', async () => {
    const signMessage = vi.fn<WalletSdk['signMessage']>().mockResolvedValue({ signature: 'sig' })
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }, undefined))

    await act(async () => {
      await expect(result.current.signMessage('hello')).rejects.toThrow(
        'wallet reports no usable party',
      )
    })

    expect(signMessage).not.toHaveBeenCalled()
    expect(result.current.error).toBeUndefined()
  })
})
