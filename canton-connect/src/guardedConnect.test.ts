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

let restoreOpen: (() => void) | undefined

// Assigned, not `vi.spyOn`: jsdom's `window.open` is an accessor, and a spy on it survives the
// guard's own reassignment, so the borrow never runs.
const stubOpen = (popup: Window | null): typeof window.open => {
  const original = window.open
  window.open = (() => popup) as typeof window.open
  restoreOpen = () => {
    window.open = original
  }
  return window.open
}

// The #49 hang: a connect that never settles.
const pendingSdk = (): DappSDK => ({ connect: () => new Promise(() => {}) }) as unknown as DappSDK

const pickingSdk = (): DappSDK =>
  ({
    connect: () => {
      window.open('', 'wallet-popup')
      return new Promise(() => {})
    },
  }) as unknown as DappSDK

describe('guardedConnect', () => {
  afterEach(() => {
    // In afterEach, not per test: a timed-out test would otherwise leave fake timers on for the rest.
    restoreOpen?.()
    restoreOpen = undefined
    vi.useRealTimers()
    localStorage.clear()
  })

  it('rejects with the picker-dismissed message once the captured popup closes', async () => {
    vi.useFakeTimers()
    const popup = stubPopup()
    stubOpen(popup)

    const settled = expect(guardedConnect(pickingSdk())).rejects.toThrow(PICKER_DISMISSED)

    popup.closed = true
    await vi.advanceTimersByTimeAsync(500)
    await settled

    expect(vi.getTimerCount()).toBe(0)
  })

  it('stays pending while the captured popup is open', async () => {
    vi.useFakeTimers()
    stubOpen(stubPopup())

    let settled = false
    void guardedConnect(pickingSdk()).catch(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(5_000)
    expect(settled).toBe(false)
  })

  it('hands the original window.open back after overlapping connects settle', async () => {
    vi.useFakeTimers()
    const stubbed = stubOpen(null)

    let settleA = (): void => {}
    let settleB = (): void => {}
    const settling = (capture: (settle: () => void) => void): DappSDK =>
      ({
        connect: () => new Promise((done) => capture(() => done({ isConnected: true }))),
      }) as unknown as DappSDK

    const a = guardedConnect(settling((settle) => (settleA = settle)))
    const b = guardedConnect(settling((settle) => (settleB = settle)))

    settleA()
    await a
    settleB()
    await b

    expect(window.open).toBe(stubbed)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('watches one popup on behalf of every connect in flight', async () => {
    vi.useFakeTimers()
    const popup = stubPopup()
    const stubbed = stubOpen(popup)

    const settledA = expect(guardedConnect(pendingSdk())).rejects.toThrow(PICKER_DISMISSED)
    const settledB = expect(guardedConnect(pendingSdk())).rejects.toThrow(PICKER_DISMISSED)

    window.open('', 'wallet-popup')
    popup.closed = true
    await vi.advanceTimersByTimeAsync(500)
    await Promise.all([settledA, settledB])

    expect(window.open).toBe(stubbed)
    expect(vi.getTimerCount()).toBe(0)
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
