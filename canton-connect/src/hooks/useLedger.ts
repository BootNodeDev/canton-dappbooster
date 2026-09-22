import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import {
  type ActiveContract,
  type ActiveContractsByInterfaceParams,
  type ActiveContractsParams,
  activeContractsByInterfaceRequest,
  activeContractsRequest,
  decodeActiveContracts,
  decodeInterfaceContracts,
  type InterfaceContract,
  LEDGER_END_REQUEST,
  type LedgerOffset,
  offsetOf,
} from '#src/activeContracts'
import { assertPartyId, assertUsable, useWalletCall } from '#src/hooks/useWalletCall'
import {
  decodeTransaction,
  decodeTransactions,
  type Transaction,
  type TransactionParams,
  type TransactionsParams,
  transactionRequest,
  transactionsRequest,
} from '#src/transactions'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { LedgerApiParams }

/**
 * Return shape of {@link useLedger}. Every call throws with no session; `isReady` says so
 * first.
 *
 * @category Hooks
 */
export interface UseLedgerResult {
  activeContracts: <Payload = unknown>(
    params: ActiveContractsParams,
  ) => Promise<ActiveContract<Payload>[]>
  activeContractsByInterface: <View = unknown>(
    params: ActiveContractsByInterfaceParams,
  ) => Promise<InterfaceContract<View>[]>
  transactions: (params: TransactionsParams) => Promise<Transaction[]>
  transaction: (updateId: string, params?: TransactionParams) => Promise<Transaction>
  ledgerEnd: () => Promise<LedgerOffset>
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

/**
 * Ledger reads over the wallet session, envelope unwrapped; `ledgerApi` is the raw call for
 * anything else.
 *
 * @throws with no {@link CantonConnectProvider} above it, with no session, or from a read with no
 * party; `transaction` also when the update is not one the party sees.
 *
 * @example
 * const { activeContracts, transactions, transaction } = useLedger()
 * const grants = await activeContracts<{ receiver: string }>({ templateId: '#my-app:Main:Grant' })
 * const history = await transactions({ templateId: '#my-app:Main:Grant' })
 * const committed = await transaction(tx.payload.updateId)
 *
 * @category Hooks
 */
export const useLedger = (): UseLedgerResult => {
  // Guards without `call`: a stateless query needs no pending/error renders around it.
  const { sdk, partyId, status, isLocked } = useWalletCall()

  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      assertUsable(status, isLocked)

      return await sdk.ledgerApi(params)
    },
    [isLocked, sdk, status],
  )

  const readAs = useCallback(
    (party: string | undefined): string => {
      assertUsable(status, isLocked)
      const readingParty = party ?? partyId
      assertPartyId(readingParty)

      return readingParty
    },
    [isLocked, partyId, status],
  )

  const ledgerEnd = useCallback(async (): Promise<LedgerOffset> => {
    assertUsable(status, isLocked)

    return offsetOf(await sdk.ledgerApi(LEDGER_END_REQUEST))
  }, [isLocked, sdk, status])

  const activeContracts = useCallback(
    async <Payload = unknown>(
      params: ActiveContractsParams,
    ): Promise<ActiveContract<Payload>[]> => {
      const party = readAs(params.party)
      const rows = await sdk.ledgerApi(activeContractsRequest(party, await ledgerEnd(), params))

      return decodeActiveContracts<Payload>(rows)
    },
    [ledgerEnd, readAs, sdk],
  )

  const activeContractsByInterface = useCallback(
    async <View = unknown>(
      params: ActiveContractsByInterfaceParams,
    ): Promise<InterfaceContract<View>[]> => {
      const party = readAs(params.party)
      const request = activeContractsByInterfaceRequest(party, await ledgerEnd(), params)

      return decodeInterfaceContracts<View>(await sdk.ledgerApi(request))
    },
    [ledgerEnd, readAs, sdk],
  )

  const transactions = useCallback(
    async (params: TransactionsParams): Promise<Transaction[]> => {
      const party = readAs(params.party)
      const endInclusive = params.endInclusive ?? (await ledgerEnd())

      return decodeTransactions(
        await sdk.ledgerApi(transactionsRequest(party, endInclusive, params)),
      )
    },
    [ledgerEnd, readAs, sdk],
  )

  const transaction = useCallback(
    async (updateId: string, params?: TransactionParams): Promise<Transaction> => {
      const party = readAs(params?.party)
      const committed = decodeTransaction(await sdk.ledgerApi(transactionRequest(party, updateId)))
      if (committed === undefined) {
        throw new Error(`update ${updateId} is not a transaction ${party} sees`)
      }

      return committed
    },
    [readAs, sdk],
  )

  return {
    activeContracts,
    activeContractsByInterface,
    transactions,
    transaction,
    ledgerEnd,
    ledgerApi,
    isReady: status === 'connected' && !isLocked,
  }
}
