import { ledgerEnd, readAcs } from '#server/ledger/acs'
import type { LedgerApiParams } from '#server/ledger/wallet'

export type Deployment = {
  factoryBlob: string
  factoryCid: string
  pkg: string
  synchronizerId: string
}

export type LedgerApi = (params: LedgerApiParams) => Promise<unknown>

// A filter takes the package-name reference, never the id it resolves to.
const FACTORY = '#amulet-vesting:AmuletVesting:AmuletVestingFactory'
// The separator is part of the prefix, so a stamped `vesting-operator-<stamp>` never matches.
const OPERATOR_HINT = 'vesting-operator::'

const advice = (reason: string): Error => new Error(`${reason} — run pnpm run bootstrap`)

type ActiveContract = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: { contractId?: string; createdEventBlob?: string; templateId?: string }
      synchronizerId?: string
    }
  }
}

export const authenticatedUser = async (ledgerApi: LedgerApi): Promise<string> => {
  const { user } = (await ledgerApi({
    requestMethod: 'get',
    resource: '/v2/authenticated-user',
  })) as { user?: { id?: string } }
  if (user?.id === undefined) {
    throw new Error('the ledger did not report an authenticated user')
  }
  return user.id
}

const operatorParty = async (ledgerApi: LedgerApi): Promise<string> => {
  const { rights } = (await ledgerApi({
    requestMethod: 'get',
    // A gateway allowlists the route, so the id travels in `path` rather than written in here.
    resource: '/v2/users/{user-id}/rights',
    path: { 'user-id': await authenticatedUser(ledgerApi) },
  })) as { rights?: { kind?: { CanActAs?: { value?: { party?: string } } } }[] }
  const operator = (rights ?? [])
    .map((right) => right.kind?.CanActAs?.value?.party)
    .filter((party): party is string => party?.startsWith(OPERATOR_HINT) === true)
    // Sorted only so a hint resolving under two namespaces picks the same one on every load.
    .sort()
    .at(-1)
  if (operator === undefined) {
    throw advice('no vesting operator on this ledger')
  }
  return operator
}

export const loadBackendConfig = async (ledgerApi: LedgerApi): Promise<Deployment> => {
  const operator = await operatorParty(ledgerApi)
  const rows = await readAcs<ActiveContract>(
    ledgerApi,
    operator,
    FACTORY,
    await ledgerEnd(ledgerApi),
    true,
  )
  const factory = rows
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
  if (factory?.synchronizerId === undefined) {
    throw new Error('the factory came back with no synchronizer id')
  }
  return {
    factoryBlob: created.createdEventBlob,
    factoryCid: created.contractId,
    pkg,
    synchronizerId: factory.synchronizerId,
  }
}
