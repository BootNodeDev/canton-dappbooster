import { assign, fromPromise, setup } from 'xstate'

export const connectionMachine = setup({
  actors: {
    connect: fromPromise(() => Promise.resolve()),
  },
  types: {
    context: {} as { error: unknown },
  },
}).createMachine({
  context: { error: undefined },
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
        onDone: { target: 'connected' },
        onError: {
          target: 'failure',
          actions: assign({
            error: ({ event: { error } }) => error,
          }),
        },
      },
      on: {
        cancel: { target: 'disconnected' },
      },
    },
    connected: {},
    failure: {},
  },
})
