import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
// biome-ignore lint/style/noRestrictedImports: this file defines the @ alias, so it cannot use it.
import { parseEnv } from './src/utils/env'

// The empty prefix loads every key in the root `.env`, so only what `parseEnv` returns may be
// defined back, never the loaded object.
// LocalNet serves the token registry behind the validator's authenticated prefix, so the browser
// cannot read it: the bearer stays here, in the dev server, and the page asks its own origin.
const REGISTRY_PROXY = '/registry'
const LOCALNET_REGISTRY = 'http://localhost:2000/api/validator/v0/scan-proxy'

const registryTarget = (values: Record<string, string>) => {
  const upstream = new URL(values.SPLICE_REGISTRY_API_URL ?? LOCALNET_REGISTRY)
  const token = values.CANTON_BACKEND_TOKEN ?? ''
  return {
    changeOrigin: true,
    headers: token === '' ? {} : { Authorization: `Bearer ${token}` },
    rewrite: (path: string) => path.replace(REGISTRY_PROXY, upstream.pathname.replace(/\/$/, '')),
    target: upstream.origin,
  }
}

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url))
  const loaded = loadEnv(mode, envDir, '')
  const env = parseEnv(loaded)

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
      proxy: { [REGISTRY_PROXY]: registryTarget(loaded) },
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
