import { assign, setup } from 'xstate'
import {
  type AccountsInput,
  accountsEvents,
  readAccounts,
  readParticipant,
} from '#src/machine/accountsActors'
import type { Party } from '#src/types'
import { withPartyType } from '#src/walletAccount'

// Selection needs the `primary` flag and `toParty` drops it, so the pick happens before the
// mapping; afterwards there is no telling which entry was primary.
/** The result of an account read, initial or pushed: the party found, or none. */
export type WalletAccounts = {
  party: Party | undefined
}

// The cause rides along because `unavailable` alone cannot say why, and a connect in flight has
// to reject with the wallet's own error.
/** What the accounts machine carries: input, party, the participant namespace, the read error. */
type AccountsContext = AccountsInput &
  WalletAccounts & { participantNamespace: string | undefined; error: unknown }

/**
 * Reads the connected party once, then follows the wallet's own `accounts.changed` pushes; reads
 * the participant namespace once and types the party against it, whichever lands first.
 * Invoked as `connectionMachine`'s `accounts` child while a session is authenticated.
 */
export const accountsMachine = setup({
  actors: {
    readAccounts,
    accountsEvents,
    readParticipant,
  },
  actions: {
    applyAccounts: assign(({ context }, params: { accounts: WalletAccounts }) => ({
      party:
        params.accounts.party === undefined
          ? undefined
          : withPartyType(params.accounts.party, context.participantNamespace),
      error: undefined,
    })),
    applyParticipant: assign(
      ({ context }, params: { participantNamespace: string | undefined }) => ({
        participantNamespace: params.participantNamespace,
        party:
          context.party === undefined
            ? undefined
            : withPartyType(context.party, params.participantNamespace),
      }),
    ),
    assignError: assign((_, params: { error: unknown }) => ({ error: params.error })),
  },
  types: {
    context: {} as AccountsContext,
    events: {} as { type: 'accounts.changed'; accounts: WalletAccounts },
    input: {} as AccountsInput,
  },
}).createMachine({
  context: ({ input }) => ({
    ...input,
    party: undefined,
    participantNamespace: undefined,
    error: undefined,
  }),
  id: 'accounts',
  initial: 'reading',
  // Root-level so a push cancels neither: the listener outlives every state, the read runs once.
  invoke: [
    {
      src: 'accountsEvents',
      input: ({ context: { sdk, networkId } }) => ({ sdk, networkId }),
    },
    {
      src: 'readParticipant',
      input: ({ context: { sdk, networkId } }) => ({ sdk, networkId }),
      onDone: {
        actions: {
          type: 'applyParticipant',
          params: ({ event: { output } }) => ({ participantNamespace: output }),
        },
      },
    },
  ],
  // A push carries the truth, so it wins from any state, in-flight read included.
  on: {
    'accounts.changed': {
      target: '.ready',
      actions: {
        type: 'applyAccounts',
        params: ({ event: { accounts } }) => ({ accounts }),
      },
    },
  },
  states: {
    reading: {
      invoke: {
        src: 'readAccounts',
        input: ({ context: { sdk, networkId } }) => ({ sdk, networkId }),
        onDone: {
          target: 'ready',
          actions: {
            type: 'applyAccounts',
            params: ({ event: { output } }) => ({ accounts: output }),
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
