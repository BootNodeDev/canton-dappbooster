import { describe, expect, it } from 'vitest'
import { type LedgerApi, loadBackendConfig } from '@/backend/config'

const OPERATOR = 'vesting-operator-1700000000001::ns'
const OLDER = 'vesting-operator-1600000000000::ns'

const factoryRow = (
  createdEvent: Record<string, unknown>,
  synchronizerId?: string,
): Record<string, unknown> => ({
  contractEntry: {
    JsActiveContract: { createdEvent, ...(synchronizerId ? { synchronizerId } : {}) },
  },
})

const created = {
  contractId: '00cid',
  createdEventBlob: 'YmxvYg==',
  templateId: 'abc123:Vesting:VestingFactory',
}

// The four reads loadBackendConfig makes, keyed by resource so a test overrides only what it is
// about. `acs` doubles as the record of which party the last filter named.
const ledger = (
  overrides: { rights?: unknown[]; acs?: unknown[]; user?: unknown } = {},
): { ledgerApi: LedgerApi; filteredParty: () => string | undefined } => {
  let filteredParty: string | undefined
  const ledgerApi: LedgerApi = async (params) => {
    const resource = params.resource as string
    if (resource === '/v2/authenticated-user') {
      return overrides.user ?? { user: { id: 'user-1' } }
    }
    if (resource.endsWith('/rights')) {
      return {
        rights: overrides.rights ?? [
          { kind: { CanActAs: { value: { party: OLDER } } } },
          { kind: { CanActAs: { value: { party: OPERATOR } } } },
          { kind: { ParticipantAdmin: { value: {} } } },
        ],
      }
    }
    if (resource === '/v2/state/ledger-end') {
      return { offset: 42 }
    }
    const filter = (params.body as { filter?: { filtersByParty?: Record<string, unknown> } })
      ?.filter
    filteredParty = Object.keys(filter?.filtersByParty ?? {})[0]
    return overrides.acs ?? [factoryRow(created, 'sync::1')]
  }
  return { ledgerApi, filteredParty: () => filteredParty }
}

describe('loadBackendConfig', () => {
  it('returns the deployment it reads back, synchronizer id included', async () => {
    const { ledgerApi } = ledger()
    await expect(loadBackendConfig(ledgerApi)).resolves.toEqual({
      factoryBlob: 'YmxvYg==',
      factoryCid: '00cid',
      pkg: 'abc123',
      synchronizerId: 'sync::1',
    })
  })

  it('omits the synchronizer id when the row carries none', async () => {
    const { ledgerApi } = ledger({ acs: [factoryRow(created)] })
    await expect(loadBackendConfig(ledgerApi)).resolves.not.toHaveProperty('synchronizerId')
  })

  // Every run leaves its operator behind, so the newest is the one whose factory the config means.
  it('reads as the newest operator among the rights', async () => {
    const { ledgerApi, filteredParty } = ledger()
    await loadBackendConfig(ledgerApi)
    expect(filteredParty()).toBe(OPERATOR)
  })

  it('names the bootstrap script when no operator was ever created', async () => {
    const { ledgerApi } = ledger({ rights: [{ kind: { ParticipantAdmin: { value: {} } } }] })
    await expect(loadBackendConfig(ledgerApi)).rejects.toThrow(
      /no vesting operator.*bootstrap-vesting-lite/,
    )
  })

  // A factory with no blob cannot be disclosed, so it is as good as absent.
  it('rejects a factory row that came back without its disclosure blob', async () => {
    const { ledgerApi } = ledger({ acs: [factoryRow({ contractId: '00cid' })] })
    await expect(loadBackendConfig(ledgerApi)).rejects.toThrow(/no factory disclosable/)
  })

  it('rejects an empty active-contracts read', async () => {
    const { ledgerApi } = ledger({ acs: [] })
    await expect(loadBackendConfig(ledgerApi)).rejects.toThrow(/no factory disclosable/)
  })

  it('throws when the wallet reports no authenticated user', async () => {
    const { ledgerApi } = ledger({ user: {} })
    await expect(loadBackendConfig(ledgerApi)).rejects.toThrow(
      /did not report an authenticated user/,
    )
  })
})
