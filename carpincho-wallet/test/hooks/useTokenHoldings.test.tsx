import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic } from '@/vault/types'

const ALICE: AccountPublic = {
  // Alice owns the initial holding shown before the user switches parties.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const BOB: AccountPublic = {
  // Bob is selected after Alice, so stale Alice holdings must disappear immediately.
  id: 'account-2',
  name: 'Bob',
  partyId: 'bob::party',
  publicKeyBase64: 'public-key-2',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 2,
}

const Probe = ({
  account,
  api,
}: {
  account: AccountPublic
  api: Cip56HoldingsApi
}): JSX.Element => {
  // Probe renders summary keys so the test can observe hook state across account changes.
  const state = useTokenHoldings(account, { api, pollMs: null })
  return <output>{state.summaries.map((summary) => summary.key).join(',')}</output>
}

describe('useTokenHoldings', () => {
  afterEach(() => {
    // Cleanup unmounts the polling hook and cancels pending timers between scenarios.
    cleanup()
  })

  it('clears previous party holdings while the newly selected party loads', async () => {
    // Scenario: Alice summaries loaded, then the user selects Bob. Bob's wallet-service
    // call can still be in flight, but Alice's balance must no longer appear under Bob.
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async (partyId) => {
        if (partyId === ALICE.partyId) {
          return [
            {
              key: 'unknown-admin:Amulet',
              tokenLabel: 'Amulet',
              instrumentId: { id: 'Amulet' },
              totalAmount: '7',
              source: 'scan',
            },
          ]
        }
        return new Promise(() => undefined)
      },
    }

    const { rerender } = render(
      <Probe
        account={ALICE}
        api={api}
      />,
      { wrapper: TestQueryClientProvider },
    )

    await screen.findByText('unknown-admin:Amulet')

    rerender(
      <Probe
        account={BOB}
        api={api}
      />,
    )

    await waitFor(() => assert.equal(screen.getByRole('status').textContent, ''))
  })
})
