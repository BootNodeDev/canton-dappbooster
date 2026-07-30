// Public types exposed to consumers of canton-connect.

import type { ProviderAdapter, WalletPickerFn } from '@canton-network/dapp-sdk'

export type ConnectMode = 'extension' | 'walletconnect' | 'preferred'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface Party {
  partyId: string
  networkId: string
  name?: string
  publicKey?: string
}

export interface ConnectKitConfig {
  appName: string
  appDescription?: string
  appUrl?: string
  // CIP-0103 network id, e.g. 'canton:local'.
  networkId?: string
  // Reown project id; enables the WalletConnect adapter when set (Task 6).
  walletConnectProjectId?: string
  // Omit for the SDK's built-in popup picker. Injected in tests (auto-select) and,
  // later, by the themed picker (follow-up issue).
  walletPicker?: WalletPickerFn
  // Extra adapters to register (e.g. the mock adapter in dev/test — Task 7).
  additionalAdapters?: ProviderAdapter[]
}
