import type { WalletPickerEntry } from '@canton-network/core-types'
import type {
  DappSDK,
  ProviderAdapter,
  TxChangedEvent,
  WalletPickerFn,
} from '@canton-network/dapp-sdk'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

/** The connected account, normalized from the wallet's CIP-0103 account entry. */
export interface Party {
  partyId: string
  /** The wallet's own network id, or `CantonConnectConfig.networkId` when it reports none. */
  networkId: string
  name?: string
  publicKey?: string
}

/**
 * The wallet a session belongs to, noted when it was chosen. Popup mode reports
 * none: the SDK never says which wallet its own UI selected.
 */
export interface ConnectedWallet {
  providerId: string
  name: string
}

export interface CantonConnectConfig {
  /** WalletConnect pairing metadata only, so it is inert without `walletConnectProjectId`. */
  appName: string
  /** Falls back to `appName`. */
  appDescription?: string
  /** Defaults to `window.location.origin`. */
  appUrl?: string
  /** Defaults to `'canton:local'`; also the WalletConnect chain id, so pairing follows it. */
  networkId?: string
  /** Reown project id. Without it, no WalletConnect entry is offered in the picker. */
  walletConnectProjectId?: string
  /**
   * Where the user chooses a wallet. `'in-page'` hands the choice to your UI:
   * `useWalletPicker()` reports the offered wallets while `connect()` waits. That
   * list exists only during an attempt — wallets cannot be listed before one.
   */
  walletSelection?: 'popup' | 'in-page'
  /** Omit for the SDK's built-in popup picker. Wins over `walletSelection`. */
  walletPicker?: WalletPickerFn
  /** Registered alongside the discovered ones, e.g. `createMockAdapter()` in dev/test. */
  additionalAdapters?: ProviderAdapter[]
}

/**
 * Mirrored from the SDK's `txChanged` event as a command moves through
 * pending, signed, executed or failed.
 */
export interface TxStatusSnapshot {
  status: TxChangedEvent['status']
  commandId: TxChangedEvent['commandId']
  payload?: unknown
}

/**
 * The full connection state and actions behind every hook in this package.
 * Prefer the narrower hooks (`useConnect`, `useParty`, …); each picks a slice of this.
 */
export interface CantonConnectContextValue {
  config: CantonConnectConfig
  /** One per `CantonConnectProvider`, recreated only when the effective picker changes. */
  sdk: DappSDK
  party: Party | undefined
  /** Every usable party the wallet holds, primary first. `party` is always `parties[0]`. */
  parties: Party[]
  /**
   * The wallet this session belongs to, remembered across page reloads.
   * `undefined` in the default popup mode by design — the SDK never reports
   * which wallet its own popup selected, and observing that would mean
   * depending on the SDK's UI bundle.
   */
  wallet: ConnectedWallet | undefined
  status: ConnectionStatus
  /** Connected-but-locked: a session exists, but must be unlocked to serve requests. */
  isLocked: boolean
  connectError: Error | undefined
  isConnecting: boolean
  lastTx: TxStatusSnapshot | undefined
  /** The pending wallet choice, only ever open in `walletSelection: 'in-page'` mode. */
  walletPicker: {
    isOpen: boolean
    wallets: WalletPickerEntry[]
    select: (providerId: string) => void
    cancel: () => void
  }
  /**
   * Opens the wallet choice (the SDK's popup, `config.walletPicker`, or the in-page bridge
   * when `walletSelection: 'in-page'`) and connects the answer. Rejects on cancel, on
   * failure, or when a `disconnect()` or unmount kills the attempt. Idempotent while an
   * attempt is in flight: a second call joins the first.
   */
  connect: () => Promise<void>
  /**
   * Cancels a pending choice, settles an in-flight connect (even one a silent wallet would
   * never settle), then resets local state.
   */
  disconnect: () => Promise<void>
}
