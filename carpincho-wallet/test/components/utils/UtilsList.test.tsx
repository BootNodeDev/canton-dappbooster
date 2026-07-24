import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AmuletTapApi } from '@/cip56/amuletPreapproval'
import { toast } from '@/components/ui/toast'
import { UtilsList } from '@/components/utils/UtilsList'
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

describe('UtilsList', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('drills into a util when its row is clicked', async () => {
    const selected: string[] = []
    render(
      <VaultContext.Provider value={baseVault()}>
        <UtilsList
          account={ACCOUNT}
          onSelect={(util) => selected.push(util)}
        />
      </VaultContext.Provider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Create contract/ }))
    assert.deepEqual(selected, ['create'])
  })

  it('runs the faucet from its action row', async () => {
    const tapped: string[] = []
    const tapApi: AmuletTapApi = {
      tapAmulet: async ({ account }) => {
        tapped.push(account.partyId)
        return { updateId: 'tap-1' }
      },
    }
    render(
      <VaultContext.Provider value={baseVault()}>
        <UtilsList
          account={ACCOUNT}
          tapApi={tapApi}
          onSelect={() => undefined}
        />
      </VaultContext.Provider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Tap Amulet/ }))
    await waitFor(() => assert.deepEqual(tapped, ['alice::party']))
  })
})
