import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import {
  type ActiveContractsByInterfaceParams,
  type ActiveContractsParams,
  type ActiveContractsResult,
  activeContractsByInterfaceRequest,
  activeContractsRequest,
  decodeActiveContracts,
  decodeInterfaceContracts,
  type InterfaceContractsResult,
  LEDGER_END_REQUEST,
  type LedgerOffset,
  offsetOf,
  pageOf,
  toParties,
} from '#src/activeContracts'
import { toError } from '#src/connectError'
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
import {
  AUTHENTICATED_USER_REQUEST,
  decodeUserRights,
  type UserRight,
  userIdOf,
  userRightsRequest,
} from '#src/userRights'

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
  ) => Promise<ActiveContractsResult<Payload>>
  activeContractsByInterface: <View = unknown>(
    params: ActiveContractsByInterfaceParams,
  ) => Promise<InterfaceContractsResult<View>>
  transactions: <Payload = unknown>(params: TransactionsParams) => Promise<Transaction<Payload>[]>
  transaction: <Payload = unknown>(
    updateId: string,
    params?: TransactionParams,
  ) => Promise<Transaction<Payload>>
  ledgerEnd: () => Promise<LedgerOffset>
  userRights: () => Promise<UserRight[]>
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

/**
 * Ledger reads over the wallet session, envelope unwrapped; `ledgerApi` is the raw call for
 * anything else. A contracts read answers with the offset it was taken at, which is where a
 * caller following changes resumes. `userRights` answers for the ledger user the wallet
 * authenticates as, whose parties can outnumber the connected one.
 *
 * @throws with no {@link CantonConnectProvider} above it, with no session, or from a read with no
 * party; `transaction` also when the update is not one the party sees, `userRights` when the
 * ledger names no authenticated user.
 *
 * @example
 * const { activeContracts, transactions, transaction, userRights } = useLedger()
 * const grants = await activeContracts<{ receiver: string }>({ templateId: '#my-app:Main:Grant' })
 * const since = await transactions({
 *   templateId: '#my-app:Main:Grant',
 *   beginExclusive: grants.offset,
 * })
 * const committed = await transaction(tx.payload.updateId)
 * const isAdmin = (await userRights()).some((right) => right.kind === 'ParticipantAdmin')
 *
 * @category Hooks
 */
export const useLedger = (): UseLedgerResult => {
  // Guards without `call`: a stateless query needs no pending/error renders around it.
  const { sdk, partyId, status, isLocked } = useWalletCall()

  // Every read goes through here, or a rejection reaches the caller as the raw envelope.
  const read = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      try {
        return await sdk.ledgerApi(params)
      } catch (err) {
        throw toError(err)
      }
    },
    [sdk],
  )

  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      assertUsable(status, isLocked)

      return await read(params)
    },
    [isLocked, read, status],
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

    return offsetOf(await read(LEDGER_END_REQUEST))
  }, [isLocked, read, status])

  // One offset for every page keeps them one snapshot.
  const readAllPages = useCallback(
    async (request: (offset: LedgerOffset, pageToken?: string) => LedgerApiParams) => {
      const offset = await ledgerEnd()
      const rows: unknown[] = []
      let pageToken: string | undefined
      do {
        const page = pageOf(await read(request(offset, pageToken)))
        rows.push(...page.rows)
        pageToken = page.nextPageToken
      } while (pageToken !== undefined)

      return { rows, offset }
    },
    [ledgerEnd, read],
  )

  const activeContracts = useCallback(
    async <Payload = unknown>(
      params: ActiveContractsParams,
    ): Promise<ActiveContractsResult<Payload>> => {
      const parties = readAs(params.party)
      const { rows, offset } = await readAllPages((snapshot, token) =>
        activeContractsRequest(parties, snapshot, params, token),
      )

      return { contracts: decodeActiveContracts<Payload>(rows), offset }
    },
    [readAllPages, readAs],
  )

  const activeContractsByInterface = useCallback(
    async <View = unknown>(
      params: ActiveContractsByInterfaceParams,
    ): Promise<InterfaceContractsResult<View>> => {
      const parties = readAs(params.party)
      const { rows, offset } = await readAllPages((snapshot, token) =>
        activeContractsByInterfaceRequest(parties, snapshot, params, token),
      )

      return { contracts: decodeInterfaceContracts<View>(rows), offset }
    },
    [readAllPages, readAs],
  )

  const transactions = useCallback(
    async <Payload = unknown>(params: TransactionsParams): Promise<Transaction<Payload>[]> => {
      const parties = readAs(params.party)
      const endInclusive = params.endInclusive ?? (await ledgerEnd())

      return decodeTransactions<Payload>(
        await read(transactionsRequest(parties, endInclusive, params)),
      )
    },
    [ledgerEnd, read, readAs],
  )

  const transaction = useCallback(
    async <Payload = unknown>(
      updateId: string,
      params?: TransactionParams,
    ): Promise<Transaction<Payload>> => {
      const parties = readAs(params?.party)
      const committed = decodeTransaction<Payload>(
        await read(transactionRequest(parties, updateId)),
      )
      if (committed === undefined) {
        throw new Error(`update ${updateId} is not a transaction ${parties.join(', ')} sees`)
      }

      return committed
    },
    [read, readAs],
  )

  const userRights = useCallback(async (): Promise<UserRight[]> => {
    assertUsable(status, isLocked)
    const userId = userIdOf(await read(AUTHENTICATED_USER_REQUEST))

    return decodeUserRights(await read(userRightsRequest(userId)))
  }, [isLocked, read, status])

  return {
    activeContracts,
    activeContractsByInterface,
    transactions,
    transaction,
    ledgerEnd,
    userRights,
    ledgerApi,
    isReady: status === 'connected' && !isLocked,
  }
}
