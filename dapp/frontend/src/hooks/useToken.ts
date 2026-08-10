import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { CC } from '@/mock/tokens'

// Shaped like the token provider that arrives with the selector; the mock only ever answers CC.
export const useToken = (): TokenMeta => CC
