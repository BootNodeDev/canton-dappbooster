import type { LedgerApiParams, LedgerApiResult } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import {
  type ActiveContract,
  type ActiveContractsParams,
  type ActiveContractsResult,
  activeContractsRequest,
  decodeActiveContracts,
  LEDGER_END_REQUEST,
  offsetOf,
  pageOf,
} from '#src/activeContracts'
import { toError } from '#src/connectError'
import { assertPartyId, assertUsable, useWalletCall } from '#src/hooks/useWalletCall'
import {
  decodeTransactionsPage,
  type TransactionsPage,
  transactionsRequest,
} from '#src/transactions'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { LedgerApiParams }

/**
 * Return shape of {@link useLedger}. Both calls reject with no session, which `isReady` is there
 * to check first, and `activeContracts` also where the wallet reports no party.
 *
 * @category Hooks
 */
export interface UseLedgerResult {
  activeContracts: <Payload>(
    params: ActiveContractsParams<Payload>,
  ) => Promise<ActiveContractsResult<Payload>>
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

/** `useLedger`'s reads, plus following a template from a cursor, which stays off its result. */
type LedgerReads = UseLedgerResult & {
  transactions: <Payload>(
    params: ActiveContractsParams<Payload>,
    beginExclusive: number,
  ) => Promise<TransactionsPage<Payload>>
}

/** Every read, the internal `transactions` included; `useLedger` publishes the rest. */
export const useLedgerReads = (): LedgerReads => {
  // Guards without `call`: a stateless query needs no pending/error renders around it.
  const { sdk, partyId, status, isLocked } = useWalletCall()

  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      assertUsable(status, isLocked)

      return await sdk.ledgerApi(params)
    },
    [isLocked, sdk, status],
  )

  const read = useCallback(
    async (params: LedgerApiParams): Promise<LedgerApiResult> => {
      try {
        return await sdk.ledgerApi(params)
      } catch (cause) {
        throw toError(cause)
      }
    },
    [sdk],
  )

  const connectedParty = useCallback((): string => {
    assertUsable(status, isLocked)
    assertPartyId(partyId)

    return partyId
  }, [isLocked, partyId, status])

  const ledgerEnd = useCallback(
    async (): Promise<number> => offsetOf(await read(LEDGER_END_REQUEST)),
    [read],
  )

  const activeContracts = useCallback(
    async <Payload>({
      templateId,
      decode,
    }: ActiveContractsParams<Payload>): Promise<ActiveContractsResult<Payload>> => {
      const party = connectedParty()
      // One offset for every page: the participant refuses a page token issued at another.
      const offset = await ledgerEnd()

      const contractsFrom = async (pageToken?: string): Promise<ActiveContract<Payload>[]> => {
        const page = pageOf(
          await read(activeContractsRequest(party, templateId, offset, pageToken)),
        )
        const contracts = decodeActiveContracts(page.activeContracts, decode)

        return page.nextPageToken === undefined
          ? contracts
          : [...contracts, ...(await contractsFrom(page.nextPageToken))]
      }

      return { contracts: await contractsFrom(), offset }
    },
    [connectedParty, ledgerEnd, read],
  )

  const transactions = useCallback(
    async <Payload>(
      { templateId, decode }: ActiveContractsParams<Payload>,
      beginExclusive: number,
    ): Promise<TransactionsPage<Payload>> => {
      const party = connectedParty()
      const endInclusive = await ledgerEnd()
      const updates = await read(
        transactionsRequest(party, templateId, beginExclusive, endInclusive),
      )

      return decodeTransactionsPage(updates, decode, beginExclusive, endInclusive)
    },
    [connectedParty, ledgerEnd, read],
  )

  return {
    activeContracts,
    transactions,
    ledgerApi,
    isReady: status === 'connected' && !isLocked,
  }
}

/**
 * Ledger reads over the wallet session. `activeContracts` reads one template's contracts as the
 * connected party, envelope unwrapped, with the offset the read was taken at; `ledgerApi` passes
 * anything else to the participant's JSON API, untyped.
 *
 * @throws with no {@link CantonConnectProvider} above it, from `ledgerApi` with no session, which
 * `isReady` checks first, and from `activeContracts` also with no party on the account.
 *
 * @example
 * const { activeContracts, ledgerApi } = useLedger()
 * const grants = await activeContracts({ templateId: '#my-app:Main:Grant', decode: toGrant })
 * await ledgerApi({
 *   requestMethod: 'get',
 *   resource: '/v2/users/{user-id}/rights',
 *   path: { 'user-id': 'alice' },
 * })
 *
 * @category Hooks
 */
export const useLedger = (): UseLedgerResult => {
  const { activeContracts, ledgerApi, isReady } = useLedgerReads()

  return { activeContracts, ledgerApi, isReady }
}
