import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'

// Everything the app resolves from its environment lands here. The values are validated and
// defaulted at build time by `vite.config.ts`, which is what makes reading them directly safe.

// Where a party id or a contract is linked for a human to look at. Nothing renders those links
// while #113 is open, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

// wallet-service's JSON-RPC endpoint: localhost in dev, and the same-origin `/api/rpc` function when
// deployed, because an https page cannot reach a plain-http wallet-service directly.
export const WALLET_RPC_URL: string = import.meta.env.VITE_WALLET_RPC_URL
