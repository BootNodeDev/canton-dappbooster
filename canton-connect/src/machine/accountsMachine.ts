import { assign, setup } from 'xstate'
import { type AccountsInput, accountsEvents, readPrimaryAccount } from '#src/machine/accountsActors'
import type { Account } from '#src/types'

// The cause rides along because `unavailable` alone cannot say why, and a connect in flight has
// to reject with the wallet's own error.
/** What the accounts machine carries: its input, the account it read, and why a read failed. */
type AccountsContext = AccountsInput & { account: Account | undefined; error: unknown }

/**
 * Reads the connected account once, then follows the wallet's own `accounts.changed` pushes.
 * Invoked as `connectionMachine`'s `accounts` child while a session is authenticated.
 */
export const accountsMachine = setup({
  actors: {
    readPrimaryAccount,
    accountsEvents,
  },
  actions: {
    applyAccount: assign((_, params: { account: Account | undefined }) => ({
      account: params.account,
      error: undefined,
    })),
    assignError: assign((_, params: { error: unknown }) => ({ error: params.error })),
  },
  types: {
    context: {} as AccountsContext,
    events: {} as { type: 'accounts.changed'; account: Account | undefined },
    input: {} as AccountsInput,
  },
}).createMachine({
  context: ({ input }) => ({
    ...input,
    account: undefined,
    error: undefined,
  }),
  id: 'accounts',
  initial: 'reading',
  invoke: {
    src: 'accountsEvents',
    input: ({ context: { sdk } }) => ({ sdk }),
  },
  // A push carries the truth, so it wins from any state, in-flight read included.
  on: {
    'accounts.changed': {
      target: '.ready',
      actions: {
        type: 'applyAccount',
        params: ({ event: { account } }) => ({ account }),
      },
    },
  },
  states: {
    reading: {
      invoke: {
        src: 'readPrimaryAccount',
        input: ({ context: { sdk } }) => ({ sdk }),
        onDone: {
          target: 'ready',
          actions: {
            type: 'applyAccount',
            params: ({ event: { output } }) => ({ account: output }),
          },
        },
        // Handled here or the rejection errors the parent actor, taking the session with it.
        onError: {
          target: 'unavailable',
          actions: {
            type: 'assignError',
            params: ({ event: { error } }) => ({ error }),
          },
        },
      },
    },
    ready: {},
    // No re-read from here: an `accounts.changed` push is the only thing that moves a failed read
    // on.
    unavailable: {},
  },
})
