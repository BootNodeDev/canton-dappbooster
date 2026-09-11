#!/usr/bin/env node
// Bootstrap the vesting demo: create the backstage operator and pre-create the observer-less
// VestingFactory it signs, plus the instrument admin and its DBT InstrumentConfig. Funder and
// receiver are wallet accounts, so no other party is created here.
//
// Nothing is written out. The dApp finds both by reading this operator's rights and its factory
// back off the ledger, so a run that ends here is a run the dApp can already see.
//
// Run with the local stack up and the DAR deployed.

const RPC_URL = process.env.RPC_URL ?? 'http://localhost:3010/rpc'
const PACKAGE_NAME = 'vesting'
const STAMP = Date.now()

const TOKEN_FORGE_PACKAGE = 'canton-token-forge'
const INSTRUMENT = {
  instrumentId: 'DBT',
  name: 'dAppBooster Token',
  symbol: 'DBT',
  decimals: 10,
  maxPerTap: '1000.0',
}

export const REGISTRY_PORT = 3013

// Spelled out rather than built from a helper, so these read the same here, in
// the registry's own .env.example, and in a grep.
export const REGISTRY_TEMPLATE_IDS = {
  INSTRUMENT_CONFIG_TEMPLATE_ID: '#canton-token-forge:Canton.TokenForge.Registry:InstrumentConfig',
  PREAPPROVAL_TEMPLATE_ID:
    '#canton-token-forge:Canton.TokenForge.Registry:TokenTransferPreapproval',
  LOCKED_TOKEN_TEMPLATE_ID: '#canton-token-forge:Canton.TokenForge.Locked:LockedToken',
  TRANSFER_INSTRUCTION_TEMPLATE_ID:
    '#canton-token-forge:Canton.TokenForge.Instruction:TokenTransferInstruction',
  ALLOCATION_TEMPLATE_ID: '#canton-token-forge:Canton.TokenForge.Allocation:TokenAllocation',
}

// Every template id is single-quoted: a value starting with `#` is otherwise read
// as a comment and the variable parses as empty.
export const formatRegistryEnv = ({ ledgerApiUrl, adminParty, port }) =>
  [
    `LEDGER_API_URL=${ledgerApiUrl}`,
    'LEDGER_API_TOKEN=<the CANTON_BACKEND_TOKEN from .env>',
    `ADMIN_PARTY=${adminParty}`,
    ...Object.entries(REGISTRY_TEMPLATE_IDS).map(([key, id]) => `${key}='${id}'`),
    `PORT=${port}`,
  ].join('\n')

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

const PARTY_PAGES = 20

// A party this participant hosts under this hint, or undefined. Party ids are
// `<hint>::<fingerprint>`, so the hint is a prefix and not the id itself, and
// `isLocal` is what separates a party this participant hosts from one it merely
// knows about: allocating rights on somebody else's party succeeds and every
// command as that party then fails.
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
    const found = details.find(
      (one) =>
        typeof one?.party === 'string' &&
        one.party.startsWith(`${hint}::`) &&
        one.isLocal !== false,
    )
    if (found !== undefined) {
      return found.party
    }
    pageToken = result?.nextPageToken
    if (typeof pageToken !== 'string' || pageToken === '') {
      return undefined
    }
  }
  // Never "not allocated": the next step would allocate the hint again and the participant would
  // refuse a party it already hosts, naming nothing about the pages this stopped short of.
  throw new Error(`gave up looking for ${hint} after ${PARTY_PAGES} pages of parties`)
}

// Allocates the party if the participant does not already know it, and grants the
// authenticated user rights over it either way. That user is whoever the participant
// authenticated CANTON_BACKEND_TOKEN as, which is also the token the registry reads
// with, so this grant is what lets it read as the admin. Granting again is harmless
// and is what makes a re-run against a party from an earlier run complete.
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
  return { party, reused: existing !== undefined }
}

