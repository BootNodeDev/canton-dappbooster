export const anatomy = {
  parts: {
    balance: 'cnc-token-input__balance',
    field: 'cnc-token-input__field',
    label: 'cnc-token-input__label',
    max: 'cnc-token-input__max',
    meta: 'cnc-token-input__meta',
    root: 'cnc-token-input',
    row: 'cnc-token-input__row',
    token: 'cnc-token-input__token',
    usdValue: 'cnc-token-input__usd-value',
  },
  states: {
    balance: 'data-state',
    disabled: 'data-disabled',
    interactive: 'data-interactive',
    invalid: 'data-invalid',
  },
} as const

export const modalAnatomy = {
  parts: {
    backdrop: 'cnc-token-select-modal__backdrop',
    close: 'cnc-token-select-modal__close',
    content: 'cnc-token-select-modal',
    empty: 'cnc-token-select-modal__empty',
    favorites: 'cnc-token-select-modal__favorites',
    header: 'cnc-token-select-modal__header',
    list: 'cnc-token-select-modal__list',
    positioner: 'cnc-token-select-modal__positioner',
    row: 'cnc-token-select-modal__row',
    rowLogo: 'cnc-token-select-modal__row-logo',
    rowName: 'cnc-token-select-modal__row-name',
    rows: 'cnc-token-select-modal__rows',
    rowSymbol: 'cnc-token-select-modal__row-symbol',
    rowText: 'cnc-token-select-modal__row-text',
    search: 'cnc-token-select-modal__search',
    searchIcon: 'cnc-token-select-modal__search-icon',
    searchInput: 'cnc-token-select-modal__search-input',
    sizer: 'cnc-token-select-modal__sizer',
    title: 'cnc-token-select-modal__title',
  },
  states: {
    selected: 'data-selected',
  },
} as const
