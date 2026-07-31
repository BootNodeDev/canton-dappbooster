import type { WalletPickerEntry } from '@canton-network/core-types'
import { useCantonConnectContext } from '../CantonConnectProvider'

/** Return value of `useWalletPicker`. */
export interface UseWalletPickerResult {
  /** True only while `connect()` waits for an answer. */
  isOpen: boolean
  /**
   * The entries the SDK offered. Empty when no choice is open — there is no
   * way to list wallets before a connect attempt is running.
   */
  wallets: WalletPickerEntry[]
  /**
   * Answers the pending choice with the offered entry whose `providerId`
   * matches; an id that was never offered rejects the connect attempt instead.
   */
  select: (providerId: string) => void
  /** Closes the pending choice; `connect()` rejects with `UserRejectedError`. */
  cancel: () => void
}

/**
 * The pending wallet choice while `connect()` waits, for dApps that set
 * `walletSelection: 'in-page'` and draw the chooser themselves. Never opens
 * in the default popup mode, nor for a dApp that supplies its own
 * `walletPicker` — there, that function owns the interaction.
 *
 * Wagmi counterpart: `useConnectors`, except the offered list exists only
 * while a connect attempt is running — the SDK builds it inside `connect()`
 * and exposes it nowhere else.
 */
export const useWalletPicker = (): UseWalletPickerResult => useCantonConnectContext().walletPicker
