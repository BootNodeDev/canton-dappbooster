import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '../../providers/TokenListProvider'
import type { Token } from '../../providers/TokenListProvider/context'
import { TOKENS } from '../../testing/tokens'
import { dialogAnatomy as anatomy } from './anatomy'
import { MAX_FAVORITES } from './constants'
import { TokenFavorites } from './TokenFavorites'

const favorites = (
  props: Partial<React.ComponentProps<typeof TokenFavorites>> & {
    onSelect: (token: Token) => void
  },
  tokens: Token[] = TOKENS,
): ReactElement => (
  <TokenListProvider tokens={tokens}>
    <TokenFavorites {...props} />
  </TokenListProvider>
)

const many = Array.from({ length: MAX_FAVORITES + 3 }, (_, index) => ({
  id: `token-${index}`,
  name: `Token ${index}`,
  symbol: `TK${index}`,
}))

describe('TokenFavorites', () => {
  it('renders the tokens its ids resolve to, in the order given', () => {
    render(favorites({ ids: ['usdc', 'canton-coin'], onSelect: vi.fn() }))

    const symbols = screen
      .getAllByRole('button')
      .map((button) => button.querySelector(`.${anatomy.parts.favoriteSymbol}`)?.textContent)
    expect(symbols).toEqual(['USDC', 'CC'])
    expect(screen.getByRole('region', { name: 'Favorite tokens' })).toHaveClass(
      anatomy.parts.favorites,
    )
  })

  it('drops an id the list does not hold', () => {
    render(favorites({ ids: ['canton-coin', 'gone'], onSelect: vi.fn() }))
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('renders nothing without an id that resolves', () => {
    const { container } = render(favorites({ ids: ['gone'], onSelect: vi.fn() }))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders no more chips than the cap, keeping the first', () => {
    render(favorites({ ids: many.map((token) => token.id), onSelect: vi.fn() }, many))

    const chips = screen.getAllByRole('button')
    expect(chips).toHaveLength(MAX_FAVORITES)
    expect(chips.at(-1)).toHaveAccessibleName(`Token ${MAX_FAVORITES - 1} TK${MAX_FAVORITES - 1}`)
  })

  it('hands the whole token to onSelect', () => {
    const onSelect = vi.fn()
    render(favorites({ ids: ['canton-coin'], onSelect }))
    fireEvent.click(screen.getByRole('button', { name: 'Canton Coin CC' }))

    expect(onSelect).toHaveBeenCalledWith(TOKENS[0])
  })
})
