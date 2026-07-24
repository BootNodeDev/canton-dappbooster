import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PendingTokenTransfer } from '@/cip56/transfers'
import { TransferCard } from '@/components/TransferCard'
import { TooltipProvider } from '@/components/ui/Tooltip'

const INCOMING: PendingTokenTransfer = {
  contractId: 'incoming-cid-1',
  interfaceViewValue: {
    transfer: {
      sender: 'sender-party-1234567890abcdef',
      receiver: 'alice::party',
      amount: '42',
      instrumentId: { id: 'Amulet' },
      meta: { values: { 'splice.lfdecentralizedtrust.org/reason': 'invoice 42' } },
    },
  },
}

const OUTGOING: PendingTokenTransfer = {
  contractId: 'outgoing-cid-1',
  interfaceViewValue: {
    transfer: {
      sender: 'alice::party',
      receiver: 'bob-party-1234567890abcdef',
      amount: '10',
      instrumentId: { id: 'Amulet' },
    },
  },
}

describe('TransferCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders an incoming transfer with Accept, description, and a details button', async () => {
    // Scenario: an incoming transfer is the actionable case — amount, memo, Accept, and the
    // eye that opens details. Accept and the eye fire their callbacks with the transfer.
    let accepted = ''
    let opened: PendingTokenTransfer | undefined
    render(
      <TooltipProvider>
        <TransferCard
          transfer={INCOMING}
          direction="incoming"
          onAccept={(cid) => {
            accepted = cid
          }}
          onOpenDetails={(transfer) => {
            opened = transfer
          }}
        />
      </TooltipProvider>,
    )

    assert.equal(screen.getByText('42.00 Amulet').textContent, '42.00 Amulet')
    assert.equal(screen.getByText('invoice 42').textContent, 'invoice 42')

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    assert.equal(accepted, 'incoming-cid-1')

    await userEvent.click(screen.getByRole('button', { name: 'Transfer details' }))
    assert.equal(opened?.contractId, 'incoming-cid-1')
  })

  it('shows a copy button for the sender on an incoming transfer', () => {
    // Scenario: the full counterparty party id is copyable beside the truncated line.
    render(
      <TooltipProvider>
        <TransferCard
          transfer={INCOMING}
          direction="incoming"
          onOpenDetails={() => undefined}
        />
      </TooltipProvider>,
    )

    assert.ok(screen.getByRole('button', { name: 'Copy sender' }))
  })

  it('renders an outgoing transfer as watch-only with a Pending pill and no Accept', async () => {
    // Scenario: the sender can only watch their outgoing transfer settle.
    let opened: PendingTokenTransfer | undefined
    render(
      <TooltipProvider>
        <TransferCard
          transfer={OUTGOING}
          direction="outgoing"
          onOpenDetails={(transfer) => {
            opened = transfer
          }}
        />
      </TooltipProvider>,
    )

    assert.equal(screen.getByText('10.00 Amulet').textContent, '10.00 Amulet')
    assert.equal(screen.getByText('Pending').textContent, 'Pending')
    assert.equal(screen.queryByRole('button', { name: 'Accept' }), null)

    await userEvent.click(screen.getByRole('button', { name: 'Transfer details' }))
    assert.equal(opened?.contractId, 'outgoing-cid-1')
  })

  it('shows a copy button for the receiver on an outgoing transfer', () => {
    // Scenario: the full receiver party id is copyable beside the truncated line.
    render(
      <TooltipProvider>
        <TransferCard
          transfer={OUTGOING}
          direction="outgoing"
          onOpenDetails={() => undefined}
        />
      </TooltipProvider>,
    )

    assert.ok(screen.getByRole('button', { name: 'Copy receiver' }))
  })
})
