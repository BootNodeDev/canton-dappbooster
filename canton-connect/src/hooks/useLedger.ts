import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import { useWalletCall } from '#src/hooks/useWalletCall'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { LedgerApiParams }

/**
 * Return shape of {@link useLedger}; check `isReady` before calling `ledgerApi`.
 *
 * @category Hooks
 */
export interface UseLedgerResult {
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

/**
 * Escape hatch for ledger reads `useExecute` and `useSignMessage` do not cover: the participant's
 * JSON API, passed through untyped.
 *
 * @throws with no {@link CantonConnectProvider} above it, and from `ledgerApi` itself where nothing
 * is connected or the wallet is locked, which `isReady` is there to check first. A refused read
 * throws too, always as an `Error`: see {@link toError}.
 *
 * @example
 * const { ledgerApi } = useLedger()
 * await ledgerApi({
 *   requestMethod: 'get',
 *   resource: '/v2/users/{user-id}/rights',
 *   path: { 'user-id': 'alice' },
 * })
 *
 * @category Hooks
 */
export const useLedger = (): UseLedgerResult => {
  const { read, status, isLocked } = useWalletCall()

  const ledgerApi = useCallback(
    (params: LedgerApiParams): Promise<unknown> => read((sdk) => sdk.ledgerApi(params)),
    [read],
  )

  return { ledgerApi, isReady: status === 'connected' && !isLocked }
}
