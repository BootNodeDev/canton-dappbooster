// The SDK's built-in picker rejects with exactly this, from @canton-network/core-wallet-ui-components,
// a package bundled into dapp-sdk that no consumer declares — so match it here, at the seam that owns
// the SDK, and never downstream.
const PICKER_DISMISSED = 'User closed the wallet picker'

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
