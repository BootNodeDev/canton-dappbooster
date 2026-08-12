import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, type ReactElement, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '../../providers/TokenListProvider'
import type { Token } from '../../providers/TokenListProvider/context'
import { stubViewport } from '../../testing/viewport'
import { modalAnatomy as anatomy } from './anatomy'
import { TokenSelectModal } from './TokenSelectModal'

const TOKENS: Token[] = [
  { id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
]

// The list inside windows itself against a height jsdom does not lay out.
const modal = (
  props: Partial<React.ComponentProps<typeof TokenSelectModal>> & {
    onClose: () => void
    onSelect: (token: Token) => void
    returnFocusTo: RefObject<HTMLElement | null>
  },
): ReactElement => {
  stubViewport(320)
  return (
    <TokenListProvider tokens={TOKENS}>
      <TokenSelectModal contentId="token-select" open={true} {...props} />
    </TokenListProvider>
  )
}

const setup = (open = true) => {
  const onClose = vi.fn()
  const onSelect = vi.fn()
  const returnFocusTo = createRef<HTMLElement>()
  const view = render(modal({ onClose, onSelect, open, returnFocusTo }))
  return { onClose, onSelect, returnFocusTo, view }
}

// Zag arms the dismiss listeners a frame after the dialog mounts, so a dismissal fired before that
// frame lands on nothing.
const armDismiss = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

describe('TokenSelectModal', () => {
  it('renders nothing while closed', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names the dialog through its title and takes the id the trigger points at', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Select a token' })
    expect(dialog).toHaveClass(anatomy.parts.content)
    expect(dialog).toHaveAttribute('id', 'token-select')
  })

  it('renders the search, the favourites placeholder and the token list', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(screen.getByLabelText('Search tokens')).toBeInTheDocument()
    expect(dialog.querySelector(`.${anatomy.parts.favorites}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Canton Coin CC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USD Coin USDC' })).toBeInTheDocument()
  })

  it('filters the list to what the search field holds', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Search tokens'), { target: { value: 'usd' } })

    expect(screen.getByRole('button', { name: 'USD Coin USDC' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Canton Coin CC' })).not.toBeInTheDocument()
  })

  it('reports a search that matches nothing', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Search tokens'), { target: { value: 'zzz' } })
    expect(screen.getByRole('status')).toHaveTextContent('No tokens found')
  })

  it('marks the row of the token it was given', () => {
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(modal({ onClose, onSelect, returnFocusTo: createRef(), selectedId: 'usdc' }))
    expect(screen.getByRole('button', { name: 'USD Coin USDC' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('reports the picked token and asks to close', async () => {
    const { onClose, onSelect } = setup()
    screen.getByRole('button', { name: 'USD Coin USDC' }).click()
    expect(onSelect).toHaveBeenCalledWith(TOKENS[1])
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('unmounts on a close it was not the one to ask for', () => {
    const { view } = setup()
    view.rerender(
      modal({ onClose: vi.fn(), onSelect: vi.fn(), open: false, returnFocusTo: createRef() }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // The machine flushes outside React's commit, so the callback lands a tick after the event.
  it('asks to close on the close button', async () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('asks to close on Escape', async () => {
    const { onClose } = setup()
    await armDismiss()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  // Fired from inside the dialog, not on the document, so Zag's capture listener runs ahead of the
  // enclosing one the way it does in a browser rather than in registration order.
  it('marks the Escape it consumed so an enclosing dialog can let it pass', async () => {
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    try {
      const { onClose } = setup()
      await armDismiss()
      fireEvent.keyDown(screen.getByLabelText('Search tokens'), { key: 'Escape' })
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(outer).toHaveBeenCalledOnce()
      expect(outer.mock.calls[0][0].defaultPrevented).toBe(true)
    } finally {
      document.removeEventListener('keydown', outer)
    }
  })

  it('returns focus to the element it was opened from', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    try {
      const { unmount } = render(
        modal({ onClose: vi.fn(), onSelect: vi.fn(), returnFocusTo: { current: trigger } }),
      )
      await armDismiss()
      unmount()
      await waitFor(() => expect(trigger).toHaveFocus())
    } finally {
      trigger.remove()
    }
  })

  // Two behaviours stay untested here because jsdom cannot carry them: dismissal on an outside
  // pointer down is hit-tested against the dialog's rect, and `initialFocusEl` loses to the focus
  // trap's fallback because nothing laid out counts as tabbable.
})
