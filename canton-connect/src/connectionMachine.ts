import type { ConnectResult } from '@canton-network/dapp-sdk'
import { assign, fromPromise, setup } from 'xstate'

export const connectionMachine = setup({
  actors: {
    connect: fromPromise<ConnectResult>(() =>
      Promise.reject(new Error('connect actor not provided')),
    ),
  },
  types: {
    context: {} as {
      connection: ConnectResult | undefined
      error: unknown
    },
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
      },
    },
    connecting: {
      invoke: {
        src: 'connect',
        onDone: {
          target: 'connected',
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
    connected: {
      exit: assign({ connection: undefined }),
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
  },
})
