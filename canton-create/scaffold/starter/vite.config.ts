import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // The empty prefix loads every key in `.env`; only the gateway url reaches the bundle.
  const { DAPP_PORT, VITE_WALLET_GATEWAY_URL, WALLET_GATEWAY_PORT } = loadEnv(mode, '.', '')
  const localGateway = WALLET_GATEWAY_PORT
    ? `http://localhost:${WALLET_GATEWAY_PORT}/api/v0/dapp`
    : ''

  return {
    define: {
      'import.meta.env.VITE_WALLET_GATEWAY_URL': JSON.stringify(
        VITE_WALLET_GATEWAY_URL || localGateway,
      ),
    },
    plugins: [react()],
    server: {
      host: 'localhost',
      port: Number(DAPP_PORT || 3012),
      strictPort: true,
    },
  }
})
