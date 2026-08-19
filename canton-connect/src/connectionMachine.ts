import type { StatusEvent } from '@canton-network/dapp-sdk'
import { assign, fromCallback, fromPromise, type SnapshotFrom, setup } from 'xstate'
import type { ConnectionStatus } from './types'

export type WalletStatusUpdate = Pick<StatusEvent, 'connection' | 'session'>

export const toConnectionStatus = (
  snapshot: SnapshotFrom<typeof connectionMachine>,
): ConnectionStatus => {
  if (snapshot.matches('connecting')) {
    return 'connecting'
  }

  if (snapshot.matches('session')) {
    return 'connected'
  }

  if (snapshot.matches('restoring') || snapshot.matches('initializing')) {
    return 'idle'
  }

  // `failure` reads as disconnected to consumers; the error rides in context
  return 'disconnected'
}

export const connectionMachine = setup({
  actors: {
    connect: fromPromise<WalletStatusUpdate>(() =>
      Promise.reject(new Error('connect actor not provided')),
    ),
    init: fromPromise<void>(() => Promise.reject(new Error('init actor not provided'))),
    restore: fromPromise<WalletStatusUpdate>(() =>
      Promise.reject(new Error('restore actor not provided')),
    ),
    walletEvents: fromCallback(() => {}),
  },
  actions: {
    applyWalletStatus: assign(({ context }, params: { status: WalletStatusUpdate }) => ({
      connection: params.status.connection,
      session: params.status.session ?? context.session,
    })),
  },
  guards: {
    hasSession: (_, params: { session: WalletStatusUpdate['session'] }) => !!params.session,
    isAuthenticated: (_, params: { connection: WalletStatusUpdate['connection'] }) =>
      params.connection.isConnected,
  },
  types: {
    context: {} as {
      connection: WalletStatusUpdate['connection'] | undefined
      session: WalletStatusUpdate['session']
      error: unknown
    },
    events: {} as
      | { type: 'connect' }
      | { type: 'cancel' }
      | { type: 'disconnect' }
      | { type: 'restore' }
      | { type: 'wallet.statusChanged'; status: WalletStatusUpdate },
  },
}).createMachine({
  context: {
    connection: undefined,
    session: undefined,
    error: undefined,
  },
  id: 'connection',
  initial: 'disconnected',
  states: {
    disconnected: {
      on: {
        connect: { target: 'connecting' },
        restore: { target: 'initializing' },
      },
    },
    connecting: {
      invoke: {
        src: 'connect',
        onDone: [
          {
            guard: {
              type: 'isAuthenticated',
              params: ({ event: { output } }) => ({ connection: output.connection }),
            },
            target: 'session.authenticated',
            actions: {
              type: 'applyWalletStatus',
              params: ({ event: { output } }) => ({ status: output }),
            },
          },
          {
            target: 'failure',
            actions: assign(({ event: { output } }) => ({
              error: new Error(output.connection.reason ?? 'wallet declined connection'),
            })),
          },
        ],
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event: { error } }) => error }),
        },
      },
      on: {
        cancel: { target: 'disconnected' },
      },
    },
    session: {
      initial: 'unauthenticated',
      invoke: {
        src: 'walletEvents',
      },
      states: {
        authenticated: {
          on: {
            'wallet.statusChanged': [
              {
                guard: {
                  type: 'isAuthenticated',
                  params: ({ event: { status } }) => ({ connection: status.connection }),
                },
                actions: {
                  type: 'applyWalletStatus',
                  params: ({ event: { status } }) => ({ status }),
                },
              },
              { target: 'unauthenticated' },
            ],
          },
          exit: assign({ connection: undefined }),
        },
        unauthenticated: {
          on: {
            'wallet.statusChanged': {
              guard: {
                type: 'isAuthenticated',
                params: ({ event: { status } }) => ({ connection: status.connection }),
              },
              target: 'authenticated',
              actions: {
                type: 'applyWalletStatus',
                params: ({ event: { status } }) => ({ status }),
              },
            },
          },
        },
      },
      exit: assign({ session: undefined }),
      on: {
        disconnect: { target: 'disconnected' },
      },
    },
    failure: {
      exit: assign({ error: undefined }),
      on: {
        connect: { target: 'connecting' },
        restore: { target: 'initializing' },
      },
    },
    restoring: {
      invoke: {
        src: 'restore',
        onDone: [
          {
            guard: {
              type: 'isAuthenticated',
              params: ({ event: { output } }) => ({ connection: output.connection }),
            },
            target: 'session.authenticated',
            actions: {
              type: 'applyWalletStatus',
              params: ({ event: { output } }) => ({ status: output }),
            },
          },
          {
            guard: {
              type: 'hasSession',
              params: ({ event: { output } }) => ({ session: output.session }),
            },
            target: 'session.unauthenticated',
            actions: assign(({ event: { output } }) => ({ session: output.session })),
          },
          { target: 'disconnected' },
        ],
        onError: { target: 'disconnected' },
      },
      on: {
        cancel: { target: 'disconnected' },
      },
    },
    initializing: {
      invoke: {
        src: 'init',
        onDone: { target: 'restoring' },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event: { error } }) => error }),
        },
      },
      on: {
        cancel: { target: 'disconnected' },
      },
    },
  },
})
