// What the SDK's built-in picker rejects with, and what `guardedConnect` raises in its place when
// the SDK misses the close — matched here, at the seam that owns the SDK, and never downstream.
export const PICKER_DISMISSED = 'User closed the wallet picker'

/**
 * Raised by `guardedConnect` when it settles a connect the SDK left pending. The SDK's own
 * `connect()` is still running underneath, so whoever catches this retires the `DappSDK`.
 *
 * @example
 * if (err instanceof PickerClosedError) discardSdk()
 */
export class PickerClosedError extends Error {
  constructor() {
    super(PICKER_DISMISSED)
    this.name = 'PickerClosedError'
  }
}

/**
 * A connect the user walked away from: the picker was closed rather than a wallet failing.
 *
 * @example
 * if (connectError !== undefined && !(connectError instanceof ConnectCancelledError)) {
 *   toast.error(connectError.message)
 * }
 */
export class ConnectCancelledError extends Error {
  constructor(cause?: unknown) {
    super('Wallet connection cancelled', { cause })
    this.name = 'ConnectCancelledError'
  }
}

/** Classifies what `sdk.connect()` threw, so the cancel path is decided once. */
export const toConnectError = (cause: unknown): Error => {
  if (cause instanceof ConnectCancelledError) {
    return cause
  }

  return cause instanceof Error && cause.message === PICKER_DISMISSED
    ? new ConnectCancelledError(cause)
    : (cause as Error)
}
