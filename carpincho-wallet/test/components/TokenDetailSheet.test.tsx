import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { TokenDetailSheet } from '@/components/TokenDetailSheet'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::1220deadbeefc8b64e3',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const SUMMARY: TokenHoldingSummary = {
  key: 'dso::party:Amulet',
  tokenLabel: 'Amulet',
  instrumentId: { admin: 'dso::party', id: 'Amulet' },
  totalAmount: '9997',
  utxoCount: 2,
  lockedCount: 0,
  unlockedCount: 2,
  source: 'utxos',
  holdings: [
    {
      contractId: 'holding-cid-1',
      interfaceViewValue: {
        owner: 'alice::party',
        amount: '9000.0000000000',
        instrumentId: { admin: 'dso::party', id: 'Amulet' },
        lock: null,
      },
    },
    {
      contractId: 'holding-cid-2',
      interfaceViewValue: {
        owner: 'alice::party',
        amount: '997.0000000000',
        instrumentId: { admin: 'dso::party', id: 'Amulet' },
        lock: null,
      },
    },
  ],
}

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

const renderSheet = (): void => {
  render(
    <TestQueryClientProvider>
      <TooltipProvider>
        <VaultContext.Provider value={baseVault()}>
          <TokenDetailSheet
            open={true}
            onOpenChange={() => undefined}
            account={ACCOUNT}
            summary={SUMMARY}
          />
        </VaultContext.Provider>
      </TooltipProvider>
    </TestQueryClientProvider>,
  )
}

describe('TokenDetailSheet', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('shows the balance and holdings list on the detail screen', () => {
    // Scenario: the modal opens on the balance-first detail screen with the token
    // total in big type and each holding listed below.
    renderSheet()

    assert.equal(screen.getByText('9,997.00').textContent, '9,997.00')
    assert.ok(screen.getByText('9,000.00'))
    assert.ok(screen.getByText('997.00'))
  })

  it('opens only one dialog at a time across screens', async () => {
    // Scenario: the one-modal rule means navigating between screens reuses a single
    // dialog rather than stacking nested ones.
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1)
  })

  it('navigates to the send screen and back', async () => {
    // Scenario: Send pushes the transfer form (token preset, no token field) and the
    // back chevron returns to the balance view.
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    assert.ok(screen.getByLabelText('Recipient'))
    assert.equal(screen.queryByLabelText('Token'), null)

    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    assert.ok(screen.getByText('9,000.00'))
  })

  it('shows spendable balance on send and keeps recipient after visiting contacts', async () => {
    // Scenario: balance excludes locked holdings; visiting contacts and returning
    // preserves the typed recipient because form state lives in the sheet.
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await userEvent.type(screen.getByLabelText('Recipient'), 'bob::party')

    assert.ok(screen.getByText(/Balance: 9,997\.00 Amulet/))

    await userEvent.click(screen.getByRole('button', { name: /contacts/i }))
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    assert.equal((screen.getByLabelText('Recipient') as HTMLInputElement).value, 'bob::party')
  })

  it('advances Send -> Review -> Confirm and keeps one dialog', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await userEvent.type(screen.getByLabelText('Recipient'), 'bob::party')
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Review' }))

    assert.ok(screen.getByRole('button', { name: 'Confirm' }))
    assert.ok(screen.getByRole('button', { name: 'Cancel' }))
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1)
  })

  it('closes the whole sheet after a confirmed send', async () => {
    // Scenario: confirming returns the user to the assets tab, not the detail screen.
    let closed = false
    render(
      <TestQueryClientProvider>
        <TooltipProvider>
          <VaultContext.Provider value={baseVault()}>
            <TokenDetailSheet
              open={true}
              onOpenChange={(open) => {
                if (!open) closed = true
              }}
              account={ACCOUNT}
              summary={SUMMARY}
              sendApi={{ createTokenTransfer: async () => ({ updateId: 'u1' }) }}
            />
          </VaultContext.Provider>
        </TooltipProvider>
      </TestQueryClientProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await userEvent.type(screen.getByLabelText('Recipient'), 'bob::party')
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Review' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => assert.equal(closed, true))
  })

  it('navigates to the receive screen showing the party QR and id', async () => {
    // Scenario: Receive shows a scannable QR plus the full party id and a copy button.
    // The sheet renders through a portal, so the QR lives on document, not the container.
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Receive' }))

    assert.ok(document.querySelector('[data-testid="receive-qr"] svg'))
    assert.equal(screen.getByText(ACCOUNT.partyId).textContent, ACCOUNT.partyId)
    assert.ok(screen.getByRole('button', { name: /copy party id/i }))
  })

  it('opens a holding detail from the list and back', async () => {
    // Scenario: each holding row drills into the full UTXO detail (contract id, lock).
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: /9,000\.00/ }))
    assert.equal(screen.getByText('holding-cid-1').textContent, 'holding-cid-1')

    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    assert.ok(screen.getByText('997.00'))
  })
})
