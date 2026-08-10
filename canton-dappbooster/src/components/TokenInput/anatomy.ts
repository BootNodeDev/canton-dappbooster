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
    // A11y only, unlike `PartyIdInput` where the theme selects on `aria-invalid` itself: here it
    // sits on the field and the theme needs the root, so style off `rootInvalid` below.
    invalid: 'aria-invalid',
    // The field carries `aria-invalid` for assistive tech; the root mirrors it so the theme can
    // redden the border and the numeral without `:has()`.
    rootInvalid: 'data-invalid',
    // Same reason as `rootInvalid`: the DOM `disabled` sits on the field and the button, and the
    // theme dims the whole card.
    disabled: 'data-disabled',
    balance: 'data-state',
  },
} as const
