import { FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FormEvent, ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { cancelAnatomy } from '#src/components/WalletButton/anatomy'
import { CancelButton } from '#src/components/WalletButton/CancelButton'
import { ConnectButton } from '#src/components/WalletButton/ConnectButton'
import { hangingPicker, renderDisconnected, renderWithWallet } from '#src/testing/walletSession'

const renderBesideConnect = (ui: ReactElement): ReturnType<typeof render> =>
  renderWithWallet(
    <>
      <ConnectButton />
      {ui}
    </>,
    { walletPicker: hangingPicker },
  )

const startConnecting = async (): Promise<HTMLElement> => {
  fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
  const cancel = screen.getByRole('button', { name: 'Cancel' })
  await waitFor(() => expect(cancel).not.toHaveAttribute('aria-disabled'))
  return cancel
}

describe('CancelButton', () => {
  it('renders with the root part', () => {
    renderDisconnected(<CancelButton data-testid="cancel-button" />)
    expect(screen.getByTestId('cancel-button')).toHaveClass(cancelAnatomy.parts.root)
  })

  it('appends a consumer class to the root part', () => {
    renderDisconnected(<CancelButton className="extra" data-testid="cancel-button" />)
    expect(screen.getByTestId('cancel-button')).toHaveClass(cancelAnatomy.parts.root, 'extra')
  })

  it('names itself for the action it carries', () => {
    renderDisconnected(<CancelButton />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('takes a caller label over its own', () => {
    renderDisconnected(<CancelButton>Stop</CancelButton>)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('is inert with nothing to cancel', () => {
    const onClick = vi.fn()
    renderDisconnected(<CancelButton onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Cancel' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('refuses to submit the form it sits in while idle', () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
    render(
      <FakeSessionProvider>
        <form onSubmit={onSubmit}>
          <CancelButton type="submit" />
        </form>
      </FakeSessionProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('arms once an attempt is in flight, spinning and saying so', async () => {
    renderBesideConnect(<CancelButton />)
    const cancel = await startConnecting()

    expect(cancel).toHaveAttribute(cancelAnatomy.states.pending, 'true')
    expect(cancel.querySelector(`.${cancelAnatomy.parts.spinner}`)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connecting…'))
  })

  it('announces the wait when it mounts mid-attempt', async () => {
    render(
      <FakeSessionProvider status="connecting">
        <CancelButton />
      </FakeSessionProvider>,
    )

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connecting…'))
  })

  it('leaves nothing for a screen reader to read out while idle', () => {
    renderDisconnected(<CancelButton />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(document.querySelector(`.${cancelAnatomy.parts.spinner}`)).toBeNull()
  })

  it('cancels the attempt in flight', async () => {
    renderBesideConnect(<CancelButton />)
    fireEvent.click(await startConnecting())

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Connect wallet' })).not.toHaveAttribute(
        'aria-disabled',
      ),
    )
  })

  it('ignores every click past the first', async () => {
    const onClick = vi.fn()
    renderBesideConnect(<CancelButton onClick={onClick} />)
    const cancel = await startConnecting()

    fireEvent.click(cancel)
    await waitFor(() => expect(cancel).toHaveAttribute('aria-disabled', 'true'))
    fireEvent.click(cancel)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('lets a consumer handler keep the attempt by preventing the default', async () => {
    renderBesideConnect(<CancelButton onClick={(event) => event.preventDefault()} />)
    fireEvent.click(await startConnecting())

    expect(screen.getByRole('button', { name: 'Connecting…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
