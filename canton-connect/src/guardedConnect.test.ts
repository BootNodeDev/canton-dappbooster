import { DappSDK } from '@canton-network/dapp-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PickerClosedError } from './connectError'
import { guardedConnect } from './guardedConnect'
import { createAutoPicker } from './testing/autoPicker'
import { createFakeWallet } from './testing/fakeWallet'
import { type StubPopup, stubOpen, stubPopup } from './testing/stubPopup'

type ConnectOnly = Pick<DappSDK, 'connect'>

const popups: StubPopup[] = []
let restoreOpen: (() => void) | undefined

const openStub = (popup: object | null): void => {
  restoreOpen = stubOpen(popup)
}

const watchable = (): StubPopup => {
  const popup = stubPopup()
  popups.push(popup)
  return popup
}

// Past one poll interval, whatever it is.
const tick = () => vi.advanceTimersByTimeAsync(500)

// `opens` drives whether the SDK reaches for window.open; `settle` lets a test resolve the connect.
const stubSdk = ({ opens = false } = {}): ConnectOnly & { settle: () => void } => {
  let settle = (): void => undefined
  return {
    settle: () => settle(),
    connect: () => {
      if (opens) window.open('', 'wallet-popup')
      return new Promise((done) => {
        settle = () => done({ isConnected: true, isNetworkConnected: true })
      })
    },
  }
}

describe('guardedConnect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    // Fake timers still live: closing the popups lets every pending guard reject and release the borrow.
    for (const popup of popups.splice(0)) {
      popup.closed = true
    }
    if (vi.isFakeTimers()) await tick()

    vi.useRealTimers()
    restoreOpen?.()
    restoreOpen = undefined
    localStorage.clear()
  })

  it('rejects once the captured popup closes', async () => {
    const popup = watchable()
    openStub(popup)

    const settled = expect(guardedConnect(stubSdk({ opens: true }))).rejects.toBeInstanceOf(
      PickerClosedError,
    )

    popup.closed = true
    await tick()
    await settled

    expect(vi.getTimerCount()).toBe(0)
  })

  it('stays pending while the captured popup is open', async () => {
    openStub(watchable())

    let settled = false
    void guardedConnect(stubSdk({ opens: true })).catch(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(5_000)
    expect(settled).toBe(false)
  })

  it('hands the original window.open back after overlapping connects settle', async () => {
    openStub(null)
    const stubbed = window.open

    const a = stubSdk()
    const b = stubSdk()
    const settledA = guardedConnect(a)
    const settledB = guardedConnect(b)

    a.settle()
    await settledA
    b.settle()
    await settledB

    expect(window.open).toBe(stubbed)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('watches one popup on behalf of every connect in flight', async () => {
    const popup = watchable()
    openStub(popup)
    const stubbed = window.open

    const settledA = expect(guardedConnect(stubSdk())).rejects.toBeInstanceOf(PickerClosedError)
    const settledB = expect(guardedConnect(stubSdk())).rejects.toBeInstanceOf(PickerClosedError)

    window.open('', 'wallet-popup')
    popup.closed = true
    await tick()
    await Promise.all([settledA, settledB])

    expect(window.open).toBe(stubbed)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('watches a popup the SDK reuses instead of reopening', async () => {
    const popup = watchable()
    openStub(popup)

    void guardedConnect(stubSdk({ opens: true })).catch(() => undefined)
    await tick()

    // Opens nothing, so only the remembered handle can arm the watchdog.
    const settled = expect(guardedConnect(stubSdk())).rejects.toBeInstanceOf(PickerClosedError)

    popup.closed = true
    await tick()
    await settled
  })

  it('ignores a remembered popup the user already closed', async () => {
    const popup = watchable()
    openStub(popup)

    void guardedConnect(stubSdk({ opens: true })).catch(() => undefined)
    await tick()
    popup.closed = true
    await tick()

    openStub(watchable())

    let settled = false
    void guardedConnect(stubSdk({ opens: true })).catch(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(2_000)
    expect(settled).toBe(false)
  })

  it('passes a connect through untouched when no popup handle is captured', async () => {
    vi.useRealTimers()
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
    vi.useRealTimers()
    const original = window.open
    const sdk = new DappSDK({ walletPicker: createAutoPicker('absent') })
    await sdk.init({ defaultAdapters: [] })

    await expect(guardedConnect(sdk)).rejects.toThrow('auto-picker: no wallet matching absent')
    expect(window.open).toBe(original)
  })
})
