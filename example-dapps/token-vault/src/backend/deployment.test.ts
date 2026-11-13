import { describe, expect, it } from 'vitest'
import type { LedgerApi } from '@/backend/acs'
import { loadDeployment } from '@/backend/deployment'

const VAULT = 'vault-operator::ns'
const STAMPED = 'vault-operator-1600000000000::ns'
const ISSUER = 'token-issuer::ns'
const CONFIG = 'forgepkg:Canton.TokenForge.Registry:InstrumentConfig'

const row = (createdEvent: Record<string, unknown>, synchronizerId?: string) => ({
  contractEntry: {
    JsActiveContract: { createdEvent, ...(synchronizerId ? { synchronizerId } : {}) },
  },
})

const vaultEvent = {
  contractId: '00vault',
  createArgument: {
    instrumentId: { admin: ISSUER, id: 'USDX' },
    vault: VAULT,
    vaultInstrumentId: { admin: VAULT, id: 'VSH' },
  },
  templateId: 'vaultpkg:Canton.TokenVault.Vault:Vault',
}

const configEvent = (id: string, faucet: unknown = null) => ({
  contractId: `00${id}`,
  createArgument: { decimals: '10', faucet, instrumentId: id, name: `${id} token`, symbol: id },
  createdEventBlob: `${id}blob`,
  templateId: CONFIG,
})

const right = (party: string) => ({ kind: { CanActAs: { value: { party } } } })

const ledger = (
  overrides: { configs?: Record<string, unknown[]>; rights?: unknown[]; vaults?: unknown[] } = {},
) => {
  const parties: string[] = []
  const requests: Parameters<LedgerApi>[0][] = []
  const ledgerApi: LedgerApi = async (params) => {
    requests.push(params)
    if (params.resource === '/v2/authenticated-user') return { user: { id: 'ledger-api-user' } }
    if (params.resource === '/v2/users/{user-id}/rights') {
      return { rights: overrides.rights ?? [right(STAMPED), right(VAULT), right(ISSUER)] }
    }
    if (params.resource === '/v2/state/ledger-end') return { offset: 42 }
    const body = params.body as {
      eventFormat: { filtersByParty: Record<string, unknown> }
      filter?: unknown
      verbose?: unknown
    }
    if (body.filter !== undefined || body.verbose !== undefined) {
      throw new Error('DEPRECATED_API_DISABLED')
    }
    const byParty = body.eventFormat.filtersByParty
    const party = Object.keys(byParty)[0] ?? ''
    parties.push(party)
    if (JSON.stringify(byParty).includes('TokenVault.Vault')) {
      return overrides.vaults ?? [row(vaultEvent, 'sync::1')]
    }
    const configs = overrides.configs ?? {
      [ISSUER]: [row(configEvent('USDX', { maxPerTap: '1000.0000000000' }), 'sync::1')],
      [VAULT]: [row(configEvent('VSH'), 'sync::1')],
    }
    return configs[party] ?? []
  }
  return { ledgerApi, parties: () => parties, requests: () => requests }
}

describe('loadDeployment', () => {
  it('returns the vault, both instruments with their disclosures, and the vault package id', async () => {
    await expect(loadDeployment(ledger().ledgerApi)).resolves.toEqual({
      share: {
        admin: VAULT,
        config: {
          contractId: '00VSH',
          createdEventBlob: 'VSHblob',
          synchronizerId: 'sync::1',
          templateId: CONFIG,
        },
        id: 'VSH',
        maxPerTap: undefined,
        name: 'VSH token',
        symbol: 'VSH',
      },
      synchronizerId: 'sync::1',
      underlying: {
        admin: ISSUER,
        config: {
          contractId: '00USDX',
          createdEventBlob: 'USDXblob',
          synchronizerId: 'sync::1',
          templateId: CONFIG,
        },
        id: 'USDX',
        maxPerTap: '1000.0000000000',
        name: 'USDX token',
        symbol: 'USDX',
      },
      vault: VAULT,
      vaultCid: '00vault',
      vaultPkg: 'vaultpkg',
    })
  })

  it('asks for the rights through the route template the gateway allows', async () => {
    const { ledgerApi, requests } = ledger()

    await loadDeployment(ledgerApi)

    expect(requests()).toContainEqual({
      path: { 'user-id': 'ledger-api-user' },
      requestMethod: 'get',
      resource: '/v2/users/{user-id}/rights',
    })
  })

  it('reads as the stable vault-operator party, never a stamped one from an older bootstrap', async () => {
    const { ledgerApi, parties } = ledger({ rights: [right(VAULT), right(STAMPED)] })

    await loadDeployment(ledgerApi)

    expect(parties()[0]).toBe(VAULT)
  })

  it('takes the underlying issuer off the vault contract, not off the rights', async () => {
    const other = 'token-issuer-9::ns'
    const { ledgerApi, parties } = ledger({ rights: [right(VAULT), right(other)] })

    const deployment = await loadDeployment(ledgerApi)

    expect(deployment.underlying.admin).toBe(ISSUER)
    expect(parties()).not.toContain(other)
  })

  it('omits the synchronizer id when the vault row carries none', async () => {
    const { ledgerApi } = ledger({ vaults: [row(vaultEvent)] })

    await expect(loadDeployment(ledgerApi)).resolves.not.toHaveProperty('synchronizerId')
  })

  it('names the bootstrap script when no vault operator was ever created', async () => {
    const { ledgerApi } = ledger({ rights: [right(STAMPED)] })

    await expect(loadDeployment(ledgerApi)).rejects.toThrow(/no vault operator.*pnpm run bootstrap/)
  })

  it('rejects a ledger where the vault party created no Vault', async () => {
    const { ledgerApi } = ledger({ vaults: [] })

    await expect(loadDeployment(ledgerApi)).rejects.toThrow(/no vault created by/)
  })

  it('rejects an instrument config that came back without its disclosure blob', async () => {
    const { createdEventBlob: _blob, ...blobless } = configEvent('VSH')
    const { ledgerApi } = ledger({
      configs: { [ISSUER]: [row(configEvent('USDX'))], [VAULT]: [row(blobless)] },
    })

    await expect(loadDeployment(ledgerApi)).rejects.toThrow(/no disclosable VSH instrument/)
  })

  it('rejects a vault whose share instrument is not on the ledger', async () => {
    const { ledgerApi } = ledger({ configs: { [ISSUER]: [row(configEvent('USDX'))], [VAULT]: [] } })

    await expect(loadDeployment(ledgerApi)).rejects.toThrow(/no VSH instrument disclosable/)
  })
})
