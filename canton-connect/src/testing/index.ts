/**
 * The `/testing` sub-path: doubles for driving a session from a test suite. Filed apart from the
 * main barrel rather than merged into it, so a fake never sits beside the real thing it stands in
 * for.
 *
 * @module Testing
 */

export { createAutoPicker } from '#src/testing/autoPicker'
export { FakeSessionProvider, type FakeSessionProviderProps } from '#src/testing/fakeSession'
export {
  createFakeWallet,
  type FakeWallet,
  type FakeWalletAccount,
  type FakeWalletOptions,
} from '#src/testing/fakeWallet'
export { pause } from '#src/testing/pause'
