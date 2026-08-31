import type { StatusEvent } from '@canton-network/dapp-sdk'
import {
  type ActorRefFrom,
  assign,
  type DoneActorEvent,
  type ErrorActorEvent,
  type SnapshotFrom,
  setup,
} from 'xstate'
import { InitFailedError, PickerClosedError } from '#src/connectError'
import { accountsMachine } from '#src/machine/accountsMachine'
import {
  connect,
  disconnect,
  type InitOptions,
  init,
  restore,
  walletEvents,
} from '#src/machine/connectionActors'
import type { ConnectionStatus, Party, WalletSdk } from '#src/types'

// The SDK's disconnect awaits the wallet's answer with no deadline of its own, so this is the only
// bound on how long `disconnecting` can last.
export const DISCONNECT_TIMEOUT_MS = 10_000

/** The wallet's connection status, narrowed from the SDK's `StatusEvent`. */
export type WalletStatusUpdate = Pick<StatusEvent, 'connection'>

/**
 * What the machine needs to build and drive its own `DappSDK`. Read once, at actor creation: as in
 * wagmi, a config swapped afterwards reaches the hooks but not the connection lifecycle.
 *
 * @example
 * import { DappSDK } from '@canton-network/dapp-sdk'
 * import { createActor } from 'xstate'
 * import { connectionMachine } from '#src/machine/connectionMachine'
 *
 * const createSdk = () => new DappSDK({})
 * const input = { createSdk, initOptions: {}, guardPicker: true, networkId: 'canton:local' }
 * createActor(connectionMachine, { input })
 *
 * @category Types
 */
export type ConnectionInput = {
  createSdk: () => WalletSdk
  initOptions: InitOptions
  guardPicker: boolean
  networkId: string
}

/** What the machine carries beyond its input: the sdk it drives, the last failure, the party. */
type ConnectionContext = ConnectionInput & {
  sdk: WalletSdk
  // The last attempt's failure, not the session's: it outlives `failure` on purpose, so a
  // session recovered afterwards can still say why the attempt before it failed.
  lastConnectError: unknown
  // Projected up from the accounts child rather than read off it, so one snapshot answers the
  // hooks; `authenticated` clears it on exit, because the child dies with that state.
  party: Party | undefined
}

/** Reduces the machine's internal states to the five-value `ConnectionStatus` hooks expose. */
export const toConnectionStatus = (
  snapshot: SnapshotFrom<typeof connectionMachine>,
): ConnectionStatus => {
  if (snapshot.matches('connecting')) {
    return 'connecting'
  }

  // A cancelled wallet change passes through `retiring.changing` and `restoring.changing` while the
  // session it kept is restored; disconnected or idle here would unmount a status-gated app.
  if (snapshot.matches({ retiring: 'changing' }) || snapshot.matches({ restoring: 'changing' })) {
    return 'connecting'
  }

  if (snapshot.matches('session')) {
    return 'connected'
  }

  if (
    snapshot.matches('idle') ||
    snapshot.matches('restoring') ||
    snapshot.matches('initializing')
  ) {
    return 'idle'
  }

  if (snapshot.matches('disconnecting')) {
    return 'disconnecting'
  }

  // `failure` reads as disconnected to consumers; the error rides in context
  return 'disconnected'
}

/** The transition an authenticated wallet answer takes, shared by `connect` and `restore`. */
const landAuthenticated = {
  guard: {
    type: 'isAuthenticated',
    params: ({ event: { output } }: { event: DoneActorEvent<WalletStatusUpdate> }) => ({
      connection: output.connection,
    }),
  },
  // `askWallet` runs this inside `connecting`, where a relative `session.authenticated` would not
  // resolve, so the target is an id.
  target: '#connection.session.authenticated',
} as const

/** The exit from `disconnecting`, success and failure alike: nothing overlaps a disconnect. */
const afterDisconnect = { target: 'disconnected' } as const

/** The exit `disconnecting` takes when the wallet never answers, on a replacement sdk. */
// The unanswered request still holds the old instance's client, and its late answer would null
// whichever client a later connect installs on that instance.
const afterSilentDisconnect = { actions: { type: 'retireSdk' }, target: 'disconnected' } as const

