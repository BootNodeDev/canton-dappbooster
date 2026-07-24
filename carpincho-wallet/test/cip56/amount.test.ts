import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { formatTokenAmount } from '@/cip56/amount'

describe('formatTokenAmount', () => {
  it('pads to two decimals and groups thousands', () => {
    assert.equal(formatTokenAmount('9997'), '9,997.00')
    assert.equal(formatTokenAmount('15.75'), '15.75')
    assert.equal(formatTokenAmount('2.0000000000'), '2.00')
    assert.equal(formatTokenAmount('9995.0000000000'), '9,995.00')
    assert.equal(formatTokenAmount('1234567.891'), '1,234,567.89')
  })

  it('rounds half up to two decimals, carrying into the whole part', () => {
    assert.equal(formatTokenAmount('0.004'), '0.00')
    assert.equal(formatTokenAmount('0.005'), '0.01')
    assert.equal(formatTokenAmount('1.999'), '2.00')
    assert.equal(formatTokenAmount('999.999'), '1,000.00')
  })

  it('keeps precision for amounts beyond Number range', () => {
    assert.equal(formatTokenAmount('12345678901234567890.5'), '12,345,678,901,234,567,890.50')
  })

  it('returns the raw value when it is not a positive decimal', () => {
    assert.equal(formatTokenAmount('unknown'), 'unknown')
    assert.equal(formatTokenAmount(''), '')
  })
})
