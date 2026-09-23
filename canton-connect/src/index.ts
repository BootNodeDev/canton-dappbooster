/**
 * Everything importable from `@bootnodedev/canton-connect` itself. The test doubles are not here:
 * they live on the `/testing` sub-path.
 *
 * @module Main
 */

// canton-connect — wagmi-style React hooks for connecting Canton dApps
// to CIP-0103 wallets. See README.md for the design rationale.

export type {
  ActiveContract,
  ActiveContractsByInterfaceParams,
  ActiveContractsParams,
  ActiveContractsResult,
  DisclosedContract,
  InterfaceContract,
  InterfaceContractsResult,
  LedgerOffset,
} from '#src/activeContracts'
export { toDisclosedContract } from '#src/activeContracts'
export type { CantonConnectProviderProps } from '#src/CantonConnectProvider'
export { CantonConnectProvider, useCantonConnectContext } from '#src/CantonConnectProvider'
export type { CantonErrorPayload } from '#src/cantonError'
export { CantonError, cantonErrorPayloadOf, isRetryable } from '#src/cantonError'
export { ConnectCancelledError } from '#src/connectError'
export type {
  ConnectedSynchronizer,
  ConnectedSynchronizersParams,
  ParticipantPermission,
} from '#src/connectedSynchronizers'
export type { ContractByIdParams, ContractByIdResult } from '#src/contractById'
export type { UseAccountResult } from '#src/hooks/useAccount'
export { useAccount } from '#src/hooks/useAccount'
export type {
  UseActiveContractsParams,
  UseActiveContractsResult,
} from '#src/hooks/useActiveContracts'
export { useActiveContracts } from '#src/hooks/useActiveContracts'
export type { UseConnectResult } from '#src/hooks/useConnect'
export { useConnect } from '#src/hooks/useConnect'
export type { UseDisconnectResult } from '#src/hooks/useDisconnect'
export { useDisconnect } from '#src/hooks/useDisconnect'
export type {
  PrepareExecuteAndWaitResult,
  PrepareExecuteParams,
  UseExecuteResult,
} from '#src/hooks/useExecute'
export { useExecute } from '#src/hooks/useExecute'
export type { LedgerApiParams, UseLedgerResult } from '#src/hooks/useLedger'
export { useLedger } from '#src/hooks/useLedger'
export type { UsePartyTypeResult } from '#src/hooks/usePartyType'
export { usePartyType } from '#src/hooks/usePartyType'
export type { UseSignMessageResult } from '#src/hooks/useSignMessage'
export { useSignMessage } from '#src/hooks/useSignMessage'
export type { UseWalletStatusResult } from '#src/hooks/useWalletStatus'
export { useWalletStatus } from '#src/hooks/useWalletStatus'
export type { InitOptions } from '#src/machine/connectionActors'
export type { ConnectionInput } from '#src/machine/connectionMachine'
export type { CreateMockAdapterOptions, MockAccount, MockAdapter } from '#src/mock/mockAdapter'
export { createMockAdapter } from '#src/mock/mockAdapter'
export type {
  ArchivedLedgerEvent,
  CreatedLedgerEvent,
  ExercisedLedgerEvent,
  LedgerEvent,
  Transaction,
  TransactionParams,
  TransactionsParams,
} from '#src/transactions'
export type {
  Account,
  CantonConnectConfig,
  CantonConnectContextValue,
  ConnectionStatus,
  ConnectionSubscription,
  DappSdkMethods,
  PartyType,
  TxStatusSnapshot,
} from '#src/types'
export type { UserRight } from '#src/userRights'
export type { WatchSource } from '#src/watch'
export { pollEvery } from '#src/watch'
