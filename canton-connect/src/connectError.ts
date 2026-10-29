// The SDK picker's own dismissal text, matched here and never downstream.
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
 * if (error !== undefined && !(error instanceof ConnectCancelledError)) {
 *   toast.error(error.message)
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

const messageOf = (cause: unknown): string | undefined => {
  if (typeof cause !== 'object' || cause === null || !('message' in cause)) {
    return undefined
  }

  const { message } = cause
  const isValidMessage = typeof message === 'string' && message !== ''

  return isValidMessage ? message : undefined
}

/**
 * Hands any rejection back as an `Error`, passing an `Error` (the SDK's `JsonRpcError` too) through
 * untouched and wrapping anything else with the raw value on `cause`.
 *
 * @example
 * toError({ code: 4001, message: 'User rejected' }).message // 'User rejected'
 * toError({ status: 'error', error: 3 }).message // 'Wallet request failed'
 * toError('nope').cause // 'nope'
 *
 * @category Utilities
 */
export const toError = (cause: unknown): Error => {
  if (cause instanceof Error) {
    return cause
  }

  return new Error(messageOf(cause) ?? 'Wallet request failed', { cause })
}

/** Classifies what `sdk.connect()` threw, so the cancel path is decided once. */
export const toConnectError = (cause: unknown): Error =>
  cause instanceof Error && cause.message === PICKER_DISMISSED
    ? new ConnectCancelledError(cause)
    : toError(cause)
