import type {
  ActiveContract,
  ActiveContractsParams,
  ActiveContractsResult,
} from '@bootnodedev/canton-connect'
import { describe, expect, it } from 'vitest'
import { type ActiveContracts, type LedgerApi, loadBackendConfig } from '@/backend/config'

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
  overrides: { rights?: unknown[]; contracts?: ActiveContract[]; user?: unknown } = {},
): { ledgerApi: LedgerApi; activeContracts: ActiveContracts; lastCall: () => unknown } => {
  let lastCall: unknown
  const ledgerApi: LedgerApi = async (params) => {
    const resource = params.resource as string
    if (resource === '/v2/authenticated-user') {
      return overrides.user ?? { user: { id: 'user-1' } }
    }
    return {
      rights: overrides.rights ?? [
        { kind: { CanActAs: { value: { party: OLDER } } } },
        { kind: { CanActAs: { value: { party: OPERATOR } } } },
        { kind: { ParticipantAdmin: { value: {} } } },
      ],
    }
  }
  const activeContracts: ActiveContracts = async <Payload>(
    params: ActiveContractsParams,
  ): Promise<ActiveContractsResult<Payload>> => {
    lastCall = params
    return {
      contracts: (overrides.contracts ?? [factoryContract()]) as ActiveContract<Payload>[],
      offset: 100,
    }
  }
  return { ledgerApi, activeContracts, lastCall: () => lastCall }
}

describe('loadBackendConfig', () => {
  it('returns the deployment it reads back, synchronizer id included', async () => {
    const { ledgerApi, activeContracts } = ledger()
    await expect(loadBackendConfig(ledgerApi, activeContracts)).resolves.toEqual({
      factoryBlob: 'YmxvYg==',
      factoryCid: '00cid',
      pkg: 'abc123',
      synchronizerId: 'sync::1',
    })
  })

  it('omits the synchronizer id when the contract carries none', async () => {
    const { ledgerApi, activeContracts } = ledger({
      contracts: [factoryContract({ synchronizerId: undefined })],
    })
    await expect(loadBackendConfig(ledgerApi, activeContracts)).resolves.not.toHaveProperty(
      'synchronizerId',
    )
  })

  // Every run leaves its operator behind, so the newest is the one whose factory the config means.
  it('reads as the newest operator among the rights', async () => {
    const { ledgerApi, activeContracts, lastCall } = ledger()
    await loadBackendConfig(ledgerApi, activeContracts)
    expect(lastCall()).toEqual({
      templateId: '#amulet-vesting:AmuletVesting:AmuletVestingFactory',
      party: OPERATOR,
      includeCreatedEventBlob: true,
    })
  })

  it('names the bootstrap script when no operator was ever created', async () => {
    const { ledgerApi, activeContracts } = ledger({
      rights: [{ kind: { ParticipantAdmin: { value: {} } } }],
    })
    await expect(loadBackendConfig(ledgerApi, activeContracts)).rejects.toThrow(
      /no vesting operator.*pnpm run bootstrap/,
    )
  })

  // A factory with no blob cannot be disclosed, so it is as good as absent.
  it('rejects a factory contract that came back without its disclosure blob', async () => {
    const { ledgerApi, activeContracts } = ledger({
      contracts: [factoryContract({ createdEventBlob: undefined })],
    })
    await expect(loadBackendConfig(ledgerApi, activeContracts)).rejects.toThrow(
      /no factory disclosable/,
    )
  })

  it('rejects an empty active-contracts read', async () => {
    const { ledgerApi, activeContracts } = ledger({ contracts: [] })
    await expect(loadBackendConfig(ledgerApi, activeContracts)).rejects.toThrow(
      /no factory disclosable/,
    )
  })

  it('throws when the wallet reports no authenticated user', async () => {
    const { ledgerApi, activeContracts } = ledger({ user: {} })
    await expect(loadBackendConfig(ledgerApi, activeContracts)).rejects.toThrow(
      /did not report an authenticated user/,
    )
  })
})
