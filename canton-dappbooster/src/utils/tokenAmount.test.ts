import { describe, expect, it } from 'vitest'
import {
  formatAmount,
  formatScaled,
  parseAmount,
  sanitizeAmountInput,
  settleAmount,
  validateAmount,
} from '#src/utils/tokenAmount'

describe('parseAmount', () => {
  it('scales a decimal string to the ledger precision', () => {
    expect(parseAmount('1.5')).toBe(15_000_000_000n)
    expect(parseAmount('0.0000000001')).toBe(1n)
    expect(parseAmount('0')).toBe(0n)
  })

  it('keeps a value a double would lose', () => {
    expect(parseAmount('8421337.1234567891')).toBe(84_213_371_234_567_891n)
  })

  it('accepts a value mid-typing', () => {
    expect(parseAmount('1.')).toBe(10_000_000_000n)
  })

  it('rejects what is not a decimal, including the empty string', () => {
    expect(parseAmount('')).toBeUndefined()
    expect(parseAmount('abc')).toBeUndefined()
    expect(parseAmount('-1')).toBeUndefined()
    expect(parseAmount('1e3')).toBeUndefined()
  })

  it('rejects more decimals than the precision can hold', () => {
    expect(parseAmount('0.12345678901')).toBeUndefined()
    expect(parseAmount('0.123', 2)).toBeUndefined()
  })
})

describe('formatScaled', () => {
  it('round-trips parseAmount', () => {
    expect(formatScaled(84_213_371_234_567_891n)).toBe('8421337.1234567891')
    expect(formatScaled(15_000_000_000n)).toBe('1.5')
    expect(formatScaled(1n)).toBe('0.0000000001')
    expect(formatScaled(0n)).toBe('0')
  })
})

describe('formatAmount', () => {
  it('groups the integer part exactly', () => {
    expect(formatAmount('8421337.1234567891')).toBe('8,421,337.1234567891')
  })

  it('leaves a value being typed alone', () => {
    expect(formatAmount('1.')).toBe('1.')
    expect(formatAmount('1.50')).toBe('1.50')
    expect(formatAmount('')).toBe('')
  })
})

describe('locale round trip', () => {
  // The field re-reads its own display, so grouping and sanitizing have to agree on the separators
  // or a comma-decimal locale reports a value a thousand times too small.
  it('formats and reads back a comma-decimal locale', () => {
    expect(formatAmount('1234.5', 'de-DE')).toBe('1.234,5')
    expect(sanitizeAmountInput('1.234,5', 'de-DE')).toBe('1234.5')
    expect(sanitizeAmountInput(formatAmount('8421337.1234567891', 'de-DE'), 'de-DE')).toBe(
      '8421337.1234567891',
    )
  })

  it('keeps latin digits under a locale that defaults to another numbering system', () => {
    expect(formatAmount('1234', 'ar-EG')).toMatch(/^[\d,.\u066b\u066c\u00a0\u202f]+$/)
  })
})

describe('sanitizeAmountInput', () => {
  it('drops everything that can never be part of an amount', () => {
    expect(sanitizeAmountInput('1a2')).toBe('12')
    expect(sanitizeAmountInput('1,234.5')).toBe('1234.5')
    expect(sanitizeAmountInput('1..5')).toBe('1.5')
  })

  it('keeps a sign or an exponent instead of salvaging a different amount', () => {
    expect(sanitizeAmountInput('-1')).toBe('-1')
    expect(sanitizeAmountInput('1.5e3')).toBe('1.5e3')
    expect(validateAmount(sanitizeAmountInput('1.5e3'))).toBe('not-a-number')
    expect(validateAmount(sanitizeAmountInput('-5'))).toBe('not-a-number')
  })

  it('collapses leading zeros and completes a leading dot', () => {
    expect(sanitizeAmountInput('007.5')).toBe('7.5')
    expect(sanitizeAmountInput('.5')).toBe('0.5')
    expect(sanitizeAmountInput('0')).toBe('0')
  })
})

describe('settleAmount', () => {
  it('drops a dangling separator and leaves everything else', () => {
    expect(settleAmount('1.')).toBe('1')
    expect(settleAmount('1.50')).toBe('1.50')
    expect(settleAmount('')).toBe('')
  })
})

describe('validateAmount', () => {
  it('treats the empty string as empty, not invalid', () => {
    expect(validateAmount('')).toBeUndefined()
  })

  it('flags more decimals than the token accepts', () => {
    expect(validateAmount('0.12345678901')).toBe('too-many-decimals')
    expect(validateAmount('0.123', { precision: 2 })).toBe('too-many-decimals')
  })

  it('flags an integer part beyond Numeric 38,10', () => {
    expect(validateAmount('1'.repeat(29))).toBe('too-large')
    expect(validateAmount('1'.repeat(28))).toBeUndefined()
  })

  it('compares against max exactly', () => {
    expect(validateAmount('1.4999999999', { max: '1.5' })).toBeUndefined()
    expect(validateAmount('1.5000000001', { max: '1.5' })).toBe('above-max')
    expect(validateAmount('8421337.1234567892', { max: '8421337.1234567891' })).toBe('above-max')
  })

  it('flags a programmatically set value that is not a decimal', () => {
    expect(validateAmount('abc')).toBe('not-a-number')
  })

  it('flags a max it cannot read rather than dropping the ceiling', () => {
    expect(validateAmount('999999', { max: '1,250.50' })).toBe('invalid-max')
    expect(validateAmount('999999', { max: '1.00000000001' })).toBe('invalid-max')
    expect(validateAmount('999999')).toBeUndefined()
    expect(validateAmount('999999', { max: '' })).toBeUndefined()
  })
})
