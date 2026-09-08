import { describe, expect, it, vi } from 'vitest'
import { readInstruments } from '#src/utils/readInstruments'

const REGISTRY = 'https://registry.example/api'
const ADMIN = 'DSO::1220ab'

const amulet = { decimals: 10, id: 'Amulet', name: 'Amulet', symbol: 'AMT' }

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

// Answers each path once, in the order the reader asks for them.
const serving = (pages: Record<string, unknown>) =>
  vi.fn(async (url: string | URL) => {
    const path = String(url).slice(REGISTRY.length)
    const body = pages[path]
    return body === undefined ? new Response('nope', { status: 404 }) : ok(body)
  })

describe('readInstruments', () => {
  it('reads the catalogue and stamps the registry admin on every id', async () => {
    vi.stubGlobal(
      'fetch',
      serving({
        '/registry/metadata/v1/info': { adminId: ADMIN, supportedApis: {} },
        '/registry/metadata/v1/instruments': { instruments: [amulet] },
      }),
    )

    expect(await readInstruments(REGISTRY)).toEqual([
      { decimals: 10, instrumentId: { admin: ADMIN, id: 'Amulet' }, name: 'Amulet', symbol: 'AMT' },
    ])
  })

  it('follows every page, so a catalogue past the first is not silently cut', async () => {
    const second = { ...amulet, id: 'Other', name: 'Other Coin', symbol: 'OTH' }
    vi.stubGlobal(
      'fetch',
      serving({
        '/registry/metadata/v1/info': { adminId: ADMIN, supportedApis: {} },
        '/registry/metadata/v1/instruments': { instruments: [amulet], nextPageToken: 'more' },
        '/registry/metadata/v1/instruments?pageToken=more': { instruments: [second] },
      }),
    )

    const found = await readInstruments(REGISTRY)
    expect(found.map(({ symbol }) => symbol)).toEqual(['AMT', 'OTH'])
  })

  it('stops on a page token it has already followed', async () => {
    const loop = { instruments: [amulet], nextPageToken: 'loop' }
    const fetching = serving({
      '/registry/metadata/v1/info': { adminId: ADMIN, supportedApis: {} },
      '/registry/metadata/v1/instruments': loop,
      '/registry/metadata/v1/instruments?pageToken=loop': loop,
    })
    vi.stubGlobal('fetch', fetching)

    expect(await readInstruments(REGISTRY)).toHaveLength(2)
    expect(fetching).toHaveBeenCalledTimes(3)
  })

  it('gives up on a registry that keeps handing out fresh page tokens', async () => {
    let page = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        page += 1
        return String(url).endsWith('/info')
          ? ok({ adminId: ADMIN, supportedApis: {} })
          : ok({ instruments: [amulet], nextPageToken: `page-${page}` })
      }),
    )

    expect(await readInstruments(REGISTRY)).toHaveLength(101)
  })

  it('takes a trailing slash on the registry url', async () => {
    vi.stubGlobal(
      'fetch',
      serving({
        '/registry/metadata/v1/info': { adminId: ADMIN, supportedApis: {} },
        '/registry/metadata/v1/instruments': { instruments: [] },
      }),
    )

    expect(await readInstruments(`${REGISTRY}/`)).toEqual([])
  })

  it('drops an entry missing what a row is rendered from', async () => {
    vi.stubGlobal(
      'fetch',
      serving({
        '/registry/metadata/v1/info': { adminId: ADMIN, supportedApis: {} },
        '/registry/metadata/v1/instruments': { instruments: [{ id: 'Bare' }, amulet] },
      }),
    )

    const found = await readInstruments(REGISTRY)
    expect(found.map(({ instrumentId }) => instrumentId.id)).toEqual(['Amulet'])
  })

  it('throws on a registry that refuses the read', async () => {
    vi.stubGlobal('fetch', serving({}))
    await expect(readInstruments(REGISTRY)).rejects.toThrow(/404/)
  })

  it('throws where the registry names no admin party', async () => {
    vi.stubGlobal('fetch', serving({ '/registry/metadata/v1/info': { supportedApis: {} } }))
    await expect(readInstruments(REGISTRY)).rejects.toThrow(/adminId/)
  })
})
