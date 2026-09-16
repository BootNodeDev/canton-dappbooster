// Public types exposed to consumers of canton-connect.

import type {
  DappSDK,
  ProviderAdapter,
  TxChangedEvent,
  Wallet,
  WalletPickerFn,
} from '@canton-network/dapp-sdk'
import type { ConnectionActorRef } from '#src/machine/connectionMachine'

/**
 * The slice of `DappSDK` this package calls. Deliberately narrower than the class: it states
 * which methods the wrapper supports, and a real `DappSDK` satisfies it structurally.
 *
 * @category Types
 */
export type WalletSdk = Pick<
  DappSDK,
  | 'init'
  | 'connect'
  | 'disconnect'
  | 'status'
  | 'listAccounts'
  | 'onStatusChanged'
  | 'removeOnStatusChanged'
  | 'onAccountsChanged'
  | 'removeOnAccountsChanged'
  | 'onTxChanged'
  | 'removeOnTxChanged'
  | 'ledgerApi'
  | 'signMessage'
  | 'prepareExecuteAndWait'
>

/**
 * `'idle'` is "not determined yet", not "disconnected": gate a connect button on `'disconnected'`,
 * or a returning user is turned away before the boot restore runs. `'disconnecting'` is the session
 * tearing down; keep connect disabled until it settles, so a new connect never overlaps it.
 *
 * @example
 * const { status } = useAccount()
 * if (status === 'idle') return null
 * return status === 'disconnected' ? <ConnectButton /> : <App />
 *
 * @category Types
 */
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'

/**
 * Canton's terms: a local party lives under the hosting participant's namespace and the participant
 * signs for it; an external party lives under its own key's and signs for itself.
 *
 * @category Types
 */
export type PartyType = 'local' | 'external'

// The account entry as dapp-sdk 1.5.1 declares it.
type PinnedAccount = {
  primary: boolean
  partyId: string
  status: 'initialized' | 'allocated' | 'removed'
  hint: string
  publicKey: string
  namespace: string
  networkId: string
  signingProviderId: string
  externalTxId?: string
  topologyTransactions?: string
  disabled?: boolean
  reason?: string
}

// `false`, never `never`: `never extends true` holds, so a `never` sentinel would never fire.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

// Exists to fail typecheck when an SDK bump changes the account entry, rather than let the new
// shape reach the hooks unnoticed. `Account` is defined through it so it cannot go unused:
// `dapp/frontend` compiles this source under `noUnusedLocals`, where a dangling type is an error.
type AccountPinned = Assert<Exact<Wallet, PinnedAccount>>

/**
 * One account the connected wallet reports: a party plus its key, signing provider and network.
 * Only `dapp-sdk`'s schema calls it a wallet, and CIP-0103 makes that schema binding from v1.0.0.
 * Until then the CIP text is what binds, and it says account.
 *
 * @category Types
 */
export type Account = AccountPinned extends true ? Wallet : never

/**
 * Wiring for `CantonConnectProvider`. From `appName` alone a local dev app works: `canton:local` as
 * the network id and the WalletConnect chain id, `appName` as the description, the page origin as
 * the url, and the SDK's popup as the picker, guarded so closing it rejects — pass a `walletPicker`
 * and that surface is yours. The app fields stay inert until `walletConnectProjectId` (Reown) is set.
 *
 * @example
 * const config: CantonConnectConfig = {
 *   appName: 'Vesting',
 *   networkId: 'canton:devnet',
 *   walletConnectProjectId: 'REOWN_PROJECT_ID',
 * }
 *
 * @example
 * import type { CantonConnectConfig } from '#src/types'
 * import { RemoteAdapter } from '@canton-network/dapp-sdk'
 *
 * const config: CantonConnectConfig = {
 *   appName: 'Vesting',
 *   additionalAdapters: [
 *     new RemoteAdapter({ name: 'Gateway', rpcUrl: 'https://gateway.example.com/dapp' }),
 *   ],
 * }
 *
 * @category Configuration
 */
export interface CantonConnectConfig {
  appName: string
  appDescription?: string
  appUrl?: string
  networkId?: string
  walletConnectProjectId?: string
  walletPicker?: WalletPickerFn
  additionalAdapters?: ProviderAdapter[]
}

/**
 * Mirrored from the SDK's `txChanged` event as a command moves through
 * pending, signed, executed or failed.
 *
 * @category Types
 */
export interface TxStatusSnapshot {
  status: TxChangedEvent['status']
  commandId: TxChangedEvent['commandId']
  payload?: unknown
}

/**
 * The connection machine as `useSelector` sees it: subscribe and read, never send. Narrowed from
 * the actor ref so `connect` and `disconnect` stay the only senders — a transition asked for
 * anywhere else is a lifecycle rule living outside the machine.
 *
 * @example
 * import type { ConnectionSubscription } from '#src/types'
 *
 * const accountOf = (connection: ConnectionSubscription) => connection.getSnapshot().context.account
 *
 * @category Types
 */
export type ConnectionSubscription = Pick<ConnectionActorRef, 'getSnapshot' | 'subscribe'>

/**
 * One connection and the actions on it, published once. Every hook selects its slice off
 * `connection`: prefer the narrower hooks and reach for this only when none exposes the slice.
 * The four actions are `useConnect`'s own, documented there.
 *
 * @category Types
 */
export interface CantonConnectContextValue {
  config: CantonConnectConfig
  connection: ConnectionSubscription
  connect: () => Promise<void>
  cancelConnect: () => void
  disconnect: () => Promise<void>
  resetConnectError: () => void
}
