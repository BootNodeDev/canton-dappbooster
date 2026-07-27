import { describe, expect, it } from 'vitest'
import { claimAmountInput, clampClaimAmount, formatCC, formatCCFull } from './format'

describe('claimAmountInput', () => {
  it('fills the full-precision remaining, not a 2dp floor', () => {
    // The bug: Math.floor(105.9154321 * 100) / 100 === 105.91 — you could never claim it all.
    expect(claimAmountInput(105.9154321)).toBe('105.9154321')
  })

  it('recovers the ledger decimal despite float-subtraction noise', () => {
    // 0.9444 - 0.3262 is not exactly 0.6182 in float; toFixed(10) absorbs the noise.
    expect(claimAmountInput(0.9444 - 0.3262)).toBe('0.6182')
  })

  it('strips trailing zeros and a bare dot', () => {
    expect(claimAmountInput(106)).toBe('106')
    expect(claimAmountInput(105.5)).toBe('105.5')
  })

  it('is empty for non-positive amounts', () => {
    expect(claimAmountInput(0)).toBe('')
    expect(claimAmountInput(-1)).toBe('')
  })
})

describe('formatCCFull', () => {
  it('shows full precision where the 2dp formatter would round up', () => {
    expect(formatCC(105.9154321)).toBe('105.92')
    expect(formatCCFull(105.9154321)).toBe('105.9154321')
  })
})

describe('clampClaimAmount', () => {
  it('passes through an amount within available', () => {
    expect(clampClaimAmount(50, 100)).toBe(50)
  })

  it('clamps to available when amount exceeds it', () => {
    expect(clampClaimAmount(200, 100)).toBe(100)
  })

  it('truncates to 10 decimal places', () => {
    // 11 decimal places typed by user — must not reach the ledger verbatim.
    expect(clampClaimAmount(1.12345678901, 10)).toBe(1.123456789)
  })

  it('absorbs float-subtraction noise back to the ledger value', () => {
    // min(available, available) via toFixed(10) recovers the intended decimal.
    const available = 200 - 94.0845679 // float noise: not exactly 105.9154321
    expect(clampClaimAmount(available, available)).toBe(105.9154321)
  })

  it('clamps and then truncates when both apply', () => {
    // amount > available and has >10dp; result should be available at 10dp.
    expect(clampClaimAmount(99.99999999991, 50.123456789)).toBe(50.123456789)
  })
})
