import { type SVGProps, useId } from 'react'

// The app's own mark, standing in for the instrument this deployment vests. Not over `Svg`, which
// is stroke-based: this is two filled shapes.
export const TokenMark = (props: SVGProps<SVGSVGElement>): React.JSX.Element => {
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
      <path d="M9 10l4.4 12h1.8L19.6 10h-2.5l-2.8 8.4L11.5 10z" fill="#fff" />
    </svg>
  )
}
