import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
// biome-ignore lint/style/noRestrictedImports: this file defines the @ alias, so it cannot use it.
import { parseEnv } from './src/utils/env'

// Vite inlines `import.meta.env.VITE_*` as literals, so the environment is a build-time input. It
// is validated and defaulted here, and defined back, so the client ships no validation code. The
// `.env` read is the repo root's, the one file the monorepo keeps; the empty prefix loads every key
// in it, so only what `parseEnv` returns may be defined back — never the loaded object.
export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url))
  const env = parseEnv(loadEnv(mode, envDir, ''))

  return {
    define: Object.fromEntries(
      Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    // Vite's own env read follows the same directory, or a leftover `dapp/frontend/.env.local` keeps
    // being loaded while silently losing to the root for exactly the keys defined above.
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
    // jsdom, though nothing here asserts on the DOM: the wallet SDK reached through canton-connect
    // touches DOM globals on import, so a node env fails at collection.
    test: {
      environment: 'jsdom',
    },
  }
})
