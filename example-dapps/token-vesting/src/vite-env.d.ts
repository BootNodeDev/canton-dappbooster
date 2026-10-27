/// <reference types="vite/client" />

import type { Env } from '@/utils/env'

// `utils/env.ts` is the schema and `vite.config.ts` defines the parsed values back, so what the app
// reads off `import.meta.env` is exactly what that schema produced.
declare global {
  interface ImportMetaEnv extends Env {}
}
