import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

export const Svg = ({
  children,
  ...props
}: IconProps & { children: ReactNode }): React.JSX.Element => (
  <svg width={18} height={18} fill="currentColor" aria-hidden="true" {...props}>
    {children}
  </svg>
)
