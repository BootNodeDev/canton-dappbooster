// Public types exposed to consumers of canton-connect.

import type { ProviderAdapter, WalletPickerFn } from '@canton-network/dapp-sdk'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface Party {
  partyId: string
  networkId: string
  name?: string
  publicKey?: string
}

export interface CantonConnectConfig {
  appName: string
  appDescription?: string
  appUrl?: string
  networkId?: string
  walletConnectProjectId?: string
  walletPicker?: WalletPickerFn
  additionalAdapters?: ProviderAdapter[]
}
