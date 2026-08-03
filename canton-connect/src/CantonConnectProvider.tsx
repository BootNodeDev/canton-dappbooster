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
import { clearConnectedWallet, readConnectedWallet, writeConnectedWallet } from './connectedWallet'
import type { CantonConnectConfig, ConnectedWallet, ConnectionStatus, Party } from './types'
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

const CantonConnectContext = createContext<CantonConnectContextValue | undefined>(undefined)

/** Throws if called outside a `CantonConnectProvider`. */
export const useCantonConnectContext = (): CantonConnectContextValue => {
  const ctx = useContext(CantonConnectContext)
  if (ctx === undefined) {
    throw new Error('canton-connect hooks must be used inside a <CantonConnectProvider>')
  }
  return ctx
}

/** Props for {@link CantonConnectProvider}. */
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
        // The CAIP-2 chain must be the configured Canton network id, not the SDK's devnet default.
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

// The SDK awaits the picker's promise; the dApp answers later, so we hold the settle pair.
interface PendingChoice {
  entries: WalletPickerEntry[]
  resolve: (result: WalletPickerResult) => void
  reject: (error: Error) => void
  // The attempt this choice belongs to; cancelling must doom it, not whichever attempt is current.
  owner: AttemptState
}

// Who killed the attempt; connect()'s failure path branches on it.
type CancelSource = 'user' | 'disconnect' | 'unmount'

