// Mock ProviderAdapter — lets a dApp or test connect with no real wallet installed.
// Only the connect flow is answered; everything else throws rather than fake a result.

import type {
  dappAPI,
  ProviderAdapter,
  ProviderId,
  ProviderType,
  WalletInfo,
} from '@canton-network/dapp-sdk'

// Derived from ProviderAdapter/dappAPI so this file stays on the one dapp-sdk dependency.
type MockProvider = ReturnType<ProviderAdapter['provider']>
type RequestArg = Parameters<MockProvider['request']>[0]
type RequestResult = Awaited<ReturnType<MockProvider['request']>>
type Listener = Parameters<MockProvider['on']>[1]
type Wallet = dappAPI.Wallet

/** A single account the mock adapter reports from `listAccounts`. */
export interface MockAccount {
  partyId: string
  name?: string
  publicKey?: string
}

/** Options for `createMockAdapter`. */
export interface CreateMockAdapterOptions {
  /** Provider id used in the picker and for `createAutoPicker` selection. Defaults to `'mock'`. */
  id?: string
  /** Accounts reported from `listAccounts`, first entry primary. Defaults to a single generated account. */
  accounts?: MockAccount[]
  /** Network id reported by the mock's accounts. Omit to let `CantonConnectConfig.networkId` apply instead. */
  networkId?: string
}

/**
 * A `ProviderAdapter` that answers the connect flow with canned data — see
 * `createMockAdapter`.
 */
export interface MockAdapter extends ProviderAdapter {
  /** Simulates the wallet pushing `event` (e.g. `'statusChanged'`) to whatever subscribed via `provider().on(...)`. */
  emit: (event: string, payload: unknown) => void
}

const DEFAULT_PROVIDER_ID: ProviderId = 'mock'
const DEFAULT_NAME = 'Mock Wallet'
const DEFAULT_DESCRIPTION = 'Mock wallet for dev and tests — no real signing, never a live wallet'

// Wallet requires status/signingProviderId; neither has a real mock equivalent.
const MOCK_WALLET_STATUS: dappAPI.WalletStatus = 'allocated'
const MOCK_SIGNING_PROVIDER_ID: dappAPI.SigningProviderId = 'mock'
// Obviously fake, not '' — a presence check downstream shouldn't mistake this for real.
const MOCK_PUBLIC_KEY: dappAPI.PublicKey = 'mock-public-key'

const defaultAccounts = (providerId: ProviderId): MockAccount[] => [
  { partyId: `${providerId}::1220abcd` },
]

const toWallet = (
  account: MockAccount,
  primary: dappAPI.Primary,
  networkId: dappAPI.NetworkId | undefined,
): Wallet =>
  ({
    primary,
    partyId: account.partyId,
    status: MOCK_WALLET_STATUS,
    hint: account.name ?? account.partyId,
    publicKey: account.publicKey ?? MOCK_PUBLIC_KEY,
    // namespace is the partyId's fingerprint segment — the real party-hint::fingerprint convention.
    namespace: account.partyId.split('::')[1] ?? account.partyId,
    signingProviderId: MOCK_SIGNING_PROVIDER_ID,
    // A mock has no network of its own — omitting this lets toParty's config fallback apply.
    ...(networkId === undefined ? {} : { networkId }),
  }) as Wallet

class MockProviderAdapter implements ProviderAdapter {
  readonly providerId: ProviderId
  readonly name = DEFAULT_NAME
  readonly type: ProviderType = 'browser'

  private readonly wallets: Wallet[]
  private connected = false
  private listenerMap: Record<string, Listener[]> = {}

  constructor(options: CreateMockAdapterOptions) {
    this.providerId = options.id ?? DEFAULT_PROVIDER_ID

    const accounts = options.accounts ?? defaultAccounts(this.providerId)
    this.wallets = accounts.map((account, index) =>
      toWallet(account, index === 0, options.networkId),
    )
  }

  // Name and description both say "mock" so the picker never reads as a real wallet.
  getInfo(): WalletInfo {
    return {
      providerId: this.providerId,
      name: this.name,
      type: this.type,
      description: DEFAULT_DESCRIPTION,
    }
  }

  async detect(): Promise<boolean> {
    return true
  }

  provider(): MockProvider {
    return this
  }

  teardown(): void {}

  // Connect flow only — a canned execute/sign result would read as real; see createFakeWallet.
  private readonly handlers: Partial<Record<RequestArg['method'], () => RequestResult>> = {
    connect: () => {
      this.connected = true
      return { isConnected: true, isNetworkConnected: true }
    },
    disconnect: () => {
      this.connected = false
      return null
    },
    status: () => ({
      provider: { id: this.providerId, providerType: this.type },
      connection: { isConnected: this.connected, isNetworkConnected: true },
    }),
    listAccounts: () => this.wallets,
  }

  async request(args: RequestArg): Promise<RequestResult> {
    const handler = this.handlers[args.method]

    if (handler === undefined) {
      throw new Error(`mock adapter does not implement '${args.method}'`)
    }

    return handler()
  }

  // Listener is EventListener<unknown> — the same erased storage type AbstractProvider uses.
  on: MockProvider['on'] = (event, listener) => {
    const listeners = this.listenerMap[event] ?? []
    listeners.push(listener as Listener)
    this.listenerMap[event] = listeners

    return this
  }

  emit: MockProvider['emit'] = (event, ...args) => {
    for (const listener of this.listenerMap[event] ?? []) {
      listener(...args)
    }

    return true
  }

  removeListener: MockProvider['removeListener'] = (event, listenerToRemove) => {
    this.listenerMap[event] = (this.listenerMap[event] ?? []).filter(
      (listener) => listener !== listenerToRemove,
    )

    return this
  }
}

/**
 * Creates a `ProviderAdapter` that answers the connect flow (`connect`,
 * `status`, `listAccounts`, `disconnect`) with configured or default data —
 * enough to drive `CantonConnectProvider` with no real wallet installed. Pass
 * it via `CantonConnectConfig.additionalAdapters`.
 *
 * Everything outside that flow (`prepareExecute`, `signMessage`, `ledgerApi`,
 * etc.) throws naming the method, on purpose: a canned execute or sign
 * result would be indistinguishable from a real one.
 */
export const createMockAdapter = (options: CreateMockAdapterOptions = {}): MockAdapter =>
  new MockProviderAdapter(options)
