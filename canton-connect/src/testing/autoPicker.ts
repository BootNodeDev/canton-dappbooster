import type { WalletPickerFn } from '@canton-network/dapp-sdk'

// Headless picker for tests/dev: select by providerId, or the first entry.
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
