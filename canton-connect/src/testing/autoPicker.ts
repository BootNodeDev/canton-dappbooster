import type { WalletPickerFn } from '@canton-network/dapp-sdk'

/**
 * Creates a `WalletPickerFn` that selects without a UI — pass it as
 * `CantonConnectConfig.walletPicker` to drive `connect()` in tests or headless
 * dev flows. Selects the entry whose `providerId` matches `pick`, or the
 * first discovered entry when `pick` is omitted. Throws if no entry matches.
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
