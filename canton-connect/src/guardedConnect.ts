// #49: the SDK's picker attaches `beforeunload` to the popup, and the about:blank → blob:
// navigation that follows destroys the listener, so a closed popup leaves connect() pending forever.
// Borrowing window.open captures the handle without depending on the SDK's internal window name.

import type { DappSDK } from '@canton-network/dapp-sdk'
import { PICKER_DISMISSED } from './connectError'

const POLL_MS = 400

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
  const nativeOpen = typeof window === 'undefined' ? undefined : window.open

  if (nativeOpen === undefined) {
    return sdk.connect()
  }

  let poll: ReturnType<typeof setInterval> | undefined
  const restore = (): void => {
    window.open = nativeOpen
  }

  const dismissed = new Promise<never>((_resolve, reject) => {
    window.open = (...args: Parameters<typeof nativeOpen>) => {
      const popup = nativeOpen.apply(window, args)
      restore()

      // Falsy, not `=== null`: jsdom's unimplemented window.open returns undefined, off-type.
      if (popup) {
        poll = setInterval(() => {
          if (popup.closed) {
            reject(new Error(PICKER_DISMISSED))
          }
        }, POLL_MS)
      }

      return popup
    }
  })

  // No status() probe before rejecting: it would read a still-live previous session and swallow a
  // genuine cancel, and connect() resolves before the microtask that closes the popup on success.
  return Promise.race([sdk.connect(), dismissed]).finally(() => {
    restore()
    clearInterval(poll)
  })
}
