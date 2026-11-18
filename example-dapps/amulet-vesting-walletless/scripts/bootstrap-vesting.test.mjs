import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { partyUnder } from './bootstrap-vesting.mjs'

const OPERATOR = 'vesting-operator::1220abcd'

describe('the operator id the bootstrap looks up', () => {
  it('puts the hint under the participant namespace', () => {
    assert.equal(partyUnder('participant1::1220abcd', 'vesting-operator'), OPERATOR)
  })

  it('takes the namespace from the end of an id with a prefix', () => {
    assert.equal(partyUnder('PAR::participant1::1220abcd', 'vesting-operator'), OPERATOR)
  })

  it('refuses a participant id with no namespace', () => {
    assert.throws(() => partyUnder('participant1', 'vesting-operator'), /no namespace/)
  })
})
