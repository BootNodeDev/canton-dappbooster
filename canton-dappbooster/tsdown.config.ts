import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Browser library: don't let engines.node steer platform/target to Node.
  platform: 'neutral',
  dts: true,
  clean: true,
  fixedExtension: false,
})
