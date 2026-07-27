# Provenance

This dApp was vendored, frontend-only, from the vesting-lite branch of the
`cn-dappbooster` monorepo.

| Field | Value |
|-------|-------|
| Source repo | https://github.com/BootNodeDev/cn-dappbooster |
| Source branch | `feat/vesting-lite` |
| Source commit | `e7e59b2c3e9b7de019418c12a33d43cd21bc85d4` |
| Source path | `dapp/frontend` |
| Imported | `src/**`, `index.html`, `public/`, `tsconfig*.json`, `vite.config.ts` |

## Integration deltas

Applied on import to fit this repo's conventions and land green **mock-first**:

- **Mock-first data layer (new):** added `src/mock/` — `MockBackend` (in-memory
  grants/proposals/claims with command mutations), `MockWallet` (seeded party
  pool), and `seed.ts` (sample dataset relative to now). `createBackend` now
  returns `MockBackend` when no deployment config is present, so the app runs with
  zero services. `WalletProvider` picks `MockWallet` in that same case. The live
  `LiteBackend` code is kept in-tree but inert until a deployment config appears.
- **Shared kit + theme (new):** added `@bootnodedev/canton-dappbooster` and
  `@bootnodedev/canton-theme`; `main.tsx` imports the theme CSS and the top bar
  renders the temporary `<Placeholder />` kit-pipeline proof (shown only once
  connected; replaced by `<Identifier>` in #6).
- **Centralized tooling:** removed the vendored `biome.json`, `CLAUDE.md`,
  `AGENTS.md`, `architecture.md`, and `.nvmrc`; the repo uses one root Biome config
  and root Node pin. The source's `noImportantStyles`/`noDescendingSpecificity` CSS
  relaxations moved into the root `biome.json` `dapp/frontend` override.
- **Toolchain aligned to the repo:** `vite` 6→8, `@vitejs/plugin-react` 4→6,
  `vitest` 3→4 (avoids duplicate major versions across the workspace).
- **Kit-from-source resolution:** `tsconfig.app.json` gains
  `customConditions: ["development"]` so tsc resolves the workspace kit from source.
- **knip / lint fixes:** pruned three unused vendored exports (`HistoryIcon`,
  `WalletIcon`, `useWalletStatus`) and fixed one `noUnsafeOptionalChaining` in
  `StealthWallet.test.ts`; unit-test runner is `vitest` (was already in the source).

## Not imported (deferred)

- The `vesting-lite` DAML package and the party-bootstrap script.
- The live wallet-service / Canton wiring and the Playwright `e2e` suite.
- Migration onto `canton-connect-kit` (CIP-0103) — this app keeps its DirectWallet.
