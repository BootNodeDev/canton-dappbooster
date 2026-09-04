// Read-only gates only. The formatter runs first, from .lintstagedrc.format.mjs, so these are safe
// to run concurrently with each other.
export default {
  'canton-connect/src/**/*.{ts,tsx,js,jsx}': () => 'pnpm -C canton-connect test',
  'canton-dappbooster/src/**/*.{ts,tsx,js,jsx}': () => 'pnpm -C canton-dappbooster test',
  // One task for the whole doc gate, under the name CI uses: typedoc resolves both packages in a
  // single run anyway, so splitting it per package bought a second and two ways to drift.
  // Snippets live in the READMEs as well as in the doc blocks, so a doc edit re-runs the compile.
  '{canton-connect,canton-dappbooster}/{src/**/*.{ts,tsx},doc-fixtures.d.ts,README.md,architecture.md,coming-from-wagmi.md,typedoc.json}':
    () => 'pnpm docs:check',
  // Either side of the L2/L3 contract moving on its own is what this catches.
  '{canton-dappbooster/src/{components,providers}/**/anatomy.ts,canton-theme/src/**/*.css}': () =>
    'node scripts/check-anatomy.mjs',
}
