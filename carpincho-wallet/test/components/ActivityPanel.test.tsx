import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityPanel } from '@/components/ActivityPanel'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { getToastEntries, toast } from '@/components/ui/toast'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic, TransactionRecord } from '@/vault/types'
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

const txRecord = (id: string, summary: string): TransactionRecord => ({
  id,
  accountId: ACCOUNT.id,
  accountName: ACCOUNT.name,
  partyId: ACCOUNT.partyId,
  network: ACCOUNT.network,
  method: 'canton_prepareExecuteAndWait',
  status: 'executed',
  createdAt: Date.parse('2026-06-10T12:00:00.000Z'),
  preparedTransactionHash: `${id}-hash`,
  summary,
})

const renderPanel = (
  api: Cip56TransferApi,
  transactions: TransactionRecord[] = [],
  onPendingCountChange?: (count: number) => void,
): void => {
  render(
    <TooltipProvider>
      <TestQueryClientProvider>
        <VaultContext.Provider value={baseVault()}>
          <ActivityPanel
            account={ACCOUNT}
            transactions={transactions}
            api={api}
            onPendingCountChange={onPendingCountChange}
          />
        </VaultContext.Provider>
      </TestQueryClientProvider>
    </TooltipProvider>,
  )
}

describe('ActivityPanel', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('shows a Needs action incoming transfer and accepts it', async () => {
    // Scenario: an incoming transfer is pinned under "Needs action"; accepting clears it.
    const calls: string[] = []
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => {
        calls.push('list')
        return calls.includes('accept')
          ? []
          : [
              {
                contractId: 'transfer-cid-1',
                interfaceViewValue: {
                  transfer: {
                    sender: 'sender-party-1234567890abcdef',
                    receiver: 'alice::party',
                    amount: '42',
                    instrumentId: { id: 'Amulet' },
                  },
                },
              },
            ]
      },
      acceptTransfer: async ({ transferInstructionCid }) => {
        calls.push('accept')
        assert.equal(transferInstructionCid, 'transfer-cid-1')
        return { updateId: 'update-1' }
      },
    }

    renderPanel(api)

    await screen.findByText('Needs action')
    await screen.findByText('42.00 Amulet')
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => assert.ok(screen.getByText('No activity yet')))

    assert.deepEqual(calls, ['list', 'accept', 'list'])
  })

  it('hides the transfer on Accept and swaps the progress toast for a success toast', async () => {
    // Scenario: clicking Accept removes the card immediately (optimistic) and shows an
    // "Accepting transfer..." toast that is replaced by "Transfer accepted." once it settles.
    let resolveAccept: (() => void) | undefined
    let accepted = false
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () =>
        accepted
          ? []
          : [
              {
                contractId: 'incoming-cid-1',
                interfaceViewValue: {
                  transfer: {
                    sender: 'sender-party-1234567890abcdef',
                    receiver: 'alice::party',
                    amount: '9',
                    instrumentId: { id: 'Amulet' },
                  },
                },
              },
            ],
      acceptTransfer: async () => {
        await new Promise<void>((resolve) => {
          resolveAccept = resolve
        })
        accepted = true
        return { updateId: 'update-1' }
      },
    }

    renderPanel(api)

    await screen.findByText('9.00 Amulet')
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

    // The card is gone before the accept settles, with a progress toast showing.
    await waitFor(() => assert.equal(screen.queryByText('9.00 Amulet'), null))
    assert.ok(
      getToastEntries().some((t) => t.variant === 'info' && t.message === 'Accepting transfer...'),
    )

    resolveAccept?.()

    // The progress toast is dismissed and replaced by the success toast.
    await waitFor(() =>
      assert.ok(
        getToastEntries().some(
          (t) => t.variant === 'success' && t.message === 'Transfer accepted.',
        ),
      ),
    )
    assert.equal(
      getToastEntries().some((t) => t.variant === 'info'),
      false,
    )
  })

  it("shows the active party's outgoing transfer as read-only under Awaiting acceptance", async () => {
    // Scenario: the sender's own outgoing transfer is watch-only — no Accept button.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'outgoing-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'alice::party',
              receiver: 'bob-party-1234567890abcdef',
              amount: '10',
              instrumentId: { id: 'Amulet' },
            },
            status: { tag: 'TransferPendingReceiverAcceptance' },
          },
        },
      ],
      acceptTransfer: async () => {
        throw new Error('the sender must not accept their own transfer')
      },
    }

    renderPanel(api)

    await screen.findByText('Awaiting acceptance')
    await screen.findByText('10.00 Amulet')
    assert.equal(screen.queryByRole('button', { name: 'Accept' }), null)
  })

  it('counts only incoming transfers toward the pending count', async () => {
    // Scenario: a mixed list shows one Accept and reports a pending count of one.
    const counts: number[] = []
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'incoming-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party-1234567890abcdef',
              receiver: 'alice::party',
              amount: '3',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
        {
          contractId: 'outgoing-cid-2',
          interfaceViewValue: {
            transfer: {
              sender: 'alice::party',
              receiver: 'bob-party-1234567890abcdef',
              amount: '4',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    renderPanel(api, [], (count) => counts.push(count))

    await screen.findByText('Awaiting acceptance')
    assert.equal(screen.getAllByRole('button', { name: 'Accept' }).length, 1)
    assert.equal(counts.at(-1), 1)
  })

  it('shows a spinner while transfers load and there is no history yet', async () => {
    // Scenario: first fetch in flight, no history — show a loading indicator, not the empty state.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: () => new Promise(() => {}),
    }

    renderPanel(api)

    await screen.findByRole('status', { name: /loading/i })
    assert.equal(screen.queryByText('No activity yet'), null)
  })

  it('opens transfer details in a sheet from the eye button', async () => {
    // Scenario: the eye button reveals full parties/status behind the standard sheet.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'transfer-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party-1234567890abcdef',
              receiver: 'alice::party',
              amount: '5',
              instrumentId: { id: 'Amulet' },
            },
            status: { tag: 'TransferPendingReceiverAcceptance' },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    renderPanel(api)

    await screen.findByText('5.00 Amulet')
    assert.equal(screen.queryByText('sender-party-1234567890abcdef'), null)
    await userEvent.click(screen.getByRole('button', { name: 'Transfer details' }))
    assert.equal(
      screen.getByText('sender-party-1234567890abcdef').textContent,
      'sender-party-1234567890abcdef',
    )
  })

  it('does not show the empty-activity message while transfers are pending', async () => {
    // Scenario: with pending transfers but no settled history, the "No activity yet" empty
    // state must not render beneath the pending cards.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'incoming-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party-1234567890abcdef',
              receiver: 'alice::party',
              amount: '8',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    renderPanel(api)

    await screen.findByText('Needs action')
    assert.equal(screen.queryByText('No activity yet'), null)
  })

  it('renders settled history below the pending zone', async () => {
    // Scenario: confirmed transactions still render via ActivityList beneath any pending items.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [],
    }

    renderPanel(api, [txRecord('tx-1', 'Send 25 AMT')])

    await screen.findByText('Send 25 AMT')
    await screen.findByText('Confirmed')
  })

  it('resets the pending count to zero when unmounted', async () => {
    // Scenario: when the panel tears down (e.g. account switch), the parent badge must clear.
    const counts: number[] = []
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'incoming-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party-1234567890abcdef',
              receiver: 'alice::party',
              amount: '3',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    renderPanel(api, [], (count) => counts.push(count))

    await screen.findByText('Needs action')
    await waitFor(() => assert.equal(counts.at(-1), 1))
    cleanup()
    assert.equal(counts.at(-1), 0)
  })
})
