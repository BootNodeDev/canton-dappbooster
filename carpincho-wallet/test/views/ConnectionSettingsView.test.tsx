import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getToastEntries, toast } from '@/components/ui/toast'
import { loadRuntimeConfig } from '@/config/runtimeConfig'
import { ConnectionSettingsView } from '@/views/ConnectionSettingsView'

const originalFetch = globalThis.fetch

const lastToast = (): { variant: string; message: unknown } | undefined => {
  const entries = getToastEntries()
  return entries.length === 0 ? undefined : entries[entries.length - 1]
}

const installStatus = (body: unknown, ok = true): void => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as typeof globalThis.fetch
}

describe('ConnectionSettingsView', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
    localStorage.clear()
    globalThis.fetch = originalFetch
  })

  it('renders the current runtime config', () => {
    // Scenario: runtime config should only expose the wallet-service endpoint for editing.
    // The Canton network is discovered from wallet-service status, so no editable local value
    // should be present in the settings form.
    render(<ConnectionSettingsView />)
    assert.equal(
      (screen.getByLabelText('Wallet-service RPC URL') as HTMLInputElement).value,
      'http://localhost:3010/rpc',
    )
    assert.equal(screen.queryByLabelText('Canton network'), null)
  })

  it('saves edited config and confirms with a success toast', async () => {
    render(<ConnectionSettingsView />)

    fireEvent.change(screen.getByLabelText('Wallet-service RPC URL'), {
      target: { value: 'http://localhost:9999/rpc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => assert.equal(lastToast()?.variant, 'success'))
    assert.equal(loadRuntimeConfig().walletServiceRpcUrl, 'http://localhost:9999/rpc')
  })

  it('reports a reachable wallet-service when Canton is connected', async () => {
    installStatus({
      result: { connection: { isNetworkConnected: true }, network: { networkId: 'canton:local' } },
    })
    render(<ConnectionSettingsView />)

    fireEvent.click(screen.getByRole('button', { name: 'Test' }))

    await waitFor(() => assert.equal(lastToast()?.variant, 'success'))
    assert.match(String(lastToast()?.message), /reachable: canton:local/)
  })

  it('warns when the wallet-service responds but Canton is not connected', async () => {
    installStatus({
      result: {
        connection: { isNetworkConnected: false, networkReason: 'syncing' },
        network: { networkId: 'canton:local' },
      },
    })
    render(<ConnectionSettingsView />)

    fireEvent.click(screen.getByRole('button', { name: 'Test' }))

    await waitFor(() => assert.equal(lastToast()?.variant, 'warning'))
  })

  it('surfaces an error when the wallet-service request fails', async () => {
    installStatus({}, false)
    render(<ConnectionSettingsView />)

    fireEvent.click(screen.getByRole('button', { name: 'Test' }))

    await waitFor(() => assert.equal(lastToast()?.variant, 'error'))
  })
})
