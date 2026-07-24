import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { TokenRow } from '@/components/TokenRow'

const SUMMARY: TokenHoldingSummary = {
  key: 'dso::party:Amulet',
  tokenLabel: 'Amulet',
  instrumentId: { admin: 'dso::party', id: 'Amulet' },
  totalAmount: '9997',
  utxoCount: 2,
  lockedCount: 0,
  unlockedCount: 2,
  source: 'utxos',
}

describe('TokenRow', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the balance with the token name beneath and a chevron', () => {
    // Scenario: the assets list is balance-first: icon + amount on the left with the token
    // name beneath it, and a chevron on the right (the row opens the detail sheet). The UTXO
    // count moved to the detail sheet.
    const { container } = render(
      <TokenRow
        summary={SUMMARY}
        onOpen={() => undefined}
      />,
    )

    assert.equal(screen.getByText('Amulet').textContent, 'Amulet')
    assert.equal(screen.getByText('9,997.00').textContent, '9,997.00')
    assert.ok(container.querySelector('img'), 'the row should show the token icon')
    assert.ok(container.querySelector('svg'), 'the row should show a chevron')
    assert.equal(screen.queryByText(/UTXO/i), null)
    assert.equal(screen.queryByRole('button', { name: /show holdings/i }), null)
  })

  it('marks locked holdings with a lock hint', () => {
    // Scenario: locked funds matter at a glance; a small lock glyph appears when any
    // holding is locked (the amount/breakdown stays in the detail sheet).
    render(
      <TokenRow
        summary={{ ...SUMMARY, lockedCount: 1, unlockedCount: 1 }}
        onOpen={() => undefined}
      />,
    )

    assert.ok(screen.getByLabelText('Some holdings are locked'))
  })

  it('omits the lock hint when nothing is locked', () => {
    // Scenario: a fully-spendable token shows no lock glyph, only the balance.
    render(
      <TokenRow
        summary={SUMMARY}
        onOpen={() => undefined}
      />,
    )

    assert.equal(screen.queryByLabelText('Some holdings are locked'), null)
    assert.ok(screen.getByText('9,997.00'))
  })

  it('opens the token when the row is clicked', async () => {
    // Scenario: the whole row is the affordance that opens the token detail modal.
    let opened = 0
    render(
      <TokenRow
        summary={SUMMARY}
        onOpen={() => {
          opened += 1
        }}
      />,
    )

    await userEvent.click(screen.getByRole('button'))

    assert.equal(opened, 1)
  })
})
