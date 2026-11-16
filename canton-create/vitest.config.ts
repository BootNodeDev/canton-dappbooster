import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // In a terminal lint-staged sets FORCE_COLOR, and Ink's color codes break the text matches.
    env: { FORCE_COLOR: '0' },
    // The scaffold's scripts carry node:test files of their own, which the root `pnpm test` runs.
    include: ['src/**/*.test.{ts,tsx}'],
    // `npm pack` in the example test is a real subprocess.
    testTimeout: 60_000,
  },
})
