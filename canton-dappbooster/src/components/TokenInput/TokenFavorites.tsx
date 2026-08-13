import type { ReactElement } from 'react'
import type { Token } from '../../providers/TokenListProvider/context'
import { useTokenList } from '../../providers/TokenListProvider/useTokenList'
import { TokenLogo } from '../TokenLogo'
import { modalAnatomy as anatomy } from './anatomy'

interface TokenFavoritesProps {
  ids?: readonly string[]
  onSelect: (token: Token) => void
}

/**
 * The token select's shortcut row.
 *
 * @example
 * <TokenFavorites ids={['canton-coin']} onSelect={setToken} />
 */
export const TokenFavorites = ({
  ids = [],
  onSelect,
}: TokenFavoritesProps): ReactElement | null => {
  const { byId } = useTokenList()
  const favorites = ids.map((id) => byId.get(id)).filter((token) => token !== undefined)

  if (favorites.length === 0) return null

  return (
    <section aria-label="Favorite tokens" className={anatomy.parts.favorites}>
      {favorites.map((token) => (
        <button
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
