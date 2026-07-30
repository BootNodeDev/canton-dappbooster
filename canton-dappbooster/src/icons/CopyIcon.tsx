import type { ReactElement } from 'react'
import { Svg } from './Svg'

export const CopyIcon = (): ReactElement => (
  <Svg>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
)
