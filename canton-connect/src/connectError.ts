// What the SDK's built-in picker rejects with, and what `guardedConnect` raises in its place when
// the SDK misses the close — matched here, at the seam that owns the SDK, and never downstream.
const PICKER_DISMISSED = 'User closed the wallet picker'

/**
 * Raised by `guardedConnect` when it settles a connect the SDK left pending. The SDK's own
 * `connect()` is still running underneath, so whoever catches this retires the `DappSDK`.
 *
 * @example
 * if (err instanceof PickerClosedError) discardSdk()
 *
 * @internal
 */
export class PickerClosedError extends Error {
  constructor() {
    super(PICKER_DISMISSED)
    this.name = 'PickerClosedError'
  }
}

/**
 * Raised by the connect actor when its early init rejects, so the machine can tell an init
 * failure from a connect one: the SDK caches the rejection on the instance forever, and only a
 * replacement instance can genuinely retry. The SDK's own error rides in `cause`.
 *
 * @example
 * if (err instanceof InitFailedError) retireSdk()
 */
export class InitFailedError extends Error {
  constructor(cause: unknown) {
    super('DappSDK.init() failed', { cause })
    this.name = 'InitFailedError'
  }
}

/**
 * A connect the user walked away from: the picker was closed rather than a wallet failing.
 *
 * @example
 * if (connectError !== undefined && !(connectError instanceof ConnectCancelledError)) {
 *   toast.error(connectError.message)
 * }
 *
 * @category Errors
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
