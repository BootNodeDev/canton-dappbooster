/// <reference types="vite/client" />

import type { Env } from '@/utils/env'

// `vite.config.ts` defines back exactly what `parseEnv` returns, so this is what the app reads
declare global {
  interface ImportMetaEnv extends Env {}
}
