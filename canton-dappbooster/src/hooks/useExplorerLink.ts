import { useCallback } from 'react'
import { isValidPartyId } from '#src/utils/partyId'

/**
 * What an identifier points at. `update` is the ledger transaction, which scans label as one.
 *
 * @example
 * getExplorerLink({ explorer, value: contractId, entity: 'contract' })
 *
 * @category Utilities
 */
export type ExplorerEntity = 'party' | 'contract' | 'update'

/**
 * Canton has no chain registry and no canonical explorer: scans are per-environment and per-SV,
 * so the app resolves the base url once from its own config and hands it over.
 *
 * @example
 * const explorer: ExplorerConfig = { baseUrl: 'https://scan.example' }
 *
 * @category Utilities
 */
export interface ExplorerConfig {
  baseUrl: string
}

/**
 * Arguments for {@link getExplorerLink}.
 *
 * @example
 * getExplorerLink({ explorer, value: partyId })
 *
 * @category Utilities
 */
export interface GetExplorerLinkParams {
  explorer: ExplorerConfig
  value: string
  entity?: ExplorerEntity
}

// Splice Scan's routes. Deployments differ by host, not by path, so the host is the only knob.
const PATHS: Record<ExplorerEntity, string> = {
  party: '/party',
  contract: '/contract',
  update: '/update',
}

const HASH = /^[0-9a-f]{64}$/i
// 64+ after the `00` discriminator: a suffixless contract id is exactly 64, and HASH already took
// the 64-character total, so the two cannot collide.
const CONTRACT_ID = /^00[0-9a-f]{64,}$/i

// A party id must be well-formed, not merely separator-shaped, or a half-typed one would get a link
// to a page that cannot exist. A contract id carries a discriminator; a bare 64-character hash is
// read as an update, a shape it shares with package and event ids.
const detectEntity = (value: string): ExplorerEntity | undefined => {
  if (isValidPartyId(value)) return 'party'
  if (HASH.test(value)) return 'update'
  if (CONTRACT_ID.test(value)) return 'contract'
  return undefined
}

// An unset env var arrives as an empty string. That is a misconfigured app, not a missing link, so
// it fails here rather than downstream as a relative href.
const requireBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim()
  if (!trimmed) throw new Error('Explorer baseUrl is required')
  return trimmed.replace(/\/$/, '')
}

/**
 * Builds an explorer URL for a Canton identifier. Returns `undefined` whenever no link can be made.
 *
 * @throws when `explorer.baseUrl` is empty or blank, which is a misconfigured app rather than a
 * missing link.
 *
 * @example
 * getExplorerLink({ explorer, value: partyId })
 * // 'https://scan.example/party/…', the party shape having matched on its own
 * getExplorerLink({ explorer, value: '1220df94a1', entity: 'update' })
 * // 'https://scan.example/update/1220df94a1', the entity overriding a shape that matched nothing
 * getExplorerLink({ explorer, value: 'nico' })
 * // undefined: no shape matched, and no entity said otherwise
 *
 * @category Utilities
 */
export const getExplorerLink = ({
  explorer,
  value,
  entity,
}: GetExplorerLinkParams): string | undefined => {
  const baseUrl = requireBaseUrl(explorer.baseUrl)
  if (!value) return undefined

  const resolved = entity ?? detectEntity(value)
  if (resolved === undefined) return undefined

  return `${baseUrl}${PATHS[resolved]}/${encodeURIComponent(value)}`
}

/**
 * Holds an explorer config so call sites pass only an identifier, and returns
 * {@link getExplorerLink} bound to it.
 *
 * @throws on render when `explorer.baseUrl` is empty or blank, as {@link getExplorerLink} does.
 *
 * @example
 * const explorerLink = useExplorerLink({ baseUrl: 'https://scan.example' })
 * <Identifier value={partyId} href={explorerLink(partyId)} />
 * <Identifier value={cid} href={explorerLink(cid, 'contract')} />
 * // no href at all where the value matched no shape and no entity said otherwise
 *
 * @category Hooks
 */
export const useExplorerLink = (
  explorer: ExplorerConfig,
): ((value: string, entity?: ExplorerEntity) => string | undefined) => {
  // Read off the config rather than closed over, so an inline object does not churn the callback.
  const baseUrl = requireBaseUrl(explorer.baseUrl)

  return useCallback(
    (value: string, entity?: ExplorerEntity) =>
      getExplorerLink({ explorer: { baseUrl }, value, entity }),
    [baseUrl],
  )
}
