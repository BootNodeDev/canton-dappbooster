import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { TokenHolding } from '@/cip56/holdings'
import { TokenHoldingDetail } from '@/components/TokenHoldingDetail'
import { TooltipProvider } from '@/components/ui/Tooltip'

const UNLOCKED: TokenHolding = {
  contractId: 'holding-cid-1',
  interfaceViewValue: {
    owner: 'alice::party',
    amount: '12.5000000000',
    instrumentId: { admin: 'dso::party', id: 'Amulet' },
    lock: null,
  },
}

const LOCKED: TokenHolding = {
  contractId: 'holding-cid-2',
  interfaceViewValue: {
    owner: 'alice::party',
    amount: '3.2500000000',
    instrumentId: { admin: 'dso::party', id: 'Amulet' },
    lock: { holders: ['validator::party'], expiresAt: '2026-06-10T20:41:05.803Z' },
  },
}

describe('TokenHoldingDetail', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows amount, unlocked state, and contract id for an unlocked holding', () => {
    // Scenario: the per-UTXO detail relocates from the old inline expander; an
    // unlocked holding has no expiry row.
    render(
      <TooltipProvider>
        <TokenHoldingDetail holding={UNLOCKED} />
      </TooltipProvider>,
    )

    assert.equal(screen.getByText('12.50').textContent, '12.50')
    assert.equal(screen.getByText('unlocked').textContent, 'unlocked')
    assert.equal(screen.getByText('holding-cid-1').textContent, 'holding-cid-1')
    assert.equal(screen.queryByText('expires'), null)
    assert.ok(screen.getByRole('button', { name: 'Copy contract ID' }))
  })

  it('shows the locked state and expiry for a locked holding', () => {
    // Scenario: locked UTXOs surface their expiry as a human time label.
    render(
      <TooltipProvider>
        <TokenHoldingDetail holding={LOCKED} />
      </TooltipProvider>,
    )

    assert.equal(screen.getByText('locked').textContent, 'locked')
    assert.equal(screen.getByText('2026-06-10 20:41 UTC').textContent, '2026-06-10 20:41 UTC')
  })
})
