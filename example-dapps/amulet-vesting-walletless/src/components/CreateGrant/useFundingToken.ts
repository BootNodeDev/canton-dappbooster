import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { useEffect, useState } from 'react'
import { vesting } from '@/backend/vesting'
import { AMT } from '@/utils/tokens'

export interface FundingToken {
  balance?: string
  balanceState?: 'error' | 'loading'
  token: TokenMeta
}

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
