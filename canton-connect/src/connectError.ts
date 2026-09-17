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

/** Reads the text off a rejection: `message` as JSON-RPC sends it, `details` as the SDK does. */
const textOf = (cause: unknown): string | undefined => {
  if (typeof cause !== 'object' || cause === null) {
    return undefined
  }

  for (const key of ['message', 'details'] as const) {
    const value = (cause as Record<string, unknown>)[key]

    if (typeof value === 'string' && value !== '') {
      return value
    }
  }

  return undefined
}

/**
 * Hands `cause` back as an `Error`, wrapping what a wallet answered with. Nothing a wallet refuses
 * arrives as an `Error`: the window transport rejects with the bare JSON-RPC object, and the SDK's
 * own controller with a `{ status, error, details }` of its own, so both are read here.
 *
 * @example
 * const error = toError(await sdk.signMessage(params).catch((cause: unknown) => cause))
 * error.cause // the wallet's `{ code, message }` when that is what it sent
 */
export const toError = (cause: unknown): Error => {
  if (cause instanceof Error) {
    return cause
  }

  return new Error(textOf(cause) ?? String(cause), { cause })
}

/** Classifies what `sdk.connect()` threw, so the cancel path is decided once. */
export const toConnectError = (cause: unknown): Error => {
  if (cause instanceof ConnectCancelledError) {
    return cause
  }

  return cause instanceof Error && cause.message === PICKER_DISMISSED
    ? new ConnectCancelledError(cause)
    : toError(cause)
}
