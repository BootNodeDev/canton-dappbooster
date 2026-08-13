import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '../../providers/TokenListProvider'
import type { Token } from '../../providers/TokenListProvider/context'
import { modalAnatomy as anatomy } from './anatomy'
import { TokenFavorites } from './TokenFavorites'

const TOKENS: Token[] = [
  { id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
]

const favorites = (
  props: Partial<React.ComponentProps<typeof TokenFavorites>> & {
    onSelect: (token: Token) => void
  },
): ReactElement => (
  <TokenListProvider tokens={TOKENS}>
    <TokenFavorites {...props} />
  </TokenListProvider>
)

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

  it('hands the whole token to onSelect', () => {
    const onSelect = vi.fn()
    render(favorites({ ids: ['canton-coin'], onSelect }))
    fireEvent.click(screen.getByRole('button', { name: 'CC' }))

    expect(onSelect).toHaveBeenCalledWith(TOKENS[0])
  })
})
