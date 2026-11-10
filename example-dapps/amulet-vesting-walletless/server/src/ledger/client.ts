import { randomUUID } from 'node:crypto'
import { JSON_API_URL } from '#server/env'
import type { ExecuteParams, LedgerApiParams, WalletFns } from '#server/ledger/wallet'

type ClientOptions = {
  baseUrl?: string
  fetch?: typeof fetch
  token: () => string | Promise<string>
  userId?: string
}

const TIMEOUT_MS = 30_000

const failure = (params: LedgerApiParams, status: number, text: string): Error => {
  let reason = text.slice(0, 400)
  try {
    const body = JSON.parse(text) as { cause?: unknown }
    if (typeof body.cause === 'string') reason = body.cause
  } catch {
    // Not JSON: keep the raw text.
  }
  return new Error(
    `${params.requestMethod.toUpperCase()} ${params.resource} failed (${status}): ${reason}`,
  )
}

export const urlFor = (baseUrl: string, params: LedgerApiParams): URL => {
  const resource = params.resource.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params.path?.[name]
    if (value === undefined) {
      throw new Error(`${params.resource} needs a value for {${name}}`)
    }
    return encodeURIComponent(value)
  })
  const url = new URL(baseUrl.replace(/\/$/, '') + resource)
  for (const [key, value] of Object.entries(params.query ?? {})) {
    url.searchParams.set(key, String(value))
  }
  return url
}

export const ledgerClient = ({
  baseUrl = JSON_API_URL,
  fetch: fetchFn = fetch,
  token,
  userId,
}: ClientOptions): WalletFns => {
  const ledgerApi = async (params: LedgerApiParams): Promise<unknown> => {
    const bearer = await token()
    const response = await fetchFn(urlFor(baseUrl, params), {
      method: params.requestMethod.toUpperCase(),
      headers: {
        authorization: `Bearer ${bearer}`,
        ...(params.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(params.body === undefined ? {} : { body: JSON.stringify(params.body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((error: unknown) => {
      // Undici's own message is only "fetch failed"; the reason is on its cause.
      const cause = (error as { cause?: { code?: string } }).cause?.code
      throw new Error(
        `the ledger at ${baseUrl} is unreachable${cause === undefined ? '' : ` (${cause})`}`,
      )
    })
    const text = await response.text()
    // Status before parse: an error page would otherwise surface as a JSON syntax error.
    if (!response.ok) {
      throw failure(params, response.status, text)
    }
    return text === '' ? {} : JSON.parse(text)
  }

  const execute = (params: ExecuteParams): Promise<unknown> => {
    if (userId === undefined) {
      throw new Error('this ledger client has no user to submit as')
    }
    return ledgerApi({
      requestMethod: 'post',
      resource: '/v2/commands/submit-and-wait',
      // The participant requires `userId` to match the token's user.
      body: { ...params, commandId: randomUUID(), userId },
    })
  }

  return { execute, ledgerApi }
}
