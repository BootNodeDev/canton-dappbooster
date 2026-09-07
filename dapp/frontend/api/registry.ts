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
  if (path === undefined || ALLOWED.get(path) !== method) {
    return fail(`Route not forwarded: ${path}`, 403)
  }

  // No default: localhost cannot be right in the only environment this file runs in.
  const upstreamUrl = process.env.REGISTRY_URL
  if (!upstreamUrl) {
    return fail('REGISTRY_URL is not set on this deployment', 500)
  }

  try {
    const upstream = await fetch(`${upstreamUrl}${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    // Pinned, not relayed: relaying would let upstream serve markup from this product's own origin.
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    // A raw fetch error can name the registry's host, which an anonymous caller must not see.
    console.error(error)
    return fail('Upstream unreachable', 502)
  }
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
