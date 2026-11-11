import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
// The native config loader adds no extension of its own, and this file defines the @ alias.
// biome-ignore lint/style/noRestrictedImports: see above; both halves of this specifier are forced.
import { parseEnv } from './src/utils/env.ts'

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url))
  // The empty prefix loads every key in `.env`, so only what `parseEnv` returns is defined back.
  const env = parseEnv(loadEnv(mode, envDir, ''))

  return {
    define: Object.fromEntries(
      Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
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
      // Node 26's own localStorage global shadows jsdom's under vitest 4; vitest 5 fixes it.
      execArgv: ['--no-experimental-webstorage'],
    },
  }
})
