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
  offsetOf,
} from '#src/activeContracts'
import { assertPartyId, assertUsable, useWalletCall } from '#src/hooks/useWalletCall'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { LedgerApiParams }

type LedgerOffset = number | string

type AcsRequest = (party: string, offset: LedgerOffset) => LedgerApiParams

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
 * const { activeContracts, activeContractsByInterface } = useLedger()
 * const grants = await activeContracts<{ receiver: string }>({ templateId: '#my-app:Main:Grant' })
 * grants[0]?.payload.receiver
 * const holdings = await activeContractsByInterface<{ amount: string }>({
 *   interfaceId: '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding',
 * })
 * holdings[0]?.view.amount
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

  const readAcs = useCallback(
    async (party: string | undefined, request: AcsRequest): Promise<unknown> => {
      assertUsable(status, isLocked)
      const readAs = party ?? partyId
      assertPartyId(readAs)

      const offset = offsetOf(await sdk.ledgerApi(LEDGER_END_REQUEST))

      return await sdk.ledgerApi(request(readAs, offset))
    },
    [isLocked, partyId, sdk, status],
  )

  const activeContracts = useCallback(
    async <Payload = unknown>(params: ActiveContractsParams): Promise<ActiveContract<Payload>[]> =>
      decodeActiveContracts<Payload>(
        await readAcs(params.party, (party, offset) =>
          activeContractsRequest(party, offset, params),
        ),
      ),
    [readAcs],
  )

  const activeContractsByInterface = useCallback(
    async <View = unknown>(
      params: ActiveContractsByInterfaceParams,
    ): Promise<InterfaceContract<View>[]> =>
      decodeInterfaceContracts<View>(
        await readAcs(params.party, (party, offset) =>
          activeContractsByInterfaceRequest(party, offset, params),
        ),
      ),
    [readAcs],
  )

  return {
    activeContracts,
    activeContractsByInterface,
    ledgerApi,
    isReady: status === 'connected' && !isLocked,
  }
}
