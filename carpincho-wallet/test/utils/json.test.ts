import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { formatJsonInput, parseJsonObject } from '@/utils/json'

describe('ledger JSON input helpers', () => {
  it('parses and formats loose DAML record arguments', () => {
    // Scenario: a developer pastes a quick DAML-style record instead of strict JSON.
    // The parser accepts unquoted keys, unquoted string values, nested records, and
    // newline separators, then returns the canonical object the ledger command needs.
    const input = `{
      owner: alice::party
      instrumentId: {
        admin: admin::party
        id: BNT
      }
      amount: 10.5
      locked: false
    }`

    const result = parseJsonObject(input, 'Arguments')

    assert.deepEqual(result, {
      owner: 'alice::party',
      instrumentId: {
        admin: 'admin::party',
        id: 'BNT',
      },
      amount: 10.5,
      locked: false,
    })
    assert.equal(formatJsonInput(input, 'Arguments'), JSON.stringify(result, null, 2))
  })
})
