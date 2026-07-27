export default {
  '{canton-connect-kit,canton-dappbooster,canton-theme,dapp/frontend,canton-barebones}/**/*.{ts,tsx,js,jsx,json,jsonc,mjs,cjs,css}':
    'biome check --write --no-errors-on-unmatched',
  'canton-connect-kit/src/**/*.{ts,tsx,js,jsx}': () => 'pnpm -C canton-connect-kit test',
  'canton-dappbooster/src/**/*.{ts,tsx,js,jsx}': () => 'pnpm -C canton-dappbooster test',
}
