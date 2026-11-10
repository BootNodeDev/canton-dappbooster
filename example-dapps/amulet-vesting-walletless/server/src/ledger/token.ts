// Ledger API bearer tokens. LocalNet trusts HS256 tokens signed with a shared secret (the same scheme
// `scripts/mint-token.mjs` uses), so they are minted here; a hosted validator trusts only its IdP's,
// so those are fetched by client-credentials grant and kept until shortly before they expire.

import { createHmac } from 'node:crypto'
import {
  ADMIN_TOKEN,
  ADMIN_USER,
  AUTH_AUDIENCE,
  AUTH_SECRET,
  OAUTH,
  type OAuthConfig,
} from '#server/env'

// Short-lived, since one is minted per request anyway.
const LIFETIME_S = 300
// A fetched token is replaced this long before it expires, so none is sent on its last second.
const REFRESH_SKEW_MS = 60_000

const b64url = (input: string | Buffer): string => Buffer.from(input).toString('base64url')

export const mintToken = (
  subject: string,
  { audience = AUTH_AUDIENCE, secret = AUTH_SECRET, nowMs = Date.now() } = {},
): string => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { sub: subject, aud: audience, exp: Math.floor(nowMs / 1000) + LIFETIME_S }
  const encoded = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  return `${encoded}.${b64url(createHmac('sha256', secret).update(encoded).digest())}`
}

export const oauthToken = (
  config: OAuthConfig,
  { fetch: fetchFn = fetch, now = Date.now }: { fetch?: typeof fetch; now?: () => number } = {},
): (() => Promise<string>) => {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scope,
    // Omitted unless set: Auth0 needs it, providers that do not gate on `aud` reject an empty one.
    ...(config.audience === undefined ? {} : { audience: config.audience }),
  }).toString()
  let cached: { token: string; refreshAt: number } | undefined
  let inFlight: Promise<string> | undefined

  const request = async (): Promise<string> => {
    const requestedAt = now()
    const response = await fetchFn(config.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`the token request failed (${response.status}): ${text.slice(0, 200)}`)
    }
    let parsed: { access_token?: unknown; expires_in?: unknown }
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('the token response was not JSON')
    }
    const { access_token: token, expires_in: expiresIn } = parsed
    if (typeof token !== 'string' || token === '') {
      throw new Error('the token response carried no access_token')
    }
    if (typeof expiresIn !== 'number' || expiresIn <= 0) {
      throw new Error('the token response carried no positive expires_in')
    }
    const lifetimeMs = expiresIn * 1000
    // Never past half the lifetime, or a short-lived token would be fetched on every call.
    cached = {
      token,
      refreshAt: requestedAt + lifetimeMs - Math.min(REFRESH_SKEW_MS, lifetimeMs / 2),
    }
    return token
  }

  return async () => {
    if (cached !== undefined && now() < cached.refreshAt) return cached.token
    // A burst arriving on an expired token makes one request, not one per caller.
    inFlight ??= request().finally(() => {
      inFlight = undefined
    })
    return inFlight
  }
}

// A token pasted into `.env` wins on LocalNet, so a participant whose admin is not
// `ledger-api-user` still works.
export const adminToken: () => string | Promise<string> = OAUTH
  ? oauthToken(OAUTH)
  : () => ADMIN_TOKEN ?? mintToken(ADMIN_USER)
