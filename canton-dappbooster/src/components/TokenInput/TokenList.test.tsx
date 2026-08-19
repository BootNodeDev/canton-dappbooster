import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '../../providers/TokenListProvider'
import type { Token } from '../../providers/TokenListProvider/context'
import { stubViewport } from '../../testing/viewport'
import { dialogAnatomy as anatomy } from './anatomy'
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

const renderList = (element: ReactElement) => {
  stubViewport(VIEWPORT)
  const { container, rerender } = render(element)
  return {
    container,
    rerender,
    scroller: container.querySelector(`.${anatomy.parts.list}`) as HTMLElement,
  }
}

const setup = (query?: string) => {
  const onSelect = vi.fn()
  const list = (next?: string): ReactElement => (
    <TokenListProvider tokens={tokens}>
      <TokenList onSelect={onSelect} query={next} />
    </TokenListProvider>
  )
  const { container, rerender, scroller } = renderList(list(query))
  return { container, onSelect, scroller, search: (next?: string) => rerender(list(next)) }
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

  it('hands the clicked token back', () => {
    const { onSelect } = setup()
    row(5).click()
    expect(onSelect).toHaveBeenCalledWith(tokens[5])
  })

  it('shows a token logo without announcing it', () => {
    const { container } = renderList(
      <TokenListProvider tokens={[{ ...tokens[0], logo: <svg aria-label="ignored" /> }]}>
        <TokenList onSelect={vi.fn()} />
      </TokenListProvider>,
    )

    expect(container.querySelector(`.${anatomy.parts.rowLogo}`)).toHaveAttribute('aria-hidden')
    expect(row(0)).toBeInTheDocument()
  })

  // Windowed, so the rows out of view are not in the DOM to tab to: one tab stop and the arrow keys
  // are what reach them, not a tab stop per token.
  it('carries a single tab stop, starting on the first row', () => {
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

  it('renders only the tokens the query matches', () => {
    setup('TK7')
    expect(rows().map((node) => node.getAttribute('aria-label'))).toEqual([
      'Token 7 TK7',
      ...Array.from({ length: 10 }, (_, index) => `Token 7${index} TK7${index}`),
    ])
  })

  it('reserves only the height of the tokens the query matches', () => {
    const { container } = setup('TK7')
    expect(container.querySelector(`.${anatomy.parts.sizer}`)).toHaveStyle({
      height: `${11 * ROW}px`,
    })
  })

  it('announces that nothing matches instead of listing rows', () => {
    const { container } = setup('nothing')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('No tokens found')
    expect(container.querySelector(`.${anatomy.parts.empty}`)).toHaveTextContent('No tokens found')
  })

  it('announces how far the query narrowed the list', () => {
    setup('TK7')
    expect(screen.getByRole('status')).toHaveTextContent('11 tokens found')
  })

  it('keeps the announcement mounted and silent until a query narrows the list', () => {
    const { container } = setup()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(container.querySelector(`.${anatomy.parts.empty}`)).not.toBeInTheDocument()
  })

  // Says so on screen, but announces nothing: mounting a list is not a change to report.
  it('shows the empty message for a provider with no tokens and stays silent', () => {
    const { container } = renderList(
      <TokenListProvider tokens={[]}>
        <TokenList onSelect={vi.fn()} />
      </TokenListProvider>,
    )

    expect(container.querySelector(`.${anatomy.parts.empty}`)).toHaveTextContent('No tokens found')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('leaves the tab stop and the scroll alone when a keystroke only pads the query', () => {
    const { scroller, search } = setup('Token 1')
    scrollTo(scroller, ROW * 5)
    search('  Token 1  ')

    expect(scroller.scrollTop).toBe(ROW * 5)
  })

  it('restores the whole list when the query is cleared', () => {
    const { search } = setup('TK7')
    search('')
    expect(row(0)).toBeInTheDocument()
    expect(rows()).toHaveLength(13)
  })

  it('returns the tab stop and the scroll to the top when the query changes', () => {
    const { scroller, search } = setup()
    row(0).focus()
    fireEvent.keyDown(row(0), { key: 'End' })
    search('Token 1')

    expect(scroller.scrollTop).toBe(0)
    expect(rows().filter((node) => node.tabIndex === 0)).toEqual([row(1)])
  })

  // The rewind goes through the hook, so the window is recomputed in the same commit rather than
  // waiting on a scroll event the programmatic write may never produce.
  it('renders the matches from the top after a query change scrolled the list back', () => {
    const { scroller, search } = setup()
    scrollTo(scroller, ROW * 90)
    search('Token 1')

    expect(scroller.scrollTop).toBe(0)
    expect(rows().map((node) => node.getAttribute('aria-label'))).toEqual([
      'Token 1 TK1',
      ...Array.from({ length: 10 }, (_, index) => `Token 1${index} TK1${index}`),
    ])
  })

  it('holds the tab stop and the scroll through a provider handing over an equal list', () => {
    const list = (given: Token[]): ReactElement => (
      <TokenListProvider tokens={given}>
        <TokenList onSelect={vi.fn()} />
      </TokenListProvider>
    )
    const { rerender, scroller } = renderList(list(tokens))
    scrollTo(scroller, ROW * 40)
    rerender(list([...tokens]))

    expect(scroller.scrollTop).toBe(ROW * 40)
    expect(rows().filter((node) => node.tabIndex === 0)).toEqual([row(0)])
  })
})
