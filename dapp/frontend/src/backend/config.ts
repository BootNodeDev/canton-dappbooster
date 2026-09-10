// The deployment the bootstrap left on the ledger, read back through the wallet rather than carried
// in a file: a stale copy of the operator or the factory shows as an empty dashboard with no error.

import type { LedgerApiParams } from '@bootnodedev/canton-connect'
import { fetchInstrument } from '@/backend/registry'

export type Deployment = {
  admin: string
  factoryBlob: string
  factoryCid: string
  instrumentId: string
  pkg: string
  synchronizerId?: string
}

export type LedgerApi = (params: LedgerApiParams) => Promise<unknown>

// A filter takes the package-name reference, never the id it resolves to.
const FACTORY = '#vesting:Vesting:VestingFactory'
// Canton mints `<hint>::<fingerprint>`, so the separator belongs to the prefix: without it a
// `vesting-operator-<stamp>::ns` party from a bootstrap predating the stable hint matches too, and
// the app runs on that run's factory while bootstrap configures the registry for this one.
const OPERATOR_HINT = 'vesting-operator::'

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

// The bootstrap grants this user `CanActAs` on each operator it creates, so its rights are the
// operator list, where reading the ledger's parties would also return everyone else's. Sorted only
// so that a shared participant, where the hint can resolve under two namespaces, picks one of them
// on every load rather than whichever came first.
const operatorParty = async (ledgerApi: LedgerApi): Promise<string> => {
  const { user } = await call<{ user?: { id?: string } }>(ledgerApi, {
    requestMethod: 'get',
    resource: '/v2/authenticated-user',
  })
  if (user?.id === undefined) {
    throw new Error('the wallet did not report an authenticated user')
  }
  const { rights } = await call<{
    rights?: { kind?: { CanActAs?: { value?: { party?: string } } } }[]
  }>(ledgerApi, { requestMethod: 'get', resource: `/v2/users/${user.id}/rights` })
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
  const [operator, instrument] = await Promise.all([operatorParty(ledgerApi), fetchInstrument()])
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
  // The blob is the disclosure payload a funder cannot read the factory without, so a row lacking
  // one is no use even though the contract exists.
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
    admin: instrument.admin,
    factoryBlob: created.createdEventBlob,
    factoryCid: created.contractId,
    instrumentId: instrument.instrumentId,
    pkg,
    ...(factory?.synchronizerId === undefined ? {} : { synchronizerId: factory.synchronizerId }),
  }
}
