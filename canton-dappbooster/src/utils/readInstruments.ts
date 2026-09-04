import type { InstrumentId } from '#src/providers/TokenListProvider/context'

const METADATA = 'registry/metadata/v1'

/**
 * What a registry says about one instrument it administers. No logo: the metadata API serves none,
 * so artwork comes from the app or from a curated list.
 *
 * @example
 * const [{ name, symbol }] = await readInstruments(registryUrl)
 *
 * @category Utilities
 */
export interface Instrument {
  decimals: number
  instrumentId: InstrumentId
  name: string
  symbol: string
}

interface Page {
  instruments: readonly unknown[]
  nextPageToken: string | undefined
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

const get = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`)
  }
  return await response.json()
}

const toInstrument = (admin: string, value: unknown): Instrument | undefined => {
  const fields = asRecord(value)
  const { decimals, id, name, symbol } = fields ?? {}
  if (typeof id !== 'string' || typeof name !== 'string' || typeof symbol !== 'string') {
    return undefined
  }
  return {
    decimals: typeof decimals === 'number' ? decimals : 10,
    instrumentId: { admin, id },
    name,
    symbol,
  }
}

const toPage = (value: unknown): Page => {
  const { instruments, nextPageToken } = asRecord(value) ?? {}
  return {
    instruments: Array.isArray(instruments) ? instruments : [],
    nextPageToken:
      typeof nextPageToken === 'string' && nextPageToken !== '' ? nextPageToken : undefined,
  }
}

/**
 * Reads a registry's instrument metadata. Follows every page, so the answer is the registry's
 * whole catalogue.
 *
 * @throws where either request answers anything but 200, or the reply is not JSON.
 *
 * @example
 * const instruments = await readInstruments('https://registry.example/api')
 *
 * @category Utilities
 */
export const readInstruments = async (registryUrl: string): Promise<readonly Instrument[]> => {
  const base = `${registryUrl.replace(/\/$/, '')}/${METADATA}`
  const admin = asRecord(await get(`${base}/info`))?.adminId
  if (typeof admin !== 'string') {
    throw new Error(`${base}/info returned no adminId`)
  }

  const found: Instrument[] = []
  let pageToken: string | undefined
  do {
    const query = pageToken === undefined ? '' : `?pageToken=${encodeURIComponent(pageToken)}`
    const page = toPage(await get(`${base}/instruments${query}`))
    for (const value of page.instruments) {
      const instrument = toInstrument(admin, value)
      if (instrument !== undefined) found.push(instrument)
    }
    pageToken = page.nextPageToken
  } while (pageToken !== undefined)

  return found
}
