import {
  CANTON_ANNOUNCE_PROVIDER_EVENT,
  CANTON_REQUEST_PROVIDER_EVENT,
  WalletEvent,
} from '@canton-network/core-types'
import type { ConnectResult, dappAPI, StatusEvent } from '@canton-network/dapp-sdk'

const JSON_RPC_METHOD_NOT_FOUND = -32601

export interface FakeWalletAccount {
  partyId: string
  primary?: boolean
  name?: string
  publicKey?: string
  /** Wallet-reported lifecycle status. Omit to simulate a wallet that reports none. */
  status?: dappAPI.WalletStatus
}

export interface FakeWalletOptions {
  /** Provider id announced to `window`, and the postMessage `target` unless `target` is set. */
  id: string
  /** Defaults to `id`. */
  name?: string
  /** postMessage target frame id. Defaults to `id`. */
  target?: string
  /** Defaults to a single account with `id` as its party prefix. */
  accounts?: FakeWalletAccount[]
  /**
   * `isConnected` per successive `status` call, the last entry repeating once exhausted;
   * lets a test restore a connected session, then report it locked.
   */
  statusResponses?: boolean[]
}

export interface FakeWallet {
  /** Re-announces the wallet, as if the extension had just loaded. */
  announce: () => void
  /** Pushes an unsolicited notification the way a real extension does, e.g. `'statusChanged'`. */
  push: (method: string, params: unknown) => void
  /** Removes the `window` listeners this fake installed. Call it in test teardown. */
  dispose: () => void
}

interface IncomingMessage {
  type?: string
  request?: { id?: string | number | null; method?: string }
  target?: string
}

/**
 * A fake CIP-0103 extension wallet for tests. It speaks the real postMessage protocol, so it
 * exercises the SDK's genuine `ExtensionAdapter` rather than a stub. Answers `connect`,
 * `status`, `listAccounts` and `disconnect`; anything else rejects naming the method.
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
    listAccounts: () => accounts,
    // The SDK's disconnect() asks the wallet too, and ignores what comes back.
    disconnect: () => ({}),
  }

  // An error frame, not a throw: the transport only settles on a response, so throwing here would
  // leave the caller's request pending forever.
  const answer = (method: string): Record<string, unknown> => {
    const handler = responses[method]
    if (handler === undefined) {
      return {
        error: {
          code: JSON_RPC_METHOD_NOT_FOUND,
          message: `createFakeWallet does not implement "${method}"`,
        },
      }
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
        response: { jsonrpc: '2.0', id: requestId, ...answer(method) },
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
