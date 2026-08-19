import { DappSDK } from '@canton-network/dapp-sdk'
import { afterEach, describe, expect, it } from 'vitest'
import { guardedConnect } from './guardedConnect'
import { createAutoPicker } from './testing/autoPicker'
import { createFakeWallet } from './testing/fakeWallet'

// jsdom has no popup, so the close this guards against cannot happen here — that is proven in a real
// browser. What is testable headless is the degrade path and the borrow of window.open.
describe('guardedConnect', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('passes a connect through untouched when no popup handle is captured', async () => {
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })
    const original = window.open
    const sdk = new DappSDK({ walletPicker: createAutoPicker() })
    await sdk.init({ defaultAdapters: [] })

    await expect(guardedConnect(sdk)).resolves.toMatchObject({ isConnected: true })
    expect(window.open).toBe(original)

    wallet.dispose()
  })

  it('hands window.open back when the connect rejects', async () => {
    const original = window.open
    const sdk = new DappSDK({ walletPicker: createAutoPicker('absent') })
    await sdk.init({ defaultAdapters: [] })

    await expect(guardedConnect(sdk)).rejects.toThrow('auto-picker: no wallet matching absent')
    expect(window.open).toBe(original)
  })
})
