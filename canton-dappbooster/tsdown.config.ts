import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/connect.ts'],
  format: ['esm'],
  // Browser lib: keep engines.node from steering platform to Node.
  platform: 'neutral',
  dts: true,
  // platform: neutral flips the default extension; keep the .js the exports map points at.
  fixedExtension: false,
})
