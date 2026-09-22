import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import {
  type ActiveContract,
  type ActiveContractsParams,
  activeContractsRequest,
  decodeActiveContracts,
  LEDGER_END_REQUEST,
  offsetOf,
} from '#src/activeContracts'
import { assertPartyId, assertUsable, useWalletCall } from '#src/hooks/useWalletCall'

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
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

/**
 * Ledger reads over the wallet session, envelope unwrapped; `ledgerApi` is the raw call for
 * anything else.
 *
 * @throws with no {@link CantonConnectProvider} above it, with no session, or from a read with no
 * party.
 *
 * @example
 * const { activeContracts, ledgerApi } = useLedger()
 * const grants = await activeContracts<{ receiver: string }>({ templateId: '#my-app:Main:Grant' })
 * grants[0]?.payload.receiver
 * await ledgerApi({ requestMethod: 'get', resource: '/v2/users/{user-id}/rights', path: { 'user-id': 'alice' } })
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

  const activeContracts = useCallback(
    async <Payload = unknown>(
      params: ActiveContractsParams,
    ): Promise<ActiveContract<Payload>[]> => {
      assertUsable(status, isLocked)
      const party = params.party ?? partyId
      assertPartyId(party)

      const offset = offsetOf(await sdk.ledgerApi(LEDGER_END_REQUEST))
      const rows = await sdk.ledgerApi(activeContractsRequest(party, offset, params))

      return decodeActiveContracts<Payload>(rows)
    },
    [isLocked, partyId, sdk, status],
  )

  return { activeContracts, ledgerApi, isReady: status === 'connected' && !isLocked }
}
