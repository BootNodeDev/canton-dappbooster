import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { getToastEntries, toast } from '@/components/ui/toast'
import { AutoLockList, PasswordForm } from '@/components/VaultPanel'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const baseVault = (): VaultContextValue => ({
  isLocked: false,
  isLoading: false,
  hasVault: true,
  setup: async () => undefined,
  unlock: async () => undefined,
  lock: () => undefined,
  destroyVault: () => undefined,
  accounts: [],
  primary: null,
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
})

const renderWithVault = (overrides: Partial<VaultContextValue>, ui: ReactNode): void => {
  const value = { ...baseVault(), ...overrides }
  render(
    <TooltipProvider>
      <VaultContext.Provider value={value}>{ui}</VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('PasswordForm', () => {
  afterEach(() => {
    toast.clear()
    cleanup()
  })

  it('shows all three fields at once', () => {
    renderWithVault({}, <PasswordForm />)
    assert.ok(screen.getByLabelText(/current password/i))
    assert.ok(screen.getByLabelText(/^new password$/i))
    assert.ok(screen.getByLabelText(/confirm new password/i))
  })

  it('keeps the submit disabled until current is filled and the new pair is valid', async () => {
    const user = userEvent.setup()
    renderWithVault({}, <PasswordForm />)
    const button = (): HTMLButtonElement =>
      screen.getByRole('button', { name: /change password/i }) as HTMLButtonElement
    assert.equal(button().disabled, true)
    await user.type(screen.getByLabelText(/^new password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm new password/i), 'purple-monkey-dishwasher-42')
    assert.equal(button().disabled, true)
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    assert.equal(button().disabled, false)
  })

  it('calls changePassword with current and new, then resets and toasts success', async () => {
    const user = userEvent.setup()
    const calls: Array<[string, string]> = []
    renderWithVault(
      {
        changePassword: async (a, b) => {
          calls.push([a, b])
        },
      },
      <PasswordForm />,
    )
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    await user.type(screen.getByLabelText(/^new password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm new password/i), 'purple-monkey-dishwasher-42')
    await user.click(screen.getByRole('button', { name: /change password/i }))
    assert.deepEqual(calls, [['right-right-1', 'purple-monkey-dishwasher-42']])
    const entries = getToastEntries()
    assert.equal(entries[0]?.variant, 'success')
    assert.equal(entries[0]?.message, 'Password updated.')
    assert.equal((screen.getByLabelText(/current password/i) as HTMLInputElement).value, '')
  })

  it('surfaces an inline error when changePassword rejects', async () => {
    const user = userEvent.setup()
    renderWithVault(
      {
        changePassword: async () => {
          throw new Error('invalid current password')
        },
      },
      <PasswordForm />,
    )
    await user.type(screen.getByLabelText(/current password/i), 'wrong-wrong-1')
    await user.type(screen.getByLabelText(/^new password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm new password/i), 'purple-monkey-dishwasher-42')
    await user.click(screen.getByRole('button', { name: /change password/i }))
    assert.ok(screen.getByText(/invalid current password/i))
  })
})

describe('AutoLockList', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all four options and marks the active row', () => {
    renderWithVault({ autoLockOption: '5m' }, <AutoLockList />)
    for (const label of [/^never$/i, /^1 minute$/i, /^5 minutes$/i, /^1 hour$/i]) {
      assert.ok(screen.getByRole('button', { name: label }))
    }
    const active = screen.getByRole('button', { name: /^5 minutes$/i })
    assert.equal(active.getAttribute('aria-current'), 'true')
  })

  it('calls setAutoLockOption when a row is tapped', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderWithVault(
      { autoLockOption: 'never', setAutoLockOption: (o) => calls.push(o) },
      <AutoLockList />,
    )
    await user.click(screen.getByRole('button', { name: /^1 minute$/i }))
    assert.deepEqual(calls, ['1m'])
  })
})
