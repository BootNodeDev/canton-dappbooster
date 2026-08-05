import { useCallback } from 'react'

/** What an identifier points at. `update` is the ledger transaction, which scans label as one. */
export type ExplorerEntity = 'party' | 'contract' | 'update'

/**
 * Canton has no chain registry and no canonical explorer: scans are per-environment and per-SV,
 * so the app resolves this once from its own config and hands it over.
 */
export interface ExplorerConfig {
  baseUrl: string
  /** Templates appended to `baseUrl`, so each must lead with `/`. `null` disables that entity. */
  paths?: Partial<Record<ExplorerEntity, string | null>>
}

/** Arguments for {@link getExplorerLink}. */
export interface GetExplorerLinkParams {
  explorer: ExplorerConfig
  value: string
  entity?: ExplorerEntity
}

const DEFAULT_PATHS: Record<ExplorerEntity, string> = {
  party: '/party/{id}',
  contract: '/contract/{id}',
  update: '/update/{id}',
}

const PARTY_SEPARATOR = '::'
const HASH = /^[0-9a-f]{64}$/i
// 64+ after the `00` discriminator: a suffixless contract id is exactly 64, and HASH already took
// the 64-character total, so the two cannot collide.
const CONTRACT_ID = /^00[0-9a-f]{64,}$/i

// A party id carries a separator.
// A contract id a discriminator.
// A bare 64-character hash is read as an update (shape it shares with package and event ids).
const detectEntity = (value: string): ExplorerEntity | undefined => {
  if (value.includes(PARTY_SEPARATOR)) return 'party'
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
 * ```ts
 * const explorer = { baseUrl: 'https://scan.example' }
 *
 * getExplorerLink({ explorer, value: 'nico::1220df94a1' })
 * // 'https://scan.example/party/nico%3A%3A1220df94a1'
 *
 * getExplorerLink({ explorer, value: '1220df94a1', entity: 'update' })
 * // 'https://scan.example/update/1220df94a1'
 *
 * getExplorerLink({ explorer, value: 'nico' })
 * // undefined — no shape matched, and no entity said otherwise
 * ```
 *
 * @throws when `explorer.baseUrl` is empty or blank — a misconfigured app, not a missing link.
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

  // `??` would swallow the `null` that disables an entity, so absent and disabled split here.
  const override = explorer.paths?.[resolved]
  const path = override === undefined ? DEFAULT_PATHS[resolved] : override
  if (!path) return undefined

  return `${baseUrl}${path.replaceAll('{id}', encodeURIComponent(value))}`
}

/**
 * Holds an explorer config so call sites pass only an identifier, and returns
 * {@link getExplorerLink} bound to it.
 *
 * An empty `baseUrl` throws on render.
 *
 * ```tsx
 * const explorerLink = useExplorerLink({ baseUrl: 'https://scan.example' })
 *
 * <Identifier value="nico::1220df94a1" href={explorerLink('nico::1220df94a1')} />
 * // href="https://scan.example/party/nico%3A%3A1220df94a1"
 *
 * <Identifier value={cid} href={explorerLink(cid, 'contract')} />
 * // href="https://scan.example/contract/00a3…", or no link at all where the builder returns
 * // undefined, since `href` is optional
 * ```
 */
export const useExplorerLink = (
  explorer: ExplorerConfig,
): ((value: string, entity?: ExplorerEntity) => string | undefined) => {
  const baseUrl = requireBaseUrl(explorer.baseUrl)
  // Destructured so an inline config object, new on every render, does not churn the callback.
  const { party, contract, update } = explorer.paths ?? {}

  return useCallback(
    (value: string, entity?: ExplorerEntity) => {
      // Typed against the full entity union, so a new entity fails to compile until it is destructured
      // above and added to the dependency list rather than being silently dropped.
      const paths: Record<ExplorerEntity, string | null | undefined> = { party, contract, update }
      return getExplorerLink({ explorer: { baseUrl, paths }, value, entity })
    },
    [baseUrl, party, contract, update],
  )
}
