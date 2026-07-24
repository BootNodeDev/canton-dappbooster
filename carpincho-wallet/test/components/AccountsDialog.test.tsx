import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountsDialog } from '@/components/AccountsDialog'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCT_A: AccountPublic = {
  id: 'a',
  name: 'alice',
  partyId: 'party-alice-1234567890abcdef',
  publicKeyBase64: 'pk-a',
  network: 'localnet',
  isPrimary: true,
  createdAt: 1,
}
const ACCT_B: AccountPublic = {
  id: 'b',
  name: 'bob',
  partyId: 'party-bob-1234567890abcdef',
  publicKeyBase64: 'pk-b',
  network: 'localnet',
  isPrimary: false,
  createdAt: 2,
}

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: true,
    setup: async () => undefined,
    unlock: async () => undefined,
    lock: () => undefined,
    destroyVault: () => undefined,
    accounts: [ACCT_A, ACCT_B],
    primary: ACCT_A,
    transactions: [],
    setPrimary: async () => undefined,
    addAccount: async () => ({
      id: '',
      name: '',
      partyId: '',
      publicKeyBase64: '',
      network: '',
      isPrimary: false,
      createdAt: 0,
    }),
    removeAccount: async () => undefined,
    signMessage: async () => '',
    recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
    changePassword: async () => undefined,
    verifyPassword: () => false,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
    ...overrides,
  }) as VaultContextValue

const renderDialog = (
  vaultOverrides: Partial<VaultContextValue> = {},
): { onOpenChange: boolean[] } => {
  const onOpenChange: boolean[] = []
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault(vaultOverrides)}>
        <AccountsDialog
          open
          onOpenChange={(next) => onOpenChange.push(next)}
        />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
  return { onOpenChange }
}

describe('AccountsDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('lists accounts other than the current one', async () => {
    // Selecting the already-active account is a no-op, so it is left out of the switcher.
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    assert.equal((dialog.textContent ?? '').includes('alice'), false)
    assert.ok((dialog.textContent ?? '').includes('bob'))
    assert.equal(within(dialog).getAllByTestId('account-item').length, 1)
  })

  it('shows an empty message when the current account is the only one', async () => {
    renderDialog({ accounts: [ACCT_A], primary: ACCT_A })
    await screen.findByRole('dialog')
    assert.equal(screen.queryAllByTestId('account-item').length, 0)
    assert.ok(screen.getByText(/no other accounts/i))
  })

  it('filters by the full party id substring, case-insensitively', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(screen.getByTestId('account-search'), 'PARTY-BOB')
    assert.equal(screen.getAllByTestId('account-item').length, 1)
    const row = screen.getByTestId('account-item').parentElement as HTMLElement
    assert.ok((row.textContent ?? '').includes('bob'))
  })

  it('shows an empty message when nothing matches', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(screen.getByTestId('account-search'), 'zzz-no-match')
    assert.equal(screen.queryAllByTestId('account-item').length, 0)
    assert.ok(screen.getByText(/no accounts match/i))
  })

  it('selects an account and closes the dialog', async () => {
    const user = userEvent.setup()
    const selected: string[] = []
    const { onOpenChange } = renderDialog({
      setPrimary: async (id) => void selected.push(id),
    })
    await screen.findByRole('dialog')
    await user.click(screen.getAllByTestId('account-item')[0])
    assert.deepEqual(selected, ['b'])
    assert.ok(onOpenChange.includes(false))
  })

  it('confirms before removing and calls removeAccount on confirm', async () => {
    const user = userEvent.setup()
    const removed: string[] = []
    renderDialog({ removeAccount: async (id) => void removed.push(id) })
    await screen.findByRole('dialog')

    const bobRow = screen.getAllByTestId('account-item')[0].parentElement as HTMLElement
    await user.click(within(bobRow).getByTestId('account-remove'))

    assert.ok(screen.getByText(/remove bob\?/i))
    assert.ok(screen.getByText(ACCT_B.partyId))
    await user.click(screen.getByTestId('confirm-remove-action'))
    assert.deepEqual(removed, ['b'])
  })

  it('cancels removal via the close button and returns to the list', async () => {
    const user = userEvent.setup()
    const removed: string[] = []
    const { onOpenChange } = renderDialog({ removeAccount: async (id) => void removed.push(id) })
    await screen.findByRole('dialog')

    const bobRow = screen.getAllByTestId('account-item')[0].parentElement as HTMLElement
    await user.click(within(bobRow).getByTestId('account-remove'))
    await user.click(screen.getByRole('button', { name: /close/i }))

    assert.ok(screen.getByTestId('account-search'))
    assert.deepEqual(removed, [])
    assert.equal(onOpenChange.includes(false), false)
  })

  it('hides the remove button when only one account exists', async () => {
    renderDialog({ accounts: [ACCT_A], primary: ACCT_A })
    await screen.findByRole('dialog')
    assert.equal(screen.queryByTestId('account-remove'), null)
  })

  it('drills down to the add-account form and back', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.click(screen.getByTestId('menu-add-account'))
    assert.ok(screen.getByTestId('add-account-hint-input'))
    await user.click(screen.getByRole('button', { name: /back/i }))
    assert.ok(screen.getByTestId('account-search'))
  })

  it('does not close the dialog after confirming a removal', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog({ removeAccount: async () => undefined })
    await screen.findByRole('dialog')

    const bobRow = screen.getAllByTestId('account-item')[0].parentElement as HTMLElement
    await user.click(within(bobRow).getByTestId('account-remove'))
    await user.click(screen.getByTestId('confirm-remove-action'))

    assert.equal(onOpenChange.includes(false), false)
  })

  it('shows only a create button on the add screen, no cancel button', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')

    await user.click(screen.getByTestId('menu-add-account'))
    assert.ok(screen.getByTestId('add-account-submit'))
    assert.equal(screen.queryByTestId('add-account-cancel'), null)
  })
})
