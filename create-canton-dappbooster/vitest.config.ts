import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // `npm pack` in the example test is a real subprocess.
    testTimeout: 60_000,
  },
})
