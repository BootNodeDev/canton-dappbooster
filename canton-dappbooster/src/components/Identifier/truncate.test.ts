import { describe, expect, it } from 'vitest'
import { partyHint, truncateIdentifier } from './truncate'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
const PLAIN = 'viewer1-1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2d05fe52e'

describe('truncateIdentifier', () => {
  it('keeps the party hint whole and shortens only the fingerprint', () => {
    expect(truncateIdentifier(PARTY)).toBe('nico::1220df…0b1cbb46')
  })

  it('middle-truncates an identifier that has no party separator', () => {
    expect(truncateIdentifier(PLAIN)).toBe('viewer1-1220…d05fe52e')
  })

  it('leaves a value at or under the threshold alone', () => {
    expect(truncateIdentifier('cid-abc')).toBe('cid-abc')
    expect(truncateIdentifier('a'.repeat(22))).toBe('a'.repeat(22))
    expect(truncateIdentifier('a'.repeat(23))).not.toBe('a'.repeat(23))
  })

  it('measures the threshold against the fingerprint, not the whole party id', () => {
    // The hint pushes this past 22 characters, but the fingerprint itself is short.
    expect(truncateIdentifier('a-fairly-long-hint::1220df94')).toBe('a-fairly-long-hint::1220df94')
  })

  it('handles a party id with an empty half', () => {
    expect(truncateIdentifier('alice::')).toBe('alice::')
    expect(truncateIdentifier(`::${'f'.repeat(30)}`)).toBe('::ffffff…ffffffff')
  })

  it('keeps everything after the first separator as the fingerprint', () => {
    expect(truncateIdentifier('alice::ns::extra')).toBe('alice::ns::extra')
  })

  it('returns an empty string unchanged', () => {
    expect(truncateIdentifier('')).toBe('')
  })

  it('honours head, tail, and threshold overrides on both shapes', () => {
    expect(truncateIdentifier(PARTY, { head: 4, tail: 4 })).toBe('nico::1220…bb46')
    expect(truncateIdentifier(PLAIN, { head: 4, tail: 4 })).toBe('view…e52e')
    expect(truncateIdentifier('cid-abc', { threshold: 4, head: 2, tail: 2 })).toBe('ci…bc')
  })

  it('drops the tail entirely when tail is zero', () => {
    expect(truncateIdentifier('a'.repeat(30), { tail: 0 })).toBe(`${'a'.repeat(12)}…`)
  })

  it('leaves the value alone when head and tail would overlap', () => {
    expect(truncateIdentifier('abcdefghijklmno', { threshold: 5 })).toBe('abcdefghijklmno')
  })

  it('bounds the hint when asked, keeping its head and no tail', () => {
    expect(
      truncateIdentifier(`treasury-operations-team::${PARTY.split('::')[1]}`, { hint: 12 }),
    ).toBe('treasury-ope…::1220df…0b1cbb46')
  })

  it('leaves a hint at or under the bound alone', () => {
    expect(truncateIdentifier(PARTY, { hint: 12 })).toBe('nico::1220df…0b1cbb46')
    expect(truncateIdentifier(`${'a'.repeat(12)}::1220df94`, { hint: 12 })).toBe(
      `${'a'.repeat(12)}::1220df94`,
    )
  })

  it('ignores the hint bound on a value with no separator', () => {
    expect(truncateIdentifier(PLAIN, { hint: 4 })).toBe('viewer1-1220…d05fe52e')
  })

  it('never returns more characters than it was given', () => {
    // Deliberately malformed: shortening must never make a string longer, whatever it is given.
    const inputs = [PARTY, PLAIN, 'a'.repeat(30), `::${'f'.repeat(30)}`, 'alice::ns::extra']
    const knobs = [
      {},
      { tail: 0 },
      { head: 0 },
      { threshold: 1 },
      { head: 20, tail: 20 },
      { hint: 0 },
      { hint: 40 },
    ]
    for (const value of inputs) {
      for (const options of knobs) {
        expect(truncateIdentifier(value, options).length).toBeLessThanOrEqual(value.length)
      }
    }
  })
})

describe('partyHint', () => {
  it('extracts the readable half of a party id', () => {
    expect(partyHint(PARTY)).toBe('nico')
  })

  it('returns the whole value when there is no separator', () => {
    expect(partyHint(PLAIN)).toBe(PLAIN)
  })

  it('returns an empty hint for a leading separator', () => {
    expect(partyHint('::1220df94')).toBe('')
  })
})
