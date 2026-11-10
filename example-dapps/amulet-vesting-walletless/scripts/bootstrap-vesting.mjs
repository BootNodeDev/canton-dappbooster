#!/usr/bin/env node
// Bootstrap the vesting demo: the backstage operator and the observer-less AmuletVestingFactory it
// signs, each created only where it is missing. Accounts are the server's to create at signup.
//
// Nothing is written out. The server finds both by reading this operator's rights and its factory
// back off the ledger, so a run that ends here is a run the server can already see.
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
const OPERATOR_HINT = 'vesting-operator'
const STAMP = Date.now()

// Checked on the first call rather than at import, so the test importing the exports below runs in
// CI, which has no .env.
const bearer = () => {
  if (!TOKEN) {
    throw new Error('CANTON_BACKEND_TOKEN is required. Generate one with: pnpm run mint-token')
  }
  return `Bearer ${TOKEN}`
}

const ledger = async (requestMethod, resource, body, query) => {
  const url = new URL(JSON_API_URL + resource)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    method: requestMethod.toUpperCase(),
    headers: {
      authorization: bearer(),
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

// Party ids are `<hint>::<fingerprint>`, so the hint is a prefix, and `isLocal` separates a party
// this participant hosts from one it only knows about.
export const hostedParty = (details, hint) =>
  details.find(
    (one) =>
      typeof one?.party === 'string' && one.party.startsWith(`${hint}::`) && one.isLocal !== false,
  )?.party

const PARTY_PAGES = 20

const findParty = async (hint) => {
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
    const found = hostedParty(details, hint)
    if (found !== undefined) {
      return found
    }
    pageToken = result?.nextPageToken
    if (typeof pageToken !== 'string' || pageToken === '') {
      return undefined
    }
  }
  // Never "not allocated": the next step would allocate the hint again and the participant would
  // refuse a party it already hosts.
  throw new Error(`gave up looking for ${hint} after ${PARTY_PAGES} pages of parties`)
}

// Granting again is harmless, and is what makes a re-run against an earlier run's party complete.
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
  return { party, reused: existing !== undefined }
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

// Observer-less, so only the operator sees it, and the server reads it back as the operator.
const findFactory = async (operator) => {
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
                // the CreateCommand carries.
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
  return (Array.isArray(rows) ? rows : [])
    .map((row) => row?.contractEntry?.JsActiveContract)
    .find((entry) => entry?.createdEvent?.createdEventBlob !== undefined)
}

const main = async () => {
  // A stable hint, and a factory only where there is none: `up` runs this on every start and the
  // LocalNet's volumes outlive a `down`, so a fresh pair each time would orphan every grant made so
  // far. A reset drops the party with the ledger, so a fresh stack still gets a fresh one.
  const { party: operator, reused: hadOperator } = await ensureParty(OPERATOR_HINT)
  console.log(`operator   ${operator}${hadOperator ? ' (existing)' : ''}`)

  const pkg = process.env.PKG ?? (await resolvePackage(operator))
  const factoryTid = `${pkg}:AmuletVesting:AmuletVestingFactory`
  console.log(`package    ${pkg}${process.env.PKG === undefined ? '' : ' (from PKG)'}`)

  let active = await findFactory(operator)
  const hadFactory = active !== undefined
  if (!hadFactory) {
    await ledger('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
      commandId: `vesting-factory-${STAMP}`,
      actAs: [operator],
      readAs: [operator],
      commands: [
        { CreateCommand: { templateId: factoryTid, createArguments: { factoryOwner: operator } } },
      ],
    })
    // Read back rather than taken from the submission response, whose shape varies by version.
    active = await findFactory(operator)
  }
  if (active === undefined) {
    throw new Error('factory created but no createdEventBlob came back from the ACS read')
  }
  console.log(`factory    ${active.createdEvent.contractId}${hadFactory ? ' (existing)' : ''}`)
  // The filter takes the package name, so a factory signed under an older version is reused too.
  const factoryPkg = active.createdEvent.templateId?.split(':')[0]
  if (hadFactory && factoryPkg !== pkg) {
    console.warn(`warning:   that factory is on package ${factoryPkg}, not the preferred ${pkg}.`)
    console.warn('           The server follows the contract, so a newly deployed DAR takes effect')
    console.warn('           only after `canton-barebones reset`.')
  }
}

// import.meta.main, not a comparison against argv[1], which keeps symlinks the loader resolves.
if (import.meta.main) {
  await main()
}
