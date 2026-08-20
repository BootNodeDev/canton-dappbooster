import type { ReactElement } from 'react'
import { Svg } from '#src/icons/Svg'

export const SearchIcon = (): ReactElement => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.9-3.9" />
  </Svg>
)
