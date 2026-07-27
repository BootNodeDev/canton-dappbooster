import type { ReactElement } from 'react'
import { anatomy } from './anatomy'

// TEMP(#31): proves the build + theming pipeline and cross-package consumption.
// Replaced by the real <Identifier> primitive in #6. Carries no styling — the
// theme (@bootnodedev/canton-theme) styles anatomy.parts.root.
export function Placeholder(): ReactElement {
  return <span className={anatomy.parts.root}>canton-dappbooster</span>
}
