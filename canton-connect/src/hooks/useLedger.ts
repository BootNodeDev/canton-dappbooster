import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'

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
 * JSON API, passed through untyped. Throws with no {@link CantonConnectProvider} above it.
 * Wagmi: `usePublicClient`.
 *
 * @example
 * const { ledgerApi } = useLedger()
 * await ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' })
 *
 * @category Hooks
 */
export const useLedger = (): UseLedgerResult => {
  const ctx = useCantonConnectContext()

  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      if (ctx.status !== 'connected') {
        throw new Error('wallet is not connected — call useConnect().connect() first')
      }

      return await ctx.sdk.ledgerApi(params)
    },
    [ctx.sdk, ctx.status],
  )

  return { ledgerApi, isReady: ctx.status === 'connected' }
}
