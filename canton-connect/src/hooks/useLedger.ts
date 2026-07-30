import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import { useCantonConnectContext } from '../CantonConnectProvider'

/**
 * The SDK's own params for `ledgerApi`, re-exported so callers don't need a
 * direct dependency on `@canton-network/dapp-sdk` for the type.
 */
export type { LedgerApiParams }

/** Return value of `useLedger`. */
export interface UseLedgerResult {
  /** Raw pass-through to the participant's JSON Ledger API. Throws if no wallet is connected. */
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  /** True once a wallet is connected and `ledgerApi` calls will resolve instead of throwing. */
  isReady: boolean
}

/**
 * Escape hatch for ledger queries the typed hooks (`useExecute`,
 * `useSignMessage`) don't cover.
 *
 * Wagmi counterpart: `usePublicClient` — both are the escape hatch for raw
 * reads the typed hooks don't cover.
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
