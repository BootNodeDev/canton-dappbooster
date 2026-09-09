import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAppNetwork, fetchInstrument, fetchInstrumentConfig } from '@/backend/registry'

const ADMIN = 'instrument-admin-1700000000000::ns'
const INSTRUMENT = { admin: ADMIN, instrumentId: 'DBT' }

const CONFIG = {
  templateId: '20d54824:Canton.TokenForge.Registry:InstrumentConfig',
  contractId: '00cfg',
  createdEventBlob: 'YmxvYg==',
  synchronizerId: 'global-domain::1220',
}

// Keyed by the path each route answers, so a case names only the response it is about. `calls`
// records the request bodies, which is how the transfer-factory case reads back what was sent.
const stubRegistry = (
  routes: Record<string, { body?: unknown; status?: number }>,
): { calls: { path: string; body: unknown }[] } => {
  const calls: { path: string; body: unknown }[] = []
  vi.stubGlobal('fetch', async (url: string, init?: { body?: string }) => {
    const path = new URL(url, 'http://localhost:3013').pathname
    calls.push({ path, body: init?.body === undefined ? undefined : JSON.parse(init.body) })
    const route = routes[path]
    if (route === undefined) {
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }
    const status = route.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => route.body }
  })
  return { calls }
}

const metadata = {
  '/registry/metadata/v1/info': { body: { adminId: ADMIN, supportedApis: {} } },
  '/registry/metadata/v1/instruments': {
    body: { instruments: [{ id: 'DBT', name: 'dAppBooster Token', symbol: 'DBT', decimals: 10 }] },
  },
}

const factory = {
  '/registry/transfer-instruction/v1/transfer-factory': {
    body: {
      factoryId: '00cfg',
      transferKind: 'self',
      choiceContext: { choiceContextData: { values: {} }, disclosedContracts: [CONFIG] },
    },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchInstrument', () => {
  it('pairs the admin from /info with the one instrument from /instruments', async () => {
    stubRegistry(metadata)

    await expect(fetchInstrument()).resolves.toEqual(INSTRUMENT)
  })

  it('names the bootstrap script when the registry administers no instrument', async () => {
    stubRegistry({
      ...metadata,
      '/registry/metadata/v1/instruments': { body: { instruments: [] } },
    })

    await expect(fetchInstrument()).rejects.toThrow(/no instrument.*pnpm run bootstrap/s)
  })

  // Two live configs for one admin is what bootstrap's own findInstrumentConfig refuses, and the
  // dApp knows exactly one instrument, so picking one silently would render grants under a symbol
  // that is not theirs.
  it('refuses to guess when the registry lists more than one instrument', async () => {
    stubRegistry({
      ...metadata,
      '/registry/metadata/v1/instruments': {
        body: { instruments: [{ id: 'DBT' }, { id: 'OTHER' }] },
      },
    })

    await expect(fetchInstrument()).rejects.toThrow(/more than one instrument/)
  })

  it('reports the route that failed rather than a bare status', async () => {
    stubRegistry({ ...metadata, '/registry/metadata/v1/info': { status: 503, body: {} } })

    await expect(fetchInstrument()).rejects.toThrow(
      /registry answered 503 for \/registry\/metadata\/v1\/info/,
    )
  })

  it('names the registry and the url when the fetch itself never answers', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(fetchInstrument()).rejects.toThrow(
      /registry is unreachable at http:\/\/localhost:3013\/registry\/metadata\/v1\/info/,
    )
  })

  it('refuses an /info body with no admin party', async () => {
    stubRegistry({ ...metadata, '/registry/metadata/v1/info': { body: { supportedApis: {} } } })

    await expect(fetchInstrument()).rejects.toThrow(/no admin party/)
  })

  it('names the bootstrap script when the one instrument came back with no id', async () => {
    stubRegistry({
      ...metadata,
      '/registry/metadata/v1/instruments': { body: { instruments: [{}] } },
    })

    await expect(fetchInstrument()).rejects.toThrow(/no id.*pnpm run bootstrap/s)
  })
})

