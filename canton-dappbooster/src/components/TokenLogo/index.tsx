import type { ReactElement, ReactNode } from 'react'
import { cx } from '../../utils/cx'
import { anatomy } from './anatomy'
import { swatchOf } from './swatch'

const INITIALS = 3

interface TokenLogoProps {
  className?: string
  logo?: ReactNode
  symbol: string
}

// Cut by code point, so an astral glyph is not split into two broken halves.
const initialsOf = (symbol: string): string => [...symbol].slice(0, INITIALS).join('')

/**
 * A token's logo, falling back to the symbol's initials on a coloured disc when there is no
 * artwork. The disc is `aria-hidden` either way, so whatever renders it must name the token itself.
 *
 * @example
 * <TokenLogo logo={token.logo} symbol={token.symbol} />
 */
export const TokenLogo = ({ className, logo, symbol }: TokenLogoProps): ReactElement => {
  const fallback = logo === undefined || logo === null

  return (
    <span
      aria-hidden
      className={cx(anatomy.parts.root, className)}
      {...{
        [anatomy.states.fallback]: fallback || undefined,
        [anatomy.states.swatch]: fallback ? swatchOf(symbol) : undefined,
      }}
    >
      {fallback ? initialsOf(symbol) : logo}
    </span>
  )
}
