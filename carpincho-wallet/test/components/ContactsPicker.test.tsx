import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactsPicker } from '@/components/ContactsPicker'
import type { AccountPublic } from '@/vault/types'

const make = (id: string, name: string): AccountPublic => ({
  id,
  name,
  partyId: `${name.toLowerCase()}::1220abcd`,
  publicKeyBase64: 'pk',
  network: 'canton:local',
  isPrimary: false,
  createdAt: 1,
})

describe('ContactsPicker', () => {
  afterEach(() => cleanup())

  it('lists the provided contacts and returns the picked party id', async () => {
    const picked: string[] = []
    render(
      <ContactsPicker
        contacts={[make('a', 'Bob'), make('b', 'Carol')]}
        onSelect={(partyId) => picked.push(partyId)}
      />,
    )
    assert.ok(screen.getByText('Bob'))
    assert.ok(screen.getByText('Carol'))
    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))
    assert.deepEqual(picked, ['bob::1220abcd'])
  })

  it('shows an empty state when there are no other accounts', () => {
    render(
      <ContactsPicker
        contacts={[]}
        onSelect={() => undefined}
      />,
    )
    assert.ok(screen.getByText(/no other accounts/i))
  })
})
