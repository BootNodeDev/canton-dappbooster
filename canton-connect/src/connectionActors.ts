import type { DappSDK, StatusEvent } from '@canton-network/dapp-sdk'
import { fromCallback, fromPromise } from 'xstate'
import type { WalletStatus } from './connectionMachine'

type InitOptions = NonNullable<Parameters<DappSDK['init']>[0]>

export const createConnectionActors = (
  sdk: Pick<DappSDK, 'connect' | 'init' | 'status' | 'onStatusChanged' | 'removeOnStatusChanged'>,
  options: InitOptions = {},
) => {
  // SDK's `defaultAdapters` include a localhost dev gateway; override them
  // connect() inits with no options internally, so only an early options-carrying init registers the caller's adapters
  const ensureInit = () => sdk.init({ defaultAdapters: [], ...options })

  return {
    connect: fromPromise(async () => {
      await ensureInit()

      try {
        return await sdk.connect()
      } catch (error) {
        // a crashed connect may have left the previous session alive
        // check before failing
        const status = await sdk
          .status()
          // a dead check proves nothing
          // original error will be the answer
          .catch(() => null)

        if (status?.connection.isConnected) {
          return status.connection
        }

        throw error
      }
    }),
    restore: fromPromise<WalletStatus>(async () => {
      await ensureInit()

      const { connection, session } = await sdk.status()

      return { connection, session }
    }),
    walletEvents: fromCallback(({ sendBack }) => {
      const listener = ({ connection, session }: StatusEvent) => {
        sendBack({ type: 'wallet.statusChanged', status: { connection, session } })
      }

      void sdk.onStatusChanged(listener)

      return () => {
        void sdk.removeOnStatusChanged(listener)
      }
    }),
  }
}
