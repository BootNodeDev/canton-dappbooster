import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AMULET_PREAPPROVAL_POLL_MS,
  type AmuletPreapprovalApi,
  useAmuletPreapproval,
} from '@/hooks/useAmuletPreapproval'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic } from '@/vault/types'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the receiver whose Amulet preapproval status is polled.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

// Renders hook state into the DOM so tests can observe busy/loading across actions.
const Probe = ({ api }: { api: AmuletPreapprovalApi }): JSX.Element => {
  const state = useAmuletPreapproval(ACCOUNT, {
    api,
    pollMs: null,
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
  })
  return (
    <div>
      <span data-testid="busy">{state.busy ? 'busy' : 'idle'}</span>
      <span data-testid="loading">{state.loading ? 'loading' : 'idle'}</span>
      <span data-testid="status">{state.status === undefined ? 'none' : 'loaded'}</span>
      <button
        type="button"
        onClick={() => {
          void state.enable()
        }}
      >
        Enable
      </button>
      <button
        type="button"
        onClick={() => {
          void state.refresh()
        }}
      >
        Refresh
      </button>
    </div>
  )
}

describe('useAmuletPreapproval', () => {
  afterEach(() => {
    // Each test mounts a probe with its own fake API state.
    cleanup()
  })

  it('uses a five-second polling interval by default', () => {
    // Scenario: the preapproval contract has no browser stream, so the toggle relies
    // on polling to reflect changes made elsewhere.
    assert.equal(AMULET_PREAPPROVAL_POLL_MS, 5_000)
  })

  it('stays idle through a background refetch', async () => {
    // Scenario: a poll-driven refetch must not read as busy, or the toggle would
    // disable itself on every 5s tick.
    let resolveRefetch: (() => void) | undefined
    let calls = 0
    const api: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => {
        calls += 1
        if (calls >= 2) {
          await new Promise<void>((resolve) => {
            resolveRefetch = resolve
          })
        }
        return { active: false, expired: false }
      },
      createAmuletPreapproval: async () => ({ updateId: 'noop' }),
      cancelAmuletPreapproval: async () => ({ updateId: 'noop' }),
    }

    render(<Probe api={api} />, { wrapper: TestQueryClientProvider })

    await waitFor(() => assert.equal(screen.getByTestId('status').textContent, 'loaded'))
    assert.equal(screen.getByTestId('busy').textContent, 'idle')

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => assert.equal(screen.getByTestId('loading').textContent, 'loading'))
    assert.equal(screen.getByTestId('busy').textContent, 'idle')

    resolveRefetch?.()
    await waitFor(() => assert.equal(screen.getByTestId('loading').textContent, 'idle'))
  })

  it('reads as busy only while an enable action is in flight', async () => {
    // Scenario: flipping the toggle on should mark the hook busy until the create
    // command and its follow-up refetch settle.
    let resolveCreate: (() => void) | undefined
    const api: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => ({ active: false, expired: false }),
      createAmuletPreapproval: async () => {
        await new Promise<void>((resolve) => {
          resolveCreate = resolve
        })
        return { updateId: 'create-update-1' }
      },
      cancelAmuletPreapproval: async () => ({ updateId: 'noop' }),
    }

    render(<Probe api={api} />, { wrapper: TestQueryClientProvider })

    await waitFor(() => assert.equal(screen.getByTestId('status').textContent, 'loaded'))
    assert.equal(screen.getByTestId('busy').textContent, 'idle')

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))

    await waitFor(() => assert.equal(screen.getByTestId('busy').textContent, 'busy'))

    resolveCreate?.()
    await waitFor(() => assert.equal(screen.getByTestId('busy').textContent, 'idle'))
  })
})
