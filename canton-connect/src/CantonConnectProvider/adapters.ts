import { type ProviderAdapter, WalletConnectAdapter } from '@canton-network/dapp-sdk'
import type { CantonConnectConfig } from '#src/types'

/** The config fields adapter construction reads, and no more of `CantonConnectConfig`. */
type AdapterConfig = Pick<
  CantonConnectConfig,
  'appName' | 'appDescription' | 'appUrl' | 'walletConnectProjectId' | 'additionalAdapters'
>

/** Builds the extra adapters for the SDK: WalletConnect when configured, plus any passed in. */
export const buildAdditionalAdapters = (
  config: AdapterConfig,
  networkId: string,
): ProviderAdapter[] => {
  const adapters: ProviderAdapter[] = [...(config.additionalAdapters ?? [])]

  if (config.walletConnectProjectId !== undefined && config.walletConnectProjectId !== '') {
    adapters.push(
      WalletConnectAdapter.create({
        projectId: config.walletConnectProjectId,
        // The CAIP-2 chain the wallet must serve is the configured Canton network id, not the SDK's
        // devnet default.
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
