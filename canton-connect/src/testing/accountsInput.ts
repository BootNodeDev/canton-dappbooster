import type { DappSDK } from '@canton-network/dapp-sdk'
import type { AccountsInput } from '#src/machine/accountsActors'
import { connectionInput } from '#src/testing/connectionInput'

/**
 * Input for an accounts actor driven on its own, rather than invoked by the connection machine.
 * Same double as `connectionInput`, so an unstubbed read never settles.
 *
 * @example
 * const actor = createActor(accountsMachine.provide({ actors }), { input: accountsInput() })
 */
export const accountsInput = (sdk: Partial<DappSDK> = {}): AccountsInput => {
  const { createSdk, networkId } = connectionInput(sdk)

  return { sdk: createSdk(), networkId }
}
