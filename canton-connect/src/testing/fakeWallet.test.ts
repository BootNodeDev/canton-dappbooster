import { WalletEvent } from '@canton-network/core-types'
import { describe, expect, it } from 'vitest'
import { createFakeWallet } from '#src/testing/fakeWallet'
import { pause } from '#src/testing/pause'

// The only consumer of this pairing is this file, hence a local factory over a testing/ module.
const createFakeExtension = async (statusResponses?: boolean[]) => {
  const wallet = createFakeWallet({ id: 'test-wallet', target: 'test-wallet', statusResponses })

  const { ExtensionAdapter } = await import('@canton-network/dapp-sdk')
  const adapter = new ExtensionAdapter({
    providerId: 'browser:ext:test-wallet',
    target: 'test-wallet',
  })

  return { wallet, adapter }
}

describe('createFakeWallet', () => {
  it('answers the extension handshake so detect resolves true', async () => {
    const { wallet, adapter } = await createFakeExtension()

    expect(await adapter.detect()).toBe(true)

    wallet.dispose()
  })

  it('rejects a request for a method it does not implement, naming the method', async () => {
    const { wallet, adapter } = await createFakeExtension()
    await adapter.detect()

    await expect(
      adapter.provider().request({ method: 'signMessage' } as never),
    ).rejects.toMatchObject({
      message: expect.stringContaining('signMessage'),
    })

    wallet.dispose()
  })

  it('delivers a pushed notification as a provider event', async () => {
    const { wallet, adapter } = await createFakeExtension()
    await adapter.detect()

    const received: unknown[] = []
    adapter.provider().on('accountsChanged', (payload: unknown) => {
      received.push(payload)
    })

    wallet.push('accountsChanged', { accounts: [] })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(received).toHaveLength(1)

    wallet.dispose()
  })

  it('answers status by call count, repeating the last entry once exhausted', async () => {
    const { wallet, adapter } = await createFakeExtension([true, false])

    const provider = adapter.provider()
    const askStatus = async (): Promise<boolean> => {
      const status = await provider.request({ method: 'status' } as never)

      return (status as { connection: { isConnected: boolean } }).connection.isConnected
    }

    expect(await askStatus()).toBe(true)

    // another method in between: the sequence is indexed by status calls alone
    await provider.request({ method: 'listAccounts' } as never)

    expect(await askStatus()).toBe(false)
    expect(await askStatus()).toBe(false)

    wallet.dispose()
  })

  it('ignores a request frame addressed to another fake', async () => {
    const wallet = createFakeWallet({ id: 'wallet-b', target: 'wallet-b' })

    const answers: unknown[] = []
    const collect = (event: MessageEvent): void => {
      if ((event.data as { type?: string })?.type === WalletEvent.SPLICE_WALLET_RESPONSE) {
        answers.push(event.data)
      }
    }
    window.addEventListener('message', collect)

    const ask = (target: string, id: number): void => {
      window.postMessage(
        {
          type: WalletEvent.SPLICE_WALLET_REQUEST,
          target,
          request: { jsonrpc: '2.0', id, method: 'status' },
        },
        '*',
      )
    }

    // Two turns of the queue: one delivers the request frame, the next the answer to it.
    const settle = async (): Promise<void> => {
      await pause(0)
      await pause(0)
    }

    ask('wallet-a', 1)
    await settle()

    expect(answers).toEqual([])

    // the same frame on its own target is answered, so the filter is what silenced the first
    ask('wallet-b', 2)
    await settle()

    expect(answers).toHaveLength(1)

    window.removeEventListener('message', collect)
    wallet.dispose()
  })
})
