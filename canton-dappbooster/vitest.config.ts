import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // A stub or spy surviving into the next test is an order-dependent pass; undo both centrally.
    restoreMocks: true,
    unstubGlobals: true,
  },
})
