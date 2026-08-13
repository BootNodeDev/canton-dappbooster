import type { DappSDK } from '@canton-network/dapp-sdk'
import { fromPromise } from 'xstate'

export const createConnectionActors = (sdk: Pick<DappSDK, 'connect' | 'status'>) => ({
  connect: fromPromise(async () => {
    try {
      return await sdk.connect()
    } catch (error) {
      const status = await sdk.status()

      if (status.connection.isConnected) {
        return status.connection
      }

      throw error
    }
  }),
})
