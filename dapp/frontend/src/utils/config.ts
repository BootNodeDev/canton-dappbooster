import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'
import type { AssetListNetwork } from '@/utils/assetList'

// Unused while #113 is open, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

export const WALLET_RPC_URL: string = import.meta.env.VITE_WALLET_RPC_URL

export const REGISTRY_URL = '/registry'

export const ASSET_LIST_URL =
  'https://raw.githubusercontent.com/canton-network/wallet/main/api-specs/assets.json'

export const ASSET_LIST_NETWORK: AssetListNetwork | undefined = undefined
