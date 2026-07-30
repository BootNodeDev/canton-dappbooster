import type { ReactElement, ReactNode } from 'react'

// Sized in `em` and stroked in `currentColor` so the theme drives them through font-size and color.
export const Svg = ({ children }: { children: ReactNode }): ReactElement => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)
