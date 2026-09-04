import {
  CANTON_ANNOUNCE_PROVIDER_EVENT,
  CANTON_REQUEST_PROVIDER_EVENT,
  WalletEvent,
} from '@canton-network/core-types'
import type { ConnectResult, StatusEvent, Wallet } from '@canton-network/dapp-sdk'
import { PARTICIPANT_ID_RESOURCE } from '#src/walletAccount'

const JSON_RPC_METHOD_NOT_FOUND = -32601

// Obviously fake, not '': a presence check downstream shouldn't mistake these for real.
const FAKE_PUBLIC_KEY = 'fake-public-key'
const FAKE_SIGNING_PROVIDER_ID = 'fake'
const FAKE_NETWORK_ID = 'canton:local'
// 'allocated' is the only status holding ledger rights, so it is what a usable account reports.
const FAKE_WALLET_STATUS: Wallet['status'] = 'allocated'

/**
 * One account the fake wallet reports from `listAccounts`. Mark exactly one `primary`: that is the
 * entry `selectPrimaryAccount` resolves to `Party`.
 *
 * @category Utilities
 */
export interface FakeWalletAccount {
  partyId: string
  primary?: boolean
  name?: string
  publicKey?: string
  networkId?: string
  signingProviderId?: string
}

// Reports a network the way a real wallet does; toParty's config fallback is covered by
// createMockAdapter, which legitimately has none.
/** Shapes one `FakeWalletAccount` into the `Wallet` object `listAccounts` reports. */
const toWallet = (account: FakeWalletAccount): Wallet => ({
  primary: account.primary === true,
  partyId: account.partyId,
  status: FAKE_WALLET_STATUS,
  hint: account.name ?? account.partyId,
  publicKey: account.publicKey ?? FAKE_PUBLIC_KEY,
  namespace: account.partyId.split('::')[1] ?? account.partyId,
  networkId: account.networkId ?? FAKE_NETWORK_ID,
  signingProviderId: account.signingProviderId ?? FAKE_SIGNING_PROVIDER_ID,
})

/**
 * Wiring for {@link createFakeWallet}. `id` is announced to `window` and doubles as the postMessage
 * target and display name unless `target` or `name` override it; `accounts` defaults to one with
 * `id` as its party prefix. `statusResponses` is `isConnected` per successive `status` call, last
 * entry repeating; omitting `participantId` fails the participant-id read, leaving `'unknown'`.
 *
 * @example
 * const options: FakeWalletOptions = { id: 'mock', statusResponses: [true, false] }
 *
 * @category Utilities
 */
export interface FakeWalletOptions {
  id: string
  name?: string
  target?: string
  accounts?: FakeWalletAccount[]
  statusResponses?: boolean[]
  participantId?: string
}

/**
 * Handles on a running fake wallet: `announce` re-announces it as if the extension had just loaded,
 * `push` sends an unsolicited notification the way a real one does (`'statusChanged'`, say), and
 * `dispose` removes the `window` listeners it installed, which every test must do in teardown.
 *
 * @category Utilities
 */
export interface FakeWallet {
  announce: () => void
  push: (method: string, params: unknown) => void
  dispose: () => void
}

/** A postMessage payload off `window`, before it is checked for being one of ours. */
interface IncomingMessage {
  type?: string
  request?: { id?: string | number | null; method?: string; params?: unknown }
  target?: string
}

/**
 * A fake CIP-0103 extension wallet for tests. It speaks the real postMessage protocol, so it
 * exercises the SDK's genuine `ExtensionAdapter` rather than a stub. Answers `connect`, `status`,
 * `listAccounts` and `disconnect`; anything else rejects naming the method. Reach for
 * `createMockAdapter` instead where the transport is not what is under test.
 *
 * @example
 * const wallet = createFakeWallet({ id: 'mock' })
 * wallet.push('statusChanged', { connection: { isConnected: false } })
 * wallet.dispose()
 *
 * @category Utilities
 */
