// CantonConnectProvider owns the wallet connection lifecycle and exposes it
// through React context. Hooks (useConnect, useParty, useSignMessage, etc.)
// are thin readers that subscribe to this context.

import type { WalletPickerEntry, WalletPickerResult } from '@canton-network/core-types'
import type {
  AccountsChangedEvent,
  ProviderAdapter,
  StatusEvent,
  TxChangedEvent,
  WalletPickerFn,
} from '@canton-network/dapp-sdk'
import { DappSDK, UserRejectedError, WalletConnectAdapter } from '@canton-network/dapp-sdk'
import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CantonConnectConfig, ConnectionStatus, Party } from './types'
import { toParties } from './walletAccount'

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
  status: ConnectionStatus
  /** Connected-but-locked: a session exists, but must be unlocked to serve requests. */
  isLocked: boolean
  connectError: Error | undefined
  isConnecting: boolean
  lastTx: TxStatusSnapshot | undefined
  /**
  /** The pending wallet choice, only ever open in `walletSelection: 'in-page'` mode. */
  walletPicker: {
    isOpen: boolean
    wallets: WalletPickerEntry[]
    select: (providerId: string) => void
    cancel: () => void
  }
  /**
   * Opens the picker: the SDK's popup, or `config.walletPicker`. Rejects on cancel, on
   * failure, or when a `disconnect()` or unmount kills the attempt. Idempotent while an
   * attempt is in flight: a second call joins the first.
   */
  connect: () => Promise<void>
  /** Cancels a pending choice, waits for an in-flight connect, then resets local state. */
  disconnect: () => Promise<void>
}

const CantonConnectContext = createContext<CantonConnectContextValue | undefined>(undefined)

/** Throws if called outside a `CantonConnectProvider`. */
export const useCantonConnectContext = (): CantonConnectContextValue => {
  const ctx = useContext(CantonConnectContext)
  if (ctx === undefined) {
    throw new Error('canton-connect hooks must be used inside a <CantonConnectProvider>')
  }
  return ctx
}

export interface CantonConnectProviderProps {
  config: CantonConnectConfig
  children: ReactNode
}

type AdapterConfig = Pick<
  CantonConnectConfig,
  'appName' | 'appDescription' | 'appUrl' | 'walletConnectProjectId' | 'additionalAdapters'
>

const buildAdditionalAdapters = (config: AdapterConfig, networkId: string): ProviderAdapter[] => {
  const adapters: ProviderAdapter[] = [...(config.additionalAdapters ?? [])]

  if (config.walletConnectProjectId !== undefined && config.walletConnectProjectId !== '') {
    adapters.push(
      WalletConnectAdapter.create({
        projectId: config.walletConnectProjectId,
        // The CAIP-2 chain the wallet must serve is the configured Canton network id, not the SDK's devnet default.
        chainId: networkId,
        metadata: {
          name: config.appName,
          description: config.appDescription ?? config.appName,
          url: config.appUrl ?? (typeof window === 'undefined' ? '' : window.location.origin),
          icons: [],
        },
      }),
    )
  }

  return adapters
}

// The SDK awaits the picker's promise; the dApp answers later, so we keep the settle pair, not the promise.
interface PendingChoice {
  entries: WalletPickerEntry[]
  resolve: (result: WalletPickerResult) => void
  reject: (error: Error) => void
}

// Who killed the attempt; connect()'s failure path branches on it.
type CancelSource = 'user' | 'disconnect' | 'unmount'

// Stable identity, so a closed picker never churns consumers' memos.
const NO_OFFERED_WALLETS: WalletPickerEntry[] = []

/**
 * Owns the connection lifecycle: creates the `DappSDK` from `config`, restores a previous
 * session on mount, and wires wallet-pushed events into the state the hooks read.
 * Those hooks mirror wagmi's naming, not its TanStack Query result shapes.
 */
