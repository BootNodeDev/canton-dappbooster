import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('parseEnv', () => {
  it('returns the parsed variables', () => {
    expect(parseEnv({ VITE_EXPLORER_URL: 'http://scan.localhost:4000' })).toEqual({
      VITE_EXPLORER_URL: 'http://scan.localhost:4000',
    })
  })

  it('ignores variables the app does not declare', () => {
    const parsed = parseEnv({ VITE_EXPLORER_URL: 'http://scan.localhost:4000', MODE: 'test' })

    expect(parsed).toEqual({ VITE_EXPLORER_URL: 'http://scan.localhost:4000' })
  })

  // No `.env` at all is the zero-config case the mock-first app is meant to run in.
  it('falls back to the local scan when the variable is absent', () => {
    expect(parseEnv({})).toEqual({ VITE_EXPLORER_URL: 'http://scan.localhost:4000' })
  })

  // An unset var in a .env file reaches Vite as an empty string, not as a missing key, so it is a
  // mistake to report rather than a request for the default.
  it('names the offending variable and rejects an empty value', () => {
    expect(() => parseEnv({ VITE_EXPLORER_URL: '' })).toThrow(/VITE_EXPLORER_URL/)
  })

  it('rejects a value that is not a url', () => {
    expect(() => parseEnv({ VITE_EXPLORER_URL: 'scan.localhost' })).toThrow(/VITE_EXPLORER_URL/)
  })

  // The value ends up in an href, so a script-bearing scheme must not survive validation.
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
