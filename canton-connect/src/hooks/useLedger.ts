import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback, useMemo } from 'react'
import {
  type ActiveContractsByInterfaceParams,
  type ActiveContractsParams,
  type ActiveContractsResult,
  type InterfaceContractsResult,
  type LedgerOffset,
  toParties,
} from '#src/activeContracts'
import { toError } from '#src/connectError'
import type {
  ConnectedSynchronizer,
  ConnectedSynchronizersParams,
} from '#src/connectedSynchronizers'
import { assertPartyId, assertUsable, useWalletCall } from '#src/hooks/useWalletCall'
import { createLedger } from '#src/ledger'
import type { Transaction, TransactionParams, TransactionsParams } from '#src/transactions'
import type { UserRight } from '#src/userRights'

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
  connectedSynchronizers: (
    params?: ConnectedSynchronizersParams,
  ) => Promise<ConnectedSynchronizer[]>
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

/**
 * Ledger reads over the wallet session, envelope unwrapped and the connected party filled in;
 * `ledgerApi` is the raw call for anything else. A contracts read answers with the offset it was
 * taken at. `userRights` answers for the ledger user the wallet signs in as, not the party.
 * Outside React, {@link createLedger} is the same reads over any transport.
 *
 * @throws with no {@link CantonConnectProvider} above it, with no session, or from a read with no
 * party; `transaction` also when the update is not one the party sees, `userRights` when the
 * ledger names no authenticated user. A contracts read on a participant older than Canton 3.5
 * rejects saying so, with the participant's own failure as `cause`.
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

  const ledger = useMemo(() => createLedger((params) => sdk.ledgerApi(params)), [sdk])

  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      assertUsable(status, isLocked)
      try {
        return await sdk.ledgerApi(params)
      } catch (err) {
        throw toError(err)
      }
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

    return await ledger.ledgerEnd()
  }, [isLocked, ledger, status])

  const activeContracts = useCallback(
    async <Payload = unknown>(
      params: ActiveContractsParams,
    ): Promise<ActiveContractsResult<Payload>> =>
      await ledger.activeContracts<Payload>({ ...params, party: readAs(params.party) }),
    [ledger, readAs],
  )

  const activeContractsByInterface = useCallback(
    async <View = unknown>(
      params: ActiveContractsByInterfaceParams,
    ): Promise<InterfaceContractsResult<View>> =>
      await ledger.activeContractsByInterface<View>({ ...params, party: readAs(params.party) }),
    [ledger, readAs],
  )

  const transactions = useCallback(
    async <Payload = unknown>(params: TransactionsParams): Promise<Transaction<Payload>[]> =>
      await ledger.transactions<Payload>({ ...params, party: readAs(params.party) }),
    [ledger, readAs],
  )

  const transaction = useCallback(
    async <Payload = unknown>(
      updateId: string,
      params?: TransactionParams,
    ): Promise<Transaction<Payload>> =>
      await ledger.transaction<Payload>(updateId, { party: readAs(params?.party) }),
    [ledger, readAs],
  )

  const userRights = useCallback(async (): Promise<UserRight[]> => {
    assertUsable(status, isLocked)

    return await ledger.userRights()
  }, [isLocked, ledger, status])

  const connectedSynchronizers = useCallback(
    async (params?: ConnectedSynchronizersParams): Promise<ConnectedSynchronizer[]> => {
      const [party] = readAs(params?.party)

      return await ledger.connectedSynchronizers({ party })
    },
    [ledger, readAs],
  )

  return {
    activeContracts,
    activeContractsByInterface,
    transactions,
    transaction,
    ledgerEnd,
    userRights,
    connectedSynchronizers,
    ledgerApi,
    isReady: status === 'connected' && !isLocked,
  }
}
