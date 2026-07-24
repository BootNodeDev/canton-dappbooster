import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode, useState } from 'react'
import { MenuSheet } from '@/components/menu/MenuSheet'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue => ({
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
  exportEncryptedVault: async () =>
    ({
      kind: 'carpincho-backup',
      version: 1,
      vault: {
        v: 1,
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: '' },
        cipher: { name: 'AES-GCM', iv: '', data: '' },
      },
    }) as import('@/vault/types').CarpinchoBackup,
  importEncryptedVault: async () => ({ imported: 0, skipped: 0, rejected: 0 }),
  signMessage: async () => '',
  recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
  changePassword: async () => undefined,
  verifyPassword: () => false,
  autoLockOption: 'never',
  setAutoLockOption: () => undefined,
  ...overrides,
})

const wrap = (value: VaultContextValue, ui: ReactNode): JSX.Element => (
  <ThemeProvider>
    <TooltipProvider>
      <VaultContext.Provider value={value}>{ui}</VaultContext.Provider>
    </TooltipProvider>
  </ThemeProvider>
)

describe('MenuSheet', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the new root menu items when open', () => {
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    assert.ok(screen.getByRole('button', { name: /walletconnect/i }))
    assert.ok(screen.getByRole('button', { name: /^theme$/i }))
    assert.ok(screen.getByRole('button', { name: /^vault$/i }))
    assert.ok(screen.getByRole('button', { name: /log out/i }))
  })

  it('renders nothing when closed', () => {
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={false}
          onOpenChange={() => undefined}
        />,
      ),
    )
    assert.equal(screen.queryByRole('button', { name: /^vault$/i }), null)
  })

  it('drills into Vault and shows its four entries', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /^vault$/i }))
    assert.ok(screen.getByRole('button', { name: /^password$/i }))
    assert.ok(screen.getByRole('button', { name: /^auto lock$/i }))
    assert.ok(screen.getByRole('button', { name: /^export vault$/i }))
    assert.ok(screen.getByRole('button', { name: /^import vault$/i }))
  })

  it('opens Theme directly from root', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /^theme$/i }))
    assert.ok(screen.getByRole('button', { name: /^system$/i }))
  })

  it('drills into the password leaf and back returns to Vault', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /^vault$/i }))
    await user.click(screen.getByRole('button', { name: /^password$/i }))
    assert.ok(screen.getByLabelText(/current password/i))
    await user.click(screen.getByRole('button', { name: /back/i }))
    assert.ok(screen.getByRole('button', { name: /^export vault$/i }))
  })

  it('drills into Import Vault and shows the file and password fields', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /^vault$/i }))
    await user.click(screen.getByRole('button', { name: /^import vault$/i }))
    assert.ok(screen.getByLabelText(/backup file/i))
    assert.ok(screen.getByLabelText(/backup password/i))
  })

  it('log out calls vault.lock and closes the sheet', async () => {
    const user = userEvent.setup()
    let lockCalls = 0
    const openChanges: boolean[] = []
    render(
      wrap(
        baseVault({
          lock: () => {
            lockCalls += 1
          },
        }),
        <MenuSheet
          open={true}
          onOpenChange={(o) => openChanges.push(o)}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /log out/i }))
    assert.equal(lockCalls, 1)
    assert.deepEqual(openChanges, [false])
  })

  it('re-opening after closing resets to root menu', async () => {
    const user = userEvent.setup()
    const Harness = (): JSX.Element => {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
          >
            reopen
          </button>
          {wrap(
            baseVault(),
            <MenuSheet
              open={open}
              onOpenChange={setOpen}
            />,
          )}
        </>
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /^vault$/i }))
    assert.ok(screen.getByRole('button', { name: /^password$/i }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /reopen/i }))
    assert.ok(screen.getByRole('button', { name: /^vault$/i }))
  })

  it('shows the WalletConnect entry in web mode and drills into its pairing screen', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /walletconnect/i }))
    assert.ok(screen.getByPlaceholderText('wc:...'))
  })

  it('hides the WalletConnect entry in extension mode', () => {
    const originalChrome = (globalThis as { chrome?: unknown }).chrome
    ;(globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage: () => undefined } }
    try {
      render(
        wrap(
          baseVault(),
          <MenuSheet
            open={true}
            onOpenChange={() => undefined}
          />,
        ),
      )
      assert.equal(screen.queryByRole('button', { name: /walletconnect/i }), null)
      assert.ok(screen.getByRole('button', { name: /^vault$/i }))
    } finally {
      ;(globalThis as { chrome?: unknown }).chrome = originalChrome
    }
  })

  it('keeps the root drawer title accessible but visually hidden', () => {
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    const title = screen.getByText('Menu')
    assert.match(title.className, /sr-only/)
  })
})
