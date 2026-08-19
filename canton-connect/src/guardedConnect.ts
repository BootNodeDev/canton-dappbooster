// #49: the SDK's picker loses its `beforeunload` to the about:blank → blob: navigation, so a closed
// popup leaves connect() pending forever. See architecture.md.

import type { DappSDK } from '@canton-network/dapp-sdk'
import { PickerClosedError } from './connectError'

const POLL_MS = 400

// Module-scoped: a per-call borrow would capture another call's wrapper as its native.
let nativeOpen: typeof window.open | undefined
let inFlight = 0

// Remembered, not captured per call: the SDK calls window.open only to *create* its picker window,
// so a connect reusing one the last left open opens nothing.
let opened: Window | undefined

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
      opened = popup
      // Every guard polls the remembered handle, so hand `open` back the moment one exists rather
      // than hold it for the whole connect, where an unrelated popup would become the watched one.
      window.open = native
      nativeOpen = undefined
    }

    return popup
  }
}

// Only for a connect that captured nothing; the wrapper hands `open` back itself once it has a popup.
const returnOpen = (): void => {
  if (nativeOpen === undefined || inFlight > 0) {
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
export const guardedConnect = (sdk: Pick<DappSDK, 'connect'>): ReturnType<DappSDK['connect']> => {
  if (typeof window === 'undefined') {
    return sdk.connect()
  }

  inFlight += 1
  borrowOpen()

  // A handle already closed on arrival belongs to a past connect; wait for the next one instead.
  let seen = opened
  let watched = opened?.closed === false ? opened : undefined
  let poll: ReturnType<typeof setInterval> | undefined

  const dismissed = new Promise<never>((_resolve, reject) => {
    poll = setInterval(() => {
      if (opened !== seen) {
        seen = opened
        watched = opened
      }

      if (watched?.closed === true) {
        reject(new PickerClosedError())
      }
    }, POLL_MS)
  })

  // No status() probe before rejecting: a still-live previous session would swallow the cancel.
  return Promise.race([sdk.connect(), dismissed]).finally(() => {
    clearInterval(poll)
    inFlight -= 1
    returnOpen()
  })
}
