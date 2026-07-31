import type { VestingBackend } from '@/backend/VestingBackend'
import { useWalletContext } from '@/providers/WalletProvider'

// Hands the store whichever backend the provider resolved, mock or live.
export const useBackend = (): VestingBackend => useWalletContext().backend
