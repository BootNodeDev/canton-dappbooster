import type { ReactElement } from 'react'
import { dialogAnatomy as anatomy } from '#src/components/TokenInput/anatomy'
import { MAX_FAVORITES } from '#src/components/TokenInput/constants'
import { getTokenLabel } from '#src/components/TokenInput/getTokenLabel'
import { TokenLogo } from '#src/components/TokenLogo'
import type { InstrumentId, Token } from '#src/providers/TokenListProvider/context'
import { useTokenList } from '#src/providers/TokenListProvider/useTokenList'
import { tokenKey } from '#src/utils/tokenKey'

interface TokenFavoritesProps {
  ids?: readonly InstrumentId[]
  onSelect: (token: Token) => void
}

/**
 * The token select's shortcut row. Takes the first `MAX_FAVORITES` ids the list provider holds, in
 * the order given, and drops the rest.
 *
 * @example
 * <TokenFavorites ids={[{ admin: 'DSO::1220ab', id: 'Amulet' }]} onSelect={setToken} />
 */
export const TokenFavorites = ({
  ids = [],
  onSelect,
}: TokenFavoritesProps): ReactElement | null => {
  const { byKey } = useTokenList()
  const favorites = ids
    .map((id) => byKey.get(tokenKey(id)))
    .filter((token) => token !== undefined)
    .slice(0, MAX_FAVORITES)

  return favorites.length === 0 ? null : (
    <section aria-label="Favorite tokens" className={anatomy.parts.favorites}>
      {favorites.map((token) => (
        <button
          aria-label={getTokenLabel(token)}
          className={anatomy.parts.favorite}
          key={tokenKey(token.instrumentId)}
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
