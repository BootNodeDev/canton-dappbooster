// Read back off the ledger, not carried in a file: every bootstrap run mints a fresh pair.

import type { LedgerApiParams, UseLedgerResult } from '@bootnodedev/canton-connect'

export type Deployment = {
  factoryBlob: string
  factoryCid: string
  pkg: string
  synchronizerId?: string
}

export type LedgerApi = (params: LedgerApiParams) => Promise<unknown>
export type ActiveContracts = UseLedgerResult['activeContracts']

// A filter takes the package-name reference, never the id it resolves to.
const FACTORY = '#amulet-vesting:AmuletVesting:AmuletVestingFactory'
const OPERATOR_HINT = 'vesting-operator-'

const advice = (reason: string): Error => new Error(`${reason} — run pnpm run bootstrap`)

export const call = async <T>(ledgerApi: LedgerApi, params: LedgerApiParams): Promise<T> =>
  (await ledgerApi(params)) as T

// The hint carries the run's timestamp, so the last one sorted is the newest.
const newestOperator = async (ledgerApi: LedgerApi): Promise<string> => {
  const { user } = await call<{ user?: { id?: string } }>(ledgerApi, {
    requestMethod: 'get',
    resource: '/v2/authenticated-user',
  })
  if (user?.id === undefined) {
    throw new Error('the wallet did not report an authenticated user')
  }
  const { rights } = await call<{
    rights?: { kind?: { CanActAs?: { value?: { party?: string } } } }[]
  }>(ledgerApi, {
    requestMethod: 'get',
    // A gateway allowlists the route, so the id travels in `path` rather than written in here.
    resource: '/v2/users/{user-id}/rights',
    path: { 'user-id': user.id },
  })
  const operator = (rights ?? [])
    .map((right) => right.kind?.CanActAs?.value?.party)
    .filter((party): party is string => party?.startsWith(OPERATOR_HINT) === true)
    .sort()
    .at(-1)
  if (operator === undefined) {
    throw advice('no vesting operator on this ledger')
  }
  return operator
}

export const loadBackendConfig = async (
  ledgerApi: LedgerApi,
  activeContracts: ActiveContracts,
): Promise<Deployment> => {
  const operator = await newestOperator(ledgerApi)
  const { contracts } = await activeContracts({
    templateId: FACTORY,
    party: operator,
    includeCreatedEventBlob: true,
  })
  // Without the blob a funder cannot disclose the factory, so such a contract is no use.
  const factory = contracts.find((contract) => contract.createdEventBlob !== undefined)
  if (factory?.createdEventBlob === undefined) {
    throw advice(`no factory disclosable by ${operator}`)
  }
  const pkg = factory.templateId.split(':')[0]
  if (pkg === undefined || pkg === '') {
    throw advice('the factory came back with no package id')
  }
  return {
    factoryBlob: factory.createdEventBlob,
    factoryCid: factory.contractId,
    pkg,
    ...(factory.synchronizerId === undefined ? {} : { synchronizerId: factory.synchronizerId }),
  }
}
