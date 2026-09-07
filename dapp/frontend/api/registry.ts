// An https page cannot reach the plain-http registry, but Node's fetch has no mixed-content policy.
// An allowlist rather than a blanket proxy: the registry is read-only, but republishing an unknown
// route on the product's own domain is a decision, not a default.

const ALLOWED = new Map([
  ['/registry/metadata/v1/info', 'GET'],
  ['/registry/metadata/v1/instruments', 'GET'],
  ['/registry/transfer-instruction/v1/transfer-factory', 'POST'],
])
const UPSTREAM_TIMEOUT_MS = 15_000

const fail = (message: string, status: number): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const forward = async (request: Request, body: string | undefined): Promise<Response> => {
  // A bracketed filename matches one segment, so vercel.json carries the real path as a parameter.
  const paths = new URL(request.url).searchParams.getAll('path')
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

  let status: number
  let payload: string
  try {
    // The request's own query is dropped rather than forwarded: no listed route is paged today,
    // and republishing arbitrary parameters is the same decision as republishing a route.
    const upstream = await fetch(`${upstreamUrl}${path}`, {
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
