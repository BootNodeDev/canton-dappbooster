import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
// biome-ignore lint/style/noRestrictedImports: this file defines the @ alias, so it cannot use it.
import { parseEnv } from './src/utils/env'

// The empty prefix loads every key in the root `.env`, so only what `parseEnv` returns may be
// defined back, never the loaded object.
const ASSET_LIST_ROUTE = '/assets.json'
const PUBLISHED_LIST =
  'https://raw.githubusercontent.com/canton-network/wallet/main/api-specs/assets.json'

const json = async (url: string): Promise<unknown> => (await fetch(url)).json()

// The published list covers no LocalNet. This stack's own instrument is not written down here: the
// token registry serves it, and `providers/Tokens.tsx` reads it from there. What the section is
// for is the rest of the catalogue, so a list missing entirely costs labels and nothing else.
const localnetAssets = (): Plugin => ({
  apply: 'serve',
  configureServer: (server) => {
    server.middlewares.use(ASSET_LIST_ROUTE, async (_request, response) => {
      const published = (await json(PUBLISHED_LIST).catch(() => ({}))) as Record<string, unknown>
      // The published DevNet entries land in the LocalNet section too, so a local list is a real
      // catalogue rather than the one token this stack issues. DevNet rather than every network,
      // because the three carry the same instruments under a DSO party each.
      const devnet = published.DevNet
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ ...published, LocalNet: Array.isArray(devnet) ? devnet : [] }))
    })
  },
  name: 'localnet-asset-list',
})

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
    plugins: [react(), tailwindcss(), localnetAssets()],
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
