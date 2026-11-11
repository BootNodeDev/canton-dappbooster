import {
  type AcsEntry,
  call,
  type LedgerApi,
  ledgerEnd,
  readAcs,
  templateFilter,
} from '@/backend/acs'
import type { DisclosedContract } from '@/backend/wallet'

export type Instrument = {
  admin: string
  config: DisclosedContract
  id: string
  maxPerTap: string | undefined
  name: string
  symbol: string
}

export type Deployment = {
  share: Instrument
  synchronizerId?: string
  underlying: Instrument
  vault: string
  vaultCid: string
  vaultPkg: string
}

type InstrumentId = { admin: string; id: string }

const VAULT_FILTER = '#canton-token-vault:Canton.TokenVault.Vault:Vault'
const CONFIG_FILTER = '#canton-token-forge:Canton.TokenForge.Registry:InstrumentConfig'
// The separator belongs to the prefix, so a stamped `vault-operator-<n>::` party never matches.
const VAULT_HINT = 'vault-operator::'

const advice = (reason: string): Error => new Error(`${reason}: run pnpm run bootstrap`)

const instrumentIdOf = (value: unknown): InstrumentId => {
  const { admin, id } = (value ?? {}) as Partial<InstrumentId>
  if (typeof admin !== 'string' || typeof id !== 'string' || admin === '' || id === '') {
    throw advice('the vault names an instrument this app cannot read')
  }
  return { admin, id }
}

// The bootstrap grants this user `CanActAs` on the vault, so its rights are the vault list.
const vaultParty = async (ledgerApi: LedgerApi): Promise<string> => {
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
    resource: '/v2/users/{user-id}/rights',
    path: { 'user-id': user.id },
  })
  // Sorted so a participant hosting the hint under two namespaces picks the same one every load.
  const vault = (rights ?? [])
    .map((right) => right.kind?.CanActAs?.value?.party)
    .filter((party): party is string => party?.startsWith(VAULT_HINT) === true)
    .sort()
    .at(-1)
  if (vault === undefined) {
    throw advice('no vault operator on this ledger')
  }
  return vault
}

const toInstrument = (entry: AcsEntry, { admin, id }: InstrumentId): Instrument => {
  const { contractId, createArgument: arg = {}, createdEventBlob, templateId } = entry.event
  if (contractId === undefined || createdEventBlob === undefined || templateId === undefined) {
    throw advice(`no disclosable ${id} instrument`)
  }
  const faucet = arg.faucet as { maxPerTap?: string } | null | undefined
  return {
    admin,
    config: {
      contractId,
      createdEventBlob,
      templateId,
      ...(entry.synchronizerId === undefined ? {} : { synchronizerId: entry.synchronizerId }),
    },
    id,
    maxPerTap: faucet?.maxPerTap,
    name: typeof arg.name === 'string' ? arg.name : id,
    symbol: typeof arg.symbol === 'string' ? arg.symbol : id,
  }
}

// Read off the ledger as the admin, not from a registry: the bootstrap's `CanActAs` lets this user.
const readInstrument = async (
  ledgerApi: LedgerApi,
  offset: string,
  instrumentId: InstrumentId,
): Promise<Instrument> => {
  const rows = await readAcs(ledgerApi, {
    filter: templateFilter(CONFIG_FILTER, true),
    offset,
    party: instrumentId.admin,
  })
  const found = rows.find((row) => row.event.createArgument?.instrumentId === instrumentId.id)
  if (found === undefined) {
    throw advice(`no ${instrumentId.id} instrument disclosable by ${instrumentId.admin}`)
  }
  return toInstrument(found, instrumentId)
}

export const loadDeployment = async (ledgerApi: LedgerApi): Promise<Deployment> => {
  const vault = await vaultParty(ledgerApi)
  const offset = await ledgerEnd(ledgerApi)

  const vaults = await readAcs(ledgerApi, {
    filter: templateFilter(VAULT_FILTER),
    offset,
    party: vault,
  })
  const row = vaults.find((entry) => entry.event.createArgument?.vault === vault)
  const { contractId, createArgument: arg = {}, templateId } = row?.event ?? {}
  if (row === undefined || contractId === undefined) {
    throw advice(`no vault created by ${vault}`)
  }
  const vaultPkg = templateId?.split(':')[0]
  if (vaultPkg === undefined || vaultPkg === '') {
    throw advice('the vault came back with no package id')
  }

  // Off the Vault itself rather than the user's rights, so the pair is the one this vault names.
  const [underlying, share] = await Promise.all([
    readInstrument(ledgerApi, offset, instrumentIdOf(arg.instrumentId)),
    readInstrument(ledgerApi, offset, instrumentIdOf(arg.vaultInstrumentId)),
  ])

  return {
    share,
    underlying,
    vault,
    vaultCid: contractId,
    vaultPkg,
    ...(row.synchronizerId === undefined ? {} : { synchronizerId: row.synchronizerId }),
  }
}
