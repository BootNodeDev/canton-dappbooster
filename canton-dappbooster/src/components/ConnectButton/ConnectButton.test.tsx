import { CantonConnectProvider, createMockAdapter } from '@bootnodedev/canton-connect'
import { createAutoPicker, FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { stubResizeObserver } from '../../testing/resizeObserver'
import { ConnectButton } from '.'
import { anatomy, popoverAnatomy } from './anatomy'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
const SHORT_PARTY = 'nico::1220df…0b1cbb46'
const NETWORK = 'canton:local'

// Every state below the connect flow itself, so a markup assertion pays no SDK discovery sleep.
// null is a session naming no party at all, which an explicit undefined could not say here.
const renderInSession = (
  ui: ReactElement,
  party: { partyId: string } | null = { partyId: PARTY },
): ReturnType<typeof render> =>
  render(
    <FakeSessionProvider
      party={party === null ? undefined : { ...party, networkId: NETWORK }}
      status="connected"
    >
      {ui}
    </FakeSessionProvider>,
  )

const renderDisconnected = (ui: ReactElement): ReturnType<typeof render> =>
  render(<FakeSessionProvider>{ui}</FakeSessionProvider>)

// The connect flow is the SDK's, so the few tests that drive it drive the real provider.
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
    </CantonConnectProvider>,
  )

describe('ConnectButton', () => {
  it('renders with the root part', () => {
    renderDisconnected(<ConnectButton data-testid="connect-button" />)
    expect(screen.getByTestId('connect-button')).toHaveClass(anatomy.parts.root)
  })

  it('appends a consumer class to the root part', () => {
    renderDisconnected(<ConnectButton className="extra" data-testid="connect-button" />)
    expect(screen.getByTestId('connect-button')).toHaveClass(anatomy.parts.root, 'extra')
  })

  it('shows the connect face while no session exists', () => {
    renderDisconnected(<ConnectButton data-testid="connect-button" />)
    expect(screen.getByTestId('connect-button')).toHaveAttribute(anatomy.states.mode, 'connect')
  })

  it('renames the connect face while pending, keeping it focusable to announce that', async () => {
    renderWithWallet(<ConnectButton>Connect wallet</ConnectButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
    const button = await screen.findByRole('button', { name: 'Connecting…' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute(anatomy.states.pending, 'true')
    expect(button).toBeEnabled()
  })

  it('runs a consumer handler on the connect face and still connects', async () => {
    const onClick = vi.fn()
    renderWithWallet(<ConnectButton onClick={onClick}>Connect wallet</ConnectButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: SHORT_PARTY })).toBeInTheDocument()
  })

  it('lets a consumer handler bring its own connect by preventing the default', async () => {
    renderWithWallet(
      <ConnectButton onClick={(event) => event.preventDefault()}>Connect wallet</ConnectButton>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))

    expect(await screen.findByRole('button', { name: 'Connect wallet' })).toHaveAttribute(
      anatomy.states.mode,
      'connect',
    )
  })

  it('renders nothing where the placement wants the account face and there is no session', () => {
    renderDisconnected(<ConnectButton mode="account" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('names the account face by its truncated party id once connected', () => {
    renderInSession(<ConnectButton />)
    expect(screen.getByRole('button', { name: SHORT_PARTY })).toHaveAttribute(
      anatomy.states.mode,
      'account',
    )
  })

  it('hands the party id to a consumer avatar, beside the party id', () => {
    renderInSession(<ConnectButton avatar={(partyId) => <img alt="" src={`${partyId}.svg`} />} />)

    expect(screen.getByRole('button', { name: SHORT_PARTY })).toContainElement(
      screen.getByRole('presentation'),
    )
    expect(screen.getByRole('presentation')).toHaveAttribute('src', `${PARTY}.svg`)
  })

  it('keeps the connect face where a session names no party', () => {
    renderInSession(<ConnectButton mode="connect">Connect wallet</ConnectButton>, null)
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toHaveAttribute(
      anatomy.states.mode,
      'connect',
    )
  })

  it('keeps the connect face where the wallet names an empty party', () => {
    renderInSession(<ConnectButton mode="connect">Connect wallet</ConnectButton>, { partyId: '' })
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toHaveAttribute(
      anatomy.states.mode,
      'connect',
    )
  })

  it('renders no popover panel until it is opened, and drops it again on close', async () => {
    stubResizeObserver()
    renderInSession(<ConnectButton />)
    const trigger = screen.getByRole('button', { name: SHORT_PARTY })

    expect(document.querySelector(`.${popoverAnatomy.parts.content}`)).toBeNull()

    fireEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: 'Account' })).toBeInTheDocument()

    fireEvent.click(trigger)
    await waitFor(() =>
      expect(document.querySelector(`.${popoverAnatomy.parts.content}`)).toBeNull(),
    )
  })

  it('names the popover it opens from the account face', async () => {
    // Opening it starts the popper, which watches its reference through a ResizeObserver.
    stubResizeObserver()
    renderInSession(<ConnectButton />)
    fireEvent.click(screen.getByRole('button', { name: SHORT_PARTY }))
    expect(await screen.findByRole('dialog', { name: 'Account' })).toBeInTheDocument()
  })

  it('runs a consumer handler on the account face and still opens the popover', async () => {
    stubResizeObserver()
    const onClick = vi.fn()
    renderInSession(<ConnectButton mode="account" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: SHORT_PARTY }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('dialog', { name: 'Account' })).toBeInTheDocument()
  })

  it('marks the party id it places in the popover with its own part', async () => {
    stubResizeObserver()
    renderInSession(<ConnectButton />)
    fireEvent.click(screen.getByRole('button', { name: SHORT_PARTY }))

    expect(await screen.findByRole('dialog', { name: 'Account' })).toContainElement(
      document.querySelector<HTMLElement>(`.${popoverAnatomy.parts.partyId}`),
    )
  })

  it('ends the session from the popover, returning to the connect face', async () => {
    stubResizeObserver()
    renderInSession(<ConnectButton>Connect wallet</ConnectButton>)
    fireEvent.click(screen.getByRole('button', { name: SHORT_PARTY }))
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    expect(await screen.findByRole('button', { name: 'Connect wallet' })).toHaveAttribute(
      anatomy.states.mode,
      'connect',
    )
  })

  it('leaves the page where the placement only wants the connect face', () => {
    renderInSession(
      <>
        <ConnectButton data-testid="header" />
        <ConnectButton data-testid="hero" mode="connect">
          Connect wallet
        </ConnectButton>
      </>,
    )
    expect(screen.getByTestId('header')).toHaveAttribute(anatomy.states.mode, 'account')
    expect(screen.queryByTestId('hero')).not.toBeInTheDocument()
  })
})
