import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // The scaffold's scripts carry node:test files of their own, which the root `pnpm test` runs.
    include: ['src/**/*.test.{ts,tsx}'],
    // `npm pack` in the example test is a real subprocess.
    testTimeout: 60_000,
  },
})
