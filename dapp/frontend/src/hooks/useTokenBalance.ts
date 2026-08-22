import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { useEffect, useState } from 'react'
import { type Holding, readHoldings, sumHoldings } from '@/lib/balances'
import { CC } from '@/lib/tokens'

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

// Async state over a holdings read that can fail, re-run per party. Only `readHoldings` changes
// when the ledger arrives.
export const useTokenBalance = (
  partyId: string | undefined,
  token: TokenMeta,
): UseTokenBalanceResult => {
  const [result, setResult] = useState<UseTokenBalanceResult>(
    partyId === undefined ? IDLE : LOADING,
  )

  useEffect(() => {
    // Holdings are per instrument, and only CC has a placeholder. Anything else reads as no record.
    if (partyId === undefined || token.symbol !== CC.symbol) {
      setResult(IDLE)
      return
    }
    setResult(LOADING)
    let live = true
    readHoldings()
      .then((holdings) => ({
        balance: { total: sumHoldings(holdings), holdings },
        isLoading: false,
        error: undefined,
      }))
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
