import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { useEffect, useState } from 'react'
import { addAmounts, isAmount } from '@/lib/amount'
import { type Holding, readHoldings } from '@/mock/balances'
import { CC } from '@/mock/tokens'

export interface TokenBalance {
  total: string
  holdings: Holding[]
}

export interface UseTokenBalanceResult {
  balance: TokenBalance | undefined
  isLoading: boolean
  error: Error | undefined
}

const IDLE: UseTokenBalanceResult = { balance: undefined, isLoading: false, error: undefined }
const LOADING: UseTokenBalanceResult = { balance: undefined, isLoading: true, error: undefined }

// An unparseable holding throws rather than folding to zero — a malformed or mis-scaled read would
// otherwise silently understate the total while still listing the bad holding.
export const sumHoldings = (holdings: Holding[]): string => {
  for (const holding of holdings) {
    if (!isAmount(holding.amount)) {
      throw new Error(`Holding ${holding.cid} has an unparseable amount: ${holding.amount}`)
    }
  }
  return addAmounts(...holdings.map((holding) => holding.amount))
}

// Async state over a party-scoped holdings read that can fail. Only `readHoldings` changes when the
// ledger arrives.
export const useTokenBalance = (
  partyId: string | undefined,
  token: TokenMeta,
): UseTokenBalanceResult => {
  const [result, setResult] = useState<UseTokenBalanceResult>(
    partyId === undefined ? IDLE : LOADING,
  )

  useEffect(() => {
    // Holdings are per instrument, and the mock only holds CC. Anything else reads as no record.
    if (partyId === undefined || token.symbol !== CC.symbol) {
      setResult(IDLE)
      return
    }
    setResult(LOADING)
    let live = true
    readHoldings(partyId)
      .then((holdings) =>
        holdings === undefined
          ? IDLE
          : {
              balance: { total: sumHoldings(holdings), holdings },
              isLoading: false,
              error: undefined,
            },
      )
      // Catches the read's own failure and `sumHoldings` rejecting a malformed one alike.
      .catch((err) => ({ ...IDLE, error: err instanceof Error ? err : new Error(String(err)) }))
      .then((next) => {
        if (live) setResult(next)
      })
    return () => {
      live = false
    }
  }, [partyId, token.symbol])

  return result
}
