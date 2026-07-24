export default {
  '{canton-connect-kit,dapp/frontend,canton-barebones}/**/*.{ts,tsx,js,jsx,json,jsonc,mjs,cjs,css}':
    'biome check --write --no-errors-on-unmatched',
  'canton-connect-kit/src/**/*.{ts,tsx,js,jsx}': () => 'npm --prefix canton-connect-kit test',
}
