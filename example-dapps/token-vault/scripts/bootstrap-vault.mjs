#!/usr/bin/env node
// Creates what the vault needs on the ledger, only where missing; architecture.md has the why.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import {
  activeContracts,
  authenticatedUser,
  bearer,
  JSON_API_URL,
  ledger,
  submit,
  templateFilter,
} from './ledger-api.mjs'

const STAMP = Date.now()
const FORGE_PACKAGE = 'canton-token-forge'
const VAULT_PACKAGE = 'canton-token-vault'
const CONFIG_ENTITY = 'Canton.TokenForge.Registry:InstrumentConfig'
const VAULT_ENTITY = 'Canton.TokenVault.Vault:Vault'

export const UNDERLYING = {
  instrumentId: 'USDX',
  name: 'US Dollar X',
  symbol: 'USDX',
  decimals: 10,
  maxPerTap: '1000.0',
}

// No faucet: shares are minted only by a deposit's settle, against the USDX it brings in.
export const SHARE = {
  instrumentId: 'VSH',
  name: 'Vault Share',
  symbol: 'VSH',
  decimals: 10,
  maxPerTap: undefined,
}

// Forge first, so a failed upload names the registry; the vault does not depend on it.
const VENDORED_DARS = ['canton-token-forge.dar', 'canton-token-vault.dar']

// Int64 travels as a JSON string, and an absent Optional as null rather than omitted.
export const instrumentConfigArgs = (admin, instrument) => ({
  admin,
  instrumentId: instrument.instrumentId,
  name: instrument.name,
  symbol: instrument.symbol,
  decimals: String(instrument.decimals),
  faucet: instrument.maxPerTap === undefined ? null : { maxPerTap: instrument.maxPerTap },
  meta: { values: {} },
})

export const vaultArgs = ({ issuer, vault }) => ({
  vault,
  instrumentId: { admin: issuer, id: UNDERLYING.instrumentId },
  vaultInstrumentId: { admin: vault, id: SHARE.instrumentId },
})

// A Daml Decimal comes back padded to its full scale, so 1000.0 reads as 1000.0000000000.
const sameTap = (found, wanted) =>
  wanted === undefined ? found === undefined : Number(found) === Number(wanted)

// The config is admin-signed and created once, so a change here reaches the ledger only by a reset.
export const instrumentDrift = (createArgument, instrument) => {
  const arg = createArgument ?? {}
  return [
    ['name', arg.name, instrument.name, (a, b) => a === b],
    ['symbol', arg.symbol, instrument.symbol, (a, b) => a === b],
    ['decimals', arg.decimals, String(instrument.decimals), (a, b) => a === b],
    ['maxPerTap', arg.faucet?.maxPerTap, instrument.maxPerTap, sameTap],
  ]
    .filter(([, found, wanted, matches]) => !matches(found, wanted))
    .map(([field, found, wanted]) => `${field} is ${found}, this script asks for ${wanted}`)
}

const uploadDars = async () => {
  for (const dar of VENDORED_DARS) {
    const response = await fetch(`${JSON_API_URL}/v2/packages`, {
      method: 'POST',
      headers: { authorization: bearer(), 'content-type': 'application/octet-stream' },
      body: readFileSync(path.join(import.meta.dirname, '..', 'vendor', dar)),
    })
    // A LocalNet takes an identical package again with a 200; some participants answer 409.
    if (!response.ok && response.status !== 409) {
      const text = await response.text()
      throw new Error(`uploading ${dar} failed: HTTP ${response.status} ${text.slice(0, 400)}`)
    }
    console.log(`dar        ${dar}${response.status === 409 ? ' (existing)' : ''}`)
  }
}

const PARTY_PAGES = 20

// `isLocal` tells a party this participant hosts from one it merely knows: acting as the latter fails.
const findParty = async (hint) => {
  const found = []
  let pageToken
  for (let page = 0; page < PARTY_PAGES; page++) {
    const result = await ledger(
      'get',
      '/v2/parties',
      undefined,
      pageToken === undefined ? undefined : { pageToken },
    )
    const details = result?.partyDetails
    if (!Array.isArray(details)) {
      throw new Error(`/v2/parties did not answer with a party list: ${JSON.stringify(result)}`)
    }
    for (const one of details) {
      if (
        typeof one?.party === 'string' &&
        one.party.startsWith(`${hint}::`) &&
        one.isLocal !== false
      ) {
        found.push(one.party)
      }
    }
    pageToken = result?.nextPageToken
    if (typeof pageToken !== 'string' || pageToken === '') {
      // The last in sort order, as deployment.ts and the operator pick among two namespaces.
      return found.sort().at(-1)
    }
  }
  throw new Error(`gave up looking for ${hint} after ${PARTY_PAGES} pages of parties`)
}

