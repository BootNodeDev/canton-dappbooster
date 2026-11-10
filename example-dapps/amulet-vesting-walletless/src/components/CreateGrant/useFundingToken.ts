import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { useEffect, useState } from 'react'
import { vesting } from '@/backend/vesting'
import { AMT } from '@/utils/tokens'

export interface FundingToken {
  balance?: string
  balanceState?: 'error' | 'loading'
  token: TokenMeta
}

// The row the amount field shows and the balance it is bounded by: a grant always vests Amulet, so
// the figure is the funder's free Amulet, read when the form opens.
export const useFundingToken = (): FundingToken => {
  const [balance, setBalance] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    vesting.balance().then(
      (free) => {
        if (live) setBalance(free)
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [])

  return {
    balance,
    balanceState: failed ? 'error' : balance === undefined ? 'loading' : undefined,
    token: AMT,
  }
}
