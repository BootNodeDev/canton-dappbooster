import { describe, expect, it } from 'vitest'
import { parseEnv } from '@/utils/env'

const DEFAULTS = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_NETWORK_ID: 'canton:local',
  VITE_REGISTRY_URL: 'http://localhost:3013',
  VITE_WALLET_CONNECT_PROJECT_ID: '',
  VITE_WALLET_GATEWAY_URL: 'http://localhost:3030/api/v0/dapp',
}

describe('parseEnv', () => {
  it('returns the parsed variables', () => {
    expect(parseEnv(DEFAULTS)).toEqual(DEFAULTS)
  })

  it('ignores variables the app does not declare', () => {
    expect(parseEnv({ ...DEFAULTS, CANTON_AUTH_SECRET: 'unsafe' })).toEqual(DEFAULTS)
  })

  it('falls back to the local stack when the variables are absent', () => {
    expect(parseEnv({})).toEqual(DEFAULTS)
  })

  // An unset var in a .env file reaches Vite as an empty string, not as a missing key, so it is a
  // mistake to report rather than a request for the default.
  it.each(['VITE_EXPLORER_URL', 'VITE_REGISTRY_URL', 'VITE_WALLET_GATEWAY_URL'])(
    'names %s and rejects an empty value',
    (key) => {
      expect(() => parseEnv({ ...DEFAULTS, [key]: '' })).toThrow(new RegExp(key))
    },
  )

  it('rejects an explorer value that is not a url', () => {
    expect(() => parseEnv({ VITE_EXPLORER_URL: 'scan.localhost' })).toThrow(/VITE_EXPLORER_URL/)
  })

  it.each(['javascript:alert(1)', 'data:text/html,<script></script>', 'file:///etc/passwd'])(
    'rejects the %s scheme, which the explorer href would otherwise carry',
    (VITE_EXPLORER_URL) => {
      expect(() => parseEnv({ VITE_EXPLORER_URL })).toThrow(/VITE_EXPLORER_URL/)
    },
  )

  it.each(['/api/v0/dapp', '//evil.example/api/v0/dapp', 'javascript:alert(1)'])(
    'rejects %j as the gateway url',
    (VITE_WALLET_GATEWAY_URL) => {
      expect(() => parseEnv({ ...DEFAULTS, VITE_WALLET_GATEWAY_URL })).toThrow(
        /VITE_WALLET_GATEWAY_URL/,
      )
    },
  )

  it('accepts a canton network id', () => {
    expect(parseEnv({ VITE_NETWORK_ID: 'canton:devnet' }).VITE_NETWORK_ID).toBe('canton:devnet')
  })

  it.each(['', 'devnet', 'canton:', 'eip155:1', 'canton:dev net'])(
    'rejects %j as the network id',
    (VITE_NETWORK_ID) => {
      expect(() => parseEnv({ ...DEFAULTS, VITE_NETWORK_ID })).toThrow(/VITE_NETWORK_ID/)
    },
  )

  it('accepts a Reown project id', () => {
    const VITE_WALLET_CONNECT_PROJECT_ID = 'f5f92dc31ae225fd1d946cc87eb1788b'
    expect(parseEnv({ VITE_WALLET_CONNECT_PROJECT_ID }).VITE_WALLET_CONNECT_PROJECT_ID).toBe(
      VITE_WALLET_CONNECT_PROJECT_ID,
    )
  })

  it('accepts an empty project id, which leaves WalletConnect off', () => {
    expect(parseEnv({ VITE_WALLET_CONNECT_PROJECT_ID: '' }).VITE_WALLET_CONNECT_PROJECT_ID).toBe('')
  })

  it.each(['f5f92dc3', 'F5F92DC31AE225FD1D946CC87EB1788B', ' f5f92dc31ae225fd1d946cc87eb1788b'])(
    'rejects %j as the project id',
    (VITE_WALLET_CONNECT_PROJECT_ID) => {
      expect(() => parseEnv({ ...DEFAULTS, VITE_WALLET_CONNECT_PROJECT_ID })).toThrow(
        /VITE_WALLET_CONNECT_PROJECT_ID/,
      )
    },
  )

  it('rejects a source that is not an object', () => {
    expect(() => parseEnv(undefined)).toThrow()
  })

  it.each(['VITE_EXPLORER_URL', 'VITE_REGISTRY_URL', 'VITE_WALLET_GATEWAY_URL'])(
    'refuses to fall back to the local default for %s without them',
    (key) => {
      expect(() => parseEnv({ ...DEFAULTS, [key]: undefined }, false)).toThrow(
        /must be set explicitly/,
      )
    },
  )

  it('takes an explicit value without the local defaults', () => {
    const deployed = {
      VITE_EXPLORER_URL: 'https://scan.example',
      VITE_REGISTRY_URL: '/api/registry',
      VITE_WALLET_GATEWAY_URL: 'https://gateway.example/api/v0/dapp',
    }
    expect(parseEnv(deployed, false)).toMatchObject(deployed)
  })

  it('keeps WalletConnect off without the local defaults', () => {
    const { VITE_NETWORK_ID, VITE_WALLET_CONNECT_PROJECT_ID } = parseEnv(
      { ...DEFAULTS, VITE_NETWORK_ID: undefined, VITE_WALLET_CONNECT_PROJECT_ID: undefined },
      false,
    )
    expect({ VITE_NETWORK_ID, VITE_WALLET_CONNECT_PROJECT_ID }).toEqual({
      VITE_NETWORK_ID: 'canton:local',
      VITE_WALLET_CONNECT_PROJECT_ID: '',
    })
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
    'api/registry',
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
  ])('trims the trailing slash off %j', (VITE_REGISTRY_URL, expected) => {
    expect(parseEnv({ VITE_REGISTRY_URL }).VITE_REGISTRY_URL).toBe(expected)
  })

  // Accepted by `isUrlOrPath` but nothing once trimmed, which would resolve every call against the
  // app's own origin and hand `response.json()` the SPA catch-all's `index.html`.
  it.each(['/', '///'])('rejects %j, which trims away to no base at all', (VITE_REGISTRY_URL) => {
    expect(() => parseEnv({ VITE_REGISTRY_URL })).toThrow(/VITE_REGISTRY_URL/)
  })
})
