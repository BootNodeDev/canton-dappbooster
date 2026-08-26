// The hook's own state, over a session that answers: the `sdk` opt-in on FakeSessionProvider is
// what makes a resolving signMessage reachable at all.

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSignMessage } from '#src/hooks/useSignMessage'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import type { WalletSdk } from '#src/types'

const party = { partyId: 'alice::1220ab', networkId: 'canton:local' }

const liveSession = (sdk: Partial<WalletSdk>) => ({
  wrapper: ({ children }: { children: ReactNode }) => (
    <FakeSessionProvider party={party} sdk={sdk} status="connected">
      {children}
    </FakeSessionProvider>
  ),
})

describe('useSignMessage', () => {
  it('publishes the signature the wallet answered with', async () => {
    const signMessage = vi.fn<WalletSdk['signMessage']>().mockResolvedValue({ signature: 'sig' })
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }))

    await act(async () => {
      await expect(result.current.signMessage('hello')).resolves.toBe('sig')
    })

    expect(signMessage).toHaveBeenCalledWith({ message: 'hello' })
    expect(result.current.signature).toBe('sig')
    expect(result.current.error).toBeUndefined()
    expect(result.current.isSigning).toBe(false)
  })

  it('captures the wallet refusal and rethrows it', async () => {
    const refused = new Error('user refused to sign')
    const signMessage = vi.fn<WalletSdk['signMessage']>().mockRejectedValue(refused)
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }))

    await act(async () => {
      await expect(result.current.signMessage('hello')).rejects.toBe(refused)
    })

    expect(result.current.error).toBe(refused)
    expect(result.current.signature).toBeUndefined()
    expect(result.current.isSigning).toBe(false)
  })

  it('forgets a signature, and a refusal, on reset', async () => {
    const refused = new Error('user refused to sign')
    const signMessage = vi
      .fn<WalletSdk['signMessage']>()
      .mockResolvedValueOnce({ signature: 'sig' })
      .mockRejectedValueOnce(refused)
    const { result } = renderHook(() => useSignMessage(), liveSession({ signMessage }))

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
})
