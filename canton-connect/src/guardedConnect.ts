// #49: the SDK's picker attaches `beforeunload` to the popup, and the about:blank → blob:
// navigation that follows destroys the listener, so a closed popup leaves connect() pending forever.
// Borrowing window.open captures the handle without depending on the SDK's internal window name.

import type { DappSDK } from '@canton-network/dapp-sdk'
import { PICKER_DISMISSED } from './connectError'

const POLL_MS = 400

// One borrow for the whole module, not one per call: a second guard would otherwise capture the
// first guard's wrapper as its "native" and hand it back on settle, leaving it installed for good.
let nativeOpen: typeof window.open | undefined
const waiting = new Set<(popup: Window) => void>()

const borrowOpen = (): void => {
  if (nativeOpen !== undefined) {
    return
  }

  const native = window.open
  nativeOpen = native

  window.open = (...args: Parameters<typeof native>) => {
    const popup = native.apply(window, args)

    // Falsy, not `=== null`: jsdom's unimplemented window.open returns undefined, off-type.
    if (popup) {
      const notify = [...waiting]
      waiting.clear()
      returnOpen()
      for (const watch of notify) {
        watch(popup)
      }
    }

    return popup
  }
}

const returnOpen = (): void => {
  if (nativeOpen === undefined || waiting.size > 0) {
    return
  }

  window.open = nativeOpen
  nativeOpen = undefined
}

/**
 * `sdk.connect()` with a watchdog on the popup the SDK opens. Call it only when no
 * `CantonConnectConfig.walletPicker` is set; a consumer's picker owns its own surface.
 * Degrades to a bare `sdk.connect()` wherever no popup handle can be had.
 *
 * @example
 * const result = await guardedConnect(sdk)
 * if (!result.isConnected) throw new Error(result.reason)
 */
export const guardedConnect = (sdk: DappSDK): ReturnType<DappSDK['connect']> => {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return sdk.connect()
  }

  let poll: ReturnType<typeof setInterval> | undefined
  let watch: ((popup: Window) => void) | undefined

  const dismissed = new Promise<never>((_resolve, reject) => {
    watch = (popup) => {
      poll = setInterval(() => {
        if (popup.closed) {
          reject(new Error(PICKER_DISMISSED))
        }
      }, POLL_MS)
    }

    waiting.add(watch)
    borrowOpen()
  })

  // No status() probe before rejecting: it would read a still-live previous session and swallow a
  // genuine cancel, and connect() resolves before the microtask that closes the popup on success.
  return Promise.race([sdk.connect(), dismissed]).finally(() => {
    if (watch !== undefined) {
      waiting.delete(watch)
    }
    returnOpen()
    clearInterval(poll)
  })
}
