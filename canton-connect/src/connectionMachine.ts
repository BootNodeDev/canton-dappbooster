import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { assign, fromCallback, fromPromise, setup } from 'xstate'

export type WalletStatus = Pick<StatusEvent, 'connection' | 'session'>

export const connectionMachine = setup({
  actors: {
    connect: fromPromise<ConnectResult>(() =>
      Promise.reject(new Error('connect actor not provided')),
    ),
    restore: fromPromise<WalletStatus>(() =>
      Promise.reject(new Error('restore actor not provided')),
    ),
    walletEvents: fromCallback(() => {}),
  },
  actions: {
    applyWalletStatus: assign((_, params: { status: WalletStatus }) => ({
      connection: params.status.connection,
      session: params.status.session,
    })),
  },
  guards: {
    hasSession: (_, params: { session: WalletStatus['session'] }) => !!params.session,
    isAuthenticated: (_, params: { connection: ConnectResult }) => params.connection.isConnected,
  },
  types: {
    context: {} as {
      connection: ConnectResult | undefined
      session: WalletStatus['session']
      error: unknown
    },
    events: {} as
      | { type: 'connect' }
      | { type: 'cancel' }
      | { type: 'disconnect' }
      | { type: 'restore' }
      | { type: 'wallet.statusChanged'; status: WalletStatus },
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
        restore: { target: 'restoring' },
      },
    },
    connecting: {
      invoke: {
        src: 'connect',
        onDone: [
          {
            guard: {
              type: 'isAuthenticated',
              params: ({ event: { output } }) => ({ connection: output }),
            },
            target: 'session.authenticated',
            actions: assign({ connection: ({ event: { output } }) => output }),
          },
          {
            target: 'failure',
            actions: assign(({ event: { output } }) => ({
              error: new Error(output.reason ?? 'wallet declined connection'),
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
  },
})
