import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { modalAnatomy as anatomy } from './anatomy'
import { TokenSelectModal } from './TokenSelectModal'

const setup = (open = true) => {
  const onClose = vi.fn()
  const returnFocusTo = createRef<HTMLElement>()
  const view = render(
    <TokenSelectModal
      contentId="token-select"
      onClose={onClose}
      open={open}
      returnFocusTo={returnFocusTo}
    />,
  )
  return { onClose, returnFocusTo, view }
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

  it('renders the search, favourites and list placeholders', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(screen.getByLabelText('Search tokens')).toBeInTheDocument()
    expect(dialog.querySelector(`.${anatomy.parts.favorites}`)).toBeInTheDocument()
    expect(dialog.querySelector(`.${anatomy.parts.list}`)).toBeInTheDocument()
  })

  it('unmounts on a close it was not the one to ask for', () => {
    const { view } = setup()
    view.rerender(
      <TokenSelectModal
        contentId="token-select"
        onClose={vi.fn()}
        open={false}
        returnFocusTo={createRef<HTMLElement>()}
      />,
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
        <TokenSelectModal
          contentId="token-select"
          onClose={vi.fn()}
          open={true}
          returnFocusTo={{ current: trigger }}
        />,
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
