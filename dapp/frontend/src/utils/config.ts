import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'
import type { AssetListNetwork } from '@/utils/assetList'

// Unused while #113 is open, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

export const WALLET_RPC_URL: string = import.meta.env.VITE_WALLET_RPC_URL

export const REGISTRY_URL = '/registry'

// The published list plus a LocalNet entry, served by the dev server: `vite.config.ts`.
export const ASSET_LIST_URL = '/assets.json'

export const ASSET_LIST_NETWORK: AssetListNetwork | undefined = 'LocalNet'
