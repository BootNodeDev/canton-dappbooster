export interface Env {
  VITE_EXPLORER_URL: string
  VITE_SCAN_API_URL: string
  VITE_WALLET_GATEWAY_URL: string
}

const DEFAULTS: Env = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_SCAN_API_URL: 'http://scan.localhost:4000/api/scan',
  VITE_WALLET_GATEWAY_URL: 'http://localhost:3030/api/v0/dapp',
}

const isHttpUrl = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

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

export const parseEnv = (source: unknown): Env => {
  if (typeof source !== 'object' || source === null) {
    throw new Error('Invalid environment: expected the variables as an object')
  }
  const values = source as Record<string, unknown>

  return {
    VITE_EXPLORER_URL: read(values, 'VITE_EXPLORER_URL', isHttpUrl, 'an http(s) url'),
    VITE_SCAN_API_URL: read(values, 'VITE_SCAN_API_URL', isHttpUrl, 'an http(s) url'),
    VITE_WALLET_GATEWAY_URL: read(values, 'VITE_WALLET_GATEWAY_URL', isHttpUrl, 'an http(s) url'),
  }
}
