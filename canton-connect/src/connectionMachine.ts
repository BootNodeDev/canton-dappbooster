import { setup } from 'xstate'

export const connectionMachine = setup({}).createMachine({
  id: 'connection',
  initial: 'disconnected',
  states: {
    disconnected: {
      on: {
        connect: { target: 'connecting' },
      },
    },
    connecting: {},
  },
})
