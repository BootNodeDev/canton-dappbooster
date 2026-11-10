// A caller-exported value wins over the example's own `.env`, as in the scripts.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url))
} catch {
  // No .env: the caller's environment is the whole configuration.
}

// `.env` reads a key set to nothing as the empty string, which asks for the default.
const read = (key: string, fallback: string): string => {
  const value = process.env[key]
  return value === undefined || value === '' ? fallback : value
}

// A hosted validator issues its own tokens: setting any EXTERNAL_OAUTH_* key switches the server to
// fetching one by client-credentials grant (the names canton-wallet-service reads). LocalNet tokens
// are self-signed here instead.
const OAUTH_KEYS = [
  'EXTERNAL_OAUTH_TOKEN_URL',
  'EXTERNAL_OAUTH_CLIENT_ID',
  'EXTERNAL_OAUTH_CLIENT_SECRET',
  'EXTERNAL_OAUTH_SCOPE',
  'EXTERNAL_OAUTH_AUDIENCE',
]
const useOAuth = OAUTH_KEYS.some((key) => read(key, '') !== '')

// Missing on the OAuth path fails at startup, naming the key, rather than at the first ledger call.
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

// No LocalNet default stands in for a hosted validator's endpoints.
const endpoint = (key: string, local: string): string => (OAUTH ? required(key) : read(key, local))

export const JSON_API_URL = endpoint('CANTON_JSON_API_URL', 'http://localhost:2975')
export const SCAN_API_URL = endpoint('SPLICE_SCAN_API_URL', 'http://scan.localhost:4000/api/scan')

// LocalNet's self-signed token recipe; unused on the OAuth path.
export const AUTH_AUDIENCE = read('CANTON_AUTH_AUDIENCE', 'https://canton.network.global')
export const AUTH_SECRET = read('CANTON_AUTH_SECRET', 'unsafe')
export const ADMIN_TOKEN: string | undefined = process.env.CANTON_BACKEND_TOKEN || undefined
// The one participant user the server acts through: every signup's party is granted to it, and
// `pnpm run bootstrap` granted it the vesting operator. An OAuth client's tokens name it
// `<client id>@clients`.
export const ADMIN_USER = read(
  'WL_ADMIN_USER',
  OAUTH ? `${OAUTH.clientId}@clients` : 'ledger-api-user',
)

export const PORT = Number(read('WL_SERVER_PORT', '3040'))
// The Postgres `stack:up` starts from server/compose.yaml.
export const DATABASE_URL = read(
  'DATABASE_URL',
  'postgres://walletless:walletless@localhost:5433/walletless',
)
export const COOKIE_SECURE = read('WL_COOKIE_SECURE', 'false') === 'true'
