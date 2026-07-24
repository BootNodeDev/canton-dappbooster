import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { CreateContractUtil } from '@/components/utils/CreateContractUtil'
import type { createContract as CreateContractFn } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'pk',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
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

const renderUtil = (createContract: typeof CreateContractFn): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault()}>
        <CreateContractUtil
          account={ACCOUNT}
          createContract={createContract}
        />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('CreateContractUtil', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('submits a create command and shows a copyable update id', async () => {
    const calls: Parameters<typeof CreateContractFn>[0][] = []
    const createContract = (async (params) => {
      calls.push(params)
      return { updateId: 'update-1', completionOffset: 42 }
    }) as typeof CreateContractFn
    renderUtil(createContract)

    await userEvent.type(screen.getByLabelText('Template ID'), 'pkg:Module:Template')
    fireEvent.change(screen.getByLabelText('Create arguments JSON'), {
      target: { value: JSON.stringify({ admin: 'alice::party' }) },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => assert.equal(calls.length, 1))
    assert.equal(calls[0]?.account.partyId, 'alice::party')
    assert.equal(calls[0]?.templateId, 'pkg:Module:Template')
    assert.deepEqual(calls[0]?.createArguments, { admin: 'alice::party' })
    await screen.findByText(/update-1/)
    assert.ok(screen.getByRole('button', { name: /Copy update ID/i }))
  })

  it('disables submit while the JSON is invalid', async () => {
    const createContract = (async () => ({ updateId: 'x' })) as typeof CreateContractFn
    renderUtil(createContract)
    fireEvent.change(screen.getByLabelText('Create arguments JSON'), {
      target: { value: '{ broken' },
    })
    assert.equal(
      (screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled,
      true,
    )
  })
})
