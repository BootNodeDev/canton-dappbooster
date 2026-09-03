# Agent Configuration: canton-connect

Applies only to `canton-connect/`. Repo-wide rules: [`../CLAUDE.md`](../CLAUDE.md). Deltas only.

## Scope

A thin React layer over `@canton-network/dapp-sdk`'s `DappSDK`, which owns discovery, the picker,
the session and the transports. Browser-only, and built to stay cheap to delete.

## Working rules

- **Wrap the facade.** One `DappSDK`, in the machine's context. No connectors, no
  `ConnectorProvider`, no connector abstraction.
- **Lifecycle rules live in `machine/`**, never a second copy in React. The account read is
  `accountsMachine`, invoked inside `session.authenticated`.
- **The sdk is machine context**, built by the input's `createSdk` and rebuilt by `retireSdk`
  wherever an instance is poisoned. Never React state.
- **Input is read once, at actor creation.** A changed `config` prop reaches the hooks, not the
  lifecycle; remount the provider (`key`) to change it.
- **A state carries a tag for what it means to the outside.** The tags union in
  `machine/connectionMachine.ts` is the authority, and no other module names a state. A state that
  answers an operation must carry its tag or the bridge waits forever: `waitFor` is unbounded here,
  and no clock will rescue it.
- **A state's `exit` clears what that state alone justified.** `party` is cleared on leaving
  `session.authenticated`, because a wallet that stops serving requests has none to offer, and a
  lock cannot be told from a wallet-side disconnect. `sdk` has no exit; nothing outlives it.
- **Listeners register only inside a state's `invoke`.** `sdk.onX` binds to the current client and
  `sdk.connect()` swaps it.
- **The provider selects nothing.** It publishes the config, the actor and four actions; each hook
  selects its own slice. Never add a field a hook could select.
- **Publish the narrowest type.** `ConnectionSubscription` puts `send` out of reach; `WalletSdk`
  narrows `DappSDK` to the methods this package calls.
- **React owns two things:** `lastTx` (`useExecute`) and the `toConnectError` memo (`useConnect`).
  Anything else that looks like state belongs in the machine.
- **Import the SDK's types.** A `param as Parameters<…>` cast is a duplicated type: import the real
  one from `dapp-sdk` or `core-types`.
- **The picker is `CantonConnectConfig.walletPicker`.** No picker UI in this package; that lives in
  `canton-dappbooster` and `canton-theme`.
- **Never import `@canton-network/core-wallet-ui-components`.** A second copy of its module-level
  popup state breaks the SDK's retry prompt with `"Wallet picker is not open"`.
- **The mock adapter answers the connect flow only.** A canned `execute` or `signMessage` would be
  indistinguishable from a real wallet's.
- **The hook and config surface is documented in JSDoc, and nowhere else.** The published reference
  is generated from it, and a table beside the code drifts from it unnoticed.
- **App-agnostic.** No imports from `dapp/`; name no wallet.

## Bumping `dapp-sdk`

`guardedConnect` rests on two SDK internals no test can pin: that the picker window comes from
`window.open`, and the shape of the `SPLICE_WALLET_PICKER_RESULT` message it reads and posts. Why:
[`architecture/popup-close-guard.md`](architecture/popup-close-guard.md). Serve `dapp/frontend` and
walk all four:

1. Close the picker without choosing, three times over: the button re-enables each time, and the
   next real connect raises exactly one approval prompt.
2. Choose an extension, then close the picker: the button stays pending, and the connect completes
   when the wallet answers.
3. Both of those again on a wallet that reuses the popup the SDK left open (a gateway or
   WalletConnect one), where a close after choosing must fail the connect.
4. Check that `new DappSDK()` still only initializes fields (true on 1.5.1). The machine constructs
   one inside a plain `assign`; if construction turns effectful, move the ritual into the provider's
   `createSdk` and dispose the abandoned instance on the same transition, never from an effect.

## Layout

- `machine/` holds the lifecycle: both machines and their actors. `connectError`, `guardedConnect`,
  `walletAccount` and `types` stay flat at `src/`, and a new leaf module joins them; no `utils/`.
- `CantonConnectProvider/` is the provider plus the bridges it composes. It renders only
  `<Context.Provider>`, so the root's component-authoring rules do not apply to it.
- `mock/` is source, not a double: the barrel exports `createMockAdapter`, so `testing/` cannot
  hold it.
- `testing/` is the published `./testing` subpath, and only four names are on its barrel:
  `createFakeWallet`, `createAutoPicker`, `FakeSessionProvider`, `pause`. The rest is suite-local.

## Testing

- Drive the real facade with `createFakeWallet` plus `createAutoPicker`; reach for
  `FakeSessionProvider` when a test needs a session state and no wallet.
- **Test our seam, not the SDK's.** Discovery, pairing, the popup and session restore are the SDK's.
- `pnpm coverage` reports the suite with `testing/`, `mock/` and the barrel excluded.
- The one path no test reaches is the SDK popup's own close, which the bump pass above covers.
