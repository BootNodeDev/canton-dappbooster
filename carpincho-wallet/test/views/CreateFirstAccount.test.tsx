import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'
import { CreateFirstAccount } from '@/views/onboarding/CreateFirstAccount'

const vaultStub = {
  addAccount: async () => undefined,
  importEncryptedVault: async () => ({ imported: 0, skipped: 0, rejected: 0 }),
} as unknown as VaultContextValue

const renderStep = (): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={vaultStub}>
        <CreateFirstAccount />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('CreateFirstAccount', () => {
  afterEach(() => cleanup())

  it('defaults to the create-account form', () => {
    renderStep()
    assert.ok(screen.getByTestId('add-account-hint-input'))
  })

  it('offers a restore tab that swaps in the encrypted-backup upload form', async () => {
    const user = userEvent.setup()
    renderStep()
    // Restore controls are not mounted until the tab is selected.
    assert.equal(screen.queryByLabelText(/backup file/i), null)
    await user.click(screen.getByRole('tab', { name: /restore from backup/i }))
    assert.ok(screen.getByLabelText(/backup file/i))
    assert.ok(screen.getByLabelText(/backup password/i))
    // The restore path never offers party creation.
    assert.equal(screen.queryByTestId('add-account-hint-input'), null)
  })

  it('does not render the connection footer or its settings control', () => {
    renderStep()
    assert.equal(screen.queryByRole('button', { name: 'Connection settings' }), null)
  })
})