/** The `init` invoke shared by `initializing` and `retiring`. Each caller resumes in a different
 * `restoring` state, so it names the `onDone` target. */
const bootSdk = (onDone: string) =>
  ({
    src: 'init',
    input: ({ context }: { context: ConnectionContext }) => ({
      sdk: context.sdk,
      initOptions: context.initOptions,
    }),
    onDone: { target: onDone },
    onError: {
      target: '#connection.failure',
      actions: [
        {
          type: 'assignError',
          params: ({ event: { error } }: { event: ErrorActorEvent }) => ({ error }),
        },
        // The rejection is cached on the instance forever, so only a replacement can retry.
        { type: 'retireSdk' },
      ],
    },
  }) as const

/** The `connect` invoke. The caller names which `retiring` variant a closed picker lands in, so
 * a wallet change stays one through the retirement. */
const askWallet = (retiringTarget: string) =>
  ({
    src: 'connect',
    input: ({ context }: { context: ConnectionContext }) => ({
      sdk: context.sdk,
      initOptions: context.initOptions,
      guardPicker: context.guardPicker,
    }),
    onDone: [
      landAuthenticated,
      {
        target: '#connection.failure',
        actions: {
          type: 'assignDeclined',
          params: ({ event: { output } }: { event: DoneActorEvent<WalletStatusUpdate> }) => ({
            connection: output.connection,
          }),
        },
      },
    ],
    onError: [
      {
        guard: {
          type: 'isPickerClosed',
          params: ({ event: { error } }: { event: ErrorActorEvent }) => ({ error }),
        },
        // Swapped before `retiring` is entered, so its init reads the replacement.
        actions: { type: 'retireSdk' },
        target: retiringTarget,
      },
      {
        guard: {
          type: 'isInitFailed',
          params: ({ event: { error } }: { event: ErrorActorEvent }) => ({ error }),
        },
        target: '#connection.failure',
        actions: [
          {
            type: 'assignError',
            // The wrapper marked the route; the consumer reads the SDK's own error.
            params: ({ event: { error } }: { event: ErrorActorEvent }) => ({
              error: error instanceof InitFailedError ? error.cause : error,
            }),
          },
          // The rejection is cached on the instance forever, so only a replacement can retry.
          { type: 'retireSdk' },
        ],
      },
      {
        target: '#connection.failure',
        actions: {
          type: 'assignError',
          params: ({ event: { error } }: { event: ErrorActorEvent }) => ({ error }),
        },
      },
    ],
  }) as const

/**
 * The lifecycle itself: what a connect, a restore, a lock and a disconnect mean, and the tags the
 * bridges and hooks read off them. `CantonConnectProvider` runs it; reach for it directly only to
 * drive a session in a test.
 *
 * @category Types
 */
