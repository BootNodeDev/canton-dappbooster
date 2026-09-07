import { describe, expect, it } from 'vitest'
import { parseEnv } from '@/utils/env'

const DEFAULTS = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_REGISTRY_URL: 'http://localhost:3013',
}

describe('parseEnv', () => {
  it('returns the parsed variables', () => {
    expect(parseEnv(DEFAULTS)).toEqual(DEFAULTS)
  })

  it('ignores variables the app does not declare', () => {
    expect(parseEnv({ ...DEFAULTS, CANTON_AUTH_SECRET: 'unsafe' })).toEqual(DEFAULTS)
  })

  // No `.env` at all is the zero-config case the app is meant to run in.
  it('falls back to the local stack when the variables are absent', () => {
    expect(parseEnv({})).toEqual(DEFAULTS)
  })

  // An unset var in a .env file reaches Vite as an empty string, not as a missing key, so it is a
  // mistake to report rather than a request for the default.
  it.each(['VITE_EXPLORER_URL', 'VITE_REGISTRY_URL'])(
    'names %s and rejects an empty value',
    (key) => {
      expect(() => parseEnv({ ...DEFAULTS, [key]: '' })).toThrow(new RegExp(key))
    },
  )

  it('rejects an explorer value that is not a url', () => {
    expect(() => parseEnv({ VITE_EXPLORER_URL: 'scan.localhost' })).toThrow(/VITE_EXPLORER_URL/)
  })

  // The explorer value ends up in an href, so a script-bearing scheme must not survive.
  it.each(['javascript:alert(1)', 'data:text/html,<script></script>', 'file:///etc/passwd'])(
    'rejects the %s scheme',
    (VITE_EXPLORER_URL) => {
      expect(() => parseEnv({ VITE_EXPLORER_URL })).toThrow(/VITE_EXPLORER_URL/)
    },
  )

  it('rejects a source that is not an object', () => {
    expect(() => parseEnv(undefined)).toThrow()
  })
})

describe('VITE_REGISTRY_URL', () => {
  it('defaults to the local registry port', () => {
    expect(parseEnv({}).VITE_REGISTRY_URL).toBe('http://localhost:3013')
  })

  it('accepts a same-origin path, which is what a deployed build sets', () => {
    expect(parseEnv({ VITE_REGISTRY_URL: '/api/registry' }).VITE_REGISTRY_URL).toBe('/api/registry')
  })

  it('rejects a value that is neither a url nor a path', () => {
    expect(() => parseEnv({ VITE_REGISTRY_URL: 'registry' })).toThrow(/VITE_REGISTRY_URL/)
  })

  // Leading-slash spellings the URL parser still resolves to somebody else's origin.
  it.each([
    '//evil.example/rpc',
    '/\\evil.example/rpc',
    '/\\/evil.example/rpc',
    '/\t/evil.example/rpc',
    '/\n/evil.example/rpc',
    'api/rpc',
    'javascript:alert(1)',
  ])('rejects %j as the registry url', (VITE_REGISTRY_URL) => {
    expect(() => parseEnv({ ...DEFAULTS, VITE_REGISTRY_URL })).toThrow(/VITE_REGISTRY_URL/)
  })

  // A base, not an endpoint: every caller appends a path, so a trailing slash would request
  // `//registry/...` and 404 against a path the thrown message would then misreport.
  it.each([
    ['http://localhost:3013/', 'http://localhost:3013'],
    ['http://localhost:3013///', 'http://localhost:3013'],
    ['/api/registry/', '/api/registry'],
    ['/', ''],
  ])('trims the trailing slash off %j', (VITE_REGISTRY_URL, expected) => {
    expect(parseEnv({ VITE_REGISTRY_URL }).VITE_REGISTRY_URL).toBe(expected)
  })
})
