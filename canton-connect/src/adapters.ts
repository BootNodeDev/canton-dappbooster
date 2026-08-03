import type { ProviderAdapter } from '@canton-network/dapp-sdk'
import { WalletConnectAdapter } from '@canton-network/dapp-sdk'
import type { CantonConnectConfig } from './types'

type AdapterConfig = Pick<
  CantonConnectConfig,
  'appName' | 'appDescription' | 'appUrl' | 'walletConnectProjectId' | 'additionalAdapters'
>

export const buildAdditionalAdapters = (
  config: AdapterConfig,
  networkId: string,
): ProviderAdapter[] => {
  const adapters: ProviderAdapter[] = [...(config.additionalAdapters ?? [])]

  if (config.walletConnectProjectId !== undefined && config.walletConnectProjectId !== '') {
    adapters.push(
      WalletConnectAdapter.create({
        projectId: config.walletConnectProjectId,
        // The CAIP-2 chain must be the configured Canton network id, not the SDK's devnet default.
        chainId: networkId,
        metadata: {
          name: config.appName,
          description: config.appDescription ?? config.appName,
          url: config.appUrl ?? (typeof window === 'undefined' ? '' : window.location.origin),
          icons: [],
        },
      }),
    )
  }

  return adapters
}
