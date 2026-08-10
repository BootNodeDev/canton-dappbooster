import { fromPromise, setup } from 'xstate'

export const connectionMachine = setup({
  actors: {
    connect: fromPromise(() => Promise.resolve()),
  },
}).createMachine({
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
      },
    },
    connected: {},
  },
})
