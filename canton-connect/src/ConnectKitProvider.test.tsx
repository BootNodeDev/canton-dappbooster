import { render, screen } from '@testing-library/react'
import type { JSX } from 'react'
import { describe, expect, it } from 'vitest'
import { ConnectKitProvider, useConnectKitContext } from './ConnectKitProvider'

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
    expect(screen.getByTestId('status').textContent).toBe('idle')
    expect(screen.getByTestId('connected').textContent).toBe('no-client')
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')
  })

  it('useConnectKitContext throws when used outside the provider', () => {
    const Naked = (): JSX.Element => {
      useConnectKitContext()
      return <span />
    }
    expect(() => render(<Naked />)).toThrow(/inside a <ConnectKitProvider>/)
  })
})
