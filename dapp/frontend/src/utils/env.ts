export interface Env {
  VITE_EXPLORER_URL: string
  VITE_WALLET_RPC_URL: string
}

// Both name the local stack, so the app runs from a fresh clone with no `.env`.
const DEFAULTS: Env = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_WALLET_RPC_URL: 'http://localhost:3010/rpc',
}

// The explorer value lands in an `href`, where `javascript:` would be a script sink.
const isHttpUrl = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

// A deployed build reaches wallet-service through the same-origin `/api/rpc` function, which `fetch`
// resolves against the page and `new URL` cannot parse alone. The resolver is asked rather than the
// prefix tested, because `//host`, `/\host` and `/<tab>/host` all read as paths and all leave.
const ORIGIN = 'https://same.origin.invalid'
const isSameOriginPath = (value: string): boolean =>
  value.startsWith('/') && new URL(value, ORIGIN).origin === ORIGIN

const isRpcUrl = (value: string): boolean => isSameOriginPath(value) || isHttpUrl(value)

// Absent is the zero-config case. A declared but blank value is a mistake, not a request for the
// default, so it falls through to the check rather than round-tripping.
const read = (
  values: Record<string, unknown>,
  key: keyof Env,
  accepts: (value: string) => boolean,
  expected: string,
): string => {
  const value = values[key] ?? DEFAULTS[key]
  if (typeof value !== 'string' || !accepts(value)) {
    throw new Error(`Invalid environment: ${key} must be ${expected}, e.g. ${DEFAULTS[key]}`)
  }
  return value
}

// Validates the build's environment. Takes the source rather than reading `import.meta.env` so it
// stays testable; `vite.config.ts` runs it once per build and defines the result back.
export const parseEnv = (source: unknown): Env => {
  if (typeof source !== 'object' || source === null) {
    throw new Error('Invalid environment: expected the variables as an object')
  }
  const values = source as Record<string, unknown>

  return {
    VITE_EXPLORER_URL: read(values, 'VITE_EXPLORER_URL', isHttpUrl, 'an http(s) url'),
    VITE_WALLET_RPC_URL: read(
      values,
      'VITE_WALLET_RPC_URL',
      isRpcUrl,
      'an http(s) url or a same-origin path',
    ),
  }
}
