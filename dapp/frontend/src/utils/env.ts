export interface Env {
  VITE_EXPLORER_URL: string
  VITE_WALLET_RPC_URL: string
}

const DEFAULTS: Env = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_WALLET_RPC_URL: 'http://localhost:3010/rpc',
}

const isHttpUrl = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

const ORIGIN = 'https://same.origin.invalid'
const isSameOriginPath = (value: string): boolean =>
  value.startsWith('/') && new URL(value, ORIGIN).origin === ORIGIN

const isRpcUrl = (value: string): boolean => isSameOriginPath(value) || isHttpUrl(value)

// Reads one env key and validates it
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

// Validates the build's environment
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
