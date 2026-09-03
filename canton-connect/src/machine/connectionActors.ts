import type { DappSDK, StatusEvent } from '@canton-network/dapp-sdk'
import { type EventObject, fromCallback, fromPromise } from 'xstate'
import { ConnectCancelledError, InitFailedError, PickerClosedError } from '#src/connectError'
import { guardedConnect } from '#src/guardedConnect'
import type { WalletStatusUpdate } from '#src/machine/connectionMachine'

// DappSDKConnectOptions is not exported from the package index; derived until it is
/**
 * What `DappSDK.init` accepts, read off the SDK rather than restated. The init actor defaults
 * `defaultAdapters` to empty, dropping the SDK's bundled dev gateway, and whatever is set here
 * wins over that default.
 *
 * @example
 * const initOptions: InitOptions = { additionalAdapters: [createMockAdapter()] }
 *
 * @category Types
 */
export type InitOptions = NonNullable<Parameters<DappSDK['init']>[0]>

/** Input for the `init` actor: the sdk slice and options `ensureInit` needs to boot it. */
export type InitInput = {
  sdk: Pick<DappSDK, 'init'>
  initOptions: InitOptions
}

/** Input for the `connect` actor: enough sdk to init, connect, and recover a session. */
export type ConnectInput = {
  sdk: Pick<DappSDK, 'connect' | 'init' | 'status'>
  initOptions: InitOptions
  guardPicker: boolean
}

/** Input for the `restore` actor: just enough sdk to read the wallet's status. */
export type RestoreInput = { sdk: Pick<DappSDK, 'status'> }

/** Input for the `disconnect` actor: the sdk slice it calls to end the session. */
export type DisconnectInput = { sdk: Pick<DappSDK, 'disconnect'> }

/** Input for the `walletEvents` actor: the sdk slice it subscribes to and unsubscribes from. */
export type WalletEventsInput = { sdk: Pick<DappSDK, 'onStatusChanged' | 'removeOnStatusChanged'> }

// Keyed on the instance rather than held per actor, so a retired sdk inits afresh while every
// actor over one instance awaits the same promise.
/** The in-flight or settled `init()` per sdk instance. */
const initializations = new WeakMap<object, Promise<void>>()

// The init has to be ours and early: connect() inits internally with no options, so the caller's
// adapters register only if an options-carrying init got there first.
/** Runs `sdk.init()` once per sdk instance and caches the result for every later caller. */
const ensureInit = ({ sdk, initOptions }: InitInput): Promise<void> => {
  const started = initializations.get(sdk)

  // The SDK serializes every init behind one cached promise but never clears a rejected one, so
  // a second init() replays the first failure instead of retrying. Hence: no retry from here.
  if (started !== undefined) {
    return started
  }

  // The empty defaultAdapters drop the SDK's bundled ones (a localhost dev gateway).
  const initialization = sdk.init({ defaultAdapters: [], ...initOptions })
  initializations.set(sdk, initialization)

  // Logged where the promise is made: the cached rejection is re-awaited by every later connect and
  // restore (repeat logs), and a boot-time init has no caller, so its failure is otherwise
  // invisible.
  initialization.catch((error: unknown) => {
    console.error(
      'canton-connect: DappSDK.init() failed, so no wallet can be discovered or connected. ' +
        'This is usually a bad adapter config — check `additionalAdapters` and ' +
        '`walletConnectProjectId` on CantonConnectConfig.',
      error,
    )
  })

  return initialization
}

// An unauthenticated answer may sit over a standing session. CIP-0103 ties `session` to
// `isConnected` ("Session information, if authenticated"), so that flag is the whole test.
/** Reads the wallet's status and returns it only when a session is standing, else null. */
const standingSession = async (sdk: RestoreInput['sdk']): Promise<WalletStatusUpdate | null> => {
  const status = await sdk.status().catch(() => null)

  return status?.connection?.isConnected ? { connection: status.connection } : null
}

// init + the status check stay inside `connect`, not as machine states
// the chart would grow just to relocate tested behavior
/** Resolves once the wallet answers, rejecting with the wallet's own error. */
export const connect = fromPromise<WalletStatusUpdate, ConnectInput>(async ({ input, signal }) => {
  const { sdk, guardPicker } = input

  try {
    await ensureInit(input)
  } catch (error) {
    // Typed so the machine can retire the instance the cached rejection poisoned.
    throw new InitFailedError(error)
  }

  try {
    const connection = await (guardPicker ? guardedConnect(sdk, signal) : sdk.connect())
    const walletAnswer = { connection }

    if (connection.isConnected) {
      return walletAnswer
    }

    const recovered = await standingSession(sdk)

    return recovered ?? walletAnswer
  } catch (error) {
    // No recovering from either: both leave this sdk's connect() running, and a recovered session
    // would keep a client the abandoned connect can still swap (see `retireSdk`).
    if (error instanceof PickerClosedError || error instanceof ConnectCancelledError) {
      throw error
    }

    const recovered = await standingSession(sdk)

    if (recovered !== null) {
      return recovered
    }

    throw error
  }
})

/** Asks the wallet to end the session; resolves once it acknowledges. */
export const disconnect = fromPromise<null, DisconnectInput>(({ input }) => input.sdk.disconnect())

/** Boots the sdk through `ensureInit`, so `initializing` and `retiring` share one cache. */
export const init = fromPromise<void, InitInput>(({ input }) => ensureInit(input))

/** Reads the wallet's status and recovers a standing session without opening the picker. */
export const restore = fromPromise<WalletStatusUpdate, RestoreInput>(async ({ input }) => {
  try {
    const { connection } = await input.sdk.status()

    if (connection === undefined) {
      throw new Error('status answered without a connection')
    }

    return { connection }
  } catch (error) {
    // Ordinary, not an alarm: a visitor with nothing to restore rejects the same way as a wallet
    // that never answered, so this logs at debug and never surfaces to the user.
    console.debug('canton-connect: no session restored', error)

    throw error
  }
})

/** Forwards the wallet's own status pushes into the machine as `wallet.statusChanged`. */
export const walletEvents = fromCallback<EventObject, WalletEventsInput>(
  ({ sendBack, input: { sdk } }) => {
    const listener = ({ connection }: StatusEvent) => {
      // Dropped rather than read as a lock: the frame is malformed, not a status.
      if (connection === undefined) {
        return
      }

      sendBack({ type: 'wallet.statusChanged', status: { connection } })
    }

    void sdk.onStatusChanged(listener).catch(() => {})

    return () => {
      void sdk.removeOnStatusChanged(listener).catch(() => {})
    }
  },
)
