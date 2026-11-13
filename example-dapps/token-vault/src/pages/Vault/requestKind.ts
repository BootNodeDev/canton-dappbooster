import type { RequestKind } from '@/backend/commands'
import { USDX, type VaultToken, VSH } from '@/utils/tokens'

export const KIND_TEXT: Record<RequestKind, string> = { deposit: 'Deposit', withdraw: 'Withdraw' }

// A deposit sends the underlying and a withdraw the shares, at either stage.
export const SENT: Record<RequestKind, VaultToken> = { deposit: USDX, withdraw: VSH }
