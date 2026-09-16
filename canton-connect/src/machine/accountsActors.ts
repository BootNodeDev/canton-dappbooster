import type { AccountsChangedEvent, DappSDK } from '@canton-network/dapp-sdk'
import { type EventObject, fromCallback, fromPromise } from 'xstate'
import { getPrimaryAccount } from '#src/accounts'
import type { Account } from '#src/types'

/** Input shared by `readPrimaryAccount` and `accountsEvents`: the sdk slice they call. */
export type AccountsInput = {
  sdk: Pick<DappSDK, 'listAccounts' | 'onAccountsChanged' | 'removeOnAccountsChanged'>
}

/** Reads the wallet's account list once and resolves the one it flags primary. */
export const readPrimaryAccount = fromPromise<Account | undefined, AccountsInput>(
  async ({ input: { sdk } }) => getPrimaryAccount(await sdk.listAccounts()),
)

/** Forwards the wallet's own account-change pushes into the machine as `accounts.changed`. */
export const accountsEvents = fromCallback<EventObject, AccountsInput>(
  ({ sendBack, input: { sdk } }) => {
    const listener = (accounts: AccountsChangedEvent) => {
      sendBack({ type: 'accounts.changed', account: getPrimaryAccount(accounts) })
    }

    void sdk.onAccountsChanged(listener).catch(() => {})

    return () => {
      void sdk.removeOnAccountsChanged(listener).catch(() => {})
    }
  },
)
