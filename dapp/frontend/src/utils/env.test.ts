import { describe, expect, it } from 'vitest'
import { parseEnv } from '@/utils/env'

const DEFAULTS = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_WALLET_RPC_URL: 'http://localhost:3010/rpc',
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
  it.each(['VITE_EXPLORER_URL', 'VITE_WALLET_RPC_URL'])(
    'names %s and rejects an empty value',
    (key) => {
      expect(() => parseEnv({ ...DEFAULTS, [key]: '' })).toThrow(new RegExp(key))
    },
  )

  it('rejects an explorer value that is not a url', () => {
    expect(() => parseEnv({ VITE_EXPLORER_URL: 'scan.localhost' })).toThrow(/VITE_EXPLORER_URL/)
  })

  // The explorer value ends up in an href, so a script-bearing scheme must not survive validation.
  it.each(['javascript:alert(1)', 'data:text/html,<script></script>', 'file:///etc/passwd'])(
    'rejects the %s scheme',
    (VITE_EXPLORER_URL) => {
      expect(() => parseEnv({ VITE_EXPLORER_URL })).toThrow(/VITE_EXPLORER_URL/)
    },
  )

  // The deployed spelling: `fetch` resolves it against the page, so the function is same-origin.
  it('accepts a same-origin path as the rpc url', () => {
    expect(parseEnv({ ...DEFAULTS, VITE_WALLET_RPC_URL: '/api/rpc' })).toEqual({
      ...DEFAULTS,
      VITE_WALLET_RPC_URL: '/api/rpc',
    })
  })

  // Every leading-slash spelling the URL parser resolves to somebody else's origin: a second slash,
  // a backslash folded into one, and a tab or newline stripped before either is read.
  it.each([
    '//evil.example/rpc',
    '/\\evil.example/rpc',
    '/\\/evil.example/rpc',
    '/\t/evil.example/rpc',
    '/\n/evil.example/rpc',
    'api/rpc',
    'javascript:alert(1)',
  ])('rejects %j as the rpc url', (VITE_WALLET_RPC_URL) => {
    expect(() => parseEnv({ ...DEFAULTS, VITE_WALLET_RPC_URL })).toThrow(/VITE_WALLET_RPC_URL/)
  })

  it('rejects a source that is not an object', () => {
    expect(() => parseEnv(undefined)).toThrow()
  })
})
