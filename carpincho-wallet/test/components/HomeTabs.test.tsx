import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { HomeTabs } from '@/components/HomeTabs'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { inactivePreapprovalApi } from '@/test-utils/preapproval'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic, TransactionRecord } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the active wallet party whose hidden tabs poll service state.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const SECOND_ACCOUNT: AccountPublic = {
  // Second account fixture catches stale tab state when the selected party changes.
  id: 'account-2',
  name: 'Bob',
  partyId: 'bob::party',
  publicKeyBase64: 'public-key-2',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 2,
}

// Creates an executed transaction tied to one wallet account for Activity filtering.
const txFor = (account: AccountPublic, id: string, summary: string): TransactionRecord => ({
  id,
  accountId: account.id,
  accountName: account.name,
  partyId: account.partyId,
  network: account.network,
  method: 'canton_prepareExecuteAndWait',
  status: 'executed',
  createdAt: Date.parse('2026-06-10T12:00:00.000Z'),
  preparedTransactionHash: `${id}-hash`,
  summary,
})

// Builds the minimum unlocked vault context required by HomeTabs child panels.
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

// Wraps HomeTabs in the providers its child panels depend on (query, tooltip, vault).
const renderHome = (vault: VaultContextValue, children: ReactNode): void => {
  render(
    <TestQueryClientProvider>
      <TooltipProvider>
        <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>
      </TooltipProvider>
    </TestQueryClientProvider>,
  )
}

describe('HomeTabs navigation', () => {
  afterEach(() => {
    // HomeTabs child panels can own polling hooks, so unmount them between scenarios.
    cleanup()
  })

  it('renders Assets, Activity, and Utils tabs without Transfers or Send', () => {
    // Scenario: the Transfers tab is gone; pending transfers live in Activity now.
    renderHome(
      baseVault(),
      <HomeTabs
        transactions={[]}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    assert.equal(screen.getByRole('tab', { name: 'Assets' }).getAttribute('data-state'), 'active')
    assert.ok(screen.getByRole('tab', { name: 'Activity' }))
    assert.ok(screen.getByRole('tab', { name: 'Utils' }))
    assert.equal(screen.queryByRole('tab', { name: 'Transfers' }), null)
    assert.equal(screen.queryByRole('tab', { name: 'Send' }), null)
  })

  it('opens the Assets tab with the current party holdings', async () => {
    // Scenario: token balances live in the Assets tab, separate from incoming
    // transfer requests. Opening Assets should mount the holdings panel for the
    // active account and show the token row.
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [
        {
          key: 'dso::party:Amulet',
          tokenLabel: 'Amulet',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          totalAmount: '7',
          utxoCount: 1,
          source: 'scan',
        },
      ],
    }

    renderHome(
      baseVault(),
      <HomeTabs
        transactions={[]}
        tokensApi={holdingsApi}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Assets' }))

    await screen.findByText('Amulet')
  })

  it('badges the Activity tab when hidden incoming transfers require action', async () => {
    // Scenario: the Activity content is force-mounted, so its incoming-transfer polling
    // badges the tab even while Assets is selected.
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'transfer-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party',
              receiver: 'alice::party',
              amount: '42',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }

    renderHome(
      baseVault(),
      <HomeTabs
        transactions={[]}
        tokensApi={holdingsApi}
        transfersApi={transfersApi}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    assert.equal(screen.getByRole('tab', { name: 'Assets' }).getAttribute('data-state'), 'active')
    await screen.findByRole('tab', { name: 'Activity 1' })
  })

  it('keeps the optimistic auto-accept toggle on across tab switches', async () => {
    // Scenario: enabling auto-accept flips the toggle on optimistically while the ledger
    // catches up. Switching tabs must not unmount the Assets panel and lose that state.
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }

    renderHome(
      baseVault(),
      <HomeTabs
        transactions={[]}
        tokensApi={holdingsApi}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    const toggle = await screen.findByRole('switch', { name: 'Auto-accept incoming' })
    await waitFor(() => assert.equal(toggle.hasAttribute('disabled'), false))
    await userEvent.click(toggle)
    await waitFor(() => assert.equal(toggle.getAttribute('aria-checked'), 'true'))

    // Leave the Assets tab and come back.
    await userEvent.click(screen.getByRole('tab', { name: 'Activity' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Assets' }))

    const toggleAfter = await screen.findByRole('switch', { name: 'Auto-accept incoming' })
    assert.equal(toggleAfter.getAttribute('aria-checked'), 'true')
  })

  it('shows Activity only for the selected account', async () => {
    // Scenario: Alice and Bob share one local vault, but Activity belongs to the
    // selected party. Switching to Bob must hide Alice's transaction history.
    renderHome(
      { ...baseVault(), accounts: [ACCOUNT, SECOND_ACCOUNT], primary: SECOND_ACCOUNT },
      <HomeTabs
        account={SECOND_ACCOUNT}
        transactions={[
          txFor(ACCOUNT, 'tx-alice', 'Alice transfer'),
          txFor(SECOND_ACCOUNT, 'tx-bob', 'Bob transfer'),
        ]}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Activity' }))

    assert.equal(screen.queryByText('Alice transfer'), null)
    assert.equal(screen.getByText('Bob transfer').textContent, 'Bob transfer')
  })
})
