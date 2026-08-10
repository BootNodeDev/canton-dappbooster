import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getExplorerLink, useExplorerLink } from './useExplorerLink'

const FINGERPRINT = '1220bacae18ee76cbead16253ac8dbc811bdd759f99cbabc84bc4b2354a9f6a5e13c'
const PARTY = `nico::${FINGERPRINT}`
const PARTY_ENCODED = `nico%3A%3A${FINGERPRINT}`
const CONTRACT = `00${'a3'.repeat(68)}`
const UPDATE = 'ab'.repeat(32)

const EXPLORER = { baseUrl: 'https://scan.example' }

describe('getExplorerLink', () => {
  it('routes a party id to the party path', () => {
    expect(getExplorerLink({ explorer: EXPLORER, value: PARTY })).toBe(
      `https://scan.example/party/${PARTY_ENCODED}`,
    )
  })

  it('routes a contract id to the contract path', () => {
    expect(getExplorerLink({ explorer: EXPLORER, value: CONTRACT })).toBe(
      `https://scan.example/contract/${CONTRACT}`,
    )
  })

  // The shortest a contract id gets: the `00` discriminator, a 32-byte hash, and no suffix.
  it('routes a suffixless contract id to the contract path', () => {
    const value = `00${'a3'.repeat(32)}`
    expect(getExplorerLink({ explorer: EXPLORER, value })).toBe(
      `https://scan.example/contract/${value}`,
    )
  })

  it('routes a 64-character hex id to the update path', () => {
    expect(getExplorerLink({ explorer: EXPLORER, value: UPDATE })).toBe(
      `https://scan.example/update/${UPDATE}`,
    )
  })

  it('reads a 64-character hex id starting with 00 as an update, not a contract', () => {
    const value = `00${'b'.repeat(62)}`
    expect(getExplorerLink({ explorer: EXPLORER, value })).toBe(
      `https://scan.example/update/${value}`,
    )
  })

  it('honours an explicit entity over the detected one', () => {
    expect(getExplorerLink({ explorer: EXPLORER, value: UPDATE, entity: 'contract' })).toBe(
      `https://scan.example/contract/${UPDATE}`,
    )
  })

  it('keeps a path prefix on the base url and drops its trailing slash', () => {
    const explorer = { baseUrl: 'https://scan.example/app/' }
    expect(getExplorerLink({ explorer, value: UPDATE })).toBe(
      `https://scan.example/app/update/${UPDATE}`,
    )
  })

  it('returns undefined when the value matches no known identifier shape', () => {
    expect(getExplorerLink({ explorer: EXPLORER, value: 'not-an-identifier' })).toBeUndefined()
    expect(getExplorerLink({ explorer: EXPLORER, value: '' })).toBeUndefined()
  })

  // A field mid-entry is separator-shaped long before it is a party; a link to it would 404.
  it('returns undefined for a half-typed party id', () => {
    expect(getExplorerLink({ explorer: EXPLORER, value: 'nico::' })).toBeUndefined()
    expect(
      getExplorerLink({ explorer: EXPLORER, value: `nico::${FINGERPRINT.slice(0, 40)}` }),
    ).toBe(undefined)
  })

  // An unset env var reaches the config as an empty string; that is a misconfigured app, not a
  // missing link, so it fails where the mistake is rather than rendering nothing.
  it('throws when the base url is empty or blank', () => {
    expect(() => getExplorerLink({ explorer: { baseUrl: '' }, value: PARTY })).toThrow(
      /baseUrl is required/,
    )
    expect(() => getExplorerLink({ explorer: { baseUrl: '  ' }, value: PARTY })).toThrow(
      /baseUrl is required/,
    )
  })
})

describe('useExplorerLink', () => {
  it('builds links from the configured explorer', () => {
    const { result } = renderHook(() => useExplorerLink(EXPLORER))

    expect(result.current(PARTY)).toBe(`https://scan.example/party/${PARTY_ENCODED}`)
    expect(result.current(UPDATE, 'contract')).toBe(`https://scan.example/contract/${UPDATE}`)
  })

  // Rendering, not calling: a missing explorer url surfaces on mount, not on whichever click
  // first needs a link.
  it('throws on render when the base url is empty', () => {
    // React logs a render error of its own; the assertion below is the contract.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => renderHook(() => useExplorerLink({ baseUrl: '' }))).toThrow(/baseUrl is required/)
  })

  // An inline config object is a new reference every render; the builder must not be.
  it('keeps the builder stable across renders of an inline config', () => {
    const { result, rerender } = renderHook(() =>
      useExplorerLink({ baseUrl: 'https://scan.example' }),
    )
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })

  it('rebuilds when the configured base url changes', () => {
    const { result, rerender } = renderHook(({ baseUrl }) => useExplorerLink({ baseUrl }), {
      initialProps: { baseUrl: 'https://scan.example' },
    })

    rerender({ baseUrl: 'https://other.example' })

    expect(result.current(UPDATE)).toBe(`https://other.example/update/${UPDATE}`)
  })
})
