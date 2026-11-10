import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { hostedParty } from './bootstrap-vesting.mjs'

const OPERATOR = 'vesting-operator::1220abcd'

describe('the operator party a re-run reuses', () => {
  it('finds the party allocated under the hint', () => {
    assert.equal(hostedParty([{ party: OPERATOR, isLocal: true }], 'vesting-operator'), OPERATOR)
  })

  it('skips a stamped operator a wallet example bootstraps, whose hint only starts the same', () => {
    const details = [{ party: 'vesting-operator-1700000000001::1220abcd', isLocal: true }]
    assert.equal(hostedParty(details, 'vesting-operator'), undefined)
  })

  it('skips a party this participant knows about but does not host', () => {
    assert.equal(hostedParty([{ party: OPERATOR, isLocal: false }], 'vesting-operator'), undefined)
  })

  it('takes a party whose details leave isLocal out', () => {
    assert.equal(hostedParty([{ party: OPERATOR }], 'vesting-operator'), OPERATOR)
  })
})
