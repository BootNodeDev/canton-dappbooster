import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'

// Validated and defaulted at build time by `vite.config.ts`, so reading them here is safe.

// Unused while #113 is open, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

// `/api/rpc` when deployed, because an https page cannot reach plain-http wallet-service.
export const WALLET_RPC_URL: string = import.meta.env.VITE_WALLET_RPC_URL

// Same-origin, because the registry wants a bearer no browser should hold: `vite.config.ts` proxies
// this path to `SPLICE_REGISTRY_API_URL` and adds the header. A deployment needing another registry
// is what turns this into a variable.
export const REGISTRY_URL = '/registry'
