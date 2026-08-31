import type { AccountsChangedEvent, DappSDK, Wallet } from '@canton-network/dapp-sdk'
import { type EventObject, fromCallback, fromPromise } from 'xstate'
import type { WalletAccounts } from '#src/machine/accountsMachine'
import { selectPrimaryAccount, selectUsableAccounts, toParty } from '#src/walletAccount'

/** Input shared by `readAccounts` and `accountsEvents`: the sdk slice plus the network id. */
export type AccountsInput = {
  sdk: Pick<DappSDK, 'listAccounts' | 'onAccountsChanged' | 'removeOnAccountsChanged'>
  networkId: string
}

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
