# Agent Configuration — example-dapps/token-vesting

This file applies only to `example-dapps/token-vesting/`. The rules every example shares are in
[`../CLAUDE.md`](../CLAUDE.md), and the repo-wide ones in [`../../CLAUDE.md`](../../CLAUDE.md). The
internal seams are in [`architecture.md`](architecture.md). Deltas for this app only are below.

- `api/` sits beside `src/`, not inside it. Vercel publishes each module there at `/api/<basename>`,
  so the path is the route and moving one renames the endpoint. A bracketed filename matches exactly
  one path segment, catch-all spelling included, so forwarding a service's own multi-segment paths
  takes an explicit `vercel.json` rewrite carrying the path as a parameter, which is what
  `registry.ts` does. Server-side code: it never imports from `src/`, reads its configuration from
  `process.env`, and any variable it needs is deliberately not a `VITE_` name, since those are
  inlined into the bundle. Every file here is published, so a test beside one is an endpoint: only a
  `_` or `.` prefix somewhere in the path is skipped, which is why the suite is `_registry.test.ts`
  and reaches its subject through the `#api/*` subpath imports rather than a relative specifier.
- The token's mark on every figure is the instrument mark, `icons/TokenMark`, through `DBT` in
  `utils/tokens.tsx`.
- The Daml packages are binaries in `vendor/`, built elsewhere. A new one, or a new release of
  either, lands with its column in [`architecture.md`](architecture.md#the-committed-dars) in the same
  change: source, release, size, sha256 and package id. There is no automated path: replace the
  binary, run `sha256sum vendor/canton-token-forge.dar vendor/vesting.dar`, and update the column by
  hand.
- `canton-token-forge.dar` comes from the tag `package.json` pins the registry to, so moving that tag
  replaces the DAR in the same change.
- A LocalNet that already vetted an older release refuses a new one that is not a valid upgrade, with
  `NOT_VALID_UPGRADE_PACKAGE`, and nothing uploads past it. Drop the ledger and let the stack deploy
  both DARs again: `pnpm dev:token-vesting reset`, then `pnpm dev:token-vesting up`.
