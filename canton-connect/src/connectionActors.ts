import type { DappSDK } from '@canton-network/dapp-sdk'
import { fromPromise } from 'xstate'

export const createConnectionActors = (sdk: Pick<DappSDK, 'connect' | 'status'>) => ({
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
})
