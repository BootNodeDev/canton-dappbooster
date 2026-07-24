import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { getToastEntries, toast } from '@/components/ui/toast'
import { ExportVaultView, ImportVaultForm } from '@/components/VaultBackupPanel'
import type { CarpinchoBackup } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const sampleBackup: CarpinchoBackup = {
  kind: 'carpincho-backup',
  version: 1,
  vault: {
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: 'c2FsdA==' },
    cipher: { name: 'AES-GCM', iv: 'aXY=', data: 'ZGF0YQ==' },
  },
}

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: true,
    setup: async () => undefined,
    unlock: async () => undefined,
    lock: () => undefined,
    destroyVault: async () => undefined,
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
    exportEncryptedVault: async () => sampleBackup,
    importEncryptedVault: async () => ({ imported: 0, skipped: 0, rejected: 0 }),
    signMessage: async () => '',
    recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
    changePassword: async () => undefined,
    verifyPassword: () => false,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
    ...overrides,
  }) as VaultContextValue

const renderWithVault = (overrides: Partial<VaultContextValue>, ui: ReactNode): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault(overrides)}>{ui}</VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('ExportVaultView', () => {
  afterEach(() => {
    toast.clear()
    cleanup()
  })

  it('downloads the encrypted backup, toasts, and closes the menu after a correct password', async () => {
    const user = userEvent.setup()
    let askedPassword: string | null = null
    let closed = false
    renderWithVault(
      {
        verifyPassword: () => true,
        exportEncryptedVault: async (pw) => {
          askedPassword = pw
          return sampleBackup
        },
      },
      <ExportVaultView
        onExported={() => {
          closed = true
        }}
      />,
    )

    // Never a Copy-JSON control, and no intermediate reveal step.
    assert.equal(screen.queryByRole('button', { name: /copy json/i }), null)

    // Export is a single action: verifying the password downloads immediately.
    const clicks: Array<{ download: string }> = []
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    const originalClick = HTMLAnchorElement.prototype.click
    URL.createObjectURL = () => 'blob:fake'
    URL.revokeObjectURL = () => undefined
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement): void {
      clicks.push({ download: this.download })
    }
    try {
      await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse-battery')
      await user.click(screen.getByRole('button', { name: /^export$/i }))
      await waitFor(() => assert.equal(clicks.length, 1))
      assert.match(clicks[0]?.download ?? '', /^carpincho-backup-.*\.json$/)
      assert.equal(askedPassword, 'correct-horse-battery')
      assert.equal(closed, true)
      assert.ok(
        getToastEntries().some(
          (e) => typeof e.message === 'string' && /backup downloaded/i.test(e.message),
        ),
      )
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
      HTMLAnchorElement.prototype.click = originalClick
    }
  })
})

describe('ImportVaultForm', () => {
  afterEach(() => {
    toast.clear()
    cleanup()
  })

  it('uploads a file, imports with the typed password, and toasts the counts', async () => {
    const user = userEvent.setup()
    const calls: Array<{ file: unknown; password: string }> = []
    let imported = false
    renderWithVault(
      {
        importEncryptedVault: async (file, password) => {
          calls.push({ file, password })
          return { imported: 2, skipped: 1, rejected: 0 }
        },
      },
      <ImportVaultForm
        onImported={() => {
          imported = true
        }}
      />,
    )

    const file = new File([JSON.stringify(sampleBackup)], 'backup.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText(/backup file/i), file)
    await user.type(screen.getByLabelText(/backup password/i), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /^import$/i }))

    await waitFor(() => assert.equal(calls.length, 1))
    assert.deepEqual(calls[0]?.file, sampleBackup)
    assert.equal(calls[0]?.password, 'correct-horse-battery')
    assert.equal(imported, true)
    assert.ok(
      getToastEntries().some((e) => typeof e.message === 'string' && /imported 2/i.test(e.message)),
    )
  })

  it('surfaces a wrong-password error as a toast and does not navigate', async () => {
    const user = userEvent.setup()
    let imported = false
    renderWithVault(
      {
        importEncryptedVault: async () => {
          throw new Error('Wrong password for this file.')
        },
      },
      <ImportVaultForm
        onImported={() => {
          imported = true
        }}
      />,
    )
    const file = new File([JSON.stringify(sampleBackup)], 'backup.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText(/backup file/i), file)
    await user.type(screen.getByLabelText(/backup password/i), 'wrong-pw-typed')
    await user.click(screen.getByRole('button', { name: /^import$/i }))

    await waitFor(() =>
      assert.ok(
        getToastEntries().some(
          (e) => typeof e.message === 'string' && /wrong password for this file/i.test(e.message),
        ),
      ),
    )
    assert.equal(imported, false)
  })

  it('rejects an unparseable file before calling import', async () => {
    const user = userEvent.setup()
    let called = 0
    renderWithVault(
      {
        importEncryptedVault: async () => {
          called += 1
          return { imported: 0, skipped: 0, rejected: 0 }
        },
      },
      <ImportVaultForm />,
    )
    const file = new File(['not json'], 'backup.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/backup file/i), file)
    await user.type(screen.getByLabelText(/backup password/i), 'whatever-pw')
    await user.click(screen.getByRole('button', { name: /^import$/i }))

    await waitFor(() =>
      assert.ok(
        getToastEntries().some(
          (e) => typeof e.message === 'string' && /invalid file/i.test(e.message),
        ),
      ),
    )
    assert.equal(called, 0)
  })
})
