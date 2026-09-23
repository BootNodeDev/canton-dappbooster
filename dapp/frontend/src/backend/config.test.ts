import type {
  ActiveContract,
  ActiveContractsParams,
  ActiveContractsResult,
  UserRight,
} from '@bootnodedev/canton-connect'
import { describe, expect, it } from 'vitest'
import { type ActiveContracts, loadBackendConfig, type UserRights } from '@/backend/config'

const OPERATOR = 'vesting-operator-1700000000001::ns'
const OLDER = 'vesting-operator-1600000000000::ns'

const factoryContract = (overrides: Partial<ActiveContract> = {}): ActiveContract => ({
  contractId: '00cid',
  templateId: 'abc123:AmuletVesting:AmuletVestingFactory',
  payload: {},
  createdEventBlob: 'YmxvYg==',
  synchronizerId: 'sync::1',
  ...overrides,
})

// `params` records the last activeContracts call.
const ledger = (
  overrides: { rights?: UserRight[]; contracts?: ActiveContract[] } = {},
): { userRights: UserRights; activeContracts: ActiveContracts; lastCall: () => unknown } => {
  let lastCall: unknown
  const userRights: UserRights = async () =>
    overrides.rights ?? [
      { kind: 'CanActAs', party: OLDER },
      { kind: 'CanReadAs', party: 'vesting-operator-1800000000000::ns' },
      { kind: 'CanActAs', party: OPERATOR },
      { kind: 'ParticipantAdmin' },
    ]
  const activeContracts: ActiveContracts = async <Payload>(
    params: ActiveContractsParams,
  ): Promise<ActiveContractsResult<Payload>> => {
    lastCall = params
    return {
      contracts: (overrides.contracts ?? [factoryContract()]) as ActiveContract<Payload>[],
      offset: 100,
    }
  }
  return { userRights, activeContracts, lastCall: () => lastCall }
}

describe('loadBackendConfig', () => {
  it('returns the deployment it reads back, synchronizer id included', async () => {
    const { userRights, activeContracts } = ledger()
    await expect(loadBackendConfig(userRights, activeContracts)).resolves.toEqual({
      factoryBlob: 'YmxvYg==',
      factoryCid: '00cid',
      pkg: 'abc123',
      synchronizerId: 'sync::1',
    })
  })

  it('omits the synchronizer id when the contract carries none', async () => {
    const { userRights, activeContracts } = ledger({
      contracts: [factoryContract({ synchronizerId: undefined })],
    })
    await expect(loadBackendConfig(userRights, activeContracts)).resolves.not.toHaveProperty(
      'synchronizerId',
    )
  })

  // Every run leaves its operator behind, so the newest is the one whose factory the config means.
  it('reads as the newest operator it can act as', async () => {
    const { userRights, activeContracts, lastCall } = ledger()
    await loadBackendConfig(userRights, activeContracts)
    expect(lastCall()).toEqual({
      templateId: '#amulet-vesting:AmuletVesting:AmuletVestingFactory',
      party: OPERATOR,
      includeCreatedEventBlob: true,
    })
  })

  it('names the bootstrap script when no operator was ever created', async () => {
    const { userRights, activeContracts } = ledger({
      rights: [{ kind: 'ParticipantAdmin' }],
    })
    await expect(loadBackendConfig(userRights, activeContracts)).rejects.toThrow(
      /no vesting operator.*pnpm run bootstrap/,
    )
  })

  // A factory with no blob cannot be disclosed, so it is as good as absent.
  it('rejects a factory contract that came back without its disclosure blob', async () => {
    const { userRights, activeContracts } = ledger({
      contracts: [factoryContract({ createdEventBlob: undefined })],
    })
    await expect(loadBackendConfig(userRights, activeContracts)).rejects.toThrow(
      /no factory disclosable/,
    )
  })

  it('rejects an empty active-contracts read', async () => {
    const { userRights, activeContracts } = ledger({ contracts: [] })
    await expect(loadBackendConfig(userRights, activeContracts)).rejects.toThrow(
      /no factory disclosable/,
    )
  })
})
