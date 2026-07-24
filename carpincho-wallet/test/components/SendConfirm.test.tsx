import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { SendConfirm } from '@/components/SendConfirm'
import type { Cip56SendApi } from '@/components/SendTokenForm'
import { toast } from '@/components/ui/toast'
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

const SUMMARY: TokenHoldingSummary = {
  key: 'dso::party:Amulet',
  tokenLabel: 'Amulet',
  instrumentId: { admin: 'dso::party', id: 'Amulet' },
  totalAmount: '100',
  source: 'scan',
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

const renderConfirm = (
  sendApi: Cip56SendApi,
  onSent: () => void,
  onCancel = (): void => undefined,
): void => {
  render(
    <VaultContext.Provider value={baseVault()}>
      <SendConfirm
        account={ACCOUNT}
        summary={SUMMARY}
        recipient="bob::party"
        amount="7.5"
        memo="lunch"
        deadline="1h"
        sendApi={sendApi}
        onCancel={onCancel}
        onSent={onSent}
      />
    </VaultContext.Provider>,
  )
}

describe('SendConfirm', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('shows the human summary and submits the transfer on Confirm', async () => {
    const sent: Parameters<Cip56SendApi['createTokenTransfer']>[0][] = []
    let sentCount = 0
    const sendApi: Cip56SendApi = {
      createTokenTransfer: async (params) => {
        sent.push(params)
        return { updateId: 'u1' }
      },
    }
    renderConfirm(sendApi, () => (sentCount += 1))

    assert.ok(screen.getAllByText('lunch').length >= 1)
    assert.ok(screen.getByText(/7\.50/))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => assert.equal(sentCount, 1))
    assert.equal(sent[0]?.recipient, 'bob::party')
    assert.equal(sent[0]?.amount, '7.5')
    assert.equal(sent[0]?.memo, 'lunch')
    assert.deepEqual(sent[0]?.instrumentId, { admin: 'dso::party', id: 'Amulet' })
    assert.equal(typeof sent[0]?.expirationDate, 'string')
  })

  it('exposes the request JSON behind a View data expander', () => {
    // The payload is now a JsonView tree; the key "recipient" and the party value are
    // rendered as separate text nodes — confirm the key is visible in the tree.
    renderConfirm({ createTokenTransfer: async () => ({ updateId: 'u1' }) }, () => undefined)
    // JsonView renders the key "recipient" and the party value as separate nodes.
    assert.ok(screen.getAllByText('recipient').length >= 1)
    assert.ok(screen.getAllByText('bob::party').length >= 1)
  })

  it('cancels back without submitting', async () => {
    let cancelled = 0
    let sentCount = 0
    renderConfirm(
      { createTokenTransfer: async () => ({ updateId: 'u1' }) },
      () => (sentCount += 1),
      () => (cancelled += 1),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    assert.equal(cancelled, 1)
    assert.equal(sentCount, 0)
  })
})
