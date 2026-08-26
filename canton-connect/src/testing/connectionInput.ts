import type { DappSDK } from '@canton-network/dapp-sdk'
import type { ConnectionInput } from '#src/machine/connectionMachine'

// Never settles rather than rejects: a test that stubbed no actor for the state it drives is left
// where it put the machine, instead of a rejection walking it somewhere else.
/** A `WalletSdk` method stand-in that returns a promise which never settles. */
const pending = () => new Promise<never>(() => {})

/** Every `WalletSdk` method left hanging, so a test only stubs the ones its path reaches. */
const unstubbed = {
  connect: pending,
  disconnect: pending,
  init: pending,
  ledgerApi: pending,
  listAccounts: pending,
  onAccountsChanged: pending,
  onStatusChanged: pending,
  onTxChanged: pending,
  prepareExecuteAndWait: pending,
  removeOnAccountsChanged: pending,
  removeOnStatusChanged: pending,
  removeOnTxChanged: pending,
  signMessage: pending,
  status: pending,
}

/**
 * Machine input for a test actor, over a double satisfying the `WalletSdk` the machine types.
 * Whatever the double leaves out never settles, and every `createSdk()` hands back a fresh object,
 * as `new DappSDK` does — so a retirement changes `context.sdk` here too.
 *
 * @example
 * const actor = createActor(machine, { input: connectionInput(sdkDouble) })
 */
export const connectionInput = (
  sdk: Partial<DappSDK> = {},
  overrides: Partial<ConnectionInput> = {},
): ConnectionInput => ({
  createSdk: () => ({ ...unstubbed, ...sdk }),
  initOptions: {},
  guardPicker: false,
  networkId: 'canton:local',
  ...overrides,
})
