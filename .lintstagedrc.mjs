const examples = (files) => [...new Set(files.map((file) => file.match(/example-dapps\/[^/]+/)?.[0]))]

export default {
  'canton-connect/src/**/*.{ts,tsx,js,jsx}': () => 'pnpm -C canton-connect test',
  'canton-dappbooster/src/**/*.{ts,tsx,js,jsx}': () => 'pnpm -C canton-dappbooster test',
  'example-dapps/*/src/**/*.{ts,tsx,js,jsx}': (files) =>
    examples(files).map((example) => `pnpm -C ${example} test`),
  'example-dapps/*/{api,scripts}/**/*.{ts,mjs,sh}': (files) =>
    examples(files).map(
      (example) => `pnpm -C ${example} exec vitest run --passWithNoTests api scripts`,
    ),
  'canton-create/**/*.{ts,tsx,mjs,sh,json}': () => 'pnpm -C canton-create test',
  '{canton-create/scaffold/*/scripts,scripts}/*.{mjs,sh}': () =>
    'node --test "canton-create/scaffold/*/scripts/*.test.mjs" "scripts/*.test.mjs"',
  '{canton-connect,canton-dappbooster}/{src/**/*.{ts,tsx},doc-fixtures.d.ts,README.md,architecture.md,coming-from-wagmi.md,typedoc.json}':
    () => 'pnpm docs:check',
  '{canton-dappbooster/src/{components,providers}/**/anatomy.ts,canton-theme/src/**/*.css}': () =>
    'pnpm run check:anatomy',
}
