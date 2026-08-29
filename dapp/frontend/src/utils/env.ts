// The local Splice Scan, so the app runs from a fresh clone with no `.env`.
const DEFAULT_EXPLORER_URL = 'http://scan.localhost:4000'
// The local wallet-service, same reason. A deployed build points this at `/api/rpc` instead.
const DEFAULT_WALLET_RPC_URL = 'http://localhost:3010/rpc'

export interface Env {
  VITE_EXPLORER_URL: string
  VITE_WALLET_RPC_URL: string
}

// The value lands in an `href`, where `javascript:` would be a script sink.
const isHttpUrl = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

// A deployed build reaches wallet-service through the same-origin `/api/rpc` function, which `fetch`
// resolves against the page and `new URL` cannot parse. `//host` is excluded: it looks like a path
// and is a protocol-relative url to somebody else's origin.
const isRpcUrl = (value: string): boolean =>
  (value.startsWith('/') && !value.startsWith('//')) || isHttpUrl(value)

// Validates the build's environment. Takes the source rather than reading `import.meta.env` so it
// stays testable; `vite.config.ts` runs it once per build and defines the result back.
export const parseEnv = (source: unknown): Env => {
  if (typeof source !== 'object' || source === null) {
    throw new Error('Invalid environment: expected the variables as an object')
  }

  // Absent is the zero-config case. A declared but blank value is a mistake, not a request for the
  // default, so it falls through to the checks below.
  const values = source as Record<string, unknown>
  const explorerUrl = values.VITE_EXPLORER_URL ?? DEFAULT_EXPLORER_URL
  const walletRpcUrl = values.VITE_WALLET_RPC_URL ?? DEFAULT_WALLET_RPC_URL

  if (typeof explorerUrl !== 'string' || !isHttpUrl(explorerUrl)) {
    throw new Error(
      `Invalid environment: VITE_EXPLORER_URL must be an http(s) url, e.g. ${DEFAULT_EXPLORER_URL}`,
    )
  }

  if (typeof walletRpcUrl !== 'string' || !isRpcUrl(walletRpcUrl)) {
    throw new Error(
      `Invalid environment: VITE_WALLET_RPC_URL must be an http(s) url or a same-origin path, e.g. ${DEFAULT_WALLET_RPC_URL}`,
    )
  }

  return { VITE_EXPLORER_URL: explorerUrl, VITE_WALLET_RPC_URL: walletRpcUrl }
}
