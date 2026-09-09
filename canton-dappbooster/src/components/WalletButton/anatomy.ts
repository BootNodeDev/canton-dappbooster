export const cancelAnatomy = {
  parts: {
    root: 'cnc-cancel-button',
    spinner: 'cnc-cancel-button__spinner',
    status: 'cnc-cancel-button__status',
  },
  states: { pending: 'data-pending' },
} as const

export const connectAnatomy = {
  parts: {
    root: 'cnc-connect-button',
    spinner: 'cnc-connect-button__spinner',
  },
  states: { pending: 'data-pending' },
} as const

export const disconnectAnatomy = {
  parts: {
    root: 'cnc-disconnect-button',
  },
} as const
