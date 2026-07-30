// canton-connect — wagmi-style React hooks for connecting Canton dApps
// to CIP-0103 wallets. See README.md for the design rationale.

export type {
  ConnectKitContextValue,
  ConnectKitProviderProps,
  TxStatusSnapshot,
} from './ConnectKitProvider'
export { ConnectKitProvider, useConnectKitContext } from './ConnectKitProvider'
export type { UseConnectResult } from './hooks/useConnect'
export { useConnect } from './hooks/useConnect'
export type { PrepareExecuteParams, UseExecuteResult } from './hooks/useExecute'
export { useExecute } from './hooks/useExecute'
export type { LedgerApiParams, UseLedgerResult } from './hooks/useLedger'
export { useLedger } from './hooks/useLedger'
export type { UsePartyResult } from './hooks/useParty'
export { useParty } from './hooks/useParty'
export type { UseSignMessageResult } from './hooks/useSignMessage'
export { useSignMessage } from './hooks/useSignMessage'
export type { UseWalletStatusResult } from './hooks/useWalletStatus'
export { useWalletStatus } from './hooks/useWalletStatus'
export type { RawWalletAccount } from './lib/walletAccount'
export { selectPrimaryAccount, toParty } from './lib/walletAccount'

export type { ConnectionStatus, ConnectKitConfig, ConnectMode, Party } from './types'
