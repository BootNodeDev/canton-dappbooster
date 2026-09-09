import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Node 26's own localStorage global shadows jsdom's under vitest 4; vitest 5 fixes it.
    execArgv: ['--no-experimental-webstorage'],
    // The suite's wall clock is SDK timer waits, not CPU; without an explicit count,
    // core-starved CI runners get too few workers to overlap the files.
    maxWorkers: 8,
    coverage: {
      provider: 'v8',
      // lcov is what a CI uploader reads; text keeps the local run readable.
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // testing/ and mock/ are doubles: covering them says nothing about the package.
      exclude: ['src/testing/**', 'src/mock/**', 'src/index.ts'],
    },
  },
})
