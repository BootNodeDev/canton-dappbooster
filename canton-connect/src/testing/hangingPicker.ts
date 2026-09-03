import type { WalletPickerFn } from '@canton-network/dapp-sdk'

/** For the wallet that takes a connect and goes quiet. */
export const hangingPicker: WalletPickerFn = () => new Promise(() => {})
