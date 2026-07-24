import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoAcceptSetting } from '@/components/AutoAcceptSetting'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
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

const renderSetting = (api: AmuletPreapprovalApi): void => {
  render(
    <TestQueryClientProvider>
      <TooltipProvider>
        <VaultContext.Provider value={baseVault()}>
          <AutoAcceptSetting
            account={ACCOUNT}
            api={api}
          />
        </VaultContext.Provider>
      </TooltipProvider>
    </TestQueryClientProvider>,
  )
}

describe('AutoAcceptSetting', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('enables Amulet auto-accept for the selected party', async () => {
    // Scenario: no active preapproval; enabling signs the prepared command for that party.
    let createCalls = 0
    const api: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async (receiver) => {
        assert.equal(receiver, 'alice::party')
        return { active: false, expired: false }
      },
      createAmuletPreapproval: async ({ account, recordTransaction }) => {
        createCalls += 1
        assert.equal(account.partyId, 'alice::party')
        assert.ok(recordTransaction, 'preapproval execution should be recorded')
        return { updateId: 'create-update-1' }
      },
      cancelAmuletPreapproval: async () => {
        throw new Error('cancel should not run while enabling')
      },
    }

    renderSetting(api)

    await screen.findByText('Auto-accept incoming')
    const toggle = await screen.findByRole('switch', { name: 'Auto-accept incoming' })
    await waitFor(() => assert.equal(toggle.hasAttribute('disabled'), false))
    await userEvent.click(toggle)

    assert.equal(createCalls, 1)
  })

  it('flips on optimistically while the enable command settles', async () => {
    // Scenario: the ledger lags; the switch reads on immediately instead of waiting.
    let resolveCreate: (() => void) | undefined
    const api: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => ({ active: false, expired: false }),
      createAmuletPreapproval: async () => {
        await new Promise<void>((resolve) => {
          resolveCreate = resolve
        })
        return { updateId: 'create-update-1' }
      },
      cancelAmuletPreapproval: async () => ({ updateId: 'noop' }),
    }

    renderSetting(api)

    const toggle = await screen.findByRole('switch', { name: 'Auto-accept incoming' })
    await waitFor(() => assert.equal(toggle.hasAttribute('disabled'), false))
    await userEvent.click(toggle)

    await waitFor(() => assert.equal(toggle.getAttribute('aria-checked'), 'true'))
    resolveCreate?.()
  })

  it('disables active Amulet auto-accept for the selected party', async () => {
    // Scenario: an active preapproval reads as on; flipping it cancels the same preapproval.
    let cancelCalls = 0
    const api: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => ({
        active: true,
        expired: false,
        expiresAt: '2026-06-11T12:00:00.000Z',
        contractId: 'preapproval-cid-1',
      }),
      createAmuletPreapproval: async () => {
        throw new Error('create should not run while disabling')
      },
      cancelAmuletPreapproval: async ({ account }) => {
        cancelCalls += 1
        assert.equal(account.partyId, 'alice::party')
        return { updateId: 'cancel-update-1' }
      },
    }

    renderSetting(api)

    const toggle = await screen.findByRole('switch', {
      name: 'Auto-accept incoming',
      checked: true,
    })
    await userEvent.click(toggle)

    assert.equal(cancelCalls, 1)
  })

  it('reads expired Amulet auto-accept as on so it can be cleared', async () => {
    // Scenario: a preapproval contract can outlive its expiry; the toggle stays on to clear it.
    const api: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => ({
        active: false,
        expired: true,
        expiresAt: '2026-06-01T12:00:00.000Z',
        contractId: 'expired-preapproval-cid',
      }),
      createAmuletPreapproval: async () => {
        throw new Error('create should not run for expired status action')
      },
      cancelAmuletPreapproval: async () => ({ updateId: 'cancel-expired-1' }),
    }

    renderSetting(api)

    const toggle = await screen.findByRole('switch', {
      name: 'Auto-accept incoming',
      checked: true,
    })
    assert.equal(toggle.getAttribute('aria-checked'), 'true')
  })
})
