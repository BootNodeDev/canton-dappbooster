/**
 * The `/core` sub-path: the ledger reads over a transport the caller supplies, with no React and
 * no wallet session, for a wallet, an indexer or a service. Merged into Main because a reader
 * wants each read beside its hook; the import path is on `createLedger` itself.
 *
 * @module
 * @mergeModuleWith Main
 */

export type { LedgerApiParams } from '@canton-network/dapp-sdk'
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
export type { CantonErrorPayload } from '#src/cantonError'
export { CantonError, cantonErrorPayloadOf, isRetryable } from '#src/cantonError'
export type {
  ConnectedSynchronizer,
  ConnectedSynchronizersParams,
  ParticipantPermission,
} from '#src/connectedSynchronizers'
export type { Ledger, LedgerApi, WithParty } from '#src/ledger'
export { createLedger } from '#src/ledger'
export type {
  ArchivedLedgerEvent,
  CreatedLedgerEvent,
  ExercisedLedgerEvent,
  LedgerEvent,
  Transaction,
  TransactionParams,
  TransactionsParams,
} from '#src/transactions'
export type { UserRight } from '#src/userRights'
