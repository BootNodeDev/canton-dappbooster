import type { InstrumentId } from '#src/providers/TokenListProvider/context'
import { asRecord } from '#src/utils/json'

const METADATA = 'registry/metadata/v1'

// A registry's address comes from whatever list the app trusts, so how many pages it may spend the
// caller on is this reader's to decide rather than the registry's.
const MAX_PAGES = 100

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
 * Reads a registry's instrument metadata, following its pages up to a limit of 100, so the answer
 * is the registry's whole catalogue and a registry that will not stop paging cannot hang the caller.
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
  const followed = new Set<string>()
  let pageToken: string | undefined

  while (followed.size <= MAX_PAGES) {
    const query = pageToken === undefined ? '' : `?pageToken=${encodeURIComponent(pageToken)}`
    const page = toPage(await get(`${base}/instruments${query}`))
    for (const value of page.instruments) {
      const instrument = toInstrument(admin, value)
      if (instrument !== undefined) found.push(instrument)
    }
    // A token already followed can only serve the page it served before.
    if (page.nextPageToken === undefined || followed.has(page.nextPageToken)) break
    followed.add(page.nextPageToken)
    pageToken = page.nextPageToken
  }

  return found
}
