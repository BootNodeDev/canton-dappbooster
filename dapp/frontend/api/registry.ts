// An https page cannot reach the plain-http registry, but Node's fetch has no mixed-content policy.
// An allowlist rather than a blanket proxy: the registry is read-only, but republishing an unknown
// route on the product's own domain is a decision, not a default.

const ALLOWED = new Map([
  ['/registry/metadata/v1/info', 'GET'],
  ['/registry/metadata/v1/instruments', 'GET'],
  ['/registry/transfer-instruction/v1/transfer-factory', 'POST'],
])
// Allowlisted for the same reason the routes are: republishing an arbitrary parameter on the
// product's own domain is a decision. `pageToken` is what the instrument listing follows its pages
// with, so dropping the query strands every page past the first with no error to see.
const FORWARDED_PARAMS = ['pageToken']
const UPSTREAM_TIMEOUT_MS = 15_000

const fail = (message: string, status: number): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const forward = async (request: Request, body: string | undefined): Promise<Response> => {
  // A bracketed filename matches one segment, so vercel.json carries the real path as a parameter.
  const asked = new URL(request.url).searchParams
  const paths = asked.getAll('path')
  const path = paths.length === 1 ? paths[0] : undefined
  const method = request.method
  if (path === undefined) {
    return fail('Request did not carry exactly one path', 403)
  }
  // The method is part of the message because an allowed path reached by the wrong verb otherwise
  // reads as an unknown route.
  if (ALLOWED.get(path) !== method) {
    return fail(`Route not forwarded: ${method} ${path}`, 403)
  }

  // No default: localhost cannot be right in the only environment this file runs in. Trimmed like
  // the client's own base, since a trailing slash would request `//registry/...` and 404.
  const upstreamUrl = process.env.REGISTRY_URL?.replace(/\/+$/, '')
  if (!upstreamUrl) {
    return fail('REGISTRY_URL is not set on this deployment', 500)
  }

  const forwarded = new URLSearchParams()
  for (const name of FORWARDED_PARAMS) {
    const value = asked.get(name)
    if (value !== null) {
      forwarded.set(name, value)
    }
  }
  const query = forwarded.size === 0 ? '' : `?${forwarded}`

  let status: number
  let payload: string
  try {
    const upstream = await fetch(`${upstreamUrl}${path}${query}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    status = upstream.status
    payload = await upstream.text()
  } catch (error) {
    // A raw fetch error can name the registry's host, which an anonymous caller must not see.
    console.error(error)
    return fail('Upstream unreachable', 502)
  }

  // Built past the catch, and null for a status that refuses a body, so that a well-formed reply
  // cannot surface as an unreachable upstream. Content type pinned, not relayed: relaying would let
  // upstream serve markup from this product's own origin.
  return new Response(payload === '' ? null : payload, {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const GET = (request: Request): Promise<Response> => forward(request, undefined)

// Rebuilt rather than relayed, so nothing outside the parsed body reaches the registry.
export const POST = async (request: Request): Promise<Response> => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('Parse error', 400)
  }
  return forward(request, JSON.stringify(body))
}
