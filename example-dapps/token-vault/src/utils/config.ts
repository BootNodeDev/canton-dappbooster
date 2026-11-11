import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'

// Nothing links to the explorer yet, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

export const WALLET_GATEWAY_URL: string = import.meta.env.VITE_WALLET_GATEWAY_URL

export const WALLET_GATEWAY_UI_URL = new URL(WALLET_GATEWAY_URL).origin

export const WALLET_CONNECT_PROJECT_ID: string = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID

export const NETWORK_ID: string = import.meta.env.VITE_NETWORK_ID
