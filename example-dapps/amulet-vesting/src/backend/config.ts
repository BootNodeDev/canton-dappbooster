// Read back off the ledger, not carried in a file: every bootstrap run mints a fresh pair.

import type { LedgerApiParams } from '@bootnodedev/canton-connect'

export type Deployment = {
  factoryBlob: string
  factoryCid: string
  pkg: string
  synchronizerId?: string
}

export type LedgerApi = (params: LedgerApiParams) => Promise<unknown>

// A filter takes the package-name reference, never the id it resolves to.
const FACTORY = '#amulet-vesting:AmuletVesting:AmuletVestingFactory'
const OPERATOR_HINT = 'vesting-operator-'

const advice = (reason: string): Error => new Error(`${reason} — run pnpm run bootstrap`)

export const call = async <T>(ledgerApi: LedgerApi, params: LedgerApiParams): Promise<T> =>
  (await ledgerApi(params)) as T

type ActiveContract = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: { contractId?: string; createdEventBlob?: string; templateId?: string }
      synchronizerId?: string
    }
  }
}

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

export const loadBackendConfig = async (ledgerApi: LedgerApi): Promise<Deployment> => {
  const operator = await newestOperator(ledgerApi)
  const { offset } = await call<{ offset?: string | number }>(ledgerApi, {
    requestMethod: 'get',
    resource: '/v2/state/ledger-end',
  })
  if (offset === undefined) {
    throw new Error('the ledger did not return an offset')
  }
  const rows = await call<ActiveContract[]>(ledgerApi, {
    requestMethod: 'post',
    resource: '/v2/state/active-contracts',
    body: {
      filter: {
        filtersByParty: {
          [operator]: {
            cumulative: [
              {
                identifierFilter: {
                  TemplateFilter: { value: { templateId: FACTORY, includeCreatedEventBlob: true } },
                },
              },
            ],
          },
        },
      },
      activeAtOffset: offset,
      verbose: true,
    },
  })
  // Without the blob a funder cannot disclose the factory, so such a row is no use.
  const factory = (Array.isArray(rows) ? rows : [])
    .map((row) => row.contractEntry?.JsActiveContract)
    .find((entry) => entry?.createdEvent?.createdEventBlob !== undefined)
  const created = factory?.createdEvent
  if (created?.contractId === undefined || created.createdEventBlob === undefined) {
    throw advice(`no factory disclosable by ${operator}`)
  }
  const pkg = created.templateId?.split(':')[0]
  if (pkg === undefined || pkg === '') {
    throw advice('the factory came back with no package id')
  }
  return {
    factoryBlob: created.createdEventBlob,
    factoryCid: created.contractId,
    pkg,
    ...(factory?.synchronizerId === undefined ? {} : { synchronizerId: factory.synchronizerId }),
  }
}
