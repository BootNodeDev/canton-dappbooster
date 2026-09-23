import type { LedgerApiParams } from '@canton-network/dapp-sdk'
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
import {
  type ConnectedSynchronizer,
  type ConnectedSynchronizersParams,
  connectedSynchronizersRequest,
  decodeConnectedSynchronizers,
} from '#src/connectedSynchronizers'
import { explainPagedReadFailure, VERSION_REQUEST } from '#src/participantVersion'
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
 * The one call {@link createLedger} reads through: a JSON Ledger API route as its template, with
 * `path`, `query` and `body` beside it, answered with the participant's JSON.
 *
 * @example
 * const viaWallet: LedgerApi = (params) => sdk.ledgerApi(params)
 *
 * @category Types
 */
export type LedgerApi = (params: LedgerApiParams) => Promise<unknown>

/**
 * A read's params with `party` required, since there is no session to default it from.
 *
 * @category Types
 */
export type WithParty<Params extends { party?: unknown }> = Params & {
  party: NonNullable<Params['party']>
}

/**
 * The reads {@link createLedger} returns: {@link UseLedgerResult}'s, each naming its party.
 *
 * @category Types
 */
export interface Ledger {
  activeContracts: <Payload = unknown>(
    params: WithParty<ActiveContractsParams>,
  ) => Promise<ActiveContractsResult<Payload>>
  activeContractsByInterface: <View = unknown>(
    params: WithParty<ActiveContractsByInterfaceParams>,
  ) => Promise<InterfaceContractsResult<View>>
  transactions: <Payload = unknown>(
    params: WithParty<TransactionsParams>,
  ) => Promise<Transaction<Payload>[]>
  transaction: <Payload = unknown>(
    updateId: string,
    params: WithParty<TransactionParams>,
  ) => Promise<Transaction<Payload>>
  ledgerEnd: () => Promise<LedgerOffset>
  userRights: () => Promise<UserRight[]>
  connectedSynchronizers: (
    params: WithParty<ConnectedSynchronizersParams>,
  ) => Promise<ConnectedSynchronizer[]>
}

/**
 * The ledger reads without React or a wallet session, over whatever call answers them: a wallet's
 * `ledgerApi`, or a service's own client for the participant. Import it from
 * `@bootnodedev/canton-connect/core`; a React dApp reaches the same reads through
 * {@link useLedger}, which fills in the connected party.
 *
 * @throws from a read, as a {@link CantonError} where the participant raised it; `transaction`
 * also when the update is not one the party sees.
 *
 * @example
 * const ledger = createLedger((params) => sdk.ledgerApi(params))
 * const { contracts } = await ledger.activeContracts<{ receiver: string }>({
 *   templateId: '#my-app:Main:Grant',
 *   party: operator,
 * })
 *
 * @category Utilities
 */
export const createLedger = (ledgerApi: LedgerApi): Ledger => {
  // Every read goes through here, or a rejection reaches the caller as the raw envelope.
  const read = async (params: LedgerApiParams): Promise<unknown> => {
    try {
      return await ledgerApi(params)
    } catch (err) {
      throw toError(err)
    }
  }

  const ledgerEnd = async (): Promise<LedgerOffset> => offsetOf(await read(LEDGER_END_REQUEST))

  // Asked only once a page fails, so a participant that pages pays nothing for the check.
  const readPage = async (params: LedgerApiParams): Promise<unknown> => {
    try {
      return await read(params)
    } catch (failure) {
      const version = await read(VERSION_REQUEST).catch(() => undefined)
      throw explainPagedReadFailure(toError(failure), version)
    }
  }

  // One offset for every page keeps them one snapshot.
  const readAllPages = async (
    request: (offset: LedgerOffset, pageToken?: string) => LedgerApiParams,
  ): Promise<{ rows: unknown[]; offset: LedgerOffset }> => {
    const offset = await ledgerEnd()
    const rows: unknown[] = []
    let pageToken: string | undefined
    do {
      const page = pageOf(await readPage(request(offset, pageToken)))
      rows.push(...page.rows)
      pageToken = page.nextPageToken
    } while (pageToken !== undefined)

    return { rows, offset }
  }

  return {
    activeContracts: async <Payload = unknown>(params: WithParty<ActiveContractsParams>) => {
      const parties = toParties(params.party)
      const { rows, offset } = await readAllPages((snapshot, token) =>
        activeContractsRequest(parties, snapshot, params, token),
      )

      return { contracts: decodeActiveContracts<Payload>(rows), offset }
    },

    activeContractsByInterface: async <View = unknown>(
      params: WithParty<ActiveContractsByInterfaceParams>,
    ) => {
      const parties = toParties(params.party)
      const { rows, offset } = await readAllPages((snapshot, token) =>
        activeContractsByInterfaceRequest(parties, snapshot, params, token),
      )

      return { contracts: decodeInterfaceContracts<View>(rows), offset }
    },

    transactions: async <Payload = unknown>(params: WithParty<TransactionsParams>) => {
      const parties = toParties(params.party)
      const endInclusive = params.endInclusive ?? (await ledgerEnd())

      return decodeTransactions<Payload>(
        await read(transactionsRequest(parties, endInclusive, params)),
      )
    },

    transaction: async <Payload = unknown>(
      updateId: string,
      params: WithParty<TransactionParams>,
    ) => {
      const parties = toParties(params.party)
      const committed = decodeTransaction<Payload>(
        await read(transactionRequest(parties, updateId)),
      )
      if (committed === undefined) {
        throw new Error(`update ${updateId} is not a transaction ${parties.join(', ')} sees`)
      }

      return committed
    },

    ledgerEnd,

    userRights: async () => {
      const userId = userIdOf(await read(AUTHENTICATED_USER_REQUEST))

      return decodeUserRights(await read(userRightsRequest(userId)))
    },

    connectedSynchronizers: async (params: WithParty<ConnectedSynchronizersParams>) =>
      decodeConnectedSynchronizers(await read(connectedSynchronizersRequest(params.party))),
  }
}
