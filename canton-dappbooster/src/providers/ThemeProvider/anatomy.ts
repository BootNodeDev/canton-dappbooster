// Single source of truth for theme selectors, tests, and docs. No parts: the attribute lands on
// <html>, which this package does not render.
export const anatomy = {
  states: { theme: 'data-theme' },
} as const
