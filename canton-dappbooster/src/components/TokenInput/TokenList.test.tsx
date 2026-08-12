import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '../../providers/TokenListProvider'
import type { Token } from '../../providers/TokenListProvider/context'
import { stubViewport } from '../../testing/viewport'
import { modalAnatomy as anatomy } from './anatomy'
import { ROW_HEIGHT_REM } from './constants'
import { TokenList } from './TokenList'

// jsdom's root font size is the 16px default, so the hook under the list resolves rem to this.
const ROW = ROW_HEIGHT_REM * 16
const VIEWPORT = ROW * 4

const tokens: Token[] = Array.from({ length: 100 }, (_, index) => ({
  id: `token-${index}`,
  name: `Token ${index}`,
  symbol: `TK${index}`,
}))

const setup = (selectedId?: string) => {
  stubViewport(VIEWPORT)
  const onSelect = vi.fn()
  const { container } = render(
    <TokenListProvider tokens={tokens}>
      <TokenList onSelect={onSelect} selectedId={selectedId} />
    </TokenListProvider>,
  )
  const scroller = container.querySelector(`.${anatomy.parts.list}`) as HTMLElement
  return { container, onSelect, scroller }
}

const rows = (): HTMLElement[] => screen.getAllByRole('button')

const row = (index: number): HTMLElement =>
  screen.getByRole('button', { name: `Token ${index} TK${index}` })

const scrollTo = (scroller: HTMLElement, top: number): void => {
  scroller.scrollTop = top
  fireEvent.scroll(scroller)
}

describe('TokenList', () => {
  it('renders only the rows in view', () => {
    setup()
    expect(rows()).toHaveLength(13)
    expect(row(0)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Token 40 TK40' })).not.toBeInTheDocument()
  })

  it('reserves the height of the whole list', () => {
    const { container } = setup()
    expect(container.querySelector(`.${anatomy.parts.sizer}`)).toHaveStyle({
      height: `${tokens.length * ROW}px`,
    })
  })

  it('renders the rows in view at the scrolled offset', () => {
    const { scroller } = setup()
    scrollTo(scroller, ROW * 40)

    expect(row(40)).toBeInTheDocument()
    expect(row(40).parentElement).toHaveStyle({ transform: `translateY(${ROW * 36}px)` })
  })

  it('reports the selected token on its row and on no other', () => {
    setup('token-2')
    expect(row(2)).toHaveAttribute('aria-pressed', 'true')
    expect(row(3)).toHaveAttribute('aria-pressed', 'false')
  })

  it('hands the clicked token back', () => {
    const { onSelect } = setup()
    row(5).click()
    expect(onSelect).toHaveBeenCalledWith(tokens[5])
  })

  it('shows a token logo without announcing it', () => {
    stubViewport(VIEWPORT)
    const { container } = render(
      <TokenListProvider tokens={[{ ...tokens[0], logo: <svg aria-label="ignored" /> }]}>
        <TokenList onSelect={vi.fn()} />
      </TokenListProvider>,
    )

    expect(container.querySelector(`.${anatomy.parts.rowLogo}`)).toHaveAttribute('aria-hidden')
    expect(row(0)).toBeInTheDocument()
  })

  // Windowed, so the rows out of view are not in the DOM to tab to: one tab stop and the arrow keys
  // are what reach them, not a tab stop per token.
  it('carries a single tab stop, on the selected row', () => {
    setup('token-2')
    expect(rows().filter((node) => node.tabIndex === 0)).toEqual([row(2)])
  })

  it('starts the tab stop at the top when nothing is selected', () => {
    setup()
    expect(rows().filter((node) => node.tabIndex === 0)).toEqual([row(0)])
  })

  it('walks the tab stop and the focus with the arrow keys', () => {
    setup()
    row(0).focus()
    fireEvent.keyDown(row(0), { key: 'ArrowDown' })

    expect(row(1)).toHaveFocus()
    expect(rows().filter((node) => node.tabIndex === 0)).toEqual([row(1)])
  })

  it('jumps to either end of the list', () => {
    setup()
    row(0).focus()
    fireEvent.keyDown(row(0), { key: 'End' })
    expect(row(99)).toHaveFocus()

    fireEvent.keyDown(row(99), { key: 'Home' })
    expect(row(0)).toHaveFocus()
  })

  it('scrolls the list to the row the keys moved to', () => {
    const { scroller } = setup()
    row(0).focus()
    fireEvent.keyDown(row(0), { key: 'End' })
    expect(scroller.scrollTop).toBe(100 * ROW - VIEWPORT)
  })

  it('keeps the focused row rather than losing focus to the document when it scrolls away', () => {
    const { scroller } = setup()
    row(0).focus()
    scrollTo(scroller, ROW * 40)

    expect(row(0)).toBeInTheDocument()
    expect(row(0)).toHaveFocus()
  })

  it('leaves focus alone when it was never in the list', () => {
    const { scroller } = setup()
    scrollTo(scroller, ROW * 40)
    expect(document.body).toHaveFocus()
  })
})
