import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  filterTokenHoldingsByInstrument,
  listTokenHoldings,
  type TokenHolding,
  type TokenHoldingSummary,
} from '@/cip56/holdings'
import type { AccountPublic } from '@/vault/types'

export interface Cip56HoldingDetailsApi {
  listTokenHoldings: (partyId: string) => Promise<TokenHolding[]>
}

export interface TokenHoldingDetailsState {
  holdings: TokenHolding[]
  loading: boolean
  error?: string
}

const defaultApi: Cip56HoldingDetailsApi = {
  listTokenHoldings,
}

// Loads raw UTXOs only after a token row is expanded.
export const useTokenHoldingDetails = (
  account: AccountPublic | undefined,
  summary: TokenHoldingSummary | undefined,
  options: { api?: Cip56HoldingDetailsApi; enabled?: boolean } = {},
): TokenHoldingDetailsState => {
  const api = options.api ?? defaultApi
  const cachedHoldings = summary?.holdings
  const enabled =
    options.enabled === true &&
    account !== undefined &&
    summary !== undefined &&
    cachedHoldings === undefined
  const query = useQuery({
    enabled,
    queryKey: ['cip56', 'holdingDetails', account?.id, account?.partyId, summary?.key],
    queryFn: async () => {
      const holdings = await api.listTokenHoldings(account?.partyId ?? '')
      return filterTokenHoldingsByInstrument(holdings, summary?.instrumentId)
    },
  })
  const error = query.error instanceof Error ? query.error.message : undefined

  return useMemo(
    () => ({
      holdings: query.data ?? cachedHoldings ?? [],
      loading: cachedHoldings === undefined && query.isFetching,
      ...(error === undefined ? {} : { error }),
    }),
    [query.data, query.isFetching, cachedHoldings, error],
  )
}
