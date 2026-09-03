import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Node 26's own localStorage global shadows jsdom's under vitest 4; vitest 5 fixes it.
    execArgv: ['--no-experimental-webstorage'],
    // A stub or spy surviving into the next test is an order-dependent pass; undo both centrally.
    restoreMocks: true,
    unstubGlobals: true,
    // Room for the SDK's discovery sleeps plus the asyncUtilTimeout waiting them out.
    testTimeout: 10_000,
  },
})
