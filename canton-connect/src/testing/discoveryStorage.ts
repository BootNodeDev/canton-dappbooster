// The SDK's localStorage footprint, so suites can seed a restorable session and
// leave nothing behind for the next file's tests.

const KERNEL_DISCOVERY_KEY = 'splice_wallet_kernel_discovery'
const DISCOVERY_SESSION_KEY = 'splice_discovery_client_session'
const SUGGESTED_ENTRIES_KEY = 'splice_wallet_picker_suggested_entries'
const RECENT_GATEWAYS_KEY = 'splice_wallet_picker_recent'

/** Mirrors what a real connect() persists to localStorage, so init() takes the restore path. */
export const persistRestorableSession = (providerId: string): void => {
  localStorage.setItem(
    KERNEL_DISCOVERY_KEY,
    JSON.stringify({ walletType: 'extension', providerId }),
  )
  localStorage.setItem(DISCOVERY_SESSION_KEY, JSON.stringify({ providerId }))
}

/** Removes every SDK key, the two only the SDK itself writes included. */
export const clearDiscoveryStorage = (): void => {
  localStorage.removeItem(KERNEL_DISCOVERY_KEY)
  localStorage.removeItem(DISCOVERY_SESSION_KEY)
  localStorage.removeItem(SUGGESTED_ENTRIES_KEY)
  localStorage.removeItem(RECENT_GATEWAYS_KEY)
}
