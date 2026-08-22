import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadBackendConfig } from '@/backend/config'

const respond = (init: { ok?: boolean; status?: number; body?: unknown; text?: string }): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => {
        if (init.text !== undefined) {
          throw new SyntaxError('Unexpected token < in JSON')
        }
        return init.body
      },
    })),
  )
}

const valid = {
  pkg: 'abc123',
  factoryCid: '00cid',
  factoryBlob: 'YmxvYg==',
  synchronizerId: 'sync::1',
}

describe('loadBackendConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the deployment, synchronizer id included', async () => {
    respond({ body: valid })
    await expect(loadBackendConfig()).resolves.toEqual(valid)
  })

  it('accepts a config with no synchronizer id, which is optional', async () => {
    const { synchronizerId, ...rest } = valid
    respond({ body: rest })
    await expect(loadBackendConfig()).resolves.toEqual(rest)
  })

  it('names the bootstrap script when the file is missing', async () => {
    respond({ ok: false, status: 404 })
    await expect(loadBackendConfig()).rejects.toThrow(
      /is missing \(HTTP 404\).*bootstrap-vesting-lite/,
    )
  })

  // A dev server answers a missing file with index.html, so a 200 proves nothing.
  it('rejects the SPA fallback rather than reading it as a deployment', async () => {
    respond({ text: '<!doctype html>' })
    await expect(loadBackendConfig()).rejects.toThrow(/is not a JSON object/)
  })

  it('rejects a JSON body that is not an object, null included', async () => {
    respond({ body: null })
    await expect(loadBackendConfig()).rejects.toThrow(/is not a JSON object/)
  })

  it('names every required key that is absent or blank', async () => {
    respond({ body: { pkg: 'abc123', factoryCid: '', factoryBlob: undefined } })
    await expect(loadBackendConfig()).rejects.toThrow(/has no factoryCid, factoryBlob/)
  })
})
