// A component's contract as code. `parts` are the CSS class hooks the theme
// selects on; `states` are the data-*/aria-* attribute values it keys off.
// Single source of truth: theme selectors, tests, and docs derive from here, so
// the behavior engine underneath can change without breaking consumers.
export const anatomy = {
  parts: { root: 'cnc-placeholder' },
  states: {},
} as const
