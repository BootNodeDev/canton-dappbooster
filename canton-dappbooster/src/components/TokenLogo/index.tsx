import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cx } from '../../utils/cx'
import { anatomy } from './anatomy'
import { hueOf } from './hue'

interface TokenLogoProps {
  className?: string
  logo?: ReactNode
  symbol: string
}

// The theme composes the colour
const hueStyle = (symbol: string): CSSProperties =>
  ({ '--cnc-token-hue': hueOf(symbol) }) as CSSProperties

/**
 * A token's logo
 *
 * @example
 * <TokenLogo logo={token.logo} symbol={token.symbol} />
 */
export const TokenLogo = ({ className, logo, symbol }: TokenLogoProps): ReactElement => (
  <span
    aria-hidden
    className={cx(anatomy.parts.root, className)}
    style={logo === undefined ? hueStyle(symbol) : undefined}
    {...{ [anatomy.states.fallback]: logo === undefined || undefined }}
  >
    {logo ?? symbol}
  </span>
)
