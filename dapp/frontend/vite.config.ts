import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
// biome-ignore lint/style/noRestrictedImports: this file defines the @ alias, so it cannot use it.
import { parseEnv } from './src/utils/env'

// The empty prefix loads every key in the root `.env`, so only what `parseEnv` returns may be
// defined back, never the loaded object.
export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url))
  const env = parseEnv(loadEnv(mode, envDir, ''))

  return {
    define: Object.fromEntries(
      Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    // Without this a leftover `dapp/frontend/.env.local` is still loaded, silently losing to the
    // root for exactly the keys defined above.
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: 'localhost',
      port: 3012,
      strictPort: true,
    },
    // jsdom despite no DOM assertions: the wallet SDK touches DOM globals on import.
    test: {
      environment: 'jsdom',
    },
  }
})
