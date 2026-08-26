import type { WalletPickerFn } from '@canton-network/dapp-sdk'

/** A picker a test can call connect() with when it never intends to succeed. */
export const throwingPicker: WalletPickerFn = async () => {
  throw new Error('cancel')
}
