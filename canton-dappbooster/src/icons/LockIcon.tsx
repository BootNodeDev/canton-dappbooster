import type { ReactElement } from 'react'
import { Svg } from '#src/icons/Svg'

export const LockIcon = (): ReactElement => (
  <Svg>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
)
