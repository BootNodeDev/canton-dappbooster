import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ConnectionFooter,
  type DappFooterStatus,
  type WalletServiceFooterStatus,
} from '@/components/ConnectionFooter'

const connectedService: WalletServiceFooterStatus = {
  // Wallet-service fixture representing a healthy Canton network connection.
  connected: true,
  networkId: 'canton:local',
}

const offlineService: WalletServiceFooterStatus = {
  // Wallet-service fixture representing an unreachable service or disconnected Canton network.
  connected: false,
  networkId: 'canton:local',
}

const noDapp: DappFooterStatus = {
  // Empty dApp fixture used when no page has communicated with the extension.
  kind: 'none',
}

const detectedDapp: DappFooterStatus = {
  // Detected dApp fixture matching a browser page that contacted the extension without connecting.
  kind: 'detected',
  host: 'app.uniswap.org',
  subtitle: 'Not connected',
}

const connectedDapp: DappFooterStatus = {
  // Connected dApp fixture representing an active session.
  kind: 'connected',
  host: 'localhost:5173',
  subtitle: 'Connected',
}

describe('ConnectionFooter', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens settings from the network pill and shows the network name', async () => {
    // Scenario: Canton is connected, so the pill shows the network and routes to settings.
    const user = userEvent.setup()
    let settingsCalls = 0
    render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={noDapp}
        onOpenSettings={() => {
          settingsCalls += 1
        }}
      />,
    )

    assert.ok(screen.getByText('local'))
    await user.click(screen.getByRole('button', { name: /connection settings/i }))
    assert.equal(settingsCalls, 1)
  })

  it('shows the offline pill when the wallet-service is unreachable', () => {
    // Scenario: Canton is unavailable, so the pill makes the service problem explicit.
    render(
      <ConnectionFooter
        walletService={offlineService}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('Offline'))
  })

  it('marks a connected service with a missing network id as unknown', () => {
    // Scenario: wallet-service confirms connectivity but omits the network metadata.
    render(
      <ConnectionFooter
        walletService={{ connected: true }}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('unknown'))
  })

  it('shows a placeholder when no dApp is connected', () => {
    // Scenario: nothing is connected and no site context exists.
    render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('No dApp connected'))
  })

  it('shows a detected but unconnected site host with a not-connected status', () => {
    // Scenario: a site is open but has not connected, so its host shows as not connected.
    render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={detectedDapp}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('app.uniswap.org'))
    assert.ok(screen.getByText('Not connected'))
    assert.equal(screen.queryByRole('button', { name: /disconnect/i }), null)
  })

  it('shows the connected host with a disconnect control', async () => {
    // Scenario: a dApp is connected, so the footer shows the host, status, and disconnect.
    const user = userEvent.setup()
    let disconnects = 0
    render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={connectedDapp}
        onDisconnectDapp={() => {
          disconnects += 1
        }}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('localhost:5173'))
    assert.ok(screen.getByText('Connected'))
    await user.click(screen.getByRole('button', { name: /disconnect/i }))
    assert.equal(disconnects, 1)
  })

  it('falls back to a host monogram when the dApp has no favicon', () => {
    // Scenario: connected dApp without an icon, so the avatar shows the first host letter.
    render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={connectedDapp}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('L'))
  })

  it('keeps dApp connection and wallet-service health independent', () => {
    // Scenario: a connected dApp coexists with an unreachable wallet-service.
    render(
      <ConnectionFooter
        walletService={offlineService}
        dapp={connectedDapp}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('Connected'))
    assert.ok(screen.getByText('Offline'))
  })
})
