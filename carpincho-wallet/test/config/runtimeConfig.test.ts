import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { loadRuntimeConfig, saveRuntimeConfig } from '@/config/runtimeConfig'

const originalChrome = (globalThis as { chrome?: unknown }).chrome

// Runtime config tests cover the popup-to-background storage boundary.
describe('runtime config storage', () => {
  afterEach(() => {
    // Cleanup: each scenario owns localStorage and a chrome storage shim.
    localStorage.clear()
    Object.defineProperty(globalThis, 'chrome', { configurable: true, value: originalChrome })
  })

  it('persists saved RPC config to chrome local storage for background requests', () => {
    // Scenario: the popup saves a custom wallet-service endpoint that the MV3 worker must read.
    const writes: Array<Record<string, unknown>> = []
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            set: (items: Record<string, unknown>) => {
              writes.push(items)
            },
          },
        },
      },
    })

    // Action: save the same runtime config from the Settings screen path.
    saveRuntimeConfig({ walletServiceRpcUrl: 'http://wallet.example/rpc' })

    // Expected result: chrome.storage.local receives the sanitized config under its stable key.
    assert.deepEqual(writes, [
      {
        'carpincho.runtime-config.v2': {
          walletServiceRpcUrl: 'http://wallet.example/rpc',
        },
      },
    ])
  })

  it('mirrors existing localStorage config into chrome local storage when loaded', () => {
    // Scenario: users may already have a custom endpoint in popup localStorage from older builds.
    localStorage.setItem(
      'carpincho.runtime-config.v2',
      JSON.stringify({ walletServiceRpcUrl: 'http://existing.example/rpc' }),
    )
    const writes: Array<Record<string, unknown>> = []
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            set: (items: Record<string, unknown>) => {
              writes.push(items)
            },
          },
        },
      },
    })

    // Action: load the runtime config through the same hook initializer used by the popup UI.
    const loaded = loadRuntimeConfig()

    // Expected result: the popup value is mirrored for future service-worker requests.
    assert.equal(loaded.walletServiceRpcUrl, 'http://existing.example/rpc')
    assert.deepEqual(writes, [
      {
        'carpincho.runtime-config.v2': {
          walletServiceRpcUrl: 'http://existing.example/rpc',
        },
      },
    ])
  })
})
