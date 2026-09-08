import { FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { WalletButton } from '#src/components/WalletButton'
import {
  cancelAnatomy,
  connectAnatomy,
  disconnectAnatomy,
} from '#src/components/WalletButton/anatomy'
import { hangingPicker, PARTY, renderWithWallet } from '#src/testing/walletSession'

const NETWORK = 'canton:local'
const party = {
  partyId: PARTY,
  networkId: NETWORK,
  namespace: PARTY.split('::')[1] ?? PARTY,
  signingProviderId: 'test',
}

const renderInSession = (ui: ReactElement, isLocked = false): ReturnType<typeof render> =>
  render(
    <FakeSessionProvider
      isLocked={isLocked}
      party={isLocked ? undefined : party}
      status="connected"
    >
      {ui}
    </FakeSessionProvider>,
  )

describe('WalletButton', () => {
  it('shows the connect face with no session', () => {
    render(
      <FakeSessionProvider>
        <WalletButton />
      </FakeSessionProvider>,
    )
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toHaveClass(
      connectAnatomy.parts.root,
    )
  })

  it('shows the disconnect face once a session stands', () => {
    renderInSession(<WalletButton />)
    expect(screen.getByRole('button', { name: 'Disconnect' })).toHaveClass(
      disconnectAnatomy.parts.root,
    )
  })

  // A lock clears the party but keeps the session, which is what the face has to follow.
  it('keeps the disconnect face on a locked session', () => {
    renderInSession(<WalletButton />, true)
    expect(screen.getByRole('button', { name: 'Disconnect' })).toHaveClass(
      disconnectAnatomy.parts.root,
    )
  })

  it('passes children to the face it picks', () => {
    renderInSession(<WalletButton>Account</WalletButton>)
    expect(screen.getByRole('button', { name: 'Account' })).toHaveClass(
      disconnectAnatomy.parts.root,
    )
  })

  it('shows the cancel face while a connect is in flight', async () => {
    renderWithWallet(<WalletButton />, { walletPicker: hangingPicker })
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))

    const cancel = await screen.findByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveClass(cancelAnatomy.parts.root)
    expect(cancel).not.toHaveAttribute('aria-disabled')
  })

  it('hands focus to the face that took over', async () => {
    renderWithWallet(<WalletButton />, { walletPicker: hangingPicker })
    const connect = screen.getByRole('button', { name: 'Connect wallet' })
    connect.focus()
    fireEvent.click(connect)

    const cancel = await screen.findByRole('button', { name: 'Cancel' })
    await waitFor(() => expect(cancel).toHaveFocus())
  })

  it('goes back to the connect face when the attempt is cancelled', async () => {
    renderWithWallet(<WalletButton />, { walletPicker: hangingPicker })
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Connect wallet' })).toHaveClass(
        connectAnatomy.parts.root,
      ),
    )
  })
})
