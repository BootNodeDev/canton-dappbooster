import { describe, expect, it, vi } from 'vitest'
import { readAssetList } from '@/utils/assetList'

const URL = 'https://example.test/assets.json'

const amulet = {
  instrumentId: { admin: 'DSO::1220ab', id: 'Amulet' },
  symbol: 'CC',
  registryURLs: ['https://scan.example/registry/'],
  assetLogo: 'https://example.test/cc.svg',
}

const serving = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('readAssetList', () => {
  it('reads the entries of the network it was asked for', async () => {
    vi.stubGlobal('fetch', serving({ DevNet: [amulet], MainNet: [] }))

    expect(await readAssetList(URL, 'DevNet')).toEqual([
      {
        instrumentId: { admin: 'DSO::1220ab', id: 'Amulet' },
        logoUrl: 'https://example.test/cc.svg',
        registryUrls: ['https://scan.example/registry/'],
        symbol: 'CC',
      },
    ])
  })

  it('reports nothing for a network the file does not carry', async () => {
    vi.stubGlobal('fetch', serving({ MainNet: [amulet] }))
    expect(await readAssetList(URL, 'DevNet')).toEqual([])
  })

  it('leaves an entry with no artwork rather than dropping it', async () => {
    const { assetLogo, ...bare } = amulet
    vi.stubGlobal('fetch', serving({ DevNet: [bare] }))

    const [entry] = await readAssetList(URL, 'DevNet')
    expect(entry.logoUrl).toBeUndefined()
    expect(entry.symbol).toBe('CC')
  })

  it('drops an entry that names no instrument', async () => {
    vi.stubGlobal('fetch', serving({ DevNet: [{ symbol: 'CC' }, amulet] }))

    const found = await readAssetList(URL, 'DevNet')
    expect(found.map(({ symbol }) => symbol)).toEqual(['CC'])
    expect(found).toHaveLength(1)
  })

  it('throws where the list will not load', async () => {
    vi.stubGlobal('fetch', serving({}, 404))
    await expect(readAssetList(URL, 'DevNet')).rejects.toThrow(/404/)
  })
})
