export interface Env {
  VITE_EXPLORER_URL: string
  VITE_NETWORK_ID: string
  VITE_SCAN_API_URL: string
  VITE_WALLET_CONNECT_PROJECT_ID: string
  VITE_WALLET_GATEWAY_URL: string
}

const DEFAULTS: Env = {
  VITE_EXPLORER_URL: 'http://scan.localhost:4000',
  VITE_NETWORK_ID: 'canton:local',
  VITE_SCAN_API_URL: 'http://scan.localhost:4000/api/scan',
  VITE_WALLET_CONNECT_PROJECT_ID: '',
  VITE_WALLET_GATEWAY_URL: 'http://localhost:3030/api/v0/dapp',
}

const isHttpUrl = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

const isCantonChainId = (value: string): boolean => /^canton:[-_a-zA-Z0-9]{1,32}$/.test(value)

const isProjectIdOrEmpty = (value: string): boolean => /^([0-9a-f]{32})?$/.test(value)

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
    VITE_NETWORK_ID: read(values, 'VITE_NETWORK_ID', isCantonChainId, 'a canton CAIP-2 chain id'),
    VITE_SCAN_API_URL: read(values, 'VITE_SCAN_API_URL', isHttpUrl, 'an http(s) url'),
    VITE_WALLET_CONNECT_PROJECT_ID: read(
      values,
      'VITE_WALLET_CONNECT_PROJECT_ID',
      isProjectIdOrEmpty,
      'empty or a 32-character Reown project id',
    ),
    VITE_WALLET_GATEWAY_URL: read(values, 'VITE_WALLET_GATEWAY_URL', isHttpUrl, 'an http(s) url'),
  }
}
