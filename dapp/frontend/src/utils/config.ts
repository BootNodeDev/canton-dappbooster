import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'

// Validated and defaulted at build time by `vite.config.ts`, so reading them here is safe.

// Unused while #113 is open, which is why knip is told this export is deliberate.
/** @public */
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }

// Direct in dev; #169 fronts it same-origin: an https page cannot reach a plain-http registry.
export const REGISTRY_URL: string = import.meta.env.VITE_REGISTRY_URL
