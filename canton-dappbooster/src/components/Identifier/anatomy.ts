// Single source of truth for theme selectors, tests, and docs.
export const anatomy = {
  parts: {
    root: 'cnc-identifier',
    value: 'cnc-identifier__value',
    copy: 'cnc-identifier__copy',
    link: 'cnc-identifier__link',
    /** Live region carrying the copy outcome. Hidden by the component, not the theme. */
    status: 'cnc-identifier__status',
  },
  states: { copy: 'data-state' },
} as const
