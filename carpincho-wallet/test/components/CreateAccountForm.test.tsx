import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateAccountForm } from '@/components/CreateAccountForm'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const originalFetch = globalThis.fetch

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue =>
  ({
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
    ...overrides,
  }) as VaultContextValue

const renderForm = (
  props: Partial<import('@/components/CreateAccountForm').CreateAccountFormProps> = {},
  vaultOverrides: Partial<VaultContextValue> = {},
): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault(vaultOverrides)}>
        <CreateAccountForm {...props} />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('CreateAccountForm', () => {
  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('rejects an invalid party hint without creating an account', async () => {
    const user = userEvent.setup()
    const added: unknown[] = []
    renderForm(
      {},
      {
        addAccount: async (args) => {
          added.push(args)
          return {
            id: '',
            name: '',
            partyId: '',
            publicKeyBase64: '',
            network: '',
            isPrimary: false,
            createdAt: 0,
          }
        },
      },
    )

    await user.type(screen.getByTestId('add-account-hint-input'), 'AB')
    await user.click(screen.getByTestId('add-account-submit'))

    assert.ok(screen.getByText(/3.{1,3}64 lowercase/i))
    assert.equal(added.length, 0)
  })

  it('renders a Cancel button only when onCancel is provided', () => {
    renderForm({ onCancel: () => undefined })
    assert.ok(screen.queryByTestId('add-account-cancel'))
    cleanup()
    renderForm({})
    assert.equal(screen.queryByTestId('add-account-cancel'), null)
  })

  it('invokes onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    let cancelled = false
    renderForm({
      onCancel: () => {
        cancelled = true
      },
    })
    await user.click(screen.getByTestId('add-account-cancel'))
    assert.equal(cancelled, true)
  })

  it('uses the provided submit label', () => {
    renderForm({ submitLabel: 'Create your account' })
    assert.ok(screen.getByRole('button', { name: 'Create your account' }))
  })

  it('always shows the username requirements as helper text', () => {
    renderForm()
    assert.ok(screen.getByText(/3-64 lowercase/i))
  })

  it('keeps the submit button disabled until the username is valid', async () => {
    const user = userEvent.setup()
    renderForm()
    const submit = screen.getByTestId('add-account-submit') as HTMLButtonElement
    assert.equal(submit.disabled, true)
    await user.type(screen.getByTestId('add-account-hint-input'), 'ab')
    assert.equal(submit.disabled, true)
    await user.type(screen.getByTestId('add-account-hint-input'), 'cde')
    assert.equal(submit.disabled, false)
  })

  it('stores the network discovered from wallet-service status after creating the party', async () => {
    // Scenario: account creation talks to wallet-service for party onboarding, then uses
    // wallet-service status as the canonical network source for the stored account.
    const user = userEvent.setup()
    const added: Array<{ network: string; partyId: string; name: string }> = []
    globalThis.fetch = (async (input, init) => {
      const url = String(input)
      if (url.endsWith('/admin/party/prepare')) {
        // Setup: the prepare endpoint returns a valid base64 message for Carpincho to sign.
        return new Response(
          JSON.stringify({
            onboardingId: 'onboarding-1',
            partyId: 'alice::fingerprint',
            multiHash: 'AQID',
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/admin/party/complete')) {
        // Setup: the complete endpoint returns the final external party id.
        return new Response(JSON.stringify({ partyId: 'alice::fingerprint' }), { status: 200 })
      }
      if (url.endsWith('/rpc') && String(init?.body ?? '').includes('"method":"status"')) {
        // Setup: status reports the network that must be persisted with the new account.
        return new Response(
          JSON.stringify({
            result: {
              connection: { isNetworkConnected: true },
              network: { networkId: 'canton:from-status' },
            },
          }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected request: ${url}`)
    }) as typeof globalThis.fetch
    renderForm(
      {},
      {
        addAccount: async (args) => {
          // Assertion fixture: capture the account args that would be persisted in the vault.
          added.push({ network: args.network, partyId: args.partyId, name: args.name })
          return {
            id: 'acct-1',
            name: args.name,
            partyId: args.partyId,
            publicKeyBase64: args.publicKeyBase64,
            network: args.network,
            isPrimary: true,
            createdAt: 1,
          }
        },
      },
    )

    // Action: create a valid account through the user-facing form.
    await user.type(screen.getByTestId('add-account-hint-input'), 'alice')
    await user.click(screen.getByTestId('add-account-submit'))

    // Expected result: the stored account uses wallet-service's network id.
    await waitFor(() => assert.equal(added.length, 1))
    assert.deepEqual(added[0], {
      network: 'canton:from-status',
      partyId: 'alice::fingerprint',
      name: 'alice',
    })
  })
})

describe('CreateAccountForm pipeline wiring', () => {
  const source = (): string => readFileSync('src/components/CreateAccountForm.tsx', 'utf8')

  it('runs prepare -> sign -> complete -> addAccount and calls onSuccess', () => {
    const src = source()
    assert.match(src, /prepareCreateParty\(/)
    assert.match(src, /signMessageBase64\(kp\.privateKeyHex, prepared\.multiHash\)/)
    assert.match(src, /completeCreateParty\(/)
    assert.match(src, /await v\.addAccount\(/)
    assert.match(src, /onSuccess\?\.\(\)/)
  })
})
