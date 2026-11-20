import type { SVGProps } from 'react'

export const VshMark = (props: SVGProps<SVGSVGElement>): React.JSX.Element => (
  <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden="true" {...props}>
    <rect width="32" height="32" rx="9" fill="var(--vsh)" />
    <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.2">
      <circle cx="16" cy="16" r="6.5" />
      <path d="M16 9.5v3M16 19.5v3M9.5 16h3M19.5 16h3" />
    </g>
  </svg>
)
