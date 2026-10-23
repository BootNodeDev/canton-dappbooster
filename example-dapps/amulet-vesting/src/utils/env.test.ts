import { describe, expect, it } from 'vitest'
import { parseEnv } from '@/utils/env'

const DEFAULTS = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_NETWORK_ID: 'canton:local',
  VITE_SCAN_API_URL: 'http://scan.localhost:4000/api/scan',
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

  it.each(['VITE_EXPLORER_URL', 'VITE_SCAN_API_URL', 'VITE_WALLET_GATEWAY_URL'])(
    'names %s and rejects an empty value, which is how an unset key reaches Vite',
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

  it.each(['/api/scan', '//evil.example/api/scan', 'scan', 'javascript:alert(1)'])(
    'rejects %j as the scan url, which the browser calls with nothing to resolve against',
    (VITE_SCAN_API_URL) => {
      expect(() => parseEnv({ ...DEFAULTS, VITE_SCAN_API_URL })).toThrow(/VITE_SCAN_API_URL/)
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
})
