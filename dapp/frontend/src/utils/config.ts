import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'

// Unused while #113 is open, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

export const WALLET_RPC_URL: string = import.meta.env.VITE_WALLET_RPC_URL

export const NETWORK_ID: string = import.meta.env.NETWORK

export const WALLET_CONNECT_PROJECT_ID: string | undefined = import.meta.env.VITE_WC_PROJECT_ID

export const REGISTRY_URL = '/registry'

// The published list plus a LocalNet entry, served by the dev server: `vite.config.ts`.
export const ASSET_LIST_URL = '/assets.json'

// A top-level key of the asset list. The published one carries `MainNet`, `TestNet` and `DevNet`; a
// stack it does not cover is served a file of its own, under whatever key that file uses.
export const ASSET_LIST_NETWORK: string | undefined = 'LocalNet'
