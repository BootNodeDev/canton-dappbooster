import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { stubViewport } from '../../testing/viewport'
import { useVirtualRows } from './useVirtualRows'

const ROW = 52
// Four rows of viewport: jsdom lays nothing out, so the height every row reads from is stubbed.
const VIEWPORT = ROW * 4

const Probe = ({ count }: { count: number }): React.JSX.Element => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { end, offset, start, totalHeight } = useVirtualRows({
    count,
    rowHeight: ROW,
    scrollRef,
  })
  return (
    <div data-testid="scroller" ref={scrollRef}>
      <span data-testid="window">{`${start}-${end}`}</span>
      <span data-testid="offset">{offset}</span>
      <span data-testid="total">{totalHeight}</span>
    </div>
  )
}

const shown = (id: 'window' | 'offset' | 'total'): string | null =>
  screen.getByTestId(id).textContent

const mount = (count: number) => {
  const resize = stubViewport(VIEWPORT)
  render(<Probe count={count} />)
  return { resize, scroller: screen.getByTestId('scroller') }
}

const scrollTo = (scroller: HTMLElement, top: number): void => {
  scroller.scrollTop = top
  fireEvent.scroll(scroller)
}

describe('useVirtualRows', () => {
  it('windows the top of the list to the viewport plus overscan', () => {
    mount(100)
    expect(shown('window')).toBe('0-13')
    expect(shown('offset')).toBe('0')
  })

  it('reserves the full height whatever it renders', () => {
    mount(100)
    expect(shown('total')).toBe(String(100 * ROW))
  })

  it('moves the window and the offset with the scroll', () => {
    const { scroller } = mount(100)
    scrollTo(scroller, ROW * 10)
    expect(shown('window')).toBe('6-19')
    expect(shown('offset')).toBe(String(ROW * 6))
  })

  it('stops the window at the end of the list', () => {
    const { scroller } = mount(20)
    scrollTo(scroller, ROW * 18)
    expect(shown('window')).toBe('14-20')
  })

  it('renders the tail of a list that shrank under a scrolled viewport', () => {
    const { scroller } = mount(3)
    scrollTo(scroller, ROW * 10)
    expect(shown('window')).toBe('0-3')
  })

  it('windows nothing when there is nothing to render', () => {
    mount(0)
    expect(shown('window')).toBe('0-0')
    expect(shown('total')).toBe('0')
  })

  // The list is a flex item under a capped card, so it resizes with the window untouched.
  it('rewindows when the scroller itself is resized', () => {
    const { resize } = mount(100)
    act(() => resize(VIEWPORT * 2))
    expect(shown('window')).toBe('0-17')
  })
})
