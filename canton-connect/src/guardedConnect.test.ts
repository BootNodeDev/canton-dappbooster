import { DappSDK } from '@canton-network/dapp-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PICKER_DISMISSED } from './connectError'
import { guardedConnect } from './guardedConnect'
import { createAutoPicker } from './testing/autoPicker'
import { createFakeWallet } from './testing/fakeWallet'

// The guard reads nothing off a popup but `closed`, so a stub carries every headless path. Only the
// real cause — the SDK losing its `beforeunload` to the about:blank → blob: navigation — needs a browser.
const stubPopup = (): Window & { closed: boolean } =>
  ({ closed: false }) as unknown as Window & { closed: boolean }

// Assigned, not `vi.spyOn`: jsdom's `window.open` is an accessor, and a spy on it survives the
// guard's own reassignment, so the borrow never runs.
const stubOpen = (popup: Window | null): (() => void) => {
  const original = window.open
  window.open = (() => popup) as typeof window.open
  return () => {
    window.open = original
  }
}

// The #49 hang itself: a connect that never settles, driven by a picker window the guard must watch.
const hangingSdk = (): DappSDK =>
  ({
    connect: () => {
      window.open('', 'wallet-popup')
      return new Promise(() => {})
    },
  }) as unknown as DappSDK

describe('guardedConnect', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('rejects with the picker-dismissed message once the captured popup closes', async () => {
    vi.useFakeTimers()
    const popup = stubPopup()
    const restoreOpen = stubOpen(popup)

    const guarded = guardedConnect(hangingSdk())
    const settled = expect(guarded).rejects.toThrow(PICKER_DISMISSED)

    popup.closed = true
    await vi.advanceTimersByTimeAsync(500)
    await settled

    expect(vi.getTimerCount()).toBe(0)

    restoreOpen()
    vi.useRealTimers()
  })

  it('stays pending while the captured popup is open', async () => {
    vi.useFakeTimers()
    const restoreOpen = stubOpen(stubPopup())

    let settled = false
    void guardedConnect(hangingSdk()).catch(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(5_000)
    expect(settled).toBe(false)

    restoreOpen()
    vi.useRealTimers()
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
