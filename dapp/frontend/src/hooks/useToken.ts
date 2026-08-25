import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { CC } from '@/lib/tokens'

// The field's own selection, seeded with CC. Per field on purpose: nothing yet says two amounts on
// one page share a token.
export const useToken = (): [TokenMeta, (token: TokenMeta) => void] => useState<TokenMeta>(CC)
