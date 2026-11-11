// The JSON Ledger API as this example's scripts reach it, with the URL and the token from its .env.

try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  // No .env: the caller's environment is the whole configuration.
}

export const JSON_API_URL = process.env.CANTON_JSON_API_URL || 'http://localhost:2975'

// Checked on the first call rather than at import, so a test importing these modules runs in CI.
export const bearer = () => {
  const token = process.env.CANTON_BACKEND_TOKEN
  if (!token) {
    throw new Error('CANTON_BACKEND_TOKEN is required. Generate one with: pnpm run mint-token')
  }
  return `Bearer ${token}`
}

export const ledger = async (requestMethod, resource, body, query) => {
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
    body: JSON.stringify(body),
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

export const authenticatedUser = async () => {
  const userId = (await ledger('get', '/v2/authenticated-user'))?.user?.id
  if (typeof userId !== 'string' || userId === '') {
    throw new Error('the participant reported no authenticated user')
  }
  return userId
}

// A filter takes the package-name reference; given a resolved package id it reads empty in silence.
export const templateFilter = (templateId, includeCreatedEventBlob = false) => ({
  identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob } } },
})

export const interfaceFilter = (interfaceId) => ({
  identifierFilter: { InterfaceFilter: { value: { interfaceId, includeInterfaceView: true } } },
})

export const ledgerEnd = async () => {
  const end = await ledger('get', '/v2/state/ledger-end')
  if (end?.offset === undefined) {
    throw new Error('the participant returned no ledger-end offset')
  }
  return end.offset
}

export const activeContracts = async (party, filter, offset) => {
  const rows = await ledger('post', '/v2/state/active-contracts', {
    filter: { filtersByParty: { [party]: { cumulative: [filter] } } },
    activeAtOffset: offset ?? (await ledgerEnd()),
    verbose: true,
  })
  if (!Array.isArray(rows)) {
    throw new Error('the participant did not answer with a list of contracts')
  }
  return rows.map((row) => ({
    ...row?.contractEntry?.JsActiveContract?.createdEvent,
    synchronizerId: row?.contractEntry?.JsActiveContract?.synchronizerId,
  }))
}

export const submit = (commandId, actAs, commands, disclosedContracts = []) =>
  ledger('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
    commandId,
    actAs: [actAs],
    readAs: [actAs],
    commands,
    disclosedContracts,
  })
