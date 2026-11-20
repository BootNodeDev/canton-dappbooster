import type { SVGProps } from 'react'

export const UsdxMark = (props: SVGProps<SVGSVGElement>): React.JSX.Element => (
  <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden="true" {...props}>
    <circle cx="16" cy="16" r="16" fill="var(--usdx)" />
    <path
      d="M20 11.6c-.8-1.3-2.3-2.1-4-2.1-2.2 0-4 1.2-4 3.1s1.8 2.5 4 3 4 1.2 4 3.2-1.8 3.1-4 3.1c-1.7 0-3.2-.8-4-2.1M16 7.5v17"
      fill="none"
      stroke="#fff"
      strokeLinecap="round"
      strokeWidth="2.2"
    />
  </svg>
)
