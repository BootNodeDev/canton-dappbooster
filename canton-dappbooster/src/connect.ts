/**
 * The `/connect` sub-path. Its one component reads the wallet session, so it is kept off the main
 * barrel to keep the Canton SDK out of a consumer's graph unless they ask for it. Merged into Main
 * here because a reader browsing components wants it beside the others; the import path is on the
 * component itself.
 *
 * @module
 * @mergeModuleWith Main
 */

export { ConnectButton, type ConnectButtonProps } from '#src/components/ConnectButton'
export type { ConnectButtonMode } from '#src/components/ConnectButton/anatomy'