export const CantonConnectProvider = ({
  config,
  children,
}: CantonConnectProviderProps): JSX.Element => {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [party, setParty] = useState<Party | undefined>(undefined)
  const [parties, setParties] = useState<Party[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const [lastTx, setLastTx] = useState<TxStatusSnapshot | undefined>(undefined)
  const [connectError, setConnectError] = useState<Error | undefined>(undefined)

  const networkId = config.networkId ?? 'canton:local'

  // The in-page selection bridge: undefined means no choice is pending, even one offering zero wallets.
  const [offeredWallets, setOfferedWallets] = useState<WalletPickerEntry[] | undefined>(undefined)
  const pendingChoiceRef = useRef<PendingChoice | undefined>(undefined)

  // Set while a cancellation is killing the attempt; only a user cancel may run the failure path's recovery.
  const cancelSourceRef = useRef<CancelSource | undefined>(undefined)

  // Stable identity: the sdk memo keys on it, so a per-render function would rebuild the SDK every render.
  const inPagePicker = useCallback<WalletPickerFn>((entries) => {
    // A choice arriving while a disconnect or unmount kills the attempt must die with it, not pend.
    if (cancelSourceRef.current !== undefined) {
      return Promise.reject(new UserRejectedError('Wallet selection cancelled'))
    }

    return new Promise<WalletPickerResult>((resolve, reject) => {
      pendingChoiceRef.current = { entries, resolve, reject }
      setOfferedWallets(entries)
    })
  }, [])

  // An explicit picker is a stronger statement of intent than the mode flag.
  const walletPicker =
    config.walletPicker ?? (config.walletSelection === 'in-page' ? inPagePicker : undefined)

  const sdk = useMemo(() => new DappSDK(walletPicker ? { walletPicker } : {}), [walletPicker])

  const additionalAdapters = useMemo(
    () =>
      buildAdditionalAdapters(
        {
          appName: config.appName,
          appDescription: config.appDescription,
          appUrl: config.appUrl,
          walletConnectProjectId: config.walletConnectProjectId,
          additionalAdapters: config.additionalAdapters,
        },
        networkId,
      ),
    [
      config.appName,
      config.appDescription,
      config.appUrl,
      config.walletConnectProjectId,
      config.additionalAdapters,
      networkId,
    ],
  )

  // A client must exist before wiring; teardownRef shares that wiring between mount-restore and connect().
  const teardownRef = useRef<(() => void) | undefined>(undefined)

  // The in-flight connect; a second call joins it instead of starting a rival attempt.
  const attemptRef = useRef<Promise<void> | undefined>(undefined)

  // The initial read and the accountsChanged push are two doors into the same state; one mapping keeps them from drifting.
  const applyAccounts = useCallback(
    (accounts: AccountsChangedEvent): void => {
      const mapped = toParties(accounts, networkId)
      setParties(mapped)
      setParty(mapped[0])
    },
    [networkId],
  )

  const wireEvents = useCallback((): (() => void) => {
    const onAccounts = (accounts: AccountsChangedEvent): void => {
      applyAccounts(accounts)
    }
    const onStatus = (event: StatusEvent): void => {
      setIsLocked(!event.connection.isConnected)
    }
    const onTx = (event: TxChangedEvent): void => {
      setLastTx({
        status: event.status,
        commandId: event.commandId,
        payload: 'payload' in event ? event.payload : undefined,
      })
    }

    void sdk.onAccountsChanged(onAccounts).catch(() => undefined)
    void sdk.onStatusChanged(onStatus).catch(() => undefined)
    void sdk.onTxChanged(onTx).catch(() => undefined)

    return () => {
      void sdk.removeOnAccountsChanged(onAccounts).catch(() => undefined)
      void sdk.removeOnStatusChanged(onStatus).catch(() => undefined)
      void sdk.removeOnTxChanged(onTx).catch(() => undefined)
    }
  }, [sdk, applyAccounts])

  const teardownWiring = useCallback((): void => {
    teardownRef.current?.()
    teardownRef.current = undefined
  }, [])

  // Connected but locked: the session exists, its accounts are unreadable until the unlock push.
  const markConnectedLocked = useCallback((): void => {
    setParty(undefined)
    setParties([])
    setIsLocked(true)
    setStatus('connected')
  }, [])

  // An account read only succeeds against an unlocked wallet.
  const markConnected = useCallback(
    (accounts: AccountsChangedEvent): void => {
      applyAccounts(accounts)
      setIsLocked(false)
      setStatus('connected')
    },
    [applyAccounts],
  )

  // Disconnected is a clean slate: connectError becomes exactly the reason given, or nothing.
  const resetToDisconnected = useCallback((error?: Error): void => {
    setParty(undefined)
    setParties([])
    setIsLocked(false)
    setConnectError(error)
    setStatus('disconnected')
  }, [])

  // Rejecting starts the in-flight connect()'s failure path; the recorded source tells it who owns the aftermath.
  const cancelPending = useCallback((source: CancelSource): void => {
    const pending = pendingChoiceRef.current
    if (pending === undefined) {
      return
    }

    pendingChoiceRef.current = undefined
    cancelSourceRef.current = source
    setOfferedWallets(undefined)
    pending.reject(new UserRejectedError('Wallet selection cancelled'))
  }, [])

  // Kills the whole attempt: rejects an open choice now, and condemns one that has not opened yet.
  const cancelAttempt = useCallback(
    (source: CancelSource): void => {
      if (attemptRef.current !== undefined) {
        cancelSourceRef.current = source
      }

      cancelPending(source)
    },
    [cancelPending],
  )

  // Never throws: a failed read is contained here, so connect()'s catch keeps its original error.
  const syncFromStatus = useCallback(
    async (restored: StatusEvent): Promise<void> => {
      // Wire events regardless of lock state so a later unlock push isn't dropped silently.
      if (teardownRef.current === undefined) {
        teardownRef.current = wireEvents()
      }

      if (!restored.connection.isConnected) {
        markConnectedLocked()
        return
      }

      try {
        const accounts = await sdk.listAccounts()
        markConnected(accounts)
      } catch (err) {
        // Left wired, the next push would set a party on a disconnected provider.
        teardownWiring()
        resetToDisconnected(err as Error)
      }
    },
    [sdk, markConnected, markConnectedLocked, resetToDisconnected, teardownWiring, wireEvents],
  )

  useEffect(() => {
    let cancelled = false

    // defaultAdapters: [] keeps the SDK's bundled localhost dev gateway out of the picker.
    void sdk
      .init({ additionalAdapters, defaultAdapters: [] })
      .then(async () => {
        if (cancelled) return

        // status() throws when there's nothing to restore — that's normal, not an error.
        const restored = await sdk.status().catch(() => undefined)
        if (cancelled || restored === undefined) return

        await syncFromStatus(restored)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        // Only init() can land here — syncFromStatus never throws — so nothing was wired or set yet.
        resetToDisconnected(err as Error)
      })

    return () => {
      cancelled = true
      cancelAttempt('unmount')
      teardownWiring()
    }
  }, [sdk, additionalAdapters, syncFromStatus, teardownWiring, cancelAttempt, resetToDisconnected])

  const runConnect = useCallback(async (): Promise<void> => {
    setStatus('connecting')
    setConnectError(undefined)

    // Remove listeners from the current client before connect() swaps in a new one.
    teardownWiring()

    try {
      const result = await sdk.connect() // opens the picker
      if (!result.isConnected) {
        throw new Error(result.reason ?? 'Wallet did not connect')
      }

      teardownRef.current = wireEvents()

      const accounts = await sdk.listAccounts()
      markConnected(accounts)
    } catch (err) {
      const cancelledBy = cancelSourceRef.current
      cancelSourceRef.current = undefined

      // A disconnect or an unmount owns the end state; recovery here would overwrite it a tick later.
      if (cancelledBy === 'disconnect' || cancelledBy === 'unmount') {
        throw err
      }

      // A cancelled picker fails before the SDK swaps its client — probe rather than assume a previous session is gone.
      const restored = await sdk.status().catch(() => undefined)

      if (restored === undefined) {
        // The try above may have wired the swapped-in client; a vanished session must not keep listeners live.
        teardownWiring()
        resetToDisconnected()
      } else {
        await syncFromStatus(restored)
      }

      // Recorded after recovery so a failed recovery read cannot replace the error the caller catches.
      setConnectError(err as Error)
      throw err
    }
  }, [sdk, markConnected, resetToDisconnected, syncFromStatus, teardownWiring, wireEvents])

  // Not async: an async wrapper re-wraps the shared promise per caller, and a fire-and-forget join would then reject unhandled.
  const connect = useCallback((): Promise<void> => {
    const inFlight = attemptRef.current
    if (inFlight !== undefined) {
      return inFlight
    }

    const attempt = runConnect().finally(() => {
      attemptRef.current = undefined
      // A condemned source outliving its settled attempt would wrongly mute the next attempt's recovery.
      cancelSourceRef.current = undefined
    })
    attemptRef.current = attempt

    // One handler always attached, so a caller that ignores the promise cannot cause an unhandled rejection.
    void attempt.catch(() => undefined)

    return attempt
  }, [runConnect])

  const disconnect = useCallback(async (): Promise<void> => {
    cancelAttempt('disconnect')

    // The dying attempt must settle before the reset below, or its failure path races it.
    await attemptRef.current?.catch(() => undefined)

    teardownWiring()

    await sdk.disconnect().catch(() => undefined)

    resetToDisconnected()
    setLastTx(undefined)
  }, [sdk, cancelAttempt, resetToDisconnected, teardownWiring])

  const select = useCallback((providerId: string): void => {
    const pending = pendingChoiceRef.current
    if (pending === undefined) {
      return
    }

    const entry = pending.entries.find((candidate) => candidate.providerId === providerId)

    pendingChoiceRef.current = undefined
    setOfferedWallets(undefined)

    if (entry === undefined) {
      // A consumer bug, not a user action — labelling it a cancellation would hide it.
      pending.reject(new Error(`canton-connect: no offered wallet with providerId ${providerId}`))
      return
    }

    // An entry structurally satisfies WalletPickerResult, so the chosen one is the answer.
    pending.resolve(entry)
  }, [])

  const cancel = useCallback((): void => {
    cancelPending('user')
  }, [cancelPending])

  const value = useMemo<CantonConnectContextValue>(
    () => ({
      config,
      sdk,
      party,
      parties,
      status,
      isLocked,
      connectError,
      isConnecting: status === 'connecting',
      lastTx,
      walletPicker: {
        // Derived from state, not the ref: a ref mutation would not re-render consumers.
        isOpen: offeredWallets !== undefined,
        wallets: offeredWallets ?? NO_OFFERED_WALLETS,
        select,
        cancel,
      },
      connect,
      disconnect,
    }),
    [
      config,
      sdk,
      party,
      parties,
      status,
      isLocked,
      connectError,
      lastTx,
      offeredWallets,
      select,
      cancel,
      connect,
      disconnect,
    ],
  )

  return <CantonConnectContext.Provider value={value}>{children}</CantonConnectContext.Provider>
}
