import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetsPanel } from '@/components/AssetsPanel'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { inactivePreapprovalApi } from '@/test-utils/preapproval'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the active wallet party whose token holdings are displayed.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

// Builds the minimum unlocked vault context required by the holdings panel.
const baseVault = (): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: true,
    setup: async () => undefined,
    unlock: async () => undefined,
    lock: () => undefined,
    destroyVault: () => undefined,
    accounts: [ACCOUNT],
    primary: ACCOUNT,
    transactions: [],
    setPrimary: async () => undefined,
    addAccount: async () => ACCOUNT,
    removeAccount: async () => undefined,
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
    changePassword: async () => undefined,
    verifyPassword: () => true,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
  }) as VaultContextValue

// Mounts the panel under vault + tooltip context so it can resolve the account and toggle.
const renderAssets = (
  api: Cip56HoldingsApi,
  preapprovalApi: AmuletPreapprovalApi = inactivePreapprovalApi,
): void => {
  render(
    <TestQueryClientProvider>
      <TooltipProvider>
        <VaultContext.Provider value={baseVault()}>
          <AssetsPanel
            api={api}
            preapprovalApi={preapprovalApi}
          />
        </VaultContext.Provider>
      </TooltipProvider>
    </TestQueryClientProvider>,
  )
}

// Clicks the token row by its visible label so the faucet button is not selected by accident.
const clickTokenRow = async (label: string): Promise<void> => {
  const tokenLabel = await screen.findByText(label)
  const row = tokenLabel.closest('button')
  assert.ok(row)
  await userEvent.click(row)
}

describe('AssetsPanel', () => {
  const originalClipboard = globalThis.navigator?.clipboard

  afterEach(() => {
    // The panel owns a polling hook; cleanup unmounts it before the next scenario.
    cleanup()
    toast.clear()
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
  })

  it('lists each token as an activity-style row without an inline expander', async () => {
    // Scenario: the assets tab now reads like the activity feed: an icon row per
    // token, no per-row "Show holdings" button, and the UTXO count as a subtitle.
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async (partyId) => {
        assert.equal(partyId, 'alice::party')
        return [
          {
            key: 'dso::party:Amulet',
            tokenLabel: 'Amulet',
            instrumentId: { admin: 'dso::party', id: 'Amulet' },
            totalAmount: '15.75',
            utxoCount: 2,
            lockedCount: 0,
            unlockedCount: 2,
            source: 'utxos',
          },
        ]
      },
    }

    renderAssets(api)

    await screen.findByText('Amulet')
    assert.equal(screen.getByText('15.75').textContent, '15.75')
    assert.equal(screen.queryByText(/UTXO/i), null)
    assert.equal(screen.queryByRole('button', { name: /show holdings/i }), null)
  })

  it('opens the token detail modal and fetches UTXOs on demand', async () => {
    // Scenario: clicking a token row opens the balance-first modal, which lazily
    // loads the raw UTXOs for the holdings list.
    let detailsCalls = 0
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [
        {
          key: 'dso::party:Amulet',
          tokenLabel: 'Amulet',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          totalAmount: '15.75',
          source: 'scan',
        },
      ],
      listTokenHoldings: async (partyId) => {
        detailsCalls += 1
        assert.equal(partyId, 'alice::party')
        return [
          {
            contractId: 'holding-cid-1',
            interfaceViewValue: {
              owner: 'alice::party',
              amount: '12.5000000000',
              instrumentId: { admin: 'dso::party', id: 'Amulet' },
              lock: null,
            },
          },
        ]
      },
    }

    renderAssets(api)

    assert.equal(detailsCalls, 0)
    await clickTokenRow('Amulet')

    await screen.findAllByText('15.75')
    await screen.findByText('12.50')
    assert.equal(detailsCalls, 1)
  })

  it('reuses fallback UTXO details from the summary response', async () => {
    // Scenario: when wallet-service falls back from Scan to UTXOs, the summary
    // already carries raw holdings, so opening the modal must not refetch them.
    let detailsCalls = 0
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [
        {
          key: 'dso::party:Amulet',
          tokenLabel: 'Amulet',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          totalAmount: '15.75',
          utxoCount: 1,
          lockedCount: 0,
          unlockedCount: 1,
          source: 'utxos',
          holdings: [
            {
              contractId: 'cached-holding-cid',
              interfaceViewValue: {
                owner: 'alice::party',
                amount: '15.7500000000',
                instrumentId: { admin: 'dso::party', id: 'Amulet' },
                lock: null,
              },
            },
          ],
        },
      ],
      listTokenHoldings: async () => {
        detailsCalls += 1
        return []
      },
    }

    renderAssets(api)

    await clickTokenRow('Amulet')

    // Both the balance and the lone cached holding format to 15.75; two matches with
    // no detail fetch proves the cached UTXO rendered without a round trip.
    const matches = await screen.findAllByText('15.75')
    assert.ok(matches.length >= 2)
    assert.equal(detailsCalls, 0)
  })

  it('shows a spinner while holdings are loading instead of blank space', async () => {
    // Scenario: the first holdings fetch is still in flight. The panel must show a
    // loading indicator rather than an empty body, and not the no-holdings message.
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: () => new Promise(() => {}),
    }

    renderAssets(api)

    await screen.findByRole('status', { name: /loading/i })
    assert.equal(screen.queryByText('No token holdings'), null)
  })

  it('shows an empty state when the party owns no tokens', async () => {
    // Scenario: a brand-new party has no holdings; the panel says so instead of
    // rendering an empty list.
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }

    renderAssets(api)

    await screen.findByText('No token holdings')
  })

  it('shows the auto-accept setting above the holdings list', async () => {
    // Scenario: the auto-accept toggle now lives on the Assets tab as a setting row,
    // with the holdings grouped beneath a label.
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [
        {
          key: 'dso::party:Amulet',
          tokenLabel: 'Amulet',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          totalAmount: '15.75',
          utxoCount: 2,
          lockedCount: 0,
          unlockedCount: 2,
          source: 'utxos',
        },
      ],
    }

    renderAssets(api)

    assert.ok(await screen.findByRole('switch', { name: 'Auto-accept incoming' }))
    assert.equal(screen.getByText('Holdings').textContent, 'Holdings')
  })
})
