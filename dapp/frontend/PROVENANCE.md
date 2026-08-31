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

Applied on import to fit this repo's conventions:

- **Shared kit + theme (new):** added `@bootnodedev/canton-dappbooster` and
  `@bootnodedev/canton-theme`; `src/styles/index.css` imports the theme CSS. The
  source's own party-id truncation and copy helpers were dropped in favour of the
  kit's `<Identifier>` primitive and its `truncateIdentifier` / `partyHint` formatters.
- **Centralized tooling:** removed the vendored `biome.json`, `CLAUDE.md`,
  `AGENTS.md`, `architecture.md`, and `.nvmrc`; the repo uses one root Biome config
  and root Node pin. The `architecture.md` here now is this repo's own, not that
  one. The source's `noImportantStyles`/`noDescendingSpecificity` CSS relaxations
  moved into the root `biome.json` `dapp/frontend` override.
- **Toolchain aligned to the repo:** `vite` 6→8, `@vitejs/plugin-react` 4→6,
  `vitest` 3→4 (avoids duplicate major versions across the workspace).
- **Kit-from-source resolution:** `tsconfig.app.json` gains
  `customConditions: ["development"]` so tsc resolves the workspace kit from source.
- **knip / lint fixes:** pruned three unused vendored exports (`HistoryIcon`,
  `WalletIcon`, `useWalletStatus`); unit-test runner is `vitest` (was already in the source).
- **Wallet-signed reads and writes:** the source's `StealthWallet` submitted through
  wallet-service, which can act as any party. Both now go through `canton-connect`'s
  `useExecute` / `useLedger`, so the dApp acts only as the connected account and the
  operator's factory arrives by explicit disclosure from the bootstrap's config file
  rather than from an operator-scoped ACS read.
- **Mock data layer removed:** the import added an in-memory `MockBackend` and a seeded
  party pool so the app ran with no services. Both are gone; there is no zero-service mode.

## Not imported (deferred)

- The Playwright `e2e` suite (#38).
- Token balances and USD prices. Amulet-backed vesting itself landed with #114, so a grant
  now locks real Canton Coin, but the create form still shows no balance and validates
  against no ceiling: a Canton balance is a set of holding contracts rather than a scalar.
  The placeholder holdings and the hardcoded CC/USD rate the import shipped are gone rather
  than kept as fiction.
