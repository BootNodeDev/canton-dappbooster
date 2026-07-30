// canton-connect — wagmi-style React hooks for connecting Canton dApps
// to CIP-0103 wallets. See README.md for the design rationale.

export type {
  CantonConnectContextValue,
  CantonConnectProviderProps,
  TxStatusSnapshot,
} from './CantonConnectProvider'
export { CantonConnectProvider, useCantonConnectContext } from './CantonConnectProvider'
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
export type { CreateMockAdapterOptions, MockAccount, MockAdapter } from './mock/mockAdapter'
export { createMockAdapter } from './mock/mockAdapter'

export type { CantonConnectConfig, ConnectionStatus, Party } from './types'
