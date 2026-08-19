/**
 * Pins a {@link ConnectButton} placement to one face, for a screen that only ever wants that one.
 * Omit it and the placement follows the session. A pinned placement renders nothing rather than
 * the other face, so a header can carry the account face without sprouting a connect button.
 *
 * @example
 * <ConnectButton mode="account" /> // header: nothing until there is a session
 */
export type ConnectButtonMode = 'account' | 'connect'

export const anatomy = {
  parts: {
    root: 'cnc-connect-button',
    party: 'cnc-connect-button__party',
    spinner: 'cnc-connect-button__spinner',
  },
  states: { mode: 'data-mode', pending: 'data-pending' },
} as const

export const popoverAnatomy = {
  parts: {
    content: 'cnc-account-popover',
    disconnect: 'cnc-account-popover__disconnect',
    partyId: 'cnc-account-popover__party-id',
    positioner: 'cnc-account-popover__positioner',
    title: 'cnc-account-popover__title',
  },
} as const
