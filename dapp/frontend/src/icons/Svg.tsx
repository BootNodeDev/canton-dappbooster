import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

// Only the brand and house marks are drawn here; every generic icon comes from lucide-react.
// Decorative by default: aria-hidden so no mark has to remember it.
export const Svg = ({
  children,
  ...props
}: IconProps & { children: ReactNode }): React.JSX.Element => (
  <svg width={18} height={18} fill="currentColor" aria-hidden="true" {...props}>
    {children}
  </svg>
)
