import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'

// Unused while #113 is open, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

// The gateway serves its UI on the origin and the dApp API under /api/v0/dapp.
export const WALLET_GATEWAY_URL: string = import.meta.env.VITE_WALLET_GATEWAY_URL
export const WALLET_GATEWAY_UI_URL = new URL(WALLET_GATEWAY_URL).origin

export const SCAN_API_URL: string = import.meta.env.VITE_SCAN_API_URL

export const REGISTRY_URL = '/registry'

// The published list plus a LocalNet entry, served by the dev server: `vite.config.ts`.
export const ASSET_LIST_URL = '/assets.json'

// The published list carries `MainNet`, `TestNet` and `DevNet`; anything else ships its own file.
export const ASSET_LIST_NETWORK: string | undefined = 'LocalNet'
