import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'

// Everything the app resolves from its environment lands here. The values are validated and
// defaulted at build time by `vite.config.ts`, which is what makes reading them directly safe.
export const EXPLORER: ExplorerConfig = { baseUrl: import.meta.env.VITE_EXPLORER_URL }
