import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { TokenReceive } from '@/components/TokenReceive'
import { TooltipProvider } from '@/components/ui/Tooltip'

const PARTY_ID = 'alice::1220abc0000000000000000000000000000000000000000000000000c8b64e3'

describe('TokenReceive', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a QR code, the full party id, and a copy button', () => {
    // Scenario: the receive screen mirrors common wallets: scannable QR up top, the
    // full party id with a copy affordance below.
    const { container } = render(
      <TooltipProvider>
        <TokenReceive partyId={PARTY_ID} />
      </TooltipProvider>,
    )

    const qr = container.querySelector('[data-testid="receive-qr"] svg')
    assert.ok(qr, 'the receive screen should render a QR code')
    assert.equal(screen.getByText(PARTY_ID).textContent, PARTY_ID)
    assert.ok(screen.getByRole('button', { name: /copy party id/i }))
  })
})
