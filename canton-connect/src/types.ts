import type { ProviderAdapter, WalletPickerFn } from '@canton-network/dapp-sdk'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

/** The connected account, normalized from the wallet's CIP-0103 account entry. */
export interface Party {
  partyId: string
  /** The wallet's own network id, or `CantonConnectConfig.networkId` when it reports none. */
  networkId: string
  name?: string
  publicKey?: string
}

/**
 * The wallet a session belongs to, noted when it was chosen. Popup mode reports
 * none: the SDK never says which wallet its own UI selected.
 */
export interface ConnectedWallet {
  providerId: string
  name: string
}

export interface CantonConnectConfig {
  /** WalletConnect pairing metadata only, so it is inert without `walletConnectProjectId`. */
  appName: string
  /** Falls back to `appName`. */
  appDescription?: string
  /** Defaults to `window.location.origin`. */
  appUrl?: string
  /** Defaults to `'canton:local'`; also the WalletConnect chain id, so pairing follows it. */
  networkId?: string
  /** Reown project id. Without it, no WalletConnect entry is offered in the picker. */
  walletConnectProjectId?: string
  /**
   * Where the user chooses a wallet. `'in-page'` hands the choice to your UI:
   * `useWalletPicker()` reports the offered wallets while `connect()` waits. That
   * list exists only during an attempt — wallets cannot be listed before one.
   */
  walletSelection?: 'popup' | 'in-page'
  /** Omit for the SDK's built-in popup picker. Wins over `walletSelection`. */
  walletPicker?: WalletPickerFn
  /** Registered alongside the discovered ones, e.g. `createMockAdapter()` in dev/test. */
  additionalAdapters?: ProviderAdapter[]
}
