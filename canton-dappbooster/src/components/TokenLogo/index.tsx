import type { ReactElement, ReactNode } from 'react'
import { anatomy } from '#src/components/TokenLogo/anatomy'
import { swatchOf } from '#src/components/TokenLogo/swatch'
import { cx } from '#src/utils/cx'

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
 * A subcomponent of {@link TokenInput} and its token select, not a public export: a consumer
 * rendering a token badge of their own owes it an accessible name, which this deliberately has not.
 *
 * @example
 * <TokenLogo logo={token.logo} symbol={token.symbol} />
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/TokenLogo/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @internal
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
