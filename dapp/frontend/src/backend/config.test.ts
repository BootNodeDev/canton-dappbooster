import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type LedgerApi, loadBackendConfig } from '@/backend/config'

const OPERATOR = 'vesting-operator::ns'
// What a bootstrap predating the stable hint left behind. A different party, whose factory is not
// the one the registry is now configured for.
const LEGACY = 'vesting-operator-1700000000001::ns'

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
          { kind: { CanActAs: { value: { party: LEGACY } } } },
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

const ADMIN = 'instrument-admin-1700000000000::ns'

// loadBackendConfig now reads the instrument off the registry as well as the factory off the
// ledger, so every case needs the happy registry unless it is about the registry failing.
beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      String(url).endsWith('/instruments')
        ? { instruments: [{ id: 'DBT' }] }
        : { adminId: ADMIN, supportedApis: {} },
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadBackendConfig', () => {
  it('returns the deployment it reads back, synchronizer id included', async () => {
    const { ledgerApi } = ledger()
    await expect(loadBackendConfig(ledgerApi)).resolves.toEqual({
      admin: ADMIN,
      factoryBlob: 'YmxvYg==',
      factoryCid: '00cid',
      instrumentId: 'DBT',
      pkg: 'abc123',
      synchronizerId: 'sync::1',
    })
  })

  // The pair comes from the registry because nothing on the ledger carries it: the factory is this
  // repo's own operator, the instrument admin is a third party.
  it('carries the registry’s instrument into the deployment', async () => {
    const { ledgerApi } = ledger()
    const deployment = await loadBackendConfig(ledgerApi)
    expect([deployment.admin, deployment.instrumentId]).toEqual([ADMIN, 'DBT'])
  })

  it('omits the synchronizer id when the row carries none', async () => {
    const { ledgerApi } = ledger({ acs: [factoryRow(created)] })
    await expect(loadBackendConfig(ledgerApi)).resolves.not.toHaveProperty('synchronizerId')
  })

  it('reads as the operator allocated under the bootstrap hint', async () => {
    const { ledgerApi, filteredParty } = ledger()
    await loadBackendConfig(ledgerApi)
    expect(filteredParty()).toBe(OPERATOR)
  })

  // The stamped spelling is a prefix of nothing the current bootstrap creates, and adopting it would
  // point the app at that run's factory while the registry serves this run's admin.
  it('does not adopt a stamped operator from an earlier bootstrap', async () => {
    const { ledgerApi } = ledger({ rights: [{ kind: { CanActAs: { value: { party: LEGACY } } } }] })
    await expect(loadBackendConfig(ledgerApi)).rejects.toThrow(/no vesting operator/)
  })

  it('names the bootstrap script when no operator was ever created', async () => {
    const { ledgerApi } = ledger({ rights: [{ kind: { ParticipantAdmin: { value: {} } } }] })
    await expect(loadBackendConfig(ledgerApi)).rejects.toThrow(
      /no vesting operator.*pnpm run bootstrap/,
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
