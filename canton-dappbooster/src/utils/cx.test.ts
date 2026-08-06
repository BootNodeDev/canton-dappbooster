import { describe, expect, it } from 'vitest'
import { cx } from './cx'

describe('cx', () => {
  it('joins the classes it is given with a single space', () => {
    expect(cx('cnc-identifier', 'extra')).toBe('cnc-identifier extra')
  })

  it('drops absent values rather than leaving gaps', () => {
    expect(cx('cnc-identifier', undefined)).toBe('cnc-identifier')
    expect(cx(undefined, 'extra')).toBe('extra')
    expect(cx('a', null, false, undefined, 'b')).toBe('a b')
  })

  it('drops an empty string, which would otherwise emit a trailing space', () => {
    expect(cx('cnc-identifier', '')).toBe('cnc-identifier')
  })

  it('returns an empty string when nothing survives', () => {
    expect(cx()).toBe('')
    expect(cx(undefined, false)).toBe('')
  })
})
