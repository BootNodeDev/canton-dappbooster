// The writing half of the pre-commit, kept apart so the read-only gates in .lintstagedrc.mjs can
// run concurrently behind it. See .husky/pre-commit.
export default {
  '{canton-connect,canton-dappbooster,canton-theme,dapp/frontend,canton-barebones,scripts}/**/*.{ts,tsx,js,jsx,json,jsonc,mjs,cjs,css}':
    'biome check --write --no-errors-on-unmatched',
}
