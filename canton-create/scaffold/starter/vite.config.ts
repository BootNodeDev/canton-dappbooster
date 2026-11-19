import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: 'localhost',
    // The empty prefix loads every key in `.env`; only the port is read, and none reaches the bundle.
    port: Number(loadEnv(mode, '.', '').DAPP_PORT || 3012),
    strictPort: true,
  },
}))
