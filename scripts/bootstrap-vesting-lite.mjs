#!/usr/bin/env node
// Bootstrap the vesting demo: create the backstage operator, pre-create the observer-less
// VestingFactory it signs, and write the config the dApp reads. Funder and beneficiary are
// wallet accounts, so no other party is created here.
//
// The factory has no observers, so a funder cannot read it. Its disclosure payload therefore
// travels through this config file rather than through the dApp's own ledger reads.
//
// Run with the local stack up and the DAR deployed.

import { writeFile } from 'node:fs/promises'

const RPC_URL = process.env.RPC_URL ?? 'http://localhost:3010/rpc'
// Resolved against this file, not the cwd, so the script works from anywhere in the repo.
const OUT =
  process.env.OUT ?? new URL('../dapp/frontend/public/vesting-lite-parties.json', import.meta.url)
const PACKAGE_NAME = 'vesting-lite'
const STAMP = Date.now()

const rpc = async (method, params) => {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
  })
  const text = await response.text()
  // Status before parse: a proxy error page or an empty body from a still-starting wallet-service
  // would otherwise surface as a JSON syntax error instead of the failure.
  if (!response.ok) {
    throw new Error(`${method} failed: HTTP ${response.status} ${text.slice(0, 400)}`)
  }
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`${method} returned no JSON: ${text.slice(0, 400)}`)
  }
  if (payload.error !== undefined) {
    throw new Error(`${method} failed: ${text.slice(0, 400)}`)
  }
  return payload.result
}

const ledger = (requestMethod, resource, body, query) =>
  rpc('ledgerApi', {
    requestMethod,
    resource,
    ...(body === undefined ? {} : { body }),
    ...(query === undefined ? {} : { query }),
  })

const createOperator = async (hint) => {
  const result = await ledger('post', '/v2/parties', { partyIdHint: hint })
  const party = result?.partyDetails?.party
  if (typeof party !== 'string' || party.length === 0) {
    throw new Error(`no party id for hint ${hint}: ${JSON.stringify(result)}`)
  }
  // wallet-service keeps its bearer token private, so ask the participant who it authenticated as.
  const userId = (await ledger('get', '/v2/authenticated-user'))?.user?.id
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('participant did not report an authenticated user')
  }
  await ledger('post', `/v2/users/${userId}/rights`, {
    userId,
    identityProviderId: '',
    rights: [{ kind: { CanActAs: { value: { party } } } }],
  })
  return party
}

// Ask the participant which package it would pick for the name, so a stale id cannot silently
// produce an empty dashboard. Fails loudly with PACKAGE_NAMES_NOT_FOUND if the DAR is not deployed.
const resolvePackage = async (party) => {
  const result = await ledger(
    'get',
    '/v2/interactive-submission/preferred-package-version',
    undefined,
    { 'package-name': PACKAGE_NAME, parties: party },
  )
  const pkg = result?.packagePreference?.packageReference?.packageId
  if (typeof pkg !== 'string' || pkg.length === 0) {
    throw new Error(`participant returned no package id for ${PACKAGE_NAME}`)
  }
  return pkg
}

const main = async () => {
  // A fresh operator per run, so the config always matches a factory this run created. Earlier
  // operators and factories stay active on the local ledger and are simply superseded.
  const operator = await createOperator(`vesting-operator-${STAMP}`)
  console.log(`operator   ${operator}`)

  const pkg = process.env.PKG ?? (await resolvePackage(operator))
  const factoryTid = `${pkg}:Vesting:VestingFactory`
  console.log(`package    ${pkg}${process.env.PKG === undefined ? '' : ' (from PKG)'}`)

  await ledger('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
    commandId: `vesting-factory-${STAMP}`,
    actAs: [operator],
    readAs: [operator],
    commands: [
      { CreateCommand: { templateId: factoryTid, createArguments: { provider: operator } } },
    ],
  })

  const end = await ledger('get', '/v2/state/ledger-end')
  if (end?.offset === undefined) {
    throw new Error('participant returned no ledger-end offset')
  }
  const rows = await ledger('post', '/v2/state/active-contracts', {
    filter: {
      filtersByParty: {
        [operator]: {
          cumulative: [
            {
              identifierFilter: {
                // A filter takes the package-name reference; a participant rejects the package id
                // the CreateCommand above carries.
                TemplateFilter: {
                  value: {
                    templateId: `#${PACKAGE_NAME}:Vesting:VestingFactory`,
                    includeCreatedEventBlob: true,
                  },
                },
              },
            },
          ],
        },
      },
    },
    activeAtOffset: end.offset,
    verbose: true,
  })
  const active = (Array.isArray(rows) ? rows : [])
    .map((row) => row?.contractEntry?.JsActiveContract)
    .find((entry) => entry?.createdEvent?.createdEventBlob !== undefined)
  if (active === undefined) {
    throw new Error('factory created but no createdEventBlob came back from the ACS read')
  }
  console.log(`factory    ${active.createdEvent.contractId}`)

  const config = {
    createdAt: new Date().toISOString(),
    pkg,
    operator,
    factoryCid: active.createdEvent.contractId,
    factoryBlob: active.createdEvent.createdEventBlob,
    synchronizerId: active.synchronizerId,
  }
  await writeFile(OUT, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  console.log(`\nWrote ${OUT}`)
}

await main()
