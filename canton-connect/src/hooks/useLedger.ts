import { useCallback } from 'react'
import { useConnectKitContext } from '../ConnectKitProvider'

export interface LedgerApiParams {
  requestMethod: 'get' | 'post' | 'patch' | 'put' | 'delete'
  resource: string
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  path?: Record<string, unknown>
}

export interface UseLedgerResult {
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
  isReady: boolean
}

// Raw pass-through to the participant JSON API via the connected wallet.
// Use when the typed hooks (`useExecute`, etc.) don't cover what you need —
// e.g. reading the ACS or querying ledger-end.
export const useLedger = (): UseLedgerResult => {
  const ctx = useConnectKitContext()
  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<unknown> => {
      if (ctx.client === undefined) {
        throw new Error('wallet is not connected — call useConnect().connect() first')
      }
      return await ctx.client.ledgerApi(params as Parameters<typeof ctx.client.ledgerApi>[0])
    },
    [ctx.client],
  )
  return { ledgerApi, isReady: ctx.client !== undefined }
}
