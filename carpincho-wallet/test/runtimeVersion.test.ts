import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildStatus } from '@/provider/status'

const rootVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

describe('runtime provider version', () => {
  it('reports the full root package.json version via __APP_VERSION__', async (t) => {
    // Stub wallet-service status with a minimal success payload so buildStatus
    // resolves without a real network call. This closes the loop on the
    // __APP_VERSION__ build-time define.
    t.mock.method(globalThis, 'fetch', () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: '1', result: {} }),
      } as Response),
    )

    const status = await buildStatus()

    assert.equal(status.provider.version, rootVersion)
  })
})
