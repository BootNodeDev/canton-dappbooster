import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import { useCantonConnectContext } from '../CantonConnectProvider'

/** Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type. */
export type { LedgerApiParams }

export interface UseLedgerResult {
  /** Throws if no wallet is connected. */
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

/**
 * Escape hatch for ledger queries `useExecute` and `useSignMessage` don't cover.
 * Wagmi: `usePublicClient`.
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
