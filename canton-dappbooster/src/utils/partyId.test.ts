import { describe, expect, it } from 'vitest'
import { isPartyId, isValidPartyId, PARTY_SEPARATOR, validatePartyId } from './partyId'

// `1220` plus 64 hex: the 68 characters a live Canton fingerprint has.
const FINGERPRINT = '1220bacae18ee76cbead16253ac8dbc811bdd759f99cbabc84bc4b2354a9f6a5e13c'
const PARTY = `nico::${FINGERPRINT}`
const PLAIN = 'viewer1-1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2d05fe52e'

describe('isPartyId', () => {
  it('accepts a party id', () => {
    expect(isPartyId(PARTY)).toBe(true)
  })

  it('rejects an identifier with no separator', () => {
    expect(isPartyId(PLAIN)).toBe(false)
    expect(isPartyId('')).toBe(false)
  })

  it('rejects a single colon', () => {
    expect(isPartyId('nico:1220df94')).toBe(false)
  })

  it('accepts a separator anywhere, including malformed halves', () => {
    // Shape classification, not validation: the explorer router only needs party-vs-hash.
    expect(isPartyId(PARTY_SEPARATOR)).toBe(true)
    expect(isPartyId('alice::')).toBe(true)
    expect(isPartyId('::1220df94')).toBe(true)
    expect(isPartyId('alice::ns::extra')).toBe(true)
  })
})

describe('validatePartyId', () => {
  it('accepts a well-formed party id', () => {
    expect(validatePartyId(PARTY)).toBeUndefined()
  })

  it('accepts an uppercase fingerprint', () => {
    expect(validatePartyId(`nico::${FINGERPRINT.toUpperCase()}`)).toBeUndefined()
  })

  it('accepts the hyphenated and underscored hints Canton issues', () => {
    expect(validatePartyId(`vesting-operator_1::${FINGERPRINT}`)).toBeUndefined()
  })

  it('accepts a uuid hint, which Canton assigns when none is given', () => {
    expect(validatePartyId(`ee1d49e9-fa52-480a-8e85-033738a1fc75::${FINGERPRINT}`)).toBeUndefined()
  })

  it('rejects a value with no separator', () => {
    expect(validatePartyId(PLAIN)).toBe('missing-separator')
    expect(validatePartyId('')).toBe('missing-separator')
    expect(validatePartyId('nico:1220df94')).toBe('missing-separator')
  })

  it('rejects a blank hint', () => {
    expect(validatePartyId(`::${FINGERPRINT}`)).toBe('invalid-hint')
    expect(validatePartyId(`   ::${FINGERPRINT}`)).toBe('invalid-hint')
  })

  it('rejects whitespace inside the hint', () => {
    expect(validatePartyId(`two words::${FINGERPRINT}`)).toBe('invalid-hint')
  })

  it('rejects a truncated fingerprint', () => {
    // The commonest real typo: a party id pasted from a display that had shortened it.
    expect(validatePartyId(`nico::${FINGERPRINT.slice(0, 56)}`)).toBe('invalid-fingerprint')
    expect(validatePartyId(`nico::${FINGERPRINT}ab`)).toBe('invalid-fingerprint')
  })

  it('rejects a fingerprint that is empty or not hex', () => {
    expect(validatePartyId('nico::')).toBe('invalid-fingerprint')
    expect(validatePartyId(`nico::${FINGERPRINT} `)).toBe('invalid-fingerprint')
    expect(validatePartyId(`nico::${'z'.repeat(68)}`)).toBe('invalid-fingerprint')
  })

  it('rejects a second separator, which the fingerprint half cannot contain', () => {
    expect(validatePartyId(`alice::ns::${FINGERPRINT}`)).toBe('invalid-fingerprint')
  })
})

describe('isValidPartyId', () => {
  it('collapses the reason to a boolean', () => {
    expect(isValidPartyId(PARTY)).toBe(true)
    expect(isValidPartyId(PLAIN)).toBe(false)
  })
})
