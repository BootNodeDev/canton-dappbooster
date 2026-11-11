import { type SVGProps, useId } from 'react'

export const LogoMark = (props: SVGProps<SVGSVGElement>): React.JSX.Element => {
  // Two marks on one page would otherwise share a gradient id.
  const gradient = useId()

  return (
    <svg
      viewBox="0 0 24 24"
      width={30}
      height={30}
      aria-hidden="true"
      className="shrink-0"
      {...props}
    >
      <defs>
        <linearGradient id={gradient} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--pink)" />
        </linearGradient>
      </defs>
      <path
        d="M2.5 18.5H9V13H15.5V7.5H22"
        fill="none"
        stroke={`url(#${gradient})`}
        strokeWidth="4.4"
        strokeLinejoin="miter"
      />
    </svg>
  )
}
