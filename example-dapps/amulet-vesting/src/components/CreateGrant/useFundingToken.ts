import { type Token, type TokenMeta, tokenKey, useTokenList } from '@bootnodedev/canton-dappbooster'
import { useEffect, useState } from 'react'
import { useTokenFigures } from '@/providers/Tokens'
import { AMT, isAmulet } from '@/utils/tokens'

export interface FundingToken {
  balance?: string
  balanceState?: 'error' | 'loading'
  onTokenSelect: (token: Token) => void
  token: TokenMeta
}

// The row the amount field shows and the balance it is bounded by.
export const useFundingToken = (): FundingToken => {
  const [pickedKey, setPickedKey] = useState<string>()
  const { byKey, tokens } = useTokenList()
  const token =
    (pickedKey === undefined ? undefined : byKey.get(pickedKey)) ??
    tokens.find(({ instrumentId }) => isAmulet(instrumentId))
  const { failed, refresh } = useTokenFigures()

  useEffect(() => {
    refresh()
  }, [refresh])

  const balance = failed ? undefined : token?.balance

  return {
    balance,
    balanceState: failed ? 'error' : balance === undefined ? 'loading' : undefined,
    onTokenSelect: ({ instrumentId }) => setPickedKey(tokenKey(instrumentId)),
    token: token ?? AMT,
  }
}