describe('fetchInstrumentConfig', () => {
  it('asks the self branch, naming the connected party as both ends', async () => {
    const { calls } = stubRegistry(factory)

    await fetchInstrumentConfig('funder::1', INSTRUMENT)

    expect(calls[0]?.body).toEqual({
      choiceArguments: {
        transfer: {
          instrumentId: { admin: ADMIN, id: 'DBT' },
          receiver: 'funder::1',
          sender: 'funder::1',
        },
      },
    })
  })

  // The synchronizer comes back beside the disclosure and not on it: `submit` stamps its own, and
  // the loose one is what `fetchAppNetwork` compares the wallet against.
  it('returns the config reference, its stripped disclosure and the synchronizer id', async () => {
    stubRegistry(factory)

    await expect(fetchInstrumentConfig('funder::1', INSTRUMENT)).resolves.toEqual({
      configCid: '00cfg',
      configTemplateId: CONFIG.templateId,
      disclosed: [
        {
          templateId: CONFIG.templateId,
          contractId: '00cfg',
          createdEventBlob: 'YmxvYg==',
        },
      ],
      synchronizerId: 'global-domain::1220',
    })
  })

  it('refuses a 200 that disclosed no config', async () => {
    stubRegistry({
      '/registry/transfer-instruction/v1/transfer-factory': {
        body: { factoryId: '00cfg', choiceContext: { disclosedContracts: [] } },
      },
    })

    await expect(fetchInstrumentConfig('funder::1', INSTRUMENT)).rejects.toThrow(
      /disclosed no InstrumentConfig/,
    )
  })

  it('refuses a disclosure whose templateId names something other than InstrumentConfig', async () => {
    stubRegistry({
      '/registry/transfer-instruction/v1/transfer-factory': {
        body: {
          factoryId: '00cfg',
          choiceContext: {
            disclosedContracts: [
              { ...CONFIG, templateId: '20d54824:Canton.TokenForge.Registry:Token' },
            ],
          },
        },
      },
    })

    await expect(fetchInstrumentConfig('funder::1', INSTRUMENT)).rejects.toThrow(
      /disclosed no InstrumentConfig/,
    )
  })

  it('refuses a factoryId the disclosure does not vouch for', async () => {
    stubRegistry({
      '/registry/transfer-instruction/v1/transfer-factory': {
        body: {
          factoryId: '00other',
          choiceContext: { disclosedContracts: [CONFIG] },
        },
      },
    })

    await expect(fetchInstrumentConfig('funder::1', INSTRUMENT)).rejects.toThrow(
      /disclosed no InstrumentConfig/,
    )
  })

  it('surfaces the registry’s own error message', async () => {
    stubRegistry({
      '/registry/transfer-instruction/v1/transfer-factory': {
        status: 409,
        body: { error: 'multiple active configs' },
      },
    })

    await expect(fetchInstrumentConfig('funder::1', INSTRUMENT)).rejects.toThrow(
      /multiple active configs/,
    )
  })

  it('reports a non-JSON body rather than a parse error', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token <')
      },
    }))

    await expect(fetchInstrumentConfig('funder::1', INSTRUMENT)).rejects.toThrow(
      /registry answered/,
    )
  })
})

describe('fetchAppNetwork', () => {
  it('reads the network off the config disclosure the registry serves', async () => {
    stubRegistry({ ...metadata, ...factory })

    await expect(fetchAppNetwork('funder::1')).resolves.toBe('global-domain::1220')
  })

  // A registry that answers without one leaves the check with nothing to compare, which reads as
  // no verdict rather than a mismatch.
  it('reports no network when the disclosure carries none', async () => {
    const { synchronizerId, ...bare } = CONFIG
    stubRegistry({
      ...metadata,
      '/registry/transfer-instruction/v1/transfer-factory': {
        body: {
          factoryId: '00cfg',
          transferKind: 'self',
          choiceContext: { choiceContextData: { values: {} }, disclosedContracts: [bare] },
        },
      },
    })

    await expect(fetchAppNetwork('funder::1')).resolves.toBeUndefined()
  })
})
