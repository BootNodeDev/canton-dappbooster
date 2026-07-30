import type { ReactElement } from 'react'
import { anatomy } from './anatomy'

// TEMP(#31): proves the build + theming pipeline. Replaced by <Identifier> in #6.
export function Placeholder(): ReactElement {
  return <span className={anatomy.parts.root}>canton-dappbooster</span>
}
