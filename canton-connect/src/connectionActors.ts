import type { DappSDK, StatusEvent } from '@canton-network/dapp-sdk'
import { fromCallback, fromPromise } from 'xstate'
import type { WalletStatusUpdate } from '#src/connectionMachine'
import { guardedConnect } from '#src/guardedConnect'

// DappSDKConnectOptions is not exported from the package index; derived until it is
type InitOptions = NonNullable<Parameters<DappSDK['init']>[0]>

export const createConnectionActors = (
  sdk: Pick<DappSDK, 'connect' | 'init' | 'status' | 'onStatusChanged' | 'removeOnStatusChanged'>,
  options: InitOptions = {},
) => {
  let initialization: Promise<void> | undefined

  // SDK's `defaultAdapters` include a localhost dev gateway; override them
  // connect() inits with no options internally, so only an early options-carrying init registers the caller's adapters
  const ensureInit = () => {
    if (!initialization) {
      initialization = sdk.init({ defaultAdapters: [], ...options }).catch((error) => {
        initialization = undefined
        throw error
      })
    }

    return initialization
  }

  return {
    // init + the status check stay inside `connect`, not as machine states
    // the chart would grow just to relocate tested behavior
    connect: fromPromise<WalletStatusUpdate>(async () => {
      await ensureInit()

      try {
        return {
          connection: await guardedConnect(sdk),
        }
      } catch (error) {
        // a crashed connect may have left the previous session alive
        // check before failing
        const status = await sdk
          .status()
          // a dead check proves nothing
          // original error will be the answer
          .catch(() => null)

        if (status?.connection.isConnected) {
          return {
            connection: status.connection,
            session: status.session,
          }
        }

        throw error
      }
    }),
    init: fromPromise(ensureInit),
    restore: fromPromise<WalletStatusUpdate>(async () => {
      const { connection, session } = await sdk.status()

      return { connection, session }
    }),
    walletEvents: fromCallback(({ sendBack }) => {
      const listener = ({ connection, session }: StatusEvent) => {
        sendBack({ type: 'wallet.statusChanged', status: { connection, session } })
      }

      void sdk.onStatusChanged(listener).catch(() => {})

      return () => {
        void sdk.removeOnStatusChanged(listener).catch(() => {})
      }
    }),
  }
}
