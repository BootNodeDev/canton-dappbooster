/**
 * The `/connect` sub-path. Its components read the wallet session, so they are kept off the main
 * barrel to keep the Canton SDK out of a consumer's graph unless they ask for it. Merged into Main
 * here because a reader browsing components wants them beside the others; the import path is on the
 * components themselves.
 *
 * @module
 * @mergeModuleWith Main
 */

export { WalletButton, type WalletButtonProps } from '#src/components/WalletButton'
export { ConnectButton, type ConnectButtonProps } from '#src/components/WalletButton/ConnectButton'
export {
  DisconnectButton,
  type DisconnectButtonProps,
} from '#src/components/WalletButton/DisconnectButton'
