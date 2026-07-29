import { describe, expect, it } from 'vitest'
import { createFakeWallet } from './fakeWallet'

describe('createFakeWallet', () => {
  it('answers the extension handshake so detect resolves true', async () => {
    const wallet = createFakeWallet({ id: 'test-wallet', target: 'test-wallet' })

    const { ExtensionAdapter } = await import('@canton-network/dapp-sdk')
    const adapter = new ExtensionAdapter({
      providerId: 'browser:ext:test-wallet',
      target: 'test-wallet',
    })

    expect(await adapter.detect()).toBe(true)

    wallet.dispose()
  })

  it('delivers a pushed notification as a provider event', async () => {
    const wallet = createFakeWallet({ id: 'test-wallet', target: 'test-wallet' })

    const { ExtensionAdapter } = await import('@canton-network/dapp-sdk')
    const adapter = new ExtensionAdapter({
      providerId: 'browser:ext:test-wallet',
      target: 'test-wallet',
    })
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
})
