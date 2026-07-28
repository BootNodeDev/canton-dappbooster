// Extension connector — uses @canton-network/dapp-sdk's ExtensionAdapter
// to discover an injected CIP-0103 provider via the canton:requestProvider /
// canton:announceProvider events. After connect, the SPLICE_WALLET_EVENT
// postMessage bridge is installed so wallet-pushed events (accountsChanged,
// txChanged, connected, statusChanged) reach the canonical Provider's emit.
//
// SPLICE_WALLET_EVENT is Carpincho's protocol extension to fill the gap that
// the canonical WindowTransport leaves on the injected path; the canonical
// extension transport carries request/response only. See `src/extension/messages.ts`
// in the carpincho-wallet repo (github.com/BootNodeDev/carpincho-wallet) for the wire shapes.

import type { Provider } from '@canton-network/core-splice-provider'
import type { RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client'
import { ExtensionAdapter } from '@canton-network/dapp-sdk'
import type { ConnectorProvider, ExtensionConnector } from '../types'

// Default extension target. Carpincho's provider id used by ExtensionAdapter.
// The kit pre-configures for Carpincho since this scaffold is the primary
// consumer; a future version can take target/name from config.
export const DEFAULT_EXTENSION_TARGET = 'carpincho-wallet'

const SPLICE_WALLET_EVENT_TYPE = 'SPLICE_WALLET_EVENT'

interface SpliceWalletEventMessage {
  type: typeof SPLICE_WALLET_EVENT_TYPE
  eventName: string
  payload: unknown
  target?: string
}

const isSpliceWalletEvent = (data: unknown): data is SpliceWalletEventMessage =>
  typeof data === 'object' &&
  data !== null &&
  (data as { type?: unknown }).type === SPLICE_WALLET_EVENT_TYPE &&
  typeof (data as { eventName?: unknown }).eventName === 'string'

const wireEventBridge = (provider: Provider<DappRpcTypes>, target: string): void => {
  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return
    }
    const data = event.data as unknown
    if (!isSpliceWalletEvent(data)) {
      return
    }
    if (data.target !== undefined && data.target !== target) {
      return
    }
    provider.emit(data.eventName, data.payload)
  })
}

export interface CreateExtensionConnectorOptions {
  target?: string
  name?: string
  description?: string
}

export const createExtensionConnector = (
  options: CreateExtensionConnectorOptions = {},
): ExtensionConnector => {
  const target = options.target ?? DEFAULT_EXTENSION_TARGET
  const name = options.name ?? 'Carpincho Wallet'
  const description = options.description ?? 'Connect with the Carpincho browser extension wallet'
  let cachedProvider: Provider<DappRpcTypes> | undefined

  const buildProvider = async (): Promise<Provider<DappRpcTypes> | undefined> => {
    if (cachedProvider !== undefined) {
      return cachedProvider
    }
    const adapter = new ExtensionAdapter({
      providerId: `browser:ext:${target}`,
      name,
      description,
      target,
    })
    if (!(await adapter.detect())) {
      return undefined
    }
    const provider = adapter.provider()
    wireEventBridge(provider, target)
    cachedProvider = provider
    return provider
  }

  return {
    id: 'extension',
    detect: async (): Promise<boolean> => (await buildProvider()) !== undefined,
    connect: async (): Promise<ConnectorProvider> => {
      const provider = await buildProvider()
      if (provider === undefined) {
        throw new Error('Carpincho extension was not detected on this page')
      }
      return { provider, providerType: 'browser' }
    },
  }
}
