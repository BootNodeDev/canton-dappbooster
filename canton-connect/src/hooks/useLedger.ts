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
  pageOf,
  toParties,
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
    (party: string | string[] | undefined): string[] => {
      assertUsable(status, isLocked)
      if (party !== undefined) {
        return toParties(party)
      }
      assertPartyId(partyId)

      return [partyId]
    },
    [isLocked, partyId, status],
  )

  const ledgerEnd = useCallback(async (): Promise<LedgerOffset> => {
    assertUsable(status, isLocked)

    return offsetOf(await sdk.ledgerApi(LEDGER_END_REQUEST))
  }, [isLocked, sdk, status])

  // One offset for every page keeps them one snapshot.
  const readAllPages = useCallback(
    async (request: (offset: LedgerOffset, pageToken?: string) => LedgerApiParams) => {
      const offset = await ledgerEnd()
      const rows: unknown[] = []
      let pageToken: string | undefined
      do {
        const page = pageOf(await sdk.ledgerApi(request(offset, pageToken)))
        rows.push(...page.rows)
        pageToken = page.nextPageToken
      } while (pageToken !== undefined)

      return rows
    },
    [ledgerEnd, sdk],
  )

  const activeContracts = useCallback(
    async <Payload = unknown>(
      params: ActiveContractsParams,
    ): Promise<ActiveContract<Payload>[]> => {
      const parties = readAs(params.party)

      return decodeActiveContracts<Payload>(
        await readAllPages((offset, token) =>
          activeContractsRequest(parties, offset, params, token),
        ),
      )
    },
    [readAllPages, readAs],
  )

  const activeContractsByInterface = useCallback(
    async <View = unknown>(
      params: ActiveContractsByInterfaceParams,
    ): Promise<InterfaceContract<View>[]> => {
      const parties = readAs(params.party)

      return decodeInterfaceContracts<View>(
        await readAllPages((offset, token) =>
          activeContractsByInterfaceRequest(parties, offset, params, token),
        ),
      )
    },
    [readAllPages, readAs],
  )

  const transactions = useCallback(
    async (params: TransactionsParams): Promise<Transaction[]> => {
      const parties = readAs(params.party)
      const endInclusive = params.endInclusive ?? (await ledgerEnd())

      return decodeTransactions(
        await sdk.ledgerApi(transactionsRequest(parties, endInclusive, params)),
      )
    },
    [ledgerEnd, readAs, sdk],
  )

  const transaction = useCallback(
    async (updateId: string, params?: TransactionParams): Promise<Transaction> => {
      const parties = readAs(params?.party)
      const committed = decodeTransaction(
        await sdk.ledgerApi(transactionRequest(parties, updateId)),
      )
      if (committed === undefined) {
        throw new Error(`update ${updateId} is not a transaction ${parties.join(', ')} sees`)
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
