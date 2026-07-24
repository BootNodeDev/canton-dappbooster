import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfigureRpcStep } from '@/views/onboarding/ConfigureRpcStep'

const originalFetch = globalThis.fetch

const respondConnected = (): void => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        result: {
          connection: { isNetworkConnected: true },
          network: { networkId: 'canton:local' },
        },
      }),
      { status: 200 },
    )
}

const continueButton = (): HTMLButtonElement =>
  screen.getByTestId('configure-rpc-continue') as HTMLButtonElement

describe('ConfigureRpcStep', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    globalThis.fetch = originalFetch
  })

  it('enables Continue once the wallet-service is reachable', async () => {
    respondConnected()
    render(<ConfigureRpcStep onConfirmed={() => undefined} />)
    assert.equal(continueButton().disabled, true)
    await waitFor(() => assert.equal(continueButton().disabled, false))
    assert.ok(screen.getByText(/reachable/i))
    assert.ok(screen.getByText('local'))
  })

  it('persists the URL and calls onConfirmed on Continue', async () => {
    respondConnected()
    let confirmed = false
    render(
      <ConfigureRpcStep
        onConfirmed={() => {
          confirmed = true
        }}
      />,
    )
    await waitFor(() => assert.equal(continueButton().disabled, false))
    await userEvent.click(continueButton())
    assert.equal(confirmed, true)
    assert.match(localStorage.getItem('carpincho.runtime-config.v2') ?? '', /localhost:3010/)
  })

  it('keeps Continue disabled with a reason when unreachable and shows no Test button', async () => {
    globalThis.fetch = async () => {
      throw new Error('Failed to fetch')
    }
    render(<ConfigureRpcStep onConfirmed={() => undefined} />)
    await waitFor(() => {
      assert.ok(screen.getByText(/can.t reach wallet-service/i))
      assert.equal(continueButton().disabled, true)
    })
    assert.equal(screen.queryByRole('button', { name: /^test$/i }), null)
  })

  it('re-gates Continue when the URL is edited', async () => {
    respondConnected()
    render(<ConfigureRpcStep onConfirmed={() => undefined} />)
    await waitFor(() => assert.equal(continueButton().disabled, false))
    await userEvent.type(screen.getByLabelText(/wallet-service rpc url/i), 'x')
    assert.equal(continueButton().disabled, true)
  })

  it('auto-recovers and enables Continue once wallet-service comes up', async () => {
    let reachable = false
    globalThis.fetch = async () => {
      if (!reachable) throw new Error('Failed to fetch')
      return new Response(
        JSON.stringify({
          result: {
            connection: { isNetworkConnected: true },
            network: { networkId: 'canton:local' },
          },
        }),
        { status: 200 },
      )
    }
    render(<ConfigureRpcStep onConfirmed={() => undefined} />)
    await waitFor(() => assert.ok(screen.getByText(/can.t reach wallet-service/i)), {
      timeout: 2000,
    })
    assert.equal(continueButton().disabled, true)
    reachable = true
    await waitFor(() => assert.equal(continueButton().disabled, false), { timeout: 5000 })
  })
})
