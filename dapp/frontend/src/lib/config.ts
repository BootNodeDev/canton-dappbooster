import type { ExplorerConfig } from '@bootnodedev/canton-dappbooster'
import { parseEnv } from './env'

// Everything the app resolves from its environment lands here, parsed at import so a misconfigured
// build fails on load rather than at first use.
const env = parseEnv(import.meta.env)

export const EXPLORER: ExplorerConfig = { baseUrl: env.VITE_EXPLORER_URL }
