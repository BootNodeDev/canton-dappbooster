# Agent Configuration — wallet-service

This file applies only to `canton-barebones/wallet-service/`. For monorepo-wide rules, see [`../../CLAUDE.md`](../../CLAUDE.md).

## Scope

The wallet-service is a consumer-dApp-agnostic Express JSON-RPC bridge between a CIP-0103 wallet and the local Canton participant. It holds the Canton bearer token boundary, prepares and executes transactions, proxies participant reads, exposes CIP-56 token-standard reads/transfers and Amulet (Canton Coin) preapproval management and DevNet faucet tap, and handles wallet-internal party onboarding.

## Working Rules

- Keep this service agnostic to the *consumer dApp*. Canton-standard logic is in scope: CIP-56 token-standard reads/transfers and Amulet (Canton Coin) preapproval — including the Splice/Amulet template ids those require. What stays out is consumer-dApp-specific routes, template ids, or command logic (e.g. the `vesting-lite` templates).
- Keep the public dApp-facing API in the wallet. This service exposes only the HTTP bridge the wallet needs.
- Keep wallet-internal party onboarding under `/admin/party/*`, not on the `/rpc` dApp surface.
- Keep `ledgerApi` as a participant-native pass-through. Do not silently translate request bodies or wrap participant responses.
- Keep token handling inside this service boundary. Do not expose `CANTON_BACKEND_TOKEN` to the dApp or wallet UI.

## Testing

- Run tests with `pnpm test` from this package, or `pnpm -C canton-barebones/wallet-service test` from the repo root.
- Use `node:test` with `--experimental-strip-types`, matching `package.json`.
- Cover RPC method shape, pending approvals, CIP-56 token reads/transfers, Amulet preapproval, party onboarding, and HTTP status behavior.

## Validation Checklist

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
