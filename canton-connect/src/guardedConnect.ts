// #49: the SDK's picker loses its `beforeunload` to the about:blank → blob: navigation, so a closed
// popup leaves connect() pending forever. See architecture.md.

import type { DappSDK } from '@canton-network/dapp-sdk'
import { PickerClosedError } from './connectError'

const POLL_MS = 400

// Module-scoped: a per-call borrow would capture another call's wrapper as its native.
let nativeOpen: typeof window.open | undefined
const waiting = new Set<(popup: Window) => void>()

// The SDK calls window.open only to *create* its picker window, never to reuse one still open.
let openedPopup: Window | undefined

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
      openedPopup = popup

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
      clearInterval(poll)
      poll = setInterval(() => {
        if (popup.closed) {
          reject(new PickerClosedError())
        }
      }, POLL_MS)
    }

    if (openedPopup !== undefined && !openedPopup.closed) {
      watch(openedPopup)
    }

    waiting.add(watch)
    borrowOpen()
  })

  // No status() probe before rejecting: it would read a still-live previous session and swallow a cancel.
  return Promise.race([sdk.connect(), dismissed]).finally(() => {
    if (watch !== undefined) {
      waiting.delete(watch)
    }
    returnOpen()
    clearInterval(poll)
  })
}
