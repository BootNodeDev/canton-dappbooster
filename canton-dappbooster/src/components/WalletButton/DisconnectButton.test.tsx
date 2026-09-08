import { useParty } from '@bootnodedev/canton-connect'
import { FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { disconnectAnatomy } from '#src/components/WalletButton/anatomy'
import { DisconnectButton } from '#src/components/WalletButton/DisconnectButton'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
const NETWORK = 'canton:local'
const party = {
  partyId: PARTY,
  networkId: NETWORK,
  namespace: PARTY.split('::')[1] ?? PARTY,
  signingProviderId: 'test',
}

// The button renders whatever the session says, so the session itself is what a disconnect asserts.
const Session = (): ReactElement => {
  const { isConnected } = useParty()
  return <span data-testid="session">{isConnected ? 'connected' : 'disconnected'}</span>
}

const renderInSession = (ui: ReactElement): ReturnType<typeof render> =>
  render(
    <FakeSessionProvider party={party} status="connected">
      {ui}
      <Session />
    </FakeSessionProvider>,
  )

describe('DisconnectButton', () => {
  it('renders with the root part', () => {
    renderInSession(<DisconnectButton data-testid="account-button" />)
    expect(screen.getByTestId('account-button')).toHaveClass(disconnectAnatomy.parts.root)
  })

  it('appends a consumer class to the root part', () => {
    renderInSession(<DisconnectButton className="extra" data-testid="account-button" />)
    expect(screen.getByTestId('account-button')).toHaveClass(disconnectAnatomy.parts.root, 'extra')
  })

  it('names itself for the action it carries', () => {
    renderInSession(<DisconnectButton />)
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  })

  it('takes a caller label over its own', () => {
    renderInSession(<DisconnectButton>Account</DisconnectButton>)
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument()
  })

  it('ends the session', async () => {
    renderInSession(<DisconnectButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('disconnected'))
  })

  it('runs a consumer handler and still disconnects', async () => {
    const onClick = vi.fn()
    renderInSession(<DisconnectButton onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('disconnected'))
  })

  it('lets a consumer handler keep the session by preventing the default', async () => {
    renderInSession(<DisconnectButton onClick={(event) => event.preventDefault()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('connected'))
  })
})
