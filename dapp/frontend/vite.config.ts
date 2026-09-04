import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
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

const ASSET_LIST_ROUTE = '/assets.json'
const PUBLISHED_LIST =
  'https://raw.githubusercontent.com/canton-network/wallet/main/api-specs/assets.json'
const LOCALNET_SCAN = 'http://scan.localhost:4000/api/scan'

const json = async (url: string): Promise<unknown> => (await fetch(url)).json()

// The published list covers no LocalNet, and a LocalNet's DSO party is minted with the stack, so
// the entry is read off the running scan here rather than every developer committing their own.
// Either half missing costs labels and nothing else, so a stack that is down still serves a list.
const localnetAssets = (values: Record<string, string>): Plugin => ({
  apply: 'serve',
  configureServer: (server) => {
    server.middlewares.use(ASSET_LIST_ROUTE, async (_request, response) => {
      const scan = values.SPLICE_SCAN_API_URL ?? LOCALNET_SCAN
      const [published, dso] = await Promise.all([
        json(PUBLISHED_LIST).catch(() => ({})),
        json(`${scan}/v0/dso-party-id`)
          .then((body) => (body as { dso_party_id?: string }).dso_party_id)
          .catch(() => undefined),
      ])
      const entry = {
        instrumentId: { admin: dso, id: 'Amulet' },
        registryURLs: [REGISTRY_PROXY],
        symbol: 'CC',
      }
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({ ...(published as object), LocalNet: dso === undefined ? [] : [entry] }),
      )
    })
  },
  name: 'localnet-asset-list',
})

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
    plugins: [react(), tailwindcss(), localnetAssets(loaded)],
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
