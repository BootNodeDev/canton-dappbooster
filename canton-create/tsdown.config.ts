import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  platform: 'node',
  dts: false,
  fixedExtension: false,
  minify: true,
  // Bundled so `npm create` downloads one file instead of Ink's 25 MB of dependencies.
  noExternal: [/.*/],
  // Ink imports it only in DEV mode, and only when it is installed.
  external: ['react-devtools-core'],
})
