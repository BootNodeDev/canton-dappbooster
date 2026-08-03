# canton-connect

wagmi-style React hooks for connecting Canton dApps to CIP-0103 wallets,
wrapping `@canton-network/dapp-sdk`'s `DappSDK` facade.

## Why

`@canton-network/dapp-sdk` handles wallet discovery, the connect picker, the
session, and every transport (browser extension, WalletConnect, and — later —
a remote gateway). It doesn't ship React hooks.

canton-connect adds that layer: `useConnect`, `useParty`, `useSignMessage`,
and the rest, wagmi-style. A consumer never touches the SDK directly.

## Why not @partylayer/sdk

[`@partylayer/sdk`](https://partylayer.xyz) is another wagmi-style package for
Canton. This one wraps Digital Asset's official SDK directly — the dependency
these dApps already carry — and keeps the hook layer thin enough to delete once
the SDK ships hooks of its own. The signatures are deliberately wagmi-shaped
either way, so swapping the implementation underneath wouldn't change a dApp's
components.

## Status

Early. No consumer in this repo yet — `dapp/frontend` adopting it is a
planned follow-up. Not published (`private: true` in `package.json`).

## Usage

```tsx
import {
  CantonConnectProvider,
  useConnect,
  useParty,
  useWalletStatus,
  useSignMessage,
  useExecute,
  useLedger,
} from '@bootnodedev/canton-connect'

function App() {
  return (
    <CantonConnectProvider config={{ appName: 'My dApp', networkId: 'canton:local' }}>
      <Dapp />
    </CantonConnectProvider>
  )
}

function Dapp() {
  const { connect, isConnecting, isConnected, connectError } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const { signMessage } = useSignMessage()
  const { execute } = useExecute()
  const { ledgerApi } = useLedger()

  // Rendered in every branch: a rejected connect can land on a still-connected but
  // locked session, so an error shown only while disconnected would never appear.
  const error = connectError === undefined ? null : <p>{connectError.message}</p>

  if (!isConnected) {
    return (
      <div>
        <button onClick={() => connect().catch(() => undefined)} disabled={isConnecting}>
          Connect
        </button>
        {error}
      </div>
    )
  }

  if (isLocked) {
    return (
      <div>
        <p>Wallet locked — unlock it to continue.</p>
        {error}
      </div>
    )
  }

  // ... your dApp: party.partyId, signMessage(text), execute(params), ledgerApi(params)
}
```

`connect()` opens the SDK's wallet picker — a popup by default. Set
`walletSelection: 'in-page'` to skip the popup and render the choice yourself
through `useWalletPicker()`.

One limitation to know: from outside the SDK, a wallet that *rejected* the
connect request is indistinguishable from one that is merely *locked* —
`status()` reports `isConnected: false` for both, and the session persists
either way. That is why the quickstart renders `connectError` in the locked
branch too: after a rejection the UI lands on "Wallet locked", and the error
is the only sign the user declined.

## Hook reference

Every hook throws if called outside `<CantonConnectProvider>`.

| Hook | Returns | Notes |
|---|---|---|
| `useConnect()` | `{ connect, disconnect, isConnecting, isConnected, connectError }` | `connect()` takes no argument — it opens the wallet picker and connects whatever the picker returns. |
| `useParty()` | `{ party, status, isConnected, wallet }` | `party` (`Party \| undefined`: `partyId`, `networkId`, optional `name`/`publicKey`) updates when the wallet's primary account changes. `wallet` names the connected wallet — `undefined` in popup mode. |
| `useParties()` | `{ parties }` | Every usable party the wallet holds, primary first — `party` is always `parties[0]`. Empty while locked or disconnected. |
| `useWalletPicker()` | `{ isOpen, wallets, select, cancel }` | The pending wallet choice in `walletSelection: 'in-page'` mode. `select(providerId)` answers it; `cancel()` rejects the attempt with `UserRejectedError`. Closest wagmi counterpart: `useConnectors()`. |
| `useWalletStatus()` | `{ isLocked, isConnected }` | Tracks the wallet's lock/connect events. |
| `useSignMessage()` | `{ signMessage, signature, isSigning, error, reset }` | `signMessage(message)` resolves with the signature. |
| `useExecute()` | `{ execute, lastTx, isExecuting, error, reset }` | `execute(params)` wraps the SDK's `prepareExecuteAndWait`. `lastTx` follows the live `txChanged` events (`pending → signed → executed / failed`). |
| `useLedger()` | `{ ledgerApi, isReady }` | Raw participant JSON API pass-through for reads the other hooks don't cover. |

`signMessage`, `execute`, and `ledgerApi` all throw `wallet is not connected —
call useConnect().connect() first` if called before connecting.

Two limits a consumer will hit:

- The offered wallet list exists only while a connect attempt is running.
  `useWalletPicker().wallets` fills when `connect()` is waiting on a choice and
  empties when it settles — wallets cannot be enumerated ahead of time.
- Popup mode reports no wallet identity: `useParty().wallet` stays `undefined`.
  By choice — the SDK never says which wallet its own popup selected, and
  observing that popup would mean depending on the SDK's UI bundle.

## Configuration

`CantonConnectConfig`, passed to `<CantonConnectProvider config={...}>`:

| Field | Default | Effect |
|---|---|---|
| `appName` | required | wallet-facing app name; today only read for the WalletConnect adapter's metadata |
| `appDescription`, `appUrl` | unset | also WalletConnect metadata only — inert without `walletConnectProjectId` |
| `networkId` | `'canton:local'` | the CIP-0103 network id; also the WalletConnect adapter's `chainId` |
| `walletConnectProjectId` | unset | set to register the SDK's `WalletConnectAdapter` |
| `walletSelection` | `'popup'` | `'in-page'` skips the SDK popup and publishes the pending choice through `useWalletPicker()` |
| `walletPicker` | unset | a custom `WalletPickerFn`; wins over `walletSelection` — e.g. `createAutoPicker()` in tests |
| `additionalAdapters` | `[]` | extra `ProviderAdapter`s to register, e.g. `createMockAdapter()` |

`walletPicker` and `additionalAdapters` are held by identity: a function or
array written inline in JSX is new on every parent re-render, and each new one
rebuilds the SDK — dropping any live session. Hoist them to module scope or
memoize them. A known constraint, deliberately not designed away.

`@walletconnect/sign-client` is declared an optional peer, but `dapp-sdk` 1.4 imports it
statically at the top of its bundle (`dist/index.js:7`), so it has to be installed whether or not
you set `walletConnectProjectId`. Only the *session* is lazy — `SignClient.init()` runs when a
pairing starts, not at import. Worth an upstream issue; until then, treat it as required.

## Testing helpers

- `createMockAdapter()` — exported from the package root. A `ProviderAdapter`
  that answers `connect`/`disconnect`/`status`/`listAccounts` with no real
  wallet installed, so a dApp (or a test) can connect and show a party.
  Everything else throws, naming the method — a canned `execute` or
  `signMessage` result would be indistinguishable from a real one.
- `createFakeWallet()` and `createAutoPicker()` — exported from
  `@bootnodedev/canton-connect/testing`. `createFakeWallet` is a real
  CIP-0103 extension wallet driven over `postMessage`, for exercising the
  SDK's actual announce → detect → provider-emit path. `createAutoPicker` is
  a headless `WalletPickerFn` that auto-selects an entry (by `providerId`, or
  the first one), for driving `connect()` without a popup.

```tsx
import { CantonConnectProvider, createMockAdapter } from '@bootnodedev/canton-connect'
import { createAutoPicker } from '@bootnodedev/canton-connect/testing'

const config = {
  appName: 'My dApp',
  additionalAdapters: [createMockAdapter()],
  walletPicker: createAutoPicker(),
}
```

## Architecture

See [`architecture.md`](architecture.md) for the facade wrapper, the
adapter/picker seams, and the event flow.

## Testing

```bash
pnpm test
```

vitest + jsdom, with React Testing Library for hook/component tests.
