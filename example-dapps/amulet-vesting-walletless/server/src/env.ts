try {
  process.loadEnvFile(new URL('../../.env', import.meta.url))
} catch {
  // No .env: the caller's environment is the whole configuration.
}

const read = (key: string, fallback: string): string => {
  const value = process.env[key]
  return value === undefined || value === '' ? fallback : value
}

const OAUTH_KEYS = [
  'EXTERNAL_OAUTH_TOKEN_URL',
  'EXTERNAL_OAUTH_CLIENT_ID',
  'EXTERNAL_OAUTH_CLIENT_SECRET',
  'EXTERNAL_OAUTH_SCOPE',
  'EXTERNAL_OAUTH_AUDIENCE',
]
const useOAuth = OAUTH_KEYS.some((key) => read(key, '') !== '')

const required = (key: string): string => {
  const value = read(key, '')
  if (value === '') throw new Error(`${key} is required once EXTERNAL_OAUTH_* is set`)
  return value
}

export type OAuthConfig = {
  audience: string | undefined
  clientId: string
  clientSecret: string
  scope: string
  tokenUrl: string
}

export const OAUTH: OAuthConfig | undefined = useOAuth
  ? {
      audience: read('EXTERNAL_OAUTH_AUDIENCE', '') || undefined,
      clientId: required('EXTERNAL_OAUTH_CLIENT_ID'),
      clientSecret: required('EXTERNAL_OAUTH_CLIENT_SECRET'),
      scope: read('EXTERNAL_OAUTH_SCOPE', 'daml_ledger_api'),
      tokenUrl: required('EXTERNAL_OAUTH_TOKEN_URL'),
    }
  : undefined

const endpoint = (key: string, local: string): string => (OAUTH ? required(key) : read(key, local))

export const JSON_API_URL = endpoint('CANTON_JSON_API_URL', 'http://localhost:2975')
export const SCAN_API_URL = endpoint('SPLICE_SCAN_API_URL', 'http://scan.localhost:4000/api/scan')

export const AUTH_AUDIENCE = read('CANTON_AUTH_AUDIENCE', 'https://canton.network.global')
export const AUTH_SECRET = read('CANTON_AUTH_SECRET', 'unsafe')
export const ADMIN_TOKEN: string | undefined = process.env.CANTON_BACKEND_TOKEN || undefined
// An OAuth client's tokens name their user `<client id>@clients`.
export const ADMIN_USER = read(
  'WL_ADMIN_USER',
  OAUTH ? `${OAUTH.clientId}@clients` : 'ledger-api-user',
)

export const PORT = Number(read('WL_SERVER_PORT', '3040'))
export const DATABASE_URL = read(
  'DATABASE_URL',
  'postgres://walletless:walletless@localhost:5433/walletless',
)
export const COOKIE_SECURE = read('WL_COOKIE_SECURE', 'false') === 'true'