export const createFakeWallet = (options: FakeWalletOptions): FakeWallet => {
  const target = options.target ?? options.id
  const accounts = options.accounts ?? [{ partyId: `${options.id}::1220abcd`, primary: true }]
  let statusCallCount = 0

  const announce = (): void => {
    window.dispatchEvent(
      new CustomEvent(CANTON_ANNOUNCE_PROVIDER_EVENT, {
        detail: { id: options.id, name: options.name ?? options.id, target },
      }),
    )
  }

  const nextStatusIsConnected = (): boolean => {
    const responses = options.statusResponses
    if (responses === undefined || responses.length === 0) {
      return true
    }
    const index = Math.min(statusCallCount, responses.length - 1)
    statusCallCount += 1
    return responses[index]
  }

  const buildStatus = (): StatusEvent => ({
    provider: { id: options.id, providerType: 'browser' },
    connection: { isConnected: nextStatusIsConnected(), isNetworkConnected: true },
  })

  const buildConnect = (): ConnectResult => ({ isConnected: true, isNetworkConnected: true })

  // Thunks, not eager values — calling other methods must not advance the statusResponses sequence.
  const responses: Record<string, () => unknown> = {
    status: buildStatus,
    connect: buildConnect,
    listAccounts: () => accounts.map(toWallet),
    // The SDK's disconnect() asks the wallet too, and ignores what comes back.
    disconnect: () => ({}),
  }

  const notImplemented = (what: string): Record<string, unknown> => ({
    error: {
      code: JSON_RPC_METHOD_NOT_FOUND,
      message: `createFakeWallet does not implement ${what}`,
    },
  })

  // The one ledger read the connect flow makes; anything else is refused like an unknown method.
  const answerLedgerApi = (params: unknown): Record<string, unknown> => {
    const { requestMethod, resource } = (params ?? {}) as {
      requestMethod?: string
      resource?: string
    }
    const isParticipantIdRead = requestMethod === 'get' && resource === PARTICIPANT_ID_RESOURCE

    if (options.participantId === undefined || !isParticipantIdRead) {
      return notImplemented(`"ledgerApi" for ${resource}`)
    }

    return { result: { participantId: options.participantId } }
  }

  // An error frame, not a throw: the transport only settles on a response, so throwing here would
  // leave the caller's request pending forever.
  const answer = (method: string, params: unknown): Record<string, unknown> => {
    if (method === 'ledgerApi') {
      return answerLedgerApi(params)
    }

    const handler = responses[method]
    if (handler === undefined) {
      return notImplemented(`"${method}"`)
    }

    return { result: handler() }
  }

  const onMessage = (event: MessageEvent): void => {
    const data = event.data as IncomingMessage | undefined

    if (data?.type === undefined) {
      return
    }

    if (data.target !== undefined && data.target !== target) {
      return
    }

    if (data.type === WalletEvent.SPLICE_WALLET_EXT_READY) {
      window.postMessage({ type: WalletEvent.SPLICE_WALLET_EXT_ACK, target }, '*')
      return
    }

    const requestId = data.request?.id
    const isRequest =
      data.type === WalletEvent.SPLICE_WALLET_REQUEST &&
      requestId !== undefined &&
      requestId !== null

    if (!isRequest) {
      return
    }

    const method = data.request?.method ?? ''

    // No `target`: the real submitResponse frame doesn't carry one either.
    window.postMessage(
      {
        type: WalletEvent.SPLICE_WALLET_RESPONSE,
        response: { jsonrpc: '2.0', id: requestId, ...answer(method, data.request?.params) },
      },
      '*',
    )
  }

  const push = (method: string, params: unknown): void => {
    // No `id`: its absence is what makes this a notification.
    window.postMessage(
      {
        type: WalletEvent.SPLICE_WALLET_REQUEST,
        request: { jsonrpc: '2.0', method, params },
        target,
      },
      '*',
    )
  }

  window.addEventListener('message', onMessage)
  window.addEventListener(CANTON_REQUEST_PROVIDER_EVENT, announce)
  queueMicrotask(announce)

  return {
    announce,
    push,
    dispose: (): void => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener(CANTON_REQUEST_PROVIDER_EVENT, announce)
    },
  }
}
