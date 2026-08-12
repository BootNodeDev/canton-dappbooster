import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { assign, fromPromise, setup } from 'xstate'

export type RestoreAnswer = Pick<StatusEvent, 'connection' | 'network' | 'session'>

export const connectionMachine = setup({
  actors: {
    connect: fromPromise<ConnectResult>(() =>
      Promise.reject(new Error('connect actor not provided')),
    ),
    restore: fromPromise<RestoreAnswer>(() =>
      Promise.reject(new Error('restore actor not provided')),
    ),
  },
  guards: {
    hasSession: (_, params: { session: StatusEvent['session'] }) => !!params.session,
    isAuthenticated: (_, params: { connection: ConnectResult }) => params.connection.isConnected,
  },
  types: {
    context: {} as {
      connection: ConnectResult | undefined
      error: unknown
    },
    events: {} as
      | { type: 'connect' }
      | { type: 'cancel' }
      | { type: 'disconnect' }
      | { type: 'restore' },
  },
}).createMachine({
  context: {
    connection: undefined,
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
        onDone: {
          target: 'session.authenticated',
          actions: assign({ connection: ({ event: { output } }) => output }),
        },
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
      states: {
        authenticated: {
          exit: assign({ connection: undefined }),
        },
        unauthenticated: {},
      },
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
            actions: assign({ connection: ({ event: { output } }) => output.connection }),
          },
          {
            guard: {
              type: 'hasSession',
              params: ({ event: { output } }) => ({ session: output.session }),
            },
            target: 'session.unauthenticated',
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
