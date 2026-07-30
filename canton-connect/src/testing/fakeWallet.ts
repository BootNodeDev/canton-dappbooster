import {
  CANTON_ANNOUNCE_PROVIDER_EVENT,
  CANTON_REQUEST_PROVIDER_EVENT,
  WalletEvent,
} from '@canton-network/core-types'
import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'

export interface FakeWalletAccount {
  partyId: string
  primary?: boolean
  name?: string
  publicKey?: string
}

export interface FakeWalletOptions {
  id: string
  name?: string
  target?: string
  accounts?: FakeWalletAccount[]
  statusResponses?: boolean[]
}

export interface FakeWallet {
  announce: () => void
  push: (method: string, params: unknown) => void
  dispose: () => void
}

interface IncomingMessage {
  type?: string
  request?: { id?: string | number | null; method?: string }
  target?: string
}

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
  const answer = (method: string): unknown => {
    const responses: Record<string, () => unknown> = {
      status: buildStatus,
      connect: buildConnect,
      listAccounts: () => accounts,
    }
    return (responses[method] ?? (() => ({})))()
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
        response: { jsonrpc: '2.0', id: requestId, result: answer(method) },
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
