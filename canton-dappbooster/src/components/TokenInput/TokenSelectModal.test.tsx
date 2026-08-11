import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { modalAnatomy as anatomy } from './anatomy'
import { TokenSelectModal } from './TokenSelectModal'

const setup = (open = true) => {
  const onOpenChange = vi.fn()
  render(<TokenSelectModal onOpenChange={onOpenChange} open={open} />)
  return { onOpenChange }
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

  it('names the dialog through its title', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Select a token' })).toHaveClass(
      anatomy.parts.content,
    )
  })

  it('renders the search, favourites and list placeholders', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(screen.getByLabelText('Search tokens')).toBeInTheDocument()
    expect(dialog.querySelector(`.${anatomy.parts.favorites}`)).toBeInTheDocument()
    expect(dialog.querySelector(`.${anatomy.parts.list}`)).toBeInTheDocument()
  })

  // The machine flushes outside React's commit, so the callback lands a tick after the event.
  it('asks to close on the close button', async () => {
    const { onOpenChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('asks to close on Escape', async () => {
    const { onOpenChange } = setup()
    await armDismiss()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  // Dismissal on an outside pointer down is Zag's default and stays untested: it is gated on hit
  // testing against the dialog's rect, which jsdom never lays out.
})