export const connectionMachine = setup({
  actors: {
    connect,
    disconnect,
    init,
    restore,
    walletEvents,
    accounts: accountsMachine,
  },
  actions: {
    assignError: assign((_, params: { error: unknown }) => ({ lastConnectError: params.error })),
    assignDeclined: assign((_, params: { connection: WalletStatusUpdate['connection'] }) => ({
      lastConnectError: new Error(
        params.connection.reason ?? params.connection.networkReason ?? 'wallet declined connection',
      ),
    })),
    forgetError: assign({ lastConnectError: undefined }),
    // The walked-out connect keeps waiting inside the old sdk and nothing can stop it, so a later
    // attempt on that sdk could have its client swapped mid-connect. Drop the instance, take a new
    // one.
    retireSdk: assign(({ context }) => ({ sdk: context.createSdk() })),
  },
  guards: {
    // A guard that throws stops the actor, so an answer missing `connection` reads as not
    // authenticated.
    isAuthenticated: (_, params: { connection: WalletStatusUpdate['connection'] | undefined }) =>
      params.connection?.isConnected === true,
    isPickerClosed: (_, params: { error: unknown }) => params.error instanceof PickerClosedError,
    isInitFailed: (_, params: { error: unknown }) => params.error instanceof InitFailedError,
  },
  delays: {
    disconnectTimeout: DISCONNECT_TIMEOUT_MS,
  },
  types: {
    // Declared so `snapshot.children.accounts` types concretely; setup's actors map carries no id.
    children: {} as { accounts: 'accounts' },
    context: {} as ConnectionContext,
    input: {} as ConnectionInput,
    tags: {} as
      // The connect is answered and a session stands, `authenticated` or `unauthenticated`.
        | 'connect.settled'
        // The connect is answered by the failure riding in `lastConnectError`.
        | 'connect.failed'
        // The connect was walked out on: it ends with no session and no error recorded.
        | 'connect.cancelled'
        // A connect is still in progress to consumers, the account read after the wallet's answer
        // included.
        | 'connecting'
        // A session stands but must authenticate before it serves requests.
        | 'unauthenticated'
        // A disconnect already holds true, so one asked for here is answered by the current
        // snapshot.
        | 'disconnect.settled',
    events: {} as
      | { type: 'connect' }
      | { type: 'connectError.reset' }
      | { type: 'disconnect' }
      | { type: 'restore' }
      | { type: 'wallet.statusChanged'; status: WalletStatusUpdate },
  },
}).createMachine({
  context: ({ input }) => ({
    ...input,
    sdk: input.createSdk(),
    lastConnectError: undefined,
    party: undefined,
  }),
  id: 'connection',
  initial: 'idle',
  // Consumers dismiss a message they have read; it clears itself on the next attempt anyway.
  on: {
    'connectError.reset': { actions: { type: 'forgetError' } },
  },
  states: {
    // Nothing attempted yet. `disconnected` means a restore that found nothing or a session that
    // ended, and a consumer gating on that would turn a returning user away before the restore ran.
    idle: {
      tags: ['disconnect.settled'],
      on: {
        connect: { target: 'connecting' },
        restore: { target: 'initializing' },
      },
    },
    disconnected: {
      // Cancelled covers the second route here too: a restore that replaced a session and then
      // found nothing, which reports as a cancel because nothing failed on the way.
      tags: ['connect.cancelled', 'disconnect.settled'],
      // A cancel records no error; clearing it here keeps that rule on the state that answers.
      entry: { type: 'forgetError' },
      on: {
        connect: { target: 'connecting' },
        restore: { target: 'initializing' },
      },
    },
    connecting: {
      tags: ['connecting'],
      entry: { type: 'forgetError' },
      initial: 'new',
      // The variants carry what is at stake: `new` risks no session, `changing` is a
      // wallet change over a standing one, and a closed picker resumes that session.
      states: {
        new: { invoke: askWallet('#connection.retiring.new') },
        changing: { invoke: askWallet('#connection.retiring.changing') },
      },
      on: {
        // Leaving the state is not enough: sdk.connect() keeps running past this, so the wallet
        // itself has to be asked to disconnect.
        disconnect: { target: 'disconnecting' },
      },
    },
    session: {
      initial: 'unauthenticated',
      invoke: {
        src: 'walletEvents',
        input: ({ context }) => ({ sdk: context.sdk }),
      },
      states: {
        authenticated: {
          initial: 'reading',
          // A wallet that will not serve requests has no party to offer, and the two ways it
          // stops serving (a lock, a wallet-side disconnect) are one indistinguishable push. The
          // session itself stays, so the unlock push is still heard and re-reads the party.
          exit: assign({ party: undefined }),
          invoke: {
            src: 'accounts',
            id: 'accounts',
            input: ({ context }) => ({ sdk: context.sdk, networkId: context.networkId }),
            // The child owns the read and why it failed; these sub-states mirror its states, so one
            // snapshot of this machine can say whether a connect has landed.
            onSnapshot: [
              {
                guard: ({ event }) => event.snapshot.matches('ready'),
                target: '.ready',
                actions: assign(({ event }) => ({
                  party: event.snapshot.context.party,
                  // A push can recover a read that failed, and the failure it recorded must not
                  // outlive it: a session with a party and an error reads as broken.
                  lastConnectError: undefined,
                })),
              },
              {
                guard: ({ event }) => event.snapshot.matches('unavailable'),
                target: '.unavailable',
                actions: assign(({ event }) => ({
                  lastConnectError: event.snapshot.context.error,
                })),
              },
            ],
          },
          states: {
            reading: { tags: ['connecting'] },
            ready: { tags: ['connect.settled'] },
            unavailable: { tags: ['connect.failed'] },
          },
          on: {
            'wallet.statusChanged': [
              {
                guard: {
                  type: 'isAuthenticated',
                  params: ({ event: { status } }) => ({ connection: status.connection }),
                },
              },
              { target: 'unauthenticated' },
            ],
          },
        },
        unauthenticated: {
          // A wallet that connects unauthenticated answers no account read, so the connect is done.
          tags: ['connect.settled', 'unauthenticated'],
          on: {
            'wallet.statusChanged': {
              guard: {
                type: 'isAuthenticated',
                params: ({ event: { status } }) => ({ connection: status.connection }),
              },
              target: 'authenticated',
            },
          },
        },
      },
      on: {
        // A wallet change; without it a consumer whose wallet disconnected on its own has no way
        // back, because that push cannot be told apart from a lock.
        connect: { target: 'connecting.changing' },
        disconnect: { target: 'disconnecting' },
        // A replaced sdk leaves this session's listeners bound to the old client, and exiting
        // `session` is what tears them down, so restore has to be accepted here too.
        restore: { target: 'initializing' },
      },
    },
    failure: {
      tags: ['connect.failed'],
      on: {
        connect: { target: 'connecting' },
        disconnect: { target: 'disconnecting' },
        restore: { target: 'initializing' },
      },
    },
    // The SDK never settles a connect whose picker was closed; that instance can still swap
    // the client, so `retireSdk` replaced it before entry.
    retiring: {
      tags: ['connect.cancelled'],
      // A cancel records no error; clearing it here keeps that rule on the state that answers.
      entry: { type: 'forgetError' },
      initial: 'new',
      // A cancelled wallet change must not cost the standing session: `changing` resumes it
      // through `restoring.changing`; `new` had nothing to lose.
      states: {
        new: { invoke: bootSdk('#connection.restoring.new') },
        changing: { invoke: bootSdk('#connection.restoring.changing') },
      },
      on: {
        connect: { target: 'connecting' },
        disconnect: { target: 'disconnecting' },
      },
    },
    restoring: {
      initial: 'new',
      // Both variants run the same `restore` invoke below; they exist so `toConnectionStatus`
      // can report `changing` as connecting and `new` as idle.
      states: {
        new: {},
        changing: {},
      },
      invoke: {
        src: 'restore',
        input: ({ context }) => ({ sdk: context.sdk }),
        onDone: [landAuthenticated, { target: 'disconnected' }],
        onError: { target: 'disconnected' },
      },
      on: {
        connect: { target: 'connecting' },
        disconnect: { target: 'disconnecting' },
      },
    },
    initializing: {
      invoke: bootSdk('#connection.restoring.new'),
      on: {
        // A connect asked for during boot wins over the restore instead of being dropped; the
        // connect actor inits and reads status itself, so a standing session still comes back.
        connect: { target: 'connecting' },
        disconnect: { target: 'disconnecting' },
      },
    },
    // sdk.disconnect() and sdk.connect() both rewrite the client, so they must never overlap. A
    // connect asked for here is ignored, not queued: `status` is `disconnecting`, so a consumer
    // keeps its connect action disabled until this settles.
    disconnecting: {
      entry: { type: 'forgetError' },
      invoke: {
        src: 'disconnect',
        input: ({ context }) => ({ sdk: context.sdk }),
        onDone: afterDisconnect,
        onError: afterDisconnect,
      },
      after: {
        disconnectTimeout: afterSilentDisconnect,
      },
    },
  },
})

/**
 * The running connection machine. Consumers reach it narrowed to {@link ConnectionSubscription},
 * so `send` stays inside this package.
 *
 * @category Types
 */
export type ConnectionActorRef = ActorRefFrom<typeof connectionMachine>
