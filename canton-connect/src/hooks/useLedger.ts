import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import { useConnectKitContext } from '../ConnectKitProvider'

export type { LedgerApiParams }

export interface UseLedgerResult {
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

export const useLedger = (): UseLedgerResult => {
  const ctx = useConnectKitContext()

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
