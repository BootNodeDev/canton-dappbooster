# Agent Configuration — canton-connect

This file applies only to `canton-connect/`. For monorepo-wide rules, see [`../CLAUDE.md`](../CLAUDE.md). Deltas only below.

## Scope

`canton-connect` is a thin React wrapper over `@canton-network/dapp-sdk`'s `DappSDK` facade,
exposing a stable wagmi-style hook surface. The SDK owns discovery, the picker, the session, and
all transports. Browser-only. A stopgap, meant to stay cheap to delete.

## Working rules

- **Wrap the facade; don't rebuild it.** `CantonConnectProvider` holds one `DappSDK` instance and drives `init`/`connect`/events. Do not reintroduce hand-rolled connectors, a `ConnectorProvider` type, or a connector abstraction — the facade replaced all of that.
- **Import the SDK's types; never hand-copy them, and drop casts.** Hook params are the SDK's own (`PrepareExecuteParams`, `LedgerApiParams`); event names come from `@canton-network/core-types` (`WalletEvent`, `CANTON_*_PROVIDER_EVENT`). A `param as Parameters<…>` cast means you duplicated a type the SDK already exports — delete the duplicate, import the real type.
- **Teardown before the client swaps.** `sdk`'s `onX`/`removeOnX` bind to the current `this.client`, and `sdk.connect()` swaps it. Remove listeners *before* a connect (then re-wire after), or they leak on the old client. Keep the mount/connect/disconnect teardown paths consistent.
- **The picker is a config seam.** `CantonConnectConfig.walletPicker` — omit for the SDK popup; inject `createAutoPicker()` in tests, a themed component later. Don't wire a picker UI into this package; UI lives in `canton-dappbooster` + `canton-theme`.
- **The mock adapter answers the connect flow only.** `createMockAdapter()` implements `connect`/`disconnect`/`status`/`listAccounts` and throws naming the method for anything else. Don't extend it to fake `execute` or `signMessage` — a canned result there is indistinguishable from a real wallet's.
- **Keep hooks thin.** Read `CantonConnectProvider` context or delegate straight to a facade method. Shared state transitions belong in `CantonConnectProvider.tsx`.
- Keep it app-agnostic: no imports from `dapp/` or `canton-barebones/`; name no wallet.
- Relative imports carry **no** file extension. No semicolons, single quotes (root Biome). Terse why-only comments; vertical breathing room between logical groups.

## Layout deltas from the root rules

- **`CantonConnectProvider.tsx` lives at `src/` root, not in `components/`.** It renders only `<Context.Provider>{children}</Context.Provider>` — no markup, no visible state, no `ref` — so it is context infrastructure, and the component-authoring rules in [`../CLAUDE.md`](../CLAUDE.md) (a11y state exposure, `ref` as an ordinary prop, role-based tests) do not apply to it. Agreed on PR #45, which deliberately left this package out of its sweep.
- **`src/testing/` is a published subpath export** (`./testing` in `package.json`), unlike `canton-dappbooster`'s package-local `src/testing/`. The root rule that `testing/` is never imported from non-test code still holds here and is enforced by Biome; the export exists because the fake wallet is useful to *other* packages' test suites.

## Testing

- `pnpm -C canton-connect test` — **vitest + jsdom** (not `node:test`).
- Drive the real facade with the test doubles in `src/testing/`: `createFakeWallet` (a real CIP-0103 extension over postMessage) + `createAutoPicker` (headless picker), both exported on the `./testing` sub-path.
- **Test our seam, not the SDK's internals.** Discovery, pairing, the popup, session restore are the SDK's (trusted dependency). Cover: config → adapters → picker entries → connected state → events reaching the hooks.
- **Success paths test headless; connect-failure paths don't** — the facade's failure/retry calls a popup helper that throws without a popup window. Don't write a connect-failure test expecting a clean rejection.

## Architecture

See [`architecture.md`](architecture.md) for the facade wrapper, the picker/adapter seams, the event flow, and the teardown invariant.

## Validation Checklist

- `pnpm run lint`
- `pnpm test`
- `pnpm run typecheck`
