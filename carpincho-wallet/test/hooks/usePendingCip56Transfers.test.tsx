import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CIP56_TRANSFER_POLL_MS,
  type Cip56TransferApi,
  usePendingCip56Transfers,
} from '@/hooks/usePendingCip56Transfers'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic } from '@/vault/types'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the selected party whose incoming token transfers are polled.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const SECOND_ACCOUNT: AccountPublic = {
  // Second account fixture catches stale incoming transfers after switching parties.
  id: 'account-2',
  name: 'Bob',
  partyId: 'bob::party',
  publicKeyBase64: 'public-key-2',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 2,
}

const Probe = ({
  account = ACCOUNT,
  api,
}: {
  account?: AccountPublic
  api: Cip56TransferApi
}): JSX.Element => {
  // Probe renders raw transfer ids so the test can observe hook state across account changes.
  const state = usePendingCip56Transfers(account, {
    api,
    pollMs: null,
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
  })
  return (
    <div>
      <output>{state.transfers.map((transfer) => transfer.contractId).join(',')}</output>
      <span>{state.error ?? 'no-error'}</span>
      <button
        type="button"
        onClick={() => {
          void state.accept('transfer-cid-1')
        }}
      >
        Accept
      </button>
    </div>
  )
}

describe('usePendingCip56Transfers', () => {
  afterEach(() => {
    // Each test mounts a hook probe with its own fake API state.
    cleanup()
  })

  it('uses a five-second polling interval by default', () => {
    // Scenario: pending transfer acceptance has no browser websocket, so the
    // hook must poll often enough for the popup to update without manual refresh.
    assert.equal(CIP56_TRANSFER_POLL_MS, 5_000)
  })

  it('loads pending transfers immediately and refreshes after accept', async () => {
    // Scenario: opening the token actions view should show the current pending transfer
    // list, then accepting one should ask the API to accept and refresh the list.
    const calls: string[] = []
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => {
        calls.push('list')
        return calls.includes('accept') ? [] : [{ contractId: 'transfer-cid-1' }]
      },
      acceptTransfer: async ({ account, transferInstructionCid }) => {
        calls.push('accept')
        assert.equal(account.id, 'account-1')
        assert.equal(transferInstructionCid, 'transfer-cid-1')
        return { updateId: 'update-1' }
      },
    }

    render(<Probe api={api} />, { wrapper: TestQueryClientProvider })

    await waitFor(() =>
      assert.equal(screen.getByText('transfer-cid-1').textContent, 'transfer-cid-1'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => assert.equal(screen.getByRole('status').textContent, ''))

    assert.deepEqual(calls, ['list', 'accept', 'list'])
  })

  it('clears previous party transfers while the newly selected party loads', async () => {
    // Scenario: Alice has an incoming transfer, then the user selects Bob. Bob's
    // wallet-service call can still be in flight, but Alice's request must not remain visible.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async (partyId) => {
        if (partyId === ACCOUNT.partyId) {
          return [{ contractId: 'alice-transfer-cid' }]
        }
        return new Promise(() => undefined)
      },
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    const { rerender } = render(
      <Probe
        account={ACCOUNT}
        api={api}
      />,
      { wrapper: TestQueryClientProvider },
    )

    await screen.findByText('alice-transfer-cid')

    rerender(
      <Probe
        account={SECOND_ACCOUNT}
        api={api}
      />,
    )

    await waitFor(() => assert.equal(screen.getByRole('status').textContent, ''))
  })
})
