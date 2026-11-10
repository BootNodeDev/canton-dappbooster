import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // The empty prefix loads every key in `.env`; only the port is read, and none reaches the bundle.
  const { WL_SERVER_PORT } = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const serverPort = WL_SERVER_PORT === undefined || WL_SERVER_PORT === '' ? '3040' : WL_SERVER_PORT

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: 'localhost',
      port: 3012,
      // Same origin, so the session cookie rides along without any CORS.
      proxy: { '/api': `http://localhost:${serverPort}` },
      strictPort: true,
    },
    test: {
      projects: [
        {
          extends: true,
          test: { name: 'app', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
        },
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            include: ['server/**/*.test.ts', 'scripts/**/*.test.mjs'],
          },
        },
      ],
    },
  }
})
