import type { ReactElement } from 'react'
import './Placeholder.css'

// TEMP(#31): proves the tsdown CSS+build pipeline and cross-package consumption.
// Replaced by the real <Identifier> primitive in #6.
export function Placeholder(): ReactElement {
  return <span className="cnc-placeholder">canton-dappbooster</span>
}
