import { type SVGProps, useId } from 'react'

export const VshMark = (props: SVGProps<SVGSVGElement>): React.JSX.Element => {
  // Two marks on one page would otherwise share a gradient id.
  const gradient = useId()

  return (
    <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--pink)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradient})`} />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.2">
        <circle cx="16" cy="16" r="6.5" />
        <path d="M16 9.5v3M16 19.5v3M9.5 16h3M19.5 16h3" />
      </g>
    </svg>
  )
}
