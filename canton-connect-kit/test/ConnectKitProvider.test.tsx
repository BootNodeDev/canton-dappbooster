import './setup-dom'
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { render, screen } from '@testing-library/react'
import type { JSX } from 'react'
import { ConnectKitProvider, useConnectKitContext } from '../src/ConnectKitProvider'

const config = { appName: 'Test dApp' }

const StatusProbe = (): JSX.Element => {
  const ctx = useConnectKitContext()
  return (
    <>
      <span data-testid="status">{ctx.status}</span>
      <span data-testid="connected">{ctx.client === undefined ? 'no-client' : 'has-client'}</span>
      <span data-testid="locked">{ctx.isLocked ? 'locked' : 'unlocked'}</span>
    </>
  )
}

describe('ConnectKitProvider', () => {
  it('initial state is idle with no client and not locked', () => {
    render(
      <ConnectKitProvider config={config}>
        <StatusProbe />
      </ConnectKitProvider>,
    )
    assert.equal(screen.getByTestId('status').textContent, 'idle')
    assert.equal(screen.getByTestId('connected').textContent, 'no-client')
    assert.equal(screen.getByTestId('locked').textContent, 'unlocked')
  })

  it('useConnectKitContext throws when used outside the provider', () => {
    const Naked = (): JSX.Element => {
      useConnectKitContext()
      return <span />
    }
    assert.throws(() => render(<Naked />), /inside a <ConnectKitProvider>/)
  })
})
