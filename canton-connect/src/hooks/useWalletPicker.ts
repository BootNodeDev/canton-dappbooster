import type { WalletPickerEntry } from '@canton-network/core-types'
import { useCantonConnectContext } from '../CantonConnectProvider'

export interface UseWalletPickerResult {
  /** True only while `connect()` waits for an answer. */
  isOpen: boolean
  /** The entries the SDK offered; empty when no choice is open. */
  wallets: WalletPickerEntry[]
  /** Answers the pending choice; an id that was never offered rejects the attempt instead. */
  select: (providerId: string) => void
  /** Closes the pending choice; `connect()` rejects with `UserRejectedError`. */
  cancel: () => void
}

/**
 * The pending wallet choice, only in `walletSelection: 'in-page'` mode.
 * Wagmi: `useConnectors`, except the list exists only during a connect attempt.
 */
export const useWalletPicker = (): UseWalletPickerResult => useCantonConnectContext().walletPicker
