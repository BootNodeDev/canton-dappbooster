export const anatomy = {
  parts: {
    root: 'cnc-token-input',
    label: 'cnc-token-input__label',
    // The field and the token pill share a row, which a flex column cannot do without a wrapper.
    row: 'cnc-token-input__row',
    field: 'cnc-token-input__field',
    token: 'cnc-token-input__token',
    meta: 'cnc-token-input__meta',
    usdValue: 'cnc-token-input__usd-value',
    balance: 'cnc-token-input__balance',
    max: 'cnc-token-input__max',
  },
  states: {
    invalid: 'data-invalid',
    disabled: 'data-disabled',
    balance: 'data-state',
    // The token part renders as a span or as a picker button, so the theme needs the two apart.
    interactive: 'data-interactive',
  },
} as const

// Its own block, not a `cnc-token-input__` sub-part: the dialog renders in a portal, so nothing
// it holds is a descendant of the field.
export const modalAnatomy = {
  parts: {
    backdrop: 'cnc-token-select-modal__backdrop',
    positioner: 'cnc-token-select-modal__positioner',
    content: 'cnc-token-select-modal',
    header: 'cnc-token-select-modal__header',
    title: 'cnc-token-select-modal__title',
    close: 'cnc-token-select-modal__close',
    search: 'cnc-token-select-modal__search',
    favorites: 'cnc-token-select-modal__favorites',
    list: 'cnc-token-select-modal__list',
  },
} as const
