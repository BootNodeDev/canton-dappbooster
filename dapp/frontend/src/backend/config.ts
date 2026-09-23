// Read back off the ledger, not carried in a file: every bootstrap run mints a fresh pair.

import type { UseLedgerResult } from '@bootnodedev/canton-connect'

export type Deployment = {
  factoryBlob: string
  factoryCid: string
  pkg: string
  synchronizerId?: string
}

export type ActiveContracts = UseLedgerResult['activeContracts']
export type UserRights = UseLedgerResult['userRights']

// A filter takes the package-name reference, never the id it resolves to.
const FACTORY = '#amulet-vesting:AmuletVesting:AmuletVestingFactory'
const OPERATOR_HINT = 'vesting-operator-'

const advice = (reason: string): Error => new Error(`${reason} — run pnpm run bootstrap`)

// The hint carries the run's timestamp, so the last one sorted is the newest.
const newestOperator = async (userRights: UserRights): Promise<string> => {
  const operator = (await userRights())
    .flatMap((right) => (right.kind === 'CanActAs' ? [right.party] : []))
    .filter((party) => party.startsWith(OPERATOR_HINT))
    .sort()
    .at(-1)
  if (operator === undefined) {
    throw advice('no vesting operator on this ledger')
  }
  return operator
}

export const loadBackendConfig = async (
  userRights: UserRights,
  activeContracts: ActiveContracts,
): Promise<Deployment> => {
  const operator = await newestOperator(userRights)
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
