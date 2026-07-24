export const CANTON_METHOD_CONNECT = 'connect'
export const CANTON_METHOD_DISCONNECT = 'disconnect'
export const CANTON_METHOD_IS_CONNECTED = 'isConnected'
export const CANTON_METHOD_PREPARE_EXECUTE = 'prepareExecute'
export const CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT = 'prepareExecuteAndWait'
export const CANTON_METHOD_LIST_ACCOUNTS = 'listAccounts'
export const CANTON_METHOD_GET_PRIMARY_ACCOUNT = 'getPrimaryAccount'
export const CANTON_METHOD_GET_ACTIVE_NETWORK = 'getActiveNetwork'
export const CANTON_METHOD_STATUS = 'status'
export const CANTON_METHOD_LEDGER_API = 'ledgerApi'
export const CANTON_METHOD_SIGN_MESSAGE = 'signMessage'

export const LEGACY_CANTON_METHOD_PREPARE_SIGN_EXECUTE = 'canton_prepareSignExecute'

export type PendingApprovalMethod =
  | typeof CANTON_METHOD_SIGN_MESSAGE
  | typeof CANTON_METHOD_PREPARE_EXECUTE
  | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT

export const normalizeMethod = (method: string): string => {
  if (!method.startsWith('canton_')) {
    return method
  }
  const raw = method.slice('canton_'.length)
  const normalized = `${raw.charAt(0).toLowerCase()}${raw.slice(1)}`
  return normalized === 'prepareSignExecute' ? CANTON_METHOD_PREPARE_EXECUTE : normalized
}

export const isExecuteApprovalMethod = (
  method: string,
): method is typeof CANTON_METHOD_PREPARE_EXECUTE | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT =>
  method === CANTON_METHOD_PREPARE_EXECUTE || method === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT

export const pendingApprovalMethod = (
  rawMethod: string,
  normalizedMethod:
    | typeof CANTON_METHOD_PREPARE_EXECUTE
    | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
): typeof CANTON_METHOD_PREPARE_EXECUTE | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT =>
  rawMethod === LEGACY_CANTON_METHOD_PREPARE_SIGN_EXECUTE
    ? CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT
    : normalizedMethod

// Access tier decides what an injected-provider origin may do BEFORE the user has
// approved it (enforced in extension/directProvider.ts). Classification lives next to
// the method definitions so a newly added method cannot silently bypass the gate.
export const ACCESS_TIER = {
  // Discloses no account identity; answerable to any origin.
  PUBLIC: 'public',
  // Account queries; an unapproved origin gets an empty / disconnected view.
  IDENTITY: 'identity',
  // The connection grant itself; an unapproved origin is queued for user approval.
  CONNECT: 'connect',
  // Requires an approved origin; refused otherwise. The default for unknown methods.
  RESTRICTED: 'restricted',
} as const

export type AccessTier = (typeof ACCESS_TIER)[keyof typeof ACCESS_TIER]

type CantonMethod =
  | typeof CANTON_METHOD_CONNECT
  | typeof CANTON_METHOD_DISCONNECT
  | typeof CANTON_METHOD_IS_CONNECTED
  | typeof CANTON_METHOD_PREPARE_EXECUTE
  | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT
  | typeof CANTON_METHOD_LIST_ACCOUNTS
  | typeof CANTON_METHOD_GET_PRIMARY_ACCOUNT
  | typeof CANTON_METHOD_GET_ACTIVE_NETWORK
  | typeof CANTON_METHOD_STATUS
  | typeof CANTON_METHOD_LEDGER_API
  | typeof CANTON_METHOD_SIGN_MESSAGE

// `satisfies` forces every known method to be classified; omit one and this fails to compile.
const METHOD_ACCESS_TIERS = {
  [CANTON_METHOD_GET_ACTIVE_NETWORK]: ACCESS_TIER.PUBLIC,
  [CANTON_METHOD_DISCONNECT]: ACCESS_TIER.PUBLIC,
  [CANTON_METHOD_CONNECT]: ACCESS_TIER.CONNECT,
  [CANTON_METHOD_IS_CONNECTED]: ACCESS_TIER.IDENTITY,
  [CANTON_METHOD_LIST_ACCOUNTS]: ACCESS_TIER.IDENTITY,
  [CANTON_METHOD_GET_PRIMARY_ACCOUNT]: ACCESS_TIER.IDENTITY,
  [CANTON_METHOD_STATUS]: ACCESS_TIER.IDENTITY,
  [CANTON_METHOD_PREPARE_EXECUTE]: ACCESS_TIER.RESTRICTED,
  [CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT]: ACCESS_TIER.RESTRICTED,
  [CANTON_METHOD_LEDGER_API]: ACCESS_TIER.RESTRICTED,
  [CANTON_METHOD_SIGN_MESSAGE]: ACCESS_TIER.RESTRICTED,
} satisfies Record<CantonMethod, AccessTier>

// Fail safe: an unrecognized method is treated as restricted.
export const accessTier = (method: string): AccessTier =>
  (METHOD_ACCESS_TIERS as Record<string, AccessTier>)[normalizeMethod(method)] ??
  ACCESS_TIER.RESTRICTED
