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

  if (!isConnected) {
    return (
      <div>
        <button onClick={() => connect().catch(() => undefined)} disabled={isConnecting}>
          Connect
        </button>
        {connectError !== undefined && <p>{connectError.message}</p>}
      </div>
    )
  }

  if (isLocked) {
    return <p>Wallet locked — unlock it to continue.</p>
  }

  // ... your dApp: party.partyId, signMessage(text), execute(params), ledgerApi(params)
}
```

`connect()` opens the SDK's wallet picker — a popup by default. There's no
mode argument; the picker is what chooses the wallet.

Closing the picker rejects with `ConnectCancelledError`, which `connectError`
mirrors, so a cancel is told from a failure with `instanceof` rather than by
matching an SDK message. A custom `walletPicker` should throw it too.

## Reference

Every hook and every config field is documented in JSDoc, which your editor surfaces at the call
site and which is published at
[docs-canton-dappbooster.vercel.app](https://docs-canton-dappbooster.vercel.app). There is no table
here: a copy beside the code drifts from it, and a reader who trusted the copy has no way to tell.

Start at `CantonConnectProvider` and `CantonConnectConfig`; the hooks are `useConnect`, `useParty`,
`useWalletStatus`, `useSignMessage`, `useExecute` and `useLedger`. Which wallets the picker offers is
decided by three config fields: `walletConnectProjectId`, `walletPicker` and `additionalAdapters`.

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

See [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md) for the facade wrapper, the
adapter/picker seams, and the event flow.

## Testing

```bash
pnpm test
```

vitest + jsdom, with React Testing Library for hook/component tests.
