import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'
import { OnboardingFlow } from '@/views/onboarding/OnboardingFlow'

const originalFetch = globalThis.fetch

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: false,
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
    exportPrivateKey: () => '',
    signMessage: async () => '',
    recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
    changePassword: async () => undefined,
    verifyPassword: () => false,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
    ...overrides,
  }) as VaultContextValue

const renderFlow = (overrides: Partial<VaultContextValue> = {}): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault(overrides)}>
        <OnboardingFlow />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

// Configure RPC auto-tests on entry; this keeps that probe healthy and deterministic.
const installHealthyWalletService = (): void => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        result: {
          connection: { isNetworkConnected: true },
          network: { networkId: 'canton:local' },
        },
      }),
      { status: 200 },
    )
}

describe('OnboardingFlow', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    globalThis.fetch = originalFetch
  })

  it('shows step 1 (Vault) active when there is no vault', () => {
    renderFlow({ hasVault: false })
    assert.ok(screen.getByRole('button', { name: /^create$/i }))
    assert.equal(screen.getByTestId('step-1').getAttribute('aria-current'), 'step')
    assert.equal(screen.getByTestId('step-2').getAttribute('data-state'), 'upcoming')
  })

  it('shows step 2 (Configure RPC) when the vault exists but no account, with step 1 complete', () => {
    installHealthyWalletService()
    renderFlow({ hasVault: true, accounts: [] })
    assert.ok(screen.getByLabelText(/wallet-service rpc url/i))
    assert.equal(screen.getByTestId('step-1').getAttribute('data-state'), 'complete')
    assert.equal(screen.getByTestId('step-2').getAttribute('aria-current'), 'step')
  })

  it('does not skip the RPC step to the account step on reload (vault exists, no account)', () => {
    installHealthyWalletService()
    renderFlow({ hasVault: true, accounts: [] })
    assert.ok(screen.getByLabelText(/wallet-service rpc url/i))
    assert.equal(screen.queryByTestId('add-account-hint-input'), null)
  })

  it('advances to step 3 (Create Account) after the RPC connection is confirmed', async () => {
    installHealthyWalletService()
    renderFlow({ hasVault: true, accounts: [] })
    await waitFor(() =>
      assert.equal(
        (screen.getByTestId('configure-rpc-continue') as HTMLButtonElement).disabled,
        false,
      ),
    )
    await userEvent.click(screen.getByTestId('configure-rpc-continue'))
    await waitFor(() => assert.ok(screen.getByTestId('add-account-hint-input')))
    assert.equal(screen.getByTestId('step-3').getAttribute('aria-current'), 'step')
    assert.equal(screen.getByTestId('step-2').getAttribute('data-state'), 'complete')
  })
})
