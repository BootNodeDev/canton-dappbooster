import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
// biome-ignore lint/style/noRestrictedImports: this file defines the @ alias, so it cannot use it.
import { parseEnv } from './src/lib/env'

// Vite inlines `import.meta.env.VITE_*` as literals, so the environment is a build-time input. It
// is validated and defaulted here, and defined back, so the client ships no validation code.
export default defineConfig(({ mode }) => {
  const env = parseEnv(loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), ''))

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
  }
})
