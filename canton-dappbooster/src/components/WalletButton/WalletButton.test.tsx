import { FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { WalletButton } from '#src/components/WalletButton'
import { connectAnatomy, disconnectAnatomy } from '#src/components/WalletButton/anatomy'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
const NETWORK = 'canton:local'
const party = {
  partyId: PARTY,
  networkId: NETWORK,
  namespace: PARTY.split('::')[1] ?? PARTY,
  signingProviderId: 'test',
  partyType: 'unknown' as const,
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
})
