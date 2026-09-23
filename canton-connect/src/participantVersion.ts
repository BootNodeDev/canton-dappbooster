import type { LedgerApiParams } from '@canton-network/dapp-sdk'

export const VERSION_REQUEST: LedgerApiParams = { requestMethod: 'get', resource: '/v2/version' }

// Canton 3.5 added /v2/state/active-contracts-page; a 3.4 participant answers it with a bare 404.
const PAGED_READ_FLOOR = { major: 3, minor: 5 } as const

const versionOf = (answer: unknown): string | undefined => {
  const version = (answer as { version?: unknown } | null)?.version
  return typeof version === 'string' ? version : undefined
}

const predatesPagedRead = (version: string): boolean => {
  const match = /^(\d+)\.(\d+)/.exec(version)
  if (match === null) {
    return false
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  return (
    major < PAGED_READ_FLOOR.major ||
    (major === PAGED_READ_FLOOR.major && minor < PAGED_READ_FLOOR.minor)
  )
}

export const explainPagedReadFailure = (failure: Error, versionAnswer: unknown): Error => {
  const version = versionOf(versionAnswer)
  if (version === undefined || !predatesPagedRead(version)) {
    return failure
  }
  return new Error(
    `active contracts need Canton ${PAGED_READ_FLOOR.major}.${PAGED_READ_FLOOR.minor} or later and this participant runs ${version} - read /v2/state/active-contracts through ledgerApi instead`,
    { cause: failure },
  )
}
