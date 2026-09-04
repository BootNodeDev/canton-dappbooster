import type { AccountsChangedEvent, DappSDK, Wallet } from '@canton-network/dapp-sdk'
import { type EventObject, fromCallback, fromPromise } from 'xstate'
import type { WalletAccounts } from '#src/machine/accountsMachine'
import {
  namespaceOf,
  PARTICIPANT_ID_RESOURCE,
  selectPrimaryAccount,
  selectUsableAccounts,
  toParty,
} from '#src/walletAccount'

/** Input shared by the accounts actors: the sdk slice plus the network id. */
export type AccountsInput = {
  sdk: Pick<DappSDK, 'listAccounts' | 'onAccountsChanged' | 'removeOnAccountsChanged' | 'ledgerApi'>
  networkId: string
}

/** Narrows an untyped `ledgerApi` answer to the participant-id shape. */
const isParticipantIdResult = (value: unknown): value is { participantId: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { participantId?: unknown }).participantId === 'string'

// Never rejects: a rejection would end the session over a read that only types the party.
/** Reads the participant's namespace through the wallet's `ledgerApi`; undefined where it cannot. */
export const readParticipant = fromPromise<string | undefined, AccountsInput>(
  async ({ input: { sdk } }) => {
    try {
      const result = await sdk.ledgerApi({
        requestMethod: 'get',
        resource: PARTICIPANT_ID_RESOURCE,
      })

      return isParticipantIdResult(result) ? namespaceOf(result.participantId) : undefined
    } catch (error) {
      // Ordinary for a wallet serving no ledgerApi: the party stays usable, only untyped.
      console.debug('canton-connect: participant id not read, party type stays unknown', error)

      return undefined
    }
  },
)

/** Narrows a raw wallet-account list to the primary usable party, or none. */
const toWalletAccounts = (accounts: Wallet[], networkId: string): WalletAccounts => {
  const primary = selectPrimaryAccount(selectUsableAccounts(accounts))

  return { party: primary === undefined ? undefined : toParty(primary, networkId) }
}

/** Reads the wallet's account list once and resolves the primary usable party. */
export const readAccounts = fromPromise<WalletAccounts, AccountsInput>(
  async ({ input: { sdk, networkId } }) => toWalletAccounts(await sdk.listAccounts(), networkId),
)

/** Forwards the wallet's own account-change pushes into the machine as `accounts.changed`. */
export const accountsEvents = fromCallback<EventObject, AccountsInput>(
  ({ sendBack, input: { sdk, networkId } }) => {
    const listener = (accounts: AccountsChangedEvent) => {
      sendBack({ type: 'accounts.changed', accounts: toWalletAccounts(accounts, networkId) })
    }

    void sdk.onAccountsChanged(listener).catch(() => {})

    return () => {
      void sdk.removeOnAccountsChanged(listener).catch(() => {})
    }
  },
)
