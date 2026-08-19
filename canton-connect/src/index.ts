// canton-connect — wagmi-style React hooks for connecting Canton dApps
// to CIP-0103 wallets. See README.md for the design rationale.

export type {
  CantonConnectContextValue,
  CantonConnectProviderProps,
  TxStatusSnapshot,
} from '#src/CantonConnectProvider'
export { CantonConnectProvider, useCantonConnectContext } from '#src/CantonConnectProvider'
export type { UseConnectResult } from '#src/hooks/useConnect'
export { useConnect } from '#src/hooks/useConnect'
export type { PrepareExecuteParams, UseExecuteResult } from '#src/hooks/useExecute'
export { useExecute } from '#src/hooks/useExecute'
export type { LedgerApiParams, UseLedgerResult } from '#src/hooks/useLedger'
export { useLedger } from '#src/hooks/useLedger'
export type { UsePartyResult } from '#src/hooks/useParty'
export { useParty } from '#src/hooks/useParty'
export type { UseSignMessageResult } from '#src/hooks/useSignMessage'
export { useSignMessage } from '#src/hooks/useSignMessage'
export type { UseWalletStatusResult } from '#src/hooks/useWalletStatus'
export { useWalletStatus } from '#src/hooks/useWalletStatus'
export type { CreateMockAdapterOptions, MockAccount, MockAdapter } from '#src/mock/mockAdapter'
export { createMockAdapter } from '#src/mock/mockAdapter'

export type { CantonConnectConfig, ConnectionStatus, Party } from '#src/types'
