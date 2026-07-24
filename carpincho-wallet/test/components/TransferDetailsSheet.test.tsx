import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PendingTokenTransfer } from '@/cip56/transfers'
import { TransferDetailsSheet } from '@/components/TransferDetailsSheet'
import { TooltipProvider } from '@/components/ui/Tooltip'

const TRANSFER: PendingTokenTransfer = {
  contractId: 'transfer-cid-1',
  interfaceViewValue: {
    transfer: {
      sender: 'sender-party-1234567890abcdef',
      receiver: 'alice::party',
      amount: '666.0000000000',
      instrumentId: { id: 'Amulet' },
      requestedAt: '2026-06-09T20:41:05.841851Z',
      executeBefore: '2026-06-10T20:41:05.803Z',
    },
    status: { tag: 'TransferPendingReceiverAcceptance' },
  },
}

describe('TransferDetailsSheet', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows full transfer metadata when a transfer is selected', () => {
    // Scenario: the eye button opens this sheet with parties, status, timestamps, and id.
    render(
      <TooltipProvider>
        <TransferDetailsSheet
          transfer={TRANSFER}
          onClose={() => undefined}
        />
      </TooltipProvider>,
    )

    assert.equal(
      screen.getByText('sender-party-1234567890abcdef').textContent,
      'sender-party-1234567890abcdef',
    )
    assert.equal(screen.getByText('alice::party').textContent, 'alice::party')
    assert.equal(
      screen.getByText('TransferPendingReceiverAcceptance').textContent,
      'TransferPendingReceiverAcceptance',
    )
    assert.equal(screen.getByText('2026-06-09 20:41 UTC').textContent, '2026-06-09 20:41 UTC')
    assert.equal(screen.getByText('2026-06-10 20:41 UTC').textContent, '2026-06-10 20:41 UTC')
    assert.equal(screen.getByText('transfer-cid-1').textContent, 'transfer-cid-1')
    assert.ok(screen.getByRole('button', { name: 'Copy contract ID' }))
  })

  it('is closed when no transfer is selected', () => {
    // Scenario: a null selection renders nothing visible.
    render(
      <TooltipProvider>
        <TransferDetailsSheet
          transfer={null}
          onClose={() => undefined}
        />
      </TooltipProvider>,
    )

    assert.equal(screen.queryByText('transfer-cid-1'), null)
  })

  it('calls onClose when dismissed', async () => {
    // Scenario: the sheet close button dismisses the details view.
    let closes = 0
    render(
      <TooltipProvider>
        <TransferDetailsSheet
          transfer={TRANSFER}
          onClose={() => {
            closes += 1
          }}
        />
      </TooltipProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    assert.equal(closes, 1)
  })
})
