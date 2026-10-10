#!/usr/bin/env node
// Bootstrap the vesting demo: create the backstage operator and pre-create the observer-less
// AmuletVestingFactory it signs. Funder and receiver are wallet accounts, so no other party is
// created here.
//
// Nothing is written out. The dApp finds both by reading this operator's rights and its factory
// back off the ledger, so a run that ends here is a run the dApp can already see.
//
// Run with the local stack up and the DAR deployed.

// A caller-exported value wins over .env, the same precedence deploy-dar.sh spells out by hand.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  // No .env: the caller's environment is the whole configuration.
}

const JSON_API_URL = process.env.CANTON_JSON_API_URL || 'http://localhost:2975'
const TOKEN = process.env.CANTON_BACKEND_TOKEN
const PACKAGE_NAME = 'amulet-vesting'
const STAMP = Date.now()

if (!TOKEN) {
  throw new Error('CANTON_BACKEND_TOKEN is required. Generate one with: pnpm run mint-token')
}

const ledger = async (requestMethod, resource, body, query) => {
  const url = new URL(JSON_API_URL + resource)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    method: requestMethod.toUpperCase(),
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  // Status before parse: an error page would otherwise surface as a JSON syntax error.
  if (!response.ok) {
    throw new Error(
      `${requestMethod} ${resource} failed: HTTP ${response.status} ${text.slice(0, 400)}`,
    )
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${requestMethod} ${resource} returned no JSON: ${text.slice(0, 400)}`)
  }
}

const createOperator = async (hint) => {
  const result = await ledger('post', '/v2/parties', { partyIdHint: hint })
  const party = result?.partyDetails?.party
  if (typeof party !== 'string' || party.length === 0) {
    throw new Error(`no party id for hint ${hint}: ${JSON.stringify(result)}`)
  }
  // Asked rather than decoded off the token, so a token minted for another subject still works.
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
  const factoryTid = `${pkg}:AmuletVesting:AmuletVestingFactory`
  console.log(`package    ${pkg}${process.env.PKG === undefined ? '' : ' (from PKG)'}`)

  await ledger('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
    commandId: `vesting-factory-${STAMP}`,
    actAs: [operator],
    readAs: [operator],
    commands: [
      { CreateCommand: { templateId: factoryTid, createArguments: { factoryOwner: operator } } },
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
                    templateId: `#${PACKAGE_NAME}:AmuletVesting:AmuletVestingFactory`,
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
}

await main()
