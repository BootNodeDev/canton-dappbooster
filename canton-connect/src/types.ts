// Public types exposed to consumers of canton-connect.

import type {
  DappSDK,
  ProviderAdapter,
  TxChangedEvent,
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
 * const { status } = useParty()
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
 * The connected account, normalized from the wallet's CIP-0103 account entry. `networkId` is the
 * wallet's own, falling back to `CantonConnectConfig.networkId` where the wallet reports none.
 *
 * @category Types
 */
export interface Party {
  partyId: string
  networkId: string
  name?: string
  publicKey?: string
}

/**
 * Wiring for `CantonConnectProvider`. From `appName` alone a local dev app works: `canton:local` as
 * the network id and the WalletConnect chain id, `appName` as the description, the page origin as
 * the url, and the SDK's popup as the picker, guarded so closing it rejects — pass a `walletPicker`
 * and that surface is yours. The app fields stay inert until `walletConnectProjectId` (Reown) is set.
 *
 * @example
 * const config: CantonConnectConfig = { appName: 'Vesting', networkId: 'canton:devnet' }
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
 * const partyOf = (connection: ConnectionSubscription) => connection.getSnapshot().context.party
 *
 * @category Types
 */
export type ConnectionSubscription = Pick<ConnectionActorRef, 'getSnapshot' | 'subscribe'>

/**
 * One connection and the actions on it, published once. Every hook in this package selects the
 * slice it needs off `connection`, so prefer the narrower hooks (`useConnect`, `useParty`, …) and
 * reach for this only to select something none of them expose.
 *
 * @category Types
 */
export interface CantonConnectContextValue {
  config: CantonConnectConfig
  connection: ConnectionSubscription
  /**
   * Opens the picker (the SDK's popup, or `config.walletPicker`) and resolves once the party has
   * landed, so `useParty` reports it by the time it returns. Rejects with `ConnectCancelledError`
   * on cancel, and with the wallet's own error when the account read fails;
   * `useConnect().connectError` mirrors the failure; a dismissal the SDK itself rejects is
   * recorded too, classified as `ConnectCancelledError`. A wallet that connects
   * locked resolves with no party, since a locked wallet answers no account read.
   */
  connect: () => Promise<void>
  /**
   * Ends the session, and the party, lock and error with it, even if the SDK's own call fails or
   * goes unanswered for 10 s.
   */
  disconnect: () => Promise<void>
  /** Forgets the last connect error. Touches neither the wallet nor the session. */
  resetConnectError: () => void
}
