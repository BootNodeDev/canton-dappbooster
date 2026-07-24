import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { compareDecimalStrings, formatAmountInput, stripAmountGroups } from '@/cip56/amount'

describe('compareDecimalStrings', () => {
  it('compares decimals of differing scale without float error', () => {
    assert.equal(compareDecimalStrings('10', '9.999999999'), 1)
    assert.equal(compareDecimalStrings('1.5', '1.50'), 0)
    assert.equal(compareDecimalStrings('0.1', '0.2'), -1)
    assert.equal(compareDecimalStrings('1000.00', '1000'), 0)
  })

  it('returns undefined for non-decimal input', () => {
    assert.equal(compareDecimalStrings('abc', '1'), undefined)
    assert.equal(compareDecimalStrings('1', ''), undefined)
  })
})

describe('stripAmountGroups', () => {
  it('removes commas and invalid characters, collapsing extra dots', () => {
    assert.equal(stripAmountGroups('9,997.50'), '9997.50')
    assert.equal(stripAmountGroups('1,234,567'), '1234567')
    assert.equal(stripAmountGroups('1.2.3'), '1.23')
    assert.equal(stripAmountGroups('12a3'), '123')
  })

  it('normalizes a leading dot to "0."', () => {
    assert.equal(stripAmountGroups('.5'), '0.5')
    assert.equal(stripAmountGroups('.'), '0.')
    assert.equal(stripAmountGroups(''), '')
  })
})

describe('formatAmountInput', () => {
  it('groups the integer part while preserving the fraction and trailing dot', () => {
    assert.equal(formatAmountInput('1234567'), '1,234,567')
    assert.equal(formatAmountInput('9997.5'), '9,997.5')
    assert.equal(formatAmountInput('9997.'), '9,997.')
    assert.equal(formatAmountInput('1234567.891'), '1,234,567.891')
    assert.equal(formatAmountInput('.5'), '0.5')
    assert.equal(formatAmountInput(''), '')
  })
})