// Ask the participant which package it would pick for the name, so a stale id cannot silently
// produce an empty dashboard. Fails loudly with PACKAGE_NAMES_NOT_FOUND if the DAR is not deployed.
const resolvePackage = async (party, packageName = PACKAGE_NAME) => {
  const result = await ledger(
    'get',
    '/v2/interactive-submission/preferred-package-version',
    undefined,
    { 'package-name': packageName, parties: party },
  )
  const pkg = result?.packagePreference?.packageReference?.packageId
  if (typeof pkg !== 'string' || pkg.length === 0) {
    throw new Error(`participant returned no package id for ${packageName}`)
  }
  return pkg
}

// Read back from the ACS rather than out of the submission response, so this does not
// depend on where a given Canton version puts a create result in the envelope. The
// filter takes the package-name reference; the participant rejects a package id here.
const findInstrumentConfig = async (admin) => {
  const end = await ledger('get', '/v2/state/ledger-end')
  if (end?.offset === undefined) {
    throw new Error('participant returned no ledger-end offset')
  }
  const rows = await ledger('post', '/v2/state/active-contracts', {
    filter: {
      filtersByParty: {
        [admin]: {
          cumulative: [
            {
              identifierFilter: {
                TemplateFilter: {
                  value: {
                    templateId: REGISTRY_TEMPLATE_IDS.INSTRUMENT_CONFIG_TEMPLATE_ID,
                    includeCreatedEventBlob: false,
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
  const configs = (Array.isArray(rows) ? rows : [])
    .map((row) => row?.contractEntry?.JsActiveContract?.createdEvent)
    .filter((event) => event?.createArgument?.instrumentId === INSTRUMENT.instrumentId)
  // More than one is the state the registry cannot serve, since it scopes every route to its
  // admin and would find two configs for one instrument. None is an admin with nothing created
  // yet, which is the caller's cue to create it.
  if (configs.length > 1) {
    throw new Error(
      `expected at most one ${INSTRUMENT.instrumentId} InstrumentConfig for ${admin}, found ${configs.length}`,
    )
  }
  return configs[0]
}

// How the config on the ledger differs from what INSTRUMENT above asks for. The contract is
// admin-signed and created once, so an edit here reaches a ledger that already carries one only
// through a reset: creating a second is the state findInstrumentConfig refuses just above.
export const instrumentDrift = (createArgument) => {
  const arg = createArgument ?? {}
  const exactly = (found, wanted) => found === wanted
  // A Daml Decimal comes back padded to its full scale, so 1000.0 reads as 1000.0000000000.
  const sameNumber = (found, wanted) => Number(found) === Number(wanted)
  return [
    ['name', arg.name, INSTRUMENT.name, exactly],
    ['symbol', arg.symbol, INSTRUMENT.symbol, exactly],
    ['decimals', arg.decimals, String(INSTRUMENT.decimals), exactly],
    ['maxPerTap', arg.faucet?.maxPerTap, INSTRUMENT.maxPerTap, sameNumber],
  ]
    .filter(([, found, wanted, matches]) => !matches(found, wanted))
    .map(([field, found, wanted]) => `${field} is ${found}, this script asks for ${wanted}`)
}

// The operator's own factory, if this operator already signed one. Observer-less, so only the
// operator can see it, which is also why the dApp reads it back as the operator and not as a
// funder.
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
  return (Array.isArray(rows) ? rows : [])
    .map((row) => row?.contractEntry?.JsActiveContract)
    .find((entry) => entry?.createdEvent?.createdEventBlob !== undefined)
}

// The whole contract with scripts/dev-stack.sh, which reads these keys back off stdout. Both exits
// print it, because a reused deployment configures the registry exactly as a fresh one does.
const printRegistryEnv = (adminParty) => {
  console.log('\nregistry env')
  console.log(
    formatRegistryEnv({
      ledgerApiUrl: process.env.CANTON_JSON_API_URL || 'http://localhost:2975',
      adminParty,
      port: REGISTRY_PORT,
    }),
  )
}

const main = async () => {
  // Stable hints, and everything below is created only where it is missing. `dev-stack.sh up` runs
  // this on every start and the LocalNet's volumes outlive a `down`, so minting a fresh operator and
  // admin each time left every holding and every grant of the previous run on a ledger where
  // nothing in the dApp matches their (admin, instrumentId) any more: an empty dashboard, a zero
  // balance, and no error to read. A reset drops the parties with the ledger, so a genuinely fresh
  // stack still gets fresh ones.
  const { party: operator, reused: hadOperator } = await ensureParty('vesting-operator')
  console.log(`operator   ${operator}${hadOperator ? ' (existing)' : ''}`)

  const pkg = process.env.PKG ?? (await resolvePackage(operator))
  const factoryTid = `${pkg}:Vesting:VestingFactory`
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
    // Read back from the ACS rather than out of the submission response, so this does not depend
    // on where a given Canton version puts a create result in the envelope.
    active = await findFactory(operator)
  }
  if (active === undefined) {
    throw new Error('factory created but no createdEventBlob came back from the ACS read')
  }
  console.log(`factory    ${active.createdEvent.contractId}${hadFactory ? ' (existing)' : ''}`)
  // The filter above takes the package *name*, so a factory signed under a superseded version of it
  // is reused like any other, and the dApp takes its package id from this very contract.
  const factoryPkg = active.createdEvent.templateId?.split(':')[0]
  if (hadFactory && factoryPkg !== pkg) {
    console.warn(`warning:   that factory is on package ${factoryPkg}, not the preferred ${pkg}.`)
    console.warn('           The dApp follows the contract, so a newly deployed DAR takes effect')
    console.warn('           only after `canton-barebones reset`.')
  }

  // Preflight before the admin exists, so an undeployed vendor/canton-token-forge.dar fails
  // with PACKAGE_NAMES_NOT_FOUND rather than a raw create error and a stray party.
  await resolvePackage(operator, TOKEN_FORGE_PACKAGE)

  const { party: admin } = await ensureParty('instrument-admin')

  const existingConfig = await findInstrumentConfig(admin)
  if (existingConfig !== undefined) {
    console.log(`admin      ${admin}`)
    console.log(
      `instrument ${INSTRUMENT.instrumentId} (${INSTRUMENT.symbol}) ${existingConfig.contractId} (existing)`,
    )
    for (const line of instrumentDrift(existingConfig.createArgument)) {
      console.warn(`warning:   ${line}; reset the ledger to pick that up.`)
    }
    printRegistryEnv(admin)
    return
  }

  await ledger('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
    commandId: `instrument-config-${STAMP}`,
    actAs: [admin],
    readAs: [admin],
    commands: [
      {
        CreateCommand: {
          templateId: REGISTRY_TEMPLATE_IDS.INSTRUMENT_CONFIG_TEMPLATE_ID,
          createArguments: {
            admin,
            instrumentId: INSTRUMENT.instrumentId,
            name: INSTRUMENT.name,
            symbol: INSTRUMENT.symbol,
            // Int64 is encoded as a JSON string; a bare number is rejected.
            decimals: String(INSTRUMENT.decimals),
            faucet: { maxPerTap: INSTRUMENT.maxPerTap },
            meta: { values: {} },
          },
        },
      },
    ],
  })

  const created = await findInstrumentConfig(admin)
  if (created === undefined) {
    throw new Error(`created the ${INSTRUMENT.instrumentId} InstrumentConfig but it is not active`)
  }
  console.log(`admin      ${admin}`)
  console.log(`instrument ${INSTRUMENT.instrumentId} (${INSTRUMENT.symbol}) ${created.contractId}`)
  printRegistryEnv(admin)
}

// import.meta.main, not a comparison against argv[1]: the loader realpaths
// import.meta.filename while argv[1] keeps symlinks, so a symlinked path made the
// guard false and exited 0 having created nothing.
if (import.meta.main) {
  await main()
}
