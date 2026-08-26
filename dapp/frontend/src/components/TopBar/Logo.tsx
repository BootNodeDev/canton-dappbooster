import { Link } from 'react-router-dom'

// The mark is the product's own mechanic rather than a tile: a flat cliff, then risers, climbing
// from the accent into the pink so the gradient runs along the unlock instead of decorating a box.
export const Logo = (): React.JSX.Element => (
  <Link to="/" className="flex items-center gap-2.5">
    <svg viewBox="0 0 24 24" width={30} height={30} aria-hidden="true" className="shrink-0">
      <title>Canton Vesting</title>
      <defs>
        <linearGradient
          id="logo-climb"
          x1="2"
          y1="22"
          x2="22"
          y2="2"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--pink)" />
        </linearGradient>
      </defs>
      <path
        d="M2.5 18.5H9V13H15.5V7.5H22"
        fill="none"
        stroke="url(#logo-climb)"
        strokeWidth="4.4"
        strokeLinejoin="miter"
      />
    </svg>
    <span className="text-[0.95rem] tracking-tight text-fg">
      <span className="font-medium">Canton</span> <span className="font-extrabold">Vesting</span>
    </span>
  </Link>
)
