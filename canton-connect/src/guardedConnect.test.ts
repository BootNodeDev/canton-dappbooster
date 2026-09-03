import { DappSDK } from '@canton-network/dapp-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectCancelledError, PickerClosedError } from '#src/connectError'
import { guardedConnect } from '#src/guardedConnect'
import { createAutoPicker } from '#src/testing/autoPicker'
import { createFakeWallet } from '#src/testing/fakeWallet'
import { type StubPopup, stubOpen, stubPopup } from '#src/testing/stubPopup'

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
    // Fake timers still live: closing the popups lets every pending guard reject and release the
    // borrow.
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
    openStub(watchable())
    const stubbed = window.open

    const a = stubSdk({ opens: true })
    const b = stubSdk()
    const settledA = guardedConnect(a)
    const settledB = guardedConnect(b)

    a.settle()
    await settledA

    // B captured no handle of its own, so the borrow has to outlive A to catch a popup B opens.
    expect(window.open).not.toBe(stubbed)

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

  // Dispatched, not posted: jsdom schedules postMessage on real timers, which fake ones never
  // reach.
  const pick = (walletType: string): void => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { messageType: 'SPLICE_WALLET_PICKER_RESULT', providerId: 'wallet-a', walletType },
        origin: window.location.origin,
      }),
    )
  }

  it('stops treating a close as a dismissal once an extension is picked', async () => {
    const popup = watchable()
    openStub(popup)

    const sdk = stubSdk({ opens: true })
    let settled = false
    const connecting = guardedConnect(sdk).catch(() => {
      settled = true
    })

    pick('browser')
    popup.closed = true
    await vi.advanceTimersByTimeAsync(2_000)

    expect(settled).toBe(false)

    // Closing it cannot drain a picked guard, so this one has to be let go by hand.
    sdk.settle()
    await connecting
  })

  it('keeps rejecting for a remote wallet, whose popup is the wallet itself', async () => {
    const popup = watchable()
    openStub(popup)

    const settled = expect(guardedConnect(stubSdk({ opens: true }))).rejects.toBeInstanceOf(
      PickerClosedError,
    )

    pick('remote')
    popup.closed = true
    await tick()
    await settled
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
    // pinned by reference: a picker's own failure must propagate verbatim, never read as a close
    const pickerError = new Error('picker exploded')
    const sdk = new DappSDK({ walletPicker: () => Promise.reject(pickerError) })
    await sdk.init({ defaultAdapters: [] })

    await expect(guardedConnect(sdk)).rejects.toBe(pickerError)
    expect(window.open).toBe(original)
  })

  it('rejects as a cancel when the caller abandons the connect', async () => {
    openStub(watchable())
    const stubbed = window.open
    const controller = new AbortController()

    const settled = expect(
      guardedConnect(stubSdk({ opens: true }), controller.signal),
    ).rejects.toBeInstanceOf(ConnectCancelledError)

    controller.abort()
    await settled
    // the forged pick is delivered on a task of its own, which counts as a pending timer here
    await tick()

    // the race's `finally` is what releases both, so an unsettled race would leak them
    expect(vi.getTimerCount()).toBe(0)
    expect(window.open).toBe(stubbed)
  })

  it('closes the picker window it captured', async () => {
    const popup = watchable()
    const close = vi.fn(() => {
      popup.closed = true
    })
    popup.close = close
    openStub(popup)
    const controller = new AbortController()

    const settled = expect(
      guardedConnect(stubSdk({ opens: true }), controller.signal),
    ).rejects.toBeInstanceOf(ConnectCancelledError)

    controller.abort()
    await settled

    expect(close).toHaveBeenCalledOnce()
  })

  it('rejects at once on a signal already aborted', async () => {
    openStub(watchable())

    await expect(
      guardedConnect(stubSdk({ opens: true }), AbortSignal.abort()),
    ).rejects.toBeInstanceOf(ConnectCancelledError)
  })

  it('forges the abandoned pick only when no other connect is in flight', async () => {
    openStub(watchable())
    const posted = vi.spyOn(window, 'postMessage')
    const abandonedPick = expect.objectContaining({ providerId: 'abandoned' })

    const other = stubSdk()
    const stranded = guardedConnect(other)
    const controller = new AbortController()
    const cancelling = guardedConnect(stubSdk({ opens: true }), controller.signal)

    controller.abort()
    await expect(cancelling).rejects.toBeInstanceOf(ConnectCancelledError)

    // the message reaches every picker listener on the page, so it would settle `other`'s pick too
    expect(posted).not.toHaveBeenCalledWith(abandonedPick, expect.anything())

    other.settle()
    await stranded

    const alone = new AbortController()
    const solo = guardedConnect(stubSdk({ opens: true }), alone.signal)

    alone.abort()
    await expect(solo).rejects.toBeInstanceOf(ConnectCancelledError)

    expect(posted).toHaveBeenCalledWith(abandonedPick, expect.anything())

    posted.mockRestore()
  })
})