// Lives on the attempt itself: a late settlement must read its own fate, not a shared flag a
// newer attempt may have replaced. `condemn` settles the caller-facing promise in the one case
// nothing else can: the wallet holds the only pending answer and may never send it.
interface AttemptState {
  cancelledBy: CancelSource | undefined
  condemn: (reason: Error) => void
}

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
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | undefined>(undefined)

  const networkId = config.networkId ?? 'canton:local'

  // undefined means no choice is pending; an open choice offering zero wallets is [].
  const [offeredWallets, setOfferedWallets] = useState<WalletPickerEntry[] | undefined>(undefined)
  const pendingChoiceRef = useRef<PendingChoice | undefined>(undefined)

  // The in-flight connect; a second call joins it, and a cancellation condemns it in place.
  const attemptRef = useRef<{ state: AttemptState; promise: Promise<void> } | undefined>(undefined)

  // What the picker chose, held until the attempt actually lands on that wallet's client.
  const chosenWalletRef = useRef<ConnectedWallet | undefined>(undefined)

  // The sdk memo keys on this; a per-render function would rebuild the SDK every render.
  const inPagePicker = useCallback<WalletPickerFn>((entries) => {
    const attempt = attemptRef.current?.state
    // No live attempt means an abandoned flow reached the picker; a condemned one died already.
    // Either way the choice must die here, not open over the killer's clean slate.
    if (attempt === undefined || attempt.cancelledBy !== undefined) {
      return Promise.reject(new UserRejectedError('Wallet selection cancelled'))
    }

    return new Promise<WalletPickerResult>((resolve, reject) => {
      pendingChoiceRef.current = { entries, resolve, reject, owner: attempt }
      setOfferedWallets(entries)
    })
  }, [])

  const suppliedPicker = config.walletPicker

  // Wraps only to note what the consumer's picker returned; memoized so the sdk memo below holds.
  const notingPicker = useMemo<WalletPickerFn | undefined>(
    () =>
      suppliedPicker === undefined
        ? undefined
        : async (entries) => {
            const result = await suppliedPicker(entries)
            chosenWalletRef.current = { providerId: result.providerId, name: result.name }
            return result
          },
    [suppliedPicker],
  )

  // An explicit picker is a stronger statement of intent than the mode flag.
  const walletPicker =
    notingPicker ?? (config.walletSelection === 'in-page' ? inPagePicker : undefined)

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

  // A client must exist before wiring; this shares that wiring between mount-restore and connect().
  const teardownRef = useRef<(() => void) | undefined>(undefined)

  // The initial read and the accountsChanged push must map identically; one function keeps them so.
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

  // Written on landing, never on selection: an attempt that dies after the choice leaves nothing.
  const rememberChosenWallet = useCallback((): void => {
    const chosen = chosenWalletRef.current
    if (chosen === undefined) {
      return
    }

    writeConnectedWallet(chosen)
    setConnectedWallet(chosen)
  }, [])

  // The record is only ever a label on the SDK's session: no session, no label.
  const forgetConnectedWallet = useCallback((): void => {
    clearConnectedWallet()
    setConnectedWallet(undefined)
  }, [])

  // Rejecting starts connect()'s failure path; the recorded source tells it who owns the aftermath.
  const cancelPending = useCallback((source: CancelSource): void => {
    const pending = pendingChoiceRef.current
    if (pending === undefined) {
      return
    }

    pendingChoiceRef.current = undefined
    pending.owner.cancelledBy = source
    setOfferedWallets(undefined)
    pending.reject(new UserRejectedError('Wallet selection cancelled'))
  }, [])

  // Kills the whole attempt: rejects an open choice now, condemns one not yet opened or already
  // answered. Condemning settles the caller's promise even when the wallet never answers.
  const cancelAttempt = useCallback(
    (source: CancelSource): void => {
      const attempt = attemptRef.current
      if (attempt !== undefined) {
        attempt.state.cancelledBy = source
        attempt.state.condemn(
          new UserRejectedError(
            pendingChoiceRef.current === undefined
              ? 'Connect attempt cancelled'
              : 'Wallet selection cancelled',
          ),
        )
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

      // A restored session has no chosen wallet in memory; the record is the only source.
      if (chosenWalletRef.current === undefined) {
        setConnectedWallet(readConnectedWallet())
      }

      if (!restored.connection.isConnected) {
        // A real landing on the chosen wallet's client, just locked — the record must become it.
        markConnectedLocked()
        rememberChosenWallet()
        return
      }

      try {
        const accounts = await sdk.listAccounts()
        markConnected(accounts)
        rememberChosenWallet()
      } catch (err) {
        // Left wired, the next push would set a party on a disconnected provider.
        teardownWiring()
        resetToDisconnected(err as Error)
        forgetConnectedWallet()
      }
    },
    [
      sdk,
      markConnected,
      markConnectedLocked,
      resetToDisconnected,
      rememberChosenWallet,
      forgetConnectedWallet,
      teardownWiring,
      wireEvents,
    ],
  )

  // The instance the mount effect last initialized; a different one arriving marks a replacement.
  const initializedSdkRef = useRef<DappSDK | undefined>(undefined)

  // Mirror for the mount effect: status in its deps would re-init the SDK on every change.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    let cancelled = false

    // StrictMode re-runs this effect on the same instance; only a different instance is a replacement.
    const isReplacementInstance =
      initializedSdkRef.current !== undefined && initializedSdkRef.current !== sdk
    initializedSdkRef.current = sdk

    // defaultAdapters: [] keeps the SDK's bundled localhost dev gateway out of the picker.
    void sdk
      .init({ additionalAdapters, defaultAdapters: [] })
      .then(async () => {
        if (cancelled) {
          return
        }

        // status() throws when there's nothing to restore — that's normal, not an error.
        const restored = await sdk.status().catch(() => undefined)
        if (cancelled) {
          return
        }

        // An attempt in flight owns the outcome; a restore landing now must not write beneath it.
        if (attemptRef.current !== undefined) {
          return
        }

        // The SDK's session is the authority; a record it no longer backs is deleted, not trusted.
        if (restored === undefined) {
          // A replacement that restores nothing must shed its predecessor's state; idle has none to shed.
          if (isReplacementInstance && statusRef.current !== 'idle') {
            resetToDisconnected()
          }

          forgetConnectedWallet()
          return
        }

        await syncFromStatus(restored)
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return
        }

        // Only init() can land here — syncFromStatus never throws — so nothing was wired or set yet.
        resetToDisconnected(err as Error)
      })

    return () => {
      cancelled = true
      cancelAttempt('unmount')
      teardownWiring()
    }
  }, [
    sdk,
    additionalAdapters,
    syncFromStatus,
    teardownWiring,
    cancelAttempt,
    resetToDisconnected,
    forgetConnectedWallet,
  ])

  const runConnect = useCallback(
    async (attempt: AttemptState): Promise<void> => {
      setStatus('connecting')
      setConnectError(undefined)

      // Remove listeners from the current client before connect() swaps in a new one.
      teardownWiring()

      try {
        const result = await sdk.connect() // opens the picker
        // A condemned attempt may still get the wallet's answer later; it owns no state by then.
        if (attempt.cancelledBy !== undefined) {
          throw new UserRejectedError('Connect attempt cancelled')
        }

        if (!result.isConnected) {
          throw new Error(result.reason ?? 'Wallet did not connect')
        }

        teardownRef.current = wireEvents()

        const accounts = await sdk.listAccounts()
        if (attempt.cancelledBy !== undefined) {
          teardownWiring()
          throw new UserRejectedError('Connect attempt cancelled')
        }

        markConnected(accounts)
        rememberChosenWallet()
      } catch (err) {
        // A disconnect or an unmount owns the end state; recovery here would overwrite it a tick later.
        const killedByOwner = (): boolean =>
          attempt.cancelledBy === 'disconnect' || attempt.cancelledBy === 'unmount'

        if (killedByOwner()) {
          throw err
        }

        // A cancelled picker fails before the client swap — probe, don't assume the session is gone.
        const restored = await sdk.status().catch(() => undefined)

        // The probe is an await too: an owner landing during it wins over the recovery.
        if (killedByOwner()) {
          throw err
        }

        if (restored === undefined) {
          // The try may have wired the swapped-in client; a vanished session must not keep listeners.
          teardownWiring()
          resetToDisconnected()
          forgetConnectedWallet()
        } else {
          await syncFromStatus(restored)

          if (killedByOwner()) {
            // syncFromStatus re-wired and re-marked; give the owner back its slate.
            teardownWiring()
            resetToDisconnected()
            forgetConnectedWallet()
            throw err
          }
        }

        // Recorded after recovery so a failed recovery read cannot replace the error the caller catches.
        setConnectError(err as Error)
        throw err
      }
    },
    [
      sdk,
      markConnected,
      resetToDisconnected,
      rememberChosenWallet,
      forgetConnectedWallet,
      syncFromStatus,
      teardownWiring,
      wireEvents,
    ],
  )

  // Not async: re-wrapping the shared promise would make a fire-and-forget join reject unhandled.
  const connect = useCallback((): Promise<void> => {
    const inFlight = attemptRef.current
    if (inFlight !== undefined) {
      return inFlight.promise
    }

    // Deferred so cancelAttempt can settle the attempt when only the wallet could, and it never does.
    let condemn: (reason: Error) => void = () => undefined
    const condemnation = new Promise<never>((_, reject) => {
      condemn = reject
    })

    const state: AttemptState = { cancelledBy: undefined, condemn }

    // The guards in runConnect keep a condemned attempt from writing state; its own rejection
    // still needs a handler once the race has already settled without it.
    const inner = runConnect(state)
    void inner.catch(() => undefined)

    const attempt = Promise.race([inner, condemnation]).finally(() => {
      // Only the current attempt cleans up; one settling late must not evict its successor.
      if (attemptRef.current?.state === state) {
        attemptRef.current = undefined
        chosenWalletRef.current = undefined
      }
    })
    attemptRef.current = { state, promise: attempt }

    // One handler is always attached, so ignoring the promise cannot leak an unhandled rejection.
    void attempt.catch(() => undefined)

    return attempt
  }, [runConnect])

  const disconnect = useCallback(async (): Promise<void> => {
    cancelAttempt('disconnect')

    // Settles now even when the wallet never answers — cancelAttempt condemned it above.
    await attemptRef.current?.promise.catch(() => undefined)

    teardownWiring()

    await sdk.disconnect().catch(() => undefined)

    resetToDisconnected()
    forgetConnectedWallet()
    setLastTx(undefined)
  }, [sdk, cancelAttempt, resetToDisconnected, forgetConnectedWallet, teardownWiring])

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

    // Noted, not persisted: only an attempt that lands turns the choice into the record.
    chosenWalletRef.current = { providerId: entry.providerId, name: entry.name }

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
      wallet: connectedWallet,
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
      connectedWallet,
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
