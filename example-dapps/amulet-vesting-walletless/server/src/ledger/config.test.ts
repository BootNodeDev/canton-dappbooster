import { describe, expect, it } from 'vitest'
import { authenticatedUser, loadBackendConfig } from '#server/ledger/config'
import type { LedgerApi } from '#server/ledger/wallet'

const OPERATOR = 'vesting-operator::ns'
const STAMPED = 'vesting-operator-1700000000001::ns'

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
  templateId: 'abc123:AmuletVesting:AmuletVestingFactory',
}

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
          { kind: { CanActAs: { value: { party: STAMPED } } } },
          { kind: { CanActAs: { value: { party: OPERATOR } } } },
          { kind: { ParticipantAdmin: { value: {} } } },
        ],
      }
    }
    if (resource === '/v2/state/ledger-end') {
      return { offset: 42 }
    }
    const body = params.body as {
      eventFormat?: { filtersByParty?: Record<string, unknown> }
      filter?: unknown
      verbose?: unknown
    }
    if (body.filter !== undefined || body.verbose !== undefined) {
      throw new Error('DEPRECATED_API_DISABLED')
    }
    filteredParty = Object.keys(body.eventFormat?.filtersByParty ?? {})[0]
    return overrides.acs ?? [factoryRow(created, 'sync::1')]
  }
  return { ledgerApi, filteredParty: () => filteredParty }
}

describe('loadBackendConfig', () => {
  it('returns the deployment it reads back, synchronizer id included', async () => {
    const { ledgerApi } = ledger()
    await expect(loadBackendConfig(ledgerApi, 'user-1')).resolves.toEqual({
      factoryBlob: 'YmxvYg==',
      factoryCid: '00cid',
      pkg: 'abc123',
      synchronizerId: 'sync::1',
    })
  })

  it('refuses a factory row that names no synchronizer', async () => {
    const { ledgerApi } = ledger({ acs: [factoryRow(created)] })
    await expect(loadBackendConfig(ledgerApi, 'user-1')).rejects.toThrow(/no synchronizer id/)
  })

  it('reads as the operator allocated under the bootstrap hint', async () => {
    const { ledgerApi, filteredParty } = ledger()
    await loadBackendConfig(ledgerApi, 'user-1')
    expect(filteredParty()).toBe(OPERATOR)
  })

  it('does not adopt the stamped operator a wallet example bootstraps', async () => {
    const { ledgerApi } = ledger({
      rights: [{ kind: { CanActAs: { value: { party: STAMPED } } } }],
    })
    await expect(loadBackendConfig(ledgerApi, 'user-1')).rejects.toThrow(/no vesting operator/)
  })

  it('names the bootstrap script when no operator was ever created', async () => {
    const { ledgerApi } = ledger({ rights: [{ kind: { ParticipantAdmin: { value: {} } } }] })
    await expect(loadBackendConfig(ledgerApi, 'user-1')).rejects.toThrow(
      /no vesting operator.*pnpm run bootstrap/,
    )
  })

  it('rejects a factory row that came back without its disclosure blob', async () => {
    const { ledgerApi } = ledger({ acs: [factoryRow({ contractId: '00cid' })] })
    await expect(loadBackendConfig(ledgerApi, 'user-1')).rejects.toThrow(/no factory disclosable/)
  })

  it('rejects an empty active-contracts read', async () => {
    const { ledgerApi } = ledger({ acs: [] })
    await expect(loadBackendConfig(ledgerApi, 'user-1')).rejects.toThrow(/no factory disclosable/)
  })

  it('throws when the ledger reports no authenticated user', async () => {
    const { ledgerApi } = ledger({ user: {} })
    await expect(authenticatedUser(ledgerApi)).rejects.toThrow(
      /did not report an authenticated user/,
    )
  })
})
