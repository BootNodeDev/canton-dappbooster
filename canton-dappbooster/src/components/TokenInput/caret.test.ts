import { describe, expect, it } from 'vitest'
import { caretBeforeDigits, countDigitsAfter } from './caret'

describe('countDigitsAfter', () => {
  it('counts digits after the caret, ignoring separators', () => {
    expect(countDigitsAfter('1,234.5', 5)).toBe(1)
    expect(countDigitsAfter('1,234.5', 4)).toBe(2)
    expect(countDigitsAfter('1,234.5', 0)).toBe(5)
    expect(countDigitsAfter('1,234.5', 7)).toBe(0)
  })
})

describe('caretBeforeDigits', () => {
  it('places the caret before the same digit count in the regrouped value', () => {
    expect(caretBeforeDigits('12,345', 3)).toBe(3)
    expect(caretBeforeDigits('12,345', 0)).toBe(6)
  })

  it('lands past a trailing separator rather than before it', () => {
    expect(caretBeforeDigits('100.', 0)).toBe(4)
    expect(caretBeforeDigits('0.', 0)).toBe(2)
  })

  it('lands at the start when the value shrank below that many digits', () => {
    expect(caretBeforeDigits('12', 5)).toBe(0)
  })

  it('skips the separator a digit sits behind', () => {
    expect(caretBeforeDigits('1,234', 3)).toBe(2)
    expect(caretBeforeDigits('1,234', 4)).toBe(0)
  })
})
