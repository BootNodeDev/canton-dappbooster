import { useParty } from '@bootnodedev/canton-connect'
import { FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FormEvent, ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { connectAnatomy } from '#src/components/WalletButton/anatomy'
import { ConnectButton } from '#src/components/WalletButton/ConnectButton'
import {
  hangingPicker,
  PARTY,
  renderDisconnected,
  renderWithWallet,
} from '#src/testing/walletSession'

// The button keeps its own face through a connect, so the session itself is what a connect asserts.
const Session = (): ReactElement => {
  const { party } = useParty()
  return <span data-testid="session">{party?.partyId ?? 'none'}</span>
}

const withSession = (ui: ReactElement): ReactElement => (
  <>
    {ui}
    <Session />
  </>
)

describe('ConnectButton', () => {
  it('renders with the root part', () => {
    renderDisconnected(<ConnectButton data-testid="connect-button" />)
    expect(screen.getByTestId('connect-button')).toHaveClass(connectAnatomy.parts.root)
  })

  it('appends a consumer class to the root part', () => {
    renderDisconnected(<ConnectButton className="extra" data-testid="connect-button" />)
    expect(screen.getByTestId('connect-button')).toHaveClass(connectAnatomy.parts.root, 'extra')
  })

  it('stays put once a session stands', () => {
    render(
      <FakeSessionProvider status="connected">
        <ConnectButton />
      </FakeSessionProvider>,
    )
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument()
  })

  it('goes inert while pending, saying so in its own words', async () => {
    renderWithWallet(<ConnectButton />, { walletPicker: hangingPicker })
    const button = screen.getByRole('button', { name: 'Connect wallet' })
    fireEvent.click(button)

    await waitFor(() => expect(button).toHaveAttribute(connectAnatomy.states.pending, 'true'))
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveTextContent('Connecting…')
  })

  it('ignores every click past the first', async () => {
    const onClick = vi.fn()
    renderWithWallet(<ConnectButton onClick={onClick} />, { walletPicker: hangingPicker })
    const button = screen.getByRole('button', { name: 'Connect wallet' })
    fireEvent.click(button)

    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'))
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('refuses to submit the form it sits in while pending', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
    renderWithWallet(
      <form onSubmit={onSubmit}>
        <ConnectButton type="submit" />
      </form>,
      { walletPicker: hangingPicker },
    )
    const button = screen.getByRole('button', { name: 'Connect wallet' })
    fireEvent.click(button)

    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'))
    onSubmit.mockClear()
    fireEvent.click(button)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps a caller-supplied label while pending, that caller owning what it says', async () => {
    renderWithWallet(<ConnectButton>Confirm in your wallet</ConnectButton>)
    const button = screen.getByRole('button', { name: 'Confirm in your wallet' })
    fireEvent.click(button)

    await waitFor(() => expect(button).toHaveAttribute(connectAnatomy.states.pending, 'true'))
    expect(button).toHaveAccessibleName('Confirm in your wallet')
  })

  it('runs a consumer handler and still connects', async () => {
    const onClick = vi.fn()
    renderWithWallet(withSession(<ConnectButton onClick={onClick} />))
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent(PARTY))
  })

  it('lets a consumer handler bring its own connect by preventing the default', async () => {
    renderWithWallet(withSession(<ConnectButton onClick={(event) => event.preventDefault()} />))
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))

    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('none'))
    expect(screen.getByRole('button', { name: 'Connect wallet' })).not.toHaveAttribute(
      connectAnatomy.states.pending,
    )
  })
})
