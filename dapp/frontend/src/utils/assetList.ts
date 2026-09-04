import type { InstrumentId } from '@bootnodedev/canton-dappbooster'

// A top-level key of the file. The published one carries `MainNet`, `TestNet` and `DevNet`; a
// stack it does not cover is served a file of its own, under whatever key that file uses.
export type AssetListNetwork = string

export interface AssetListEntry {
  instrumentId: InstrumentId
  logoUrl: string | undefined
  registryUrls: readonly string[]
  symbol: string
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const toEntry = (value: unknown): AssetListEntry | undefined => {
  const fields = asRecord(value)
  const instrument = asRecord(fields?.instrumentId)
  const admin = asString(instrument?.admin)
  const id = asString(instrument?.id)
  const symbol = asString(fields?.symbol)
  if (admin === undefined || id === undefined || symbol === undefined) {
    return undefined
  }
  const urls = fields?.registryURLs
  return {
    instrumentId: { admin, id },
    logoUrl: asString(fields?.assetLogo),
    registryUrls: Array.isArray(urls) ? urls.filter((url) => typeof url === 'string') : [],
    symbol,
  }
}

/**
 * Reads the curated asset list the Canton wallet repo publishes, for one network.
 */
export const readAssetList = async (
  url: string,
  network: AssetListNetwork,
): Promise<readonly AssetListEntry[]> => {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`)
  }
  const forNetwork = asRecord(await response.json())?.[network]
  if (!Array.isArray(forNetwork)) {
    return []
  }
  return forNetwork.flatMap((value) => toEntry(value) ?? [])
}
