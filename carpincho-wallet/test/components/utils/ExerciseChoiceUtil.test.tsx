import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { ExerciseChoiceUtil } from '@/components/utils/ExerciseChoiceUtil'
import type { exerciseContract as ExerciseContractFn } from '@/ledger/contracts'
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

const renderUtil = (exerciseContract: typeof ExerciseContractFn): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault()}>
        <ExerciseChoiceUtil
          account={ACCOUNT}
          exerciseContract={exerciseContract}
        />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('ExerciseChoiceUtil', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('submits an exercise command and shows a copyable update id', async () => {
    const calls: Parameters<typeof ExerciseContractFn>[0][] = []
    const exerciseContract = (async (params) => {
      calls.push(params)
      return { updateId: 'exercise-update-1', completionOffset: 43 }
    }) as typeof ExerciseContractFn
    renderUtil(exerciseContract)

    await userEvent.type(screen.getByLabelText('Template ID'), 'pkg:Module:Template')
    await userEvent.type(screen.getByLabelText('Contract ID'), 'cid-1')
    await userEvent.type(screen.getByLabelText('Choice'), 'Template_DoThing')
    fireEvent.change(screen.getByLabelText('Choice argument JSON'), {
      target: { value: JSON.stringify({ receiver: 'bob::party', amount: '5.0' }) },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Exercise' }))

    await waitFor(() => assert.equal(calls.length, 1))
    assert.equal(calls[0]?.account.partyId, 'alice::party')
    assert.equal(calls[0]?.templateId, 'pkg:Module:Template')
    assert.equal(calls[0]?.contractId, 'cid-1')
    assert.equal(calls[0]?.choice, 'Template_DoThing')
    assert.deepEqual(calls[0]?.choiceArgument, { receiver: 'bob::party', amount: '5.0' })
    await screen.findByText(/exercise-update-1/)
    assert.ok(screen.getByRole('button', { name: /Copy update ID/i }))
  })

  it('disables submit while the choice argument JSON is invalid', async () => {
    const exerciseContract = (async () => ({ updateId: 'x' })) as typeof ExerciseContractFn
    renderUtil(exerciseContract)
    fireEvent.change(screen.getByLabelText('Choice argument JSON'), {
      target: { value: '{ broken' },
    })
    assert.equal(
      (screen.getByRole('button', { name: 'Exercise' }) as HTMLButtonElement).disabled,
      true,
    )
  })
})
