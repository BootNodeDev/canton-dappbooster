# Agent Configuration — canton-connect

This file applies only to `canton-connect/`. For monorepo-wide rules, see [`../CLAUDE.md`](../CLAUDE.md). Deltas only below.

## Scope

`canton-connect` is a thin React wrapper over `@canton-network/dapp-sdk`'s `DappSDK` facade,
exposing a stable wagmi-style hook surface. The SDK owns discovery, the picker, the session, and
all transports. Browser-only. A stopgap, meant to stay cheap to delete.

## Working rules

- **Wrap the facade; don't rebuild it.** `CantonConnectProvider` holds one `DappSDK` instance and drives `init`/`connect`/events. Do not reintroduce hand-rolled connectors, a `ConnectorProvider` type, or a connector abstraction — the facade replaced all of that.
- **Two lifecycle models live here for now; the machine replaces the provider's in #85.** `machine/connectionMachine.ts` is the connection lifecycle, internal, unwired, driven only by its own tests; `CantonConnectProvider.tsx` still owns the state the hooks read until #85 swaps it over. Put a new lifecycle rule in the machine, not in both, and never "sync" them: a rule living in two places is #76's original disease.
- **Import the SDK's types; never hand-copy them, and drop casts.** Hook params are the SDK's own (`PrepareExecuteParams`, `LedgerApiParams`); event names come from `@canton-network/core-types` (`WalletEvent`, `CANTON_*_PROVIDER_EVENT`; today only `testing/fakeWallet.ts` uses them). A `param as Parameters<…>` cast means you duplicated a type the SDK already exports: delete the duplicate, import the real type.
- **Teardown before the client swaps.** `sdk`'s `onX`/`removeOnX` bind to the current `this.client`, and `sdk.connect()` swaps it. Remove listeners *before* a connect (then re-wire after), or they leak on the old client. Keep the mount/connect/disconnect teardown paths consistent.
- **The picker is a config seam.** `CantonConnectConfig.walletPicker` — omit for the SDK popup; inject `createAutoPicker()` in tests, a themed component later. Don't wire a picker UI into this package; UI lives in `canton-dappbooster` + `canton-theme`.
- **Bumping `dapp-sdk` means a manual browser pass on the close path.** Two of `guardedConnect`'s assumptions are non-public SDK internals no test can pin: that the picker window comes from `window.open`, and the shape of the `SPLICE_WALLET_PICKER_RESULT` message it both reads and posts. Serve `dapp/frontend` and walk three cases. Close the picker without choosing, three times over: the button must re-enable each time, and a following real connect must raise exactly one approval prompt. Choose an extension, then close the picker: the button must stay pending and the connect must complete when the wallet is answered. Then repeat both on a wallet that reuses the popup the SDK left open (a gateway or WalletConnect one), where a close after choosing *must* fail the connect. Why in [`architecture.md`](architecture.md).
- **Never import `@canton-network/core-wallet-ui-components`.** It is `dapp-sdk`'s private popup layer, and declaring it to reach `pickWallet` puts a second copy of its module-level popup state in the store, which kills the SDK's retry prompt with `"Wallet picker is not open"`. This rules out reusing the SDK's picker component; it does not rule out writing our own.
- **The mock adapter answers the connect flow only.** `createMockAdapter()` implements `connect`/`disconnect`/`status`/`listAccounts` and throws naming the method for anything else. Don't extend it to fake `execute` or `signMessage` — a canned result there is indistinguishable from a real wallet's.
- **Keep hooks thin.** Read `CantonConnectProvider` context or delegate straight to a facade method. Shared state transitions belong in `CantonConnectProvider.tsx`.
- **The hook and config surface is documented in JSDoc, and nowhere else.** No hook table and no
  config table in `README.md`: root [`CLAUDE.md`](../CLAUDE.md) puts reference material out of a
  README, and both are generated from the doc blocks now. A table copied beside the code drifts from
  it, and a reader who trusted the copy has no way to tell. Which wallets the picker offers is
  decided by three fields, so `CantonConnectConfig` is where that is written down:
  `walletConnectProjectId`, `walletPicker`, `additionalAdapters`.
- Keep it app-agnostic: no imports from `dapp/` or `canton-barebones/`; name no wallet.
- Internal modules are reached through this package's `#src/*` subpath imports, never a relative path, and imports carry **no** file extension. No semicolons, single quotes (root Biome). Terse why-only comments; vertical breathing room between logical groups.

## Layout deltas from the root rules

- **The lifecycle lives in `src/machine/`; the other modules sit at `src/` root.** `machine/` holds `connectionMachine`, `connectionActors`, `accountsMachine`, `accountsActors` and nothing else. `walletAccount`, `connectError` and `guardedConnect` are one flat layer under `src/`; a new one joins them rather than starting a `utils/`. The root rule's kind folders here are `hooks/`, `machine/`, `testing/` and `mock/`.
- **`CantonConnectProvider.tsx` lives at `src/` root, not in `components/`.** It renders only `<Context.Provider>{children}</Context.Provider>` — no markup, no visible state, no `ref` — so it is context infrastructure, and the component-authoring rules in [`../CLAUDE.md`](../CLAUDE.md) (a11y state exposure, `ref` as an ordinary prop, role-based tests) do not apply to it. Agreed on PR #45, which deliberately left this package out of its sweep.
- **`src/testing/` is a published subpath export** (`./testing` in `package.json`), unlike `canton-dappbooster`'s package-local `src/testing/`. The root rule that `testing/` is never imported from non-test code still holds here and is enforced by Biome; the export exists because the fake wallet is useful to *other* packages' test suites.

## The machine

- `setup()` with parameterized actions and guards. Every actor reads its sdk off the invoke's input, so leaving the state stops it and drops its listener.
- A state carries a tag for each question it can already answer, and none while an answer is pending. The tag union in `connectionMachine.ts` is the contract; [`architecture/connection-machine.md`](architecture/connection-machine.md) is the reference. When the two disagree, fix the chapter.
- The one delay, `disconnectTimeout`, is driven in tests by xstate's `SimulatedClock`. No test waits on wall-clock time.
- `testing/connectionInput.ts` and `testing/accountsInput.ts` build inputs whose sdk methods never answer; a test overrides the one it needs.

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
- `pnpm run coverage`
- `pnpm run typecheck`