// Granted again on every run, which is harmless and what completes a re-run on an existing party.
const ensureParty = async (hint) => {
  const existing = await findParty(hint)
  let party = existing
  if (party === undefined) {
    const result = await ledger('post', '/v2/parties', { partyIdHint: hint })
    party = result?.partyDetails?.party
    if (typeof party !== 'string' || party.length === 0) {
      throw new Error(`no party id for hint ${hint}: ${JSON.stringify(result)}`)
    }
  }
  const userId = await authenticatedUser()
  await ledger('post', `/v2/users/${encodeURIComponent(userId)}/rights`, {
    userId,
    identityProviderId: '',
    rights: [{ kind: { CanActAs: { value: { party } } } }],
  })
  return { party, reused: existing !== undefined }
}

// Fails with PACKAGE_NAMES_NOT_FOUND when a DAR is missing, before anything is created.
const resolvePackage = async (party, packageName) => {
  const result = await ledger('post', '/v2/interactive-submission/preferred-packages', {
    packageVettingRequirements: [{ packageName, parties: [party] }],
  })
  const pkg = result?.packageReferences?.find(
    (reference) => reference.packageName === packageName,
  )?.packageId
  if (typeof pkg !== 'string' || pkg.length === 0) {
    throw new Error(`participant returned no package id for ${packageName}`)
  }
  return pkg
}

const create = (commandId, party, templateId, createArguments) =>
  submit(commandId, party, [{ CreateCommand: { templateId, createArguments } }])

// More than one is a state the dApp cannot pick from, so it is refused rather than guessed.
const findOne = async (party, templateId, matches, what) => {
  const found = (await activeContracts(party, templateFilter(templateId))).filter((event) =>
    matches(event.createArgument),
  )
  if (found.length > 1) {
    throw new Error(`expected at most one ${what} for ${party}, found ${found.length}`)
  }
  return found[0]
}

const ensureInstrument = async (admin, instrument, forgePkg) => {
  const matches = (arg) => arg?.instrumentId === instrument.instrumentId
  const label = `${instrument.instrumentId} InstrumentConfig`
  const existing = await findOne(admin, `#${FORGE_PACKAGE}:${CONFIG_ENTITY}`, matches, label)
  if (existing !== undefined) {
    console.log(`${instrument.symbol.padEnd(10)} ${existing.contractId} (existing)`)
    for (const line of instrumentDrift(existing.createArgument, instrument)) {
      console.warn(`warning:   ${line}; reset the ledger to pick that up.`)
    }
    return
  }
  await create(
    `vault-${instrument.instrumentId.toLowerCase()}-${STAMP}`,
    admin,
    `${forgePkg}:${CONFIG_ENTITY}`,
    instrumentConfigArgs(admin, instrument),
  )
  const created = await findOne(admin, `#${FORGE_PACKAGE}:${CONFIG_ENTITY}`, matches, label)
  if (created === undefined) {
    throw new Error(`created the ${label} but it is not active`)
  }
  console.log(`${instrument.symbol.padEnd(10)} ${created.contractId}`)
}

const ensureVault = async ({ issuer, vault }, vaultPkg) => {
  const matches = (arg) => arg?.vault === vault
  const existing = await findOne(vault, `#${VAULT_PACKAGE}:${VAULT_ENTITY}`, matches, 'Vault')
  if (existing !== undefined) {
    console.log(`vault cid  ${existing.contractId} (existing)`)
    const wanted = vaultArgs({ issuer, vault })
    if (!isDeepStrictEqual(existing.createArgument, wanted)) {
      console.warn(`warning:   that Vault names other instruments than ${JSON.stringify(wanted)}.`)
    }
    return
  }
  await create(`vault-${STAMP}`, vault, `${vaultPkg}:${VAULT_ENTITY}`, vaultArgs({ issuer, vault }))
  const created = await findOne(vault, `#${VAULT_PACKAGE}:${VAULT_ENTITY}`, matches, 'Vault')
  if (created === undefined) {
    throw new Error('created the Vault but it is not active')
  }
  console.log(`vault cid  ${created.contractId}`)
}

const main = async () => {
  await uploadDars()

  // Stable hints, because `up` runs this every time and the ledger outlives a `down`.
  const { party: issuer, reused: hadIssuer } = await ensureParty('token-issuer')
  console.log(`issuer     ${issuer}${hadIssuer ? ' (existing)' : ''}`)
  const { party: vault, reused: hadVault } = await ensureParty('vault-operator')
  console.log(`vault      ${vault}${hadVault ? ' (existing)' : ''}`)

  const [forgePkg, vaultPkg] = await Promise.all([
    resolvePackage(issuer, FORGE_PACKAGE),
    resolvePackage(vault, VAULT_PACKAGE),
  ])
  console.log(`forge pkg  ${forgePkg}`)
  console.log(`vault pkg  ${vaultPkg}`)

  await ensureInstrument(issuer, UNDERLYING, forgePkg)
  await ensureInstrument(vault, SHARE, forgePkg)
  await ensureVault({ issuer, vault }, vaultPkg)
}

// import.meta.main, not argv[1]: the loader realpaths the file, so a symlinked path made it false.
if (import.meta.main) {
  await main()
}
