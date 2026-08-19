import type { ReactElement } from 'react'
import type { Token } from '../../providers/TokenListProvider/context'
import { useTokenList } from '../../providers/TokenListProvider/useTokenList'
import { TokenLogo } from '../TokenLogo'
import { dialogAnatomy as anatomy } from './anatomy'
import { MAX_FAVORITES } from './constants'
import { tokenLabel } from './tokenLabel'

interface TokenFavoritesProps {
  ids?: readonly string[]
  onSelect: (token: Token) => void
}

/**
 * The token select's shortcut row. Takes the first `MAX_FAVORITES` ids the list provider holds, in
 * the order given, and drops the rest.
 *
 * @example
 * <TokenFavorites ids={['canton-coin']} onSelect={setToken} />
 */
export const TokenFavorites = ({
  ids = [],
  onSelect,
}: TokenFavoritesProps): ReactElement | null => {
  const { byId } = useTokenList()
  const favorites = ids
    .map((id) => byId.get(id))
    .filter((token) => token !== undefined)
    .slice(0, MAX_FAVORITES)

  if (favorites.length === 0) return null

  return (
    <section aria-label="Favorite tokens" className={anatomy.parts.favorites}>
      {favorites.map((token) => (
        <button
          aria-label={tokenLabel(token)}
          className={anatomy.parts.favorite}
          key={token.id}
          onClick={() => onSelect(token)}
          type="button"
        >
          <TokenLogo
            className={anatomy.parts.favoriteLogo}
            logo={token.logo}
            symbol={token.symbol}
          />
          <span className={anatomy.parts.favoriteSymbol}>{token.symbol}</span>
        </button>
      ))}
    </section>
  )
}
