import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { JsonView } from '@/components/ui/JsonView'

describe('JsonView', () => {
  afterEach(cleanup)

  it('renders object keys and values', () => {
    render(<JsonView value={{ admin: 'alice::party' }} />)
    // key renders in .w-rjv-object-key; value renders in .w-rjv-value — both are leaf spans
    assert.ok(screen.getByText(/admin/))
    assert.ok(
      screen.getAllByText((_t, node) => node?.textContent?.includes('alice::party') ?? false)
        .length > 0,
    )
  })

  it('renders a plain string verbatim without splitting into per-character nodes', () => {
    const b64 = 'aGVsbG8gd29ybGQ='
    render(<JsonView value={b64} />)

    // The full string must appear in a single node (the <pre>)
    assert.ok(screen.getByText(b64))

    // No per-character tree: there must be no element whose sole text content is exactly "a"
    // followed by another whose sole text content is exactly "G" as separate index entries.
    // Check by asserting no "0:" or "1:" index key labels exist in the DOM.
    const allText = document.body.textContent ?? ''
    assert.ok(!allText.includes('0:'), 'found index key "0:" — string was split into characters')
    assert.ok(!allText.includes('1:'), 'found index key "1:" — string was split into characters')
  })
})
