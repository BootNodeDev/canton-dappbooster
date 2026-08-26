// CantonConnectProvider owns the wallet connection lifecycle and publishes the actor that holds
// it. Hooks (useConnect, useParty, useSignMessage, etc.) select their own slice off that actor.

import { DappSDK } from '@canton-network/dapp-sdk'
import { createContext, type JSX, type ReactNode, useCallback, useContext, useMemo } from 'react'
import { buildAdditionalAdapters } from '#src/CantonConnectProvider/adapters'
import { useConnectBridge } from '#src/CantonConnectProvider/useConnectBridge'
import { useConnectionActor } from '#src/CantonConnectProvider/useConnectionActor'
import { useDisconnectBridge } from '#src/CantonConnectProvider/useDisconnectBridge'
import type { CantonConnectConfig, CantonConnectContextValue } from '#src/types'

// Exported for src/testing's session double only; consumers reach it through the hooks.
export const CantonConnectContext = createContext<CantonConnectContextValue | undefined>(undefined)

/**
 * The whole context in one read, and the escape hatch behind every other hook here. Reach for a
 * narrower hook unless a component needs several slices at once; this one hands back the config,
 * the connection to select off, and the three actions.
 *
 * @throws with no {@link CantonConnectProvider} above it.
 *
 * @example
 * const { config, connection } = useCantonConnectContext()
 * const snapshot = connection.getSnapshot()
 *
 * @category Hooks
 */
export const useCantonConnectContext = (): CantonConnectContextValue => {
  const ctx = useContext(CantonConnectContext)
  if (ctx === undefined) {
    throw new Error('canton-connect hooks must be used inside a <CantonConnectProvider>')
  }
  return ctx
}

/**
 * Props for {@link CantonConnectProvider}. `config` is read once, when the connection actor is
 * created: a `walletPicker` or `additionalAdapters` swapped later reaches `config` on the context,
 * never the connection, which keeps the adapters it booted with. Pass the final values first.
 *
 * @example
 * <CantonConnectProvider config={{ appName: 'Vesting' }}>{children}</CantonConnectProvider>
 *
 * @category Components
 */
export interface CantonConnectProviderProps {
  config: CantonConnectConfig
  children: ReactNode
}

/**
 * Hands the connection machine what it needs to build its own `DappSDK`, and publishes the actor
 * that goes through the states, plus the two bridges that drive it. Nothing here selects: a
 * provider that pre-selected the whole session re-rendered every consumer on every tick of it.
 * The hooks mirror wagmi's naming, not its TanStack Query result shapes.
 *
 * @example
 * <CantonConnectProvider config={{ appName: 'Vesting', networkId: 'canton:local' }}>
 *   <App />
 * </CantonConnectProvider>
 *
 * @category Components
 */
export const CantonConnectProvider = ({
  config,
  children,
}: CantonConnectProviderProps): JSX.Element => {
  const networkId = config.networkId ?? 'canton:local'

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

  const actorRef = useConnectionActor({
    createSdk: () => new DappSDK({ walletPicker: config.walletPicker }),
    initOptions: { additionalAdapters },
    // A consumer's own picker owns its lifecycle, and guardedConnect would borrow window.open
    // watching for a popup that never opens.
    guardPicker: config.walletPicker === undefined,
    networkId,
  })

  const resetConnectError = useCallback(
    () => actorRef.send({ type: 'connectError.reset' }),
    [actorRef],
  )

  const connect = useConnectBridge(actorRef)
  const disconnect = useDisconnectBridge(actorRef)

  const value = useMemo<CantonConnectContextValue>(
    () => ({
      config,
      connection: actorRef,
      connect,
      disconnect,
      resetConnectError,
    }),
    [config, actorRef, connect, disconnect, resetConnectError],
  )

  return <CantonConnectContext.Provider value={value}>{children}</CantonConnectContext.Provider>
}
