// Public types exposed to consumers of canton-connect.

import type { ProviderAdapter, WalletPickerFn } from '@canton-network/dapp-sdk'

/**
 * Where the session is. `idle` means the mount-time restore has not answered yet, which is not the
 * same as `disconnected`: only that one means a connect was tried, or a session was dropped.
 *
 * @category Types
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

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
