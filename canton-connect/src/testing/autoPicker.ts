import type { WalletPickerFn } from '@canton-network/dapp-sdk'

/**
 * A `walletPicker` that selects with no UI, for tests and headless dev flows: the entry whose
 * `providerId` matches `pick`, or the first discovered one.
 *
 * @throws when no discovered entry matches `pick`, so a test naming a wallet that never registered
 * fails at the picker rather than at the connect.
 *
 * @example
 * const config = { appName: 'Vesting', walletPicker: createAutoPicker('mock') }
 *
 * @category Utilities
 */
export const createAutoPicker =
  (pick?: string): WalletPickerFn =>
  async (entries) => {
    const chosen =
      pick === undefined ? entries[0] : entries.find((entry) => entry.providerId === pick)

    if (chosen === undefined) {
      throw new Error(`auto-picker: no wallet matching ${pick ?? '(first)'}`)
    }

    return chosen
  }
