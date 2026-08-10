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
  },
} as const
