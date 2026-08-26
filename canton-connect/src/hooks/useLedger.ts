import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import { assertUsable, useWalletCall } from '#src/hooks/useWalletCall'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { LedgerApiParams }

/**
 * Return shape of {@link useLedger}. `ledgerApi` throws when nothing is connected, which `isReady`
 * is there to check first.
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
 * Wagmi: `usePublicClient`.
 *
 * @throws with no {@link CantonConnectProvider} above it, and from `ledgerApi` itself where nothing
 * is connected, which `isReady` is there to check first.
 *
 * @example
 * const { ledgerApi } = useLedger()
 * await ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' })
 *
 * @category Hooks
 */
export const useLedger = (): UseLedgerResult => {
  // Guards without `call`: a stateless query needs no busy/error renders around it.
  const { sdk, status, isLocked } = useWalletCall()

  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      assertUsable(status, isLocked)

      return await sdk.ledgerApi(params)
    },
    [isLocked, sdk, status],
  )

  return { ledgerApi, isReady: status === 'connected' && !isLocked }
}
