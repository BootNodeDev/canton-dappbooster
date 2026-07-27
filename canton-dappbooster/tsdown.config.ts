import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Browser library: don't let engines.node steer platform/target to Node.
  platform: 'neutral',
  dts: true,
  // Keep the .js extension the exports map points at (default flips with platform).
  fixedExtension: false,
})
