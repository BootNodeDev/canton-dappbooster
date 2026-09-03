import { CantonConnectProvider, createMockAdapter, useParty } from '@bootnodedev/canton-connect'
import { createAutoPicker, FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { connectAnatomy } from '#src/components/WalletButton/anatomy'
import { ConnectButton } from '#src/components/WalletButton/ConnectButton'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'

// The button keeps its own face through a connect, so the session itself is what a connect asserts.
const Session = (): ReactElement => {
  const { party } = useParty()
  return <span data-testid="session">{party?.partyId ?? 'none'}</span>
}

const renderDisconnected = (ui: ReactElement): ReturnType<typeof render> =>
  render(<FakeSessionProvider>{ui}</FakeSessionProvider>)

// The connect flow is the SDK's, so the tests that drive it drive the real provider.
const renderWithWallet = (ui: ReactElement): ReturnType<typeof render> =>
  render(
    <CantonConnectProvider
      config={{
        additionalAdapters: [createMockAdapter({ accounts: [{ partyId: PARTY }] })],
        appName: 'test',
        walletPicker: createAutoPicker('mock'),
      }}
    >
      {ui}
      <Session />
    </CantonConnectProvider>,
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

  it('renames itself while pending, keeping it focusable to announce that', async () => {
    renderWithWallet(<ConnectButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
    const button = await screen.findByRole('button', { name: 'Connecting…' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute(connectAnatomy.states.pending, 'true')
    expect(button).toBeEnabled()
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
    renderWithWallet(<ConnectButton onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent(PARTY))
  })

  it('lets a consumer handler bring its own connect by preventing the default', async () => {
    renderWithWallet(<ConnectButton onClick={(event) => event.preventDefault()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))

    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('none'))
    expect(screen.getByRole('button', { name: 'Connect wallet' })).not.toHaveAttribute(
      connectAnatomy.states.pending,
    )
  })
})
