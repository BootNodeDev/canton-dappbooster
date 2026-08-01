// Which wallet the SDK's session belongs to. The SDK discards the session's provider id on
// restore, so this label is kept here — only ever a label, deleted whenever no session backs it.

import type { ConnectedWallet } from './types'

const STORAGE_KEY = 'canton-connect:connected-wallet'

const isConnectedWallet = (value: unknown): value is ConnectedWallet =>
  typeof value === 'object' &&
  value !== null &&
  'providerId' in value &&
  typeof value.providerId === 'string' &&
  'name' in value &&
  typeof value.name === 'string'

/** The remembered wallet; a missing, corrupt, or partial record reads as `undefined`, never a throw. */
export const readConnectedWallet = (): ConnectedWallet | undefined => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return isConnectedWallet(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** Remembers `wallet` as the one the current session belongs to. */
export const writeConnectedWallet = (wallet: ConnectedWallet): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet))
}

/** Deletes the record; call whenever the session it labelled is gone. */
export const clearConnectedWallet = (): void => {
  localStorage.removeItem(STORAGE_KEY)
}
