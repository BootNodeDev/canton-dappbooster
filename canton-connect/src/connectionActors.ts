import type { DappSDK } from '@canton-network/dapp-sdk'
import { fromPromise } from 'xstate'

type InitOptions = NonNullable<Parameters<DappSDK['init']>[0]>

export const createConnectionActors = (
  sdk: Pick<DappSDK, 'connect' | 'init' | 'status'>,
  options: InitOptions = {},
) => ({
  connect: fromPromise(async () => {
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
  restore: fromPromise(async () => {
    // SDK's `defaultAdapters` include a localhost dev gateway; override them
    await sdk.init({ defaultAdapters: [], ...options })

    const { connection, session } = await sdk.status()

    return { connection, session }
  }),
})
