# Provenance

This dApp was imported from the `canton-dappbooster-walletless` repository, a fork of this monorepo
taken at v0.5.2 that split the Amulet vesting dApp into a frontend, a server and its Daml package.

| Field | Value |
|-------|-------|
| Source repo | https://github.com/BootNodeDev/canton-dappbooster-walletless |
| Source branch | `main` |
| Source commit | `b1ce305c89941ee4d32c00ef56da7dea28b7422b` |
| Source paths | `dapp/frontend`, `dapp/server` |
| Imported | `dapp/frontend/src/**`, `index.html` and `public/` as the app; `dapp/server/src/**` and `compose.yaml` under `server/` |

## Integration deltas

Applied on import to fit this repo's conventions:

- **One package instead of three.** `dapp/frontend`, `dapp/server` and `dapp/daml` were separate
  workspace packages. They are one example here, `@bootnodedev/canton-example-amulet-vesting-walletless`,
  with the frontend in `src/`, the server in `server/` and the contract in `daml/`. The server's
  `package.json`, `tsconfig.json` and `vitest.config.ts` are gone: `tsconfig.server.json` and a
  `server` project in `vite.config.ts`'s test block replace them.
- **`#server/*` instead of relative `.ts` imports.** Root Biome refuses relative specifiers and file
  extensions under `example-dapps/`, so the server's 67 relative imports go through the sub-path
  imports in `package.json`, rewritten with `ast-grep`. The frontend's `@server/*` alias for the
  domain types became the same `#server/*`.
- **The contract is a copy of amulet-vesting's.** The source carried the same Daml at `0.0.2` on SDK
  `3.4.11`, built by a `dpm build` script that root `pnpm build` would have run. `daml/` here is
  `example-dapps/amulet-vesting/daml/` at `0.0.3` on `3.5.2`, built only through `build-dar`; see
  [`daml/PROVENANCE.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/amulet-vesting-walletless/daml/PROVENANCE.md).
- **Ports.** The dApp moved from 3013, which the token example's registry holds, to 3012, which
  `dev-stack.sh` assumes. The server stays on 3040 and Postgres on 5433.
- **`.env` in the example folder.** The server read the repo root's `.env`; `server/src/env.ts` now
  loads this folder's, as every example's scripts do. `.env.example` follows amulet-vesting's
  sections, without the `VITE_*` ones, plus the server's keys.
- **The scaffold's scripts are not copied.** The source carried its own `dev-stack.sh`,
  `deploy-dar.sh`, `mint-token.mjs`, `localnet-config.mjs` and `fetch-daml-deps.mjs`, drifted from
  this repo's. The installer's `daml-tooling` and `localnet` layers own them here. Postgres, the
  schema and the server start through `scripts/server.sh`, which `stack:up` and `stack:down` run.
- **No Vercel.** `vercel.json` deployed the frontend and the server as Vercel Services, and
  `server/src/server.ts` held the default export Vercel served. That file folded into
  `server/src/index.ts`.
- **A stable operator.** `bootstrap-vesting.mjs` was amulet-vesting's, minting a stamped operator and
  a factory on every run. It now reuses a `vesting-operator` party and its factory, as token-vesting's
  does, and `server/src/ledger/config.ts` matches only that party.
- **Server dependencies on caret ranges.** The source pinned `hono`, `@hono/node-server` and `pg`
  exactly; they take the `^` ranges every example uses.
- **`errorText` stays local.** amulet-vesting now takes it from `canton-connect`, which nothing here
  imports, so the frontend keeps the source's own copy.
- **Login documentation.** The source's README said a login for an unknown name computed a decoy
  hash; `app.ts` does not, and [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/amulet-vesting-walletless/architecture.md)
  now says what it does and why.

Brought over from the examples since the fork:

- From amulet-vesting: the `clamp01` rewrite in `utils/schedule.ts`, and the `Probe` test component
  hoisted to module level in `providers/Backend.test.tsx`.
- From token-vesting: the pending `Button` as a live region; `hooks/useOnScreen` guarding the close
  after a submission in `Claim`, `CancelGrant` and `CreateGrant`; the store's `busy` map and its
  consumers, without the proposal cancel and reject the Amulet contract does not have;
  `components/ReadError`; a Try again on the deployment error; `.dev-stack/` in `_gitignore`.
- Not brought over: token-vesting's amount-reservation hint, because the Amulet contract locks the
  funds at accept and not at proposal.

## Not imported (deferred)

- The Vercel deployment, its Neon database and the hosted validator behind it.
- The source's root tooling: Husky hooks, commitlint, Biome and knip configs, `.gitleaksignore`.
  This repo's own apply.
