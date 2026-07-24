import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { DetailRow } from '@/components/ui/DetailRow'

describe('DetailRow', () => {
  afterEach(cleanup)

  it('renders the title, value, and a copy button labelled from the title', () => {
    render(
      <dl>
        <DetailRow
          label="party"
          value="alice::party"
        />
      </dl>,
    )
    assert.ok(screen.getByText('party'))
    assert.equal(screen.getByText('alice::party').textContent, 'alice::party')
    assert.ok(screen.getByRole('button', { name: 'Copy party' }))
  })

  it('uses copyLabel for the copy button when provided', () => {
    render(
      <dl>
        <DetailRow
          label="party"
          value="alice::party"
          copyLabel="party ID"
        />
      </dl>,
    )
    assert.ok(screen.getByRole('button', { name: 'Copy party ID' }))
  })
})
