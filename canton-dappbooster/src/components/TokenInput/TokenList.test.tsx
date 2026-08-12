import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '../../providers/TokenListProvider'
import type { Token } from '../../providers/TokenListProvider/context'
import { modalAnatomy as anatomy } from './anatomy'
import { ROW_HEIGHT } from './constants'
import { TokenList } from './TokenList'

const VIEWPORT = ROW_HEIGHT * 4

const tokens: Token[] = Array.from({ length: 100 }, (_, index) => ({
  decimals: 10,
  id: `token-${index}`,
  name: `Token ${index}`,
  symbol: `TK${index}`,
}))

const setup = (selectedId?: string) => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEWPORT)
  const onSelect = vi.fn()
  const { container } = render(
    <TokenListProvider tokens={tokens}>
      <TokenList onSelect={onSelect} selectedId={selectedId} />
    </TokenListProvider>,
  )
  return { container, onSelect }
}

const rows = (): HTMLElement[] => screen.getAllByRole('button')

describe('TokenList', () => {
  it('renders only the rows in view', () => {
    setup()
    expect(rows()).toHaveLength(13)
    expect(screen.getByRole('button', { name: 'Token 0 TK0' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Token 40 TK40' })).not.toBeInTheDocument()
  })

  it('reserves the height of the whole list', () => {
    const { container } = setup()
    expect(container.querySelector(`.${anatomy.parts.sizer}`)).toHaveStyle({
      height: `${tokens.length * ROW_HEIGHT}px`,
    })
  })

  it('renders the rows in view at the scrolled offset', () => {
    const { container } = setup()
    const scroller = container.querySelector(`.${anatomy.parts.list}`) as HTMLElement
    scroller.scrollTop = ROW_HEIGHT * 40
    fireEvent.scroll(scroller)

    expect(screen.getByRole('button', { name: 'Token 40 TK40' })).toBeInTheDocument()
    expect(container.querySelector(`.${anatomy.parts.rows}`)).toHaveStyle({
      transform: `translateY(${ROW_HEIGHT * 36}px)`,
    })
  })

  it('reports the selected token on its row and on no other', () => {
    setup('token-2')
    expect(screen.getByRole('button', { name: 'Token 2 TK2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Token 3 TK3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('hands the clicked token back', () => {
    const { onSelect } = setup()
    screen.getByRole('button', { name: 'Token 5 TK5' }).click()
    expect(onSelect).toHaveBeenCalledWith(tokens[5])
  })

  it('shows a token logo without announcing it', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEWPORT)
    const { container } = render(
      <TokenListProvider tokens={[{ ...tokens[0], logo: <svg aria-label="ignored" /> }]}>
        <TokenList onSelect={vi.fn()} />
      </TokenListProvider>,
    )

    expect(container.querySelector(`.${anatomy.parts.rowLogo}`)).toHaveAttribute('aria-hidden')
    expect(screen.getByRole('button', { name: 'Token 0 TK0' })).toBeInTheDocument()
  })
})
