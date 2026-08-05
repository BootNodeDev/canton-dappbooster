import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getExplorerLink, useExplorerLink } from './useExplorerLink'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
const PARTY_ENCODED = 'nico%3A%3A1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
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

  it('uses a custom path template', () => {
    const explorer = { baseUrl: 'https://scan.example', paths: { party: '/parties/{id}/holdings' } }
    expect(getExplorerLink({ explorer, value: PARTY })).toBe(
      `https://scan.example/parties/${PARTY_ENCODED}/holdings`,
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

  it('returns undefined when the explorer has no template for the entity', () => {
    const explorer = { baseUrl: 'https://scan.example', paths: { party: null } }
    expect(getExplorerLink({ explorer, value: PARTY })).toBeUndefined()
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
      useExplorerLink({ baseUrl: 'https://scan.example', paths: { party: '/party/{id}' } }),
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

  // Stability is memoised per path, so every template belongs in the dependency list.
  it('rebuilds when a configured path template changes', () => {
    const { result, rerender } = renderHook(
      ({ party }) => useExplorerLink({ baseUrl: 'https://scan.example', paths: { party } }),
      { initialProps: { party: '/party/{id}' } },
    )

    rerender({ party: '/parties/{id}' })

    expect(result.current(PARTY)).toBe(`https://scan.example/parties/${PARTY_ENCODED}`)
  })
})
