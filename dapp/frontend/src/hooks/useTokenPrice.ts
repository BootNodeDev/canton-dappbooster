import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { CC } from '@/lib/tokens'

// CoinGecko `canton-network`, 2026-08-07. Refresh by hand, or swap this body for a fetch.
export const CC_USD_RATE = '0.091012'

export interface UseTokenPriceResult {
  usdRate: string | undefined
  isLoading: boolean
  error: Error | undefined
}

// A live fetch would add a rate-limited network dependency for one cosmetic line, so the rate is a
// dated constant behind the interface a real one will satisfy.
export const useTokenPrice = (token: TokenMeta): UseTokenPriceResult => ({
  usdRate: token.symbol === CC.symbol ? CC_USD_RATE : undefined,
  isLoading: false,
  error: undefined,
})
