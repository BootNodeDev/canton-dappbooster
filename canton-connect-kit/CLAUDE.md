# Agent Configuration — canton-connect-kit

This file applies only to `canton-connect-kit/`. For monorepo-wide rules, see [`../CLAUDE.md`](../CLAUDE.md).

## Scope

`canton-connect-kit` is a React hook library for Canton dApps. It exposes a stable wagmi-style hook surface while hiding connector details for the injected CIP-0103 provider and the optional WalletConnect fallback.

## Working Rules

- Keep this package app-agnostic. Do not import from `dapp/` or `canton-barebones/`, and keep it decoupled from any specific wallet implementation.
- Treat `src/index.ts` as the public API. New exports should be deliberate and documented in `README.md`.
- Keep connectors narrow: `detect`, `connect`, and provider/session wiring only.
- Keep hooks thin. Hooks should read from `ConnectKitProvider` context and expose lifecycle state; shared state transitions belong in `ConnectKitProvider.tsx`.
- Keep WalletConnect code lazy-loaded so extension-only dApps do not pay the fallback bundle cost.
- Use relative imports with explicit `.ts` / `.tsx` extensions, matching the current package style.

## Architecture

See [`architecture.md`](architecture.md) for the provider, connector, hook, and event-flow structure.

## Testing

- Run tests with `pnpm test` from this package, or `pnpm -C canton-connect-kit test` from the repo root.
- Use the configured `node:test` + `tsx` setup.
- Prefer connector factories and test doubles over importing wallet or dApp source.
- Cover context state transitions, connector selection, event subscriptions, and hook return values.

## Validation Checklist

- `pnpm run lint`
- `pnpm test`
- `pnpm run typecheck`
