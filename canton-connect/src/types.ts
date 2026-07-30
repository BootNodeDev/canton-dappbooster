// Public types exposed to consumers of canton-connect.

import type { ProviderAdapter, WalletPickerFn } from '@canton-network/dapp-sdk'

/** Lifecycle state of the wallet connection, as tracked by `CantonConnectProvider`. */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

/** The connected account, normalized from the wallet's CIP-0103 account entry. */
export interface Party {
  partyId: string
  /**
   * The account's CIP-0103 network id. Wallets that report their own network
   * use that value; otherwise this falls back to `CantonConnectConfig.networkId`.
   */
  networkId: string
  name?: string
  publicKey?: string
}

/**
 * Configuration passed to `CantonConnectProvider`: the dApp's identity, target
 * network, and the adapters/picker the SDK connects through.
 */
export interface CantonConnectConfig {
  /**
   * The dApp's name. Currently used only in WalletConnect's pairing
   * metadata, so it has no visible effect unless `walletConnectProjectId`
   * is set.
   */
  appName: string
  /** Longer description for WalletConnect's pairing metadata; falls back to `appName`. No effect without `walletConnectProjectId`. */
  appDescription?: string
  /** The dApp's URL for WalletConnect's pairing metadata. Defaults to `window.location.origin`. No effect without `walletConnectProjectId`. */
  appUrl?: string
  /**
   * CIP-0103 network id, e.g. `'canton:local'`. Defaults to `'canton:local'`
   * when omitted. Feeds `Party.networkId` (for wallets that report none of
   * their own) and the WalletConnect session's chain id — left on the
   * default, a dApp cannot pair over WalletConnect against another network.
   */
  networkId?: string
  /**
   * Reown project id. Enables the WalletConnect adapter when set; without
   * it, no WalletConnect entry is offered in the wallet picker.
   */
  walletConnectProjectId?: string
  /**
   * Selects a wallet from the discovered entries when `connect()` is called.
   * Omit to get the SDK's built-in popup picker. Supply one to take over
   * selection — `createAutoPicker` does this headlessly in tests, and a
   * themed picker component is a planned replacement for the popup.
   */
  walletPicker?: WalletPickerFn
  /**
   * Extra provider adapters to register alongside the discovered ones, e.g.
   * `createMockAdapter()` in dev/test.
   */
  additionalAdapters?: ProviderAdapter[]
}
