import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { uploadDarFile, walletServiceRequest } from '@/api/walletService'

const originalFetch = globalThis.fetch
const originalChrome = (globalThis as { chrome?: unknown }).chrome

describe('wallet-service admin API', () => {
  afterEach(() => {
    // Each scenario installs its own fetch spy so request shape assertions do not leak.
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'chrome', { configurable: true, value: originalChrome })
    localStorage.clear()
  })

  it('uploads DAR files to the admin endpoint as octet-stream bytes', async () => {
    // Scenario: the browser already has the compiled DAR file, so Carpincho must
    // send the raw file body to wallet-service instead of wrapping it in JSON-RPC.
    const file = new File([new Uint8Array([1, 2, 3])], 'token.dar')
    const seen: { url?: string; type?: string; body?: Blob } = {}
    globalThis.fetch = (async (input, init) => {
      seen.url = String(input)
      seen.type = new Headers(init?.headers).get('content-type') ?? undefined
      seen.body = init?.body as Blob
      return new Response(JSON.stringify({ ok: true, vetAllPackages: true, response: {} }), {
        status: 200,
      })
    }) as typeof globalThis.fetch

    const result = await uploadDarFile(file, { rpcUrl: 'http://wallet.example/rpc' })

    // The URL is derived from the configured RPC endpoint and keeps binary upload out of JSON-RPC.
    assert.equal(seen.url, 'http://wallet.example/admin/dars')
    assert.equal(seen.type, 'application/octet-stream')
    assert.equal(seen.body, file)
    assert.deepEqual(result, { ok: true, vetAllPackages: true, response: {} })
  })

  it('uses extension local storage for JSON-RPC calls made by the background worker', async () => {
    // Scenario: the MV3 background worker has no window.localStorage, so direct dApp
    // ledgerApi calls must read the RPC URL persisted by the popup from chrome.storage.local.
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: async (key: string) => ({
              [key]: { walletServiceRpcUrl: 'http://wallet.example/rpc' },
            }),
            set: async () => undefined,
          },
        },
      },
    })
    const seen: { url?: string; body?: string } = {}
    globalThis.fetch = (async (input, init) => {
      seen.url = String(input)
      seen.body = String(init?.body ?? '')
      return new Response(JSON.stringify({ result: { ok: true } }), { status: 200 })
    }) as typeof globalThis.fetch

    await walletServiceRequest('ledgerApi', {
      requestMethod: 'get',
      resource: '/v2/state/ledger-end',
    })

    // Expected result: the background request uses chrome.storage.local, not the default endpoint.
    assert.equal(seen.url, 'http://wallet.example/rpc')
    assert.match(seen.body ?? '', /"method":"ledgerApi"/)
  })
})
