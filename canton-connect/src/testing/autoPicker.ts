import type { WalletPickerFn } from '@canton-network/dapp-sdk'

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
