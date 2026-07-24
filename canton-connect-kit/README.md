# canton-connect-kit

wagmi-style React hooks for connecting Canton dApps to CIP-0103 wallets.
Pairs with `carpincho-wallet`, but works with any wallet that implements
the canonical CIP-0103 provider surface.

## Why

The Canton ecosystem has the equivalent of `ethers.js`
(`@canton-network/dapp-sdk`, `@canton-network/core-splice-provider`), but
there's no widely-adopted equivalent of `wagmi` / `RainbowKit` / `ConnectKit`
— the React layer that:

- Provides hooks (`useConnect`, `useParty`, `useSignMessage`, …)
- Bundles connectors (injected extension, WalletConnect)
- Manages event subscriptions as React state
- Exposes lifecycle (lock/unlock) as derived UI state

This package fills that gap for the dApp scaffold. EVM devs cloning
the scaffold should recognise the patterns from day one.

## Status

Early — used by `dapp/frontend` in this repo. Not yet a published
artifact. The hook signatures are stable enough to depend on; the
implementation underneath may swap to delegate to `@partylayer/sdk` if that
ecosystem matures.

For the full local stack that consumes this package, follow the root
[quick start](../README.md#quick-start).

## Hook surface

```tsx
import {
  ConnectKitProvider,
  useConnect,
  useParty,
  useWalletStatus,
  useSignMessage,
  useExecute,
  useLedger,
} from 'canton-connect-kit'

function App() {
  return (
    <ConnectKitProvider config={{ appName: 'My dApp' }}>
      <Dapp />
    </ConnectKitProvider>
  )
}

function Dapp() {
  const { connect, disconnect, isConnecting } = useConnect()
  const { party, isConnected } = useParty()
  const { isLocked } = useWalletStatus()
  const { signMessage, signature, isSigning } = useSignMessage()
  const { execute, lastTx } = useExecute()
  const { ledgerApi } = useLedger()

  if (isLocked) {
    return <p>Wallet locked — please unlock your wallet to continue.</p>
  }

  // ... your dApp
}
```

## Hook reference

| Hook | Returns | Notes |
|---|---|---|
| `useConnect()` | `{ connect(mode), disconnect(), isConnecting, isConnected, connectError }` | `connect('extension' \| 'walletconnect' \| 'preferred')`. The extension path uses the injected CIP-0103 provider; WalletConnect requires `walletConnectProjectId`. Throws if called outside `<ConnectKitProvider>`. |
| `useParty()` | `{ party: { partyId, network } \| undefined, status, isConnected }` | `party` updates reactively when the wallet's primary changes (via `accountsChanged`). |
| `useWalletStatus()` | `{ isLocked, isConnected }` | Tracks `statusChanged` / `connected` lifecycle events from the wallet. Drives lock-detection UX. |
| `useSignMessage()` | `{ signMessage(text), signature, isSigning, error, reset() }` | Promise lifecycle exposed as React state, wagmi pattern. The Promise also resolves with the signature for imperative use. |
| `useExecute()` | `{ execute(params), lastTx: { status, commandId } \| undefined, isExecuting }` | Wraps `prepareExecuteAndWait`; subscribes to `txChanged` for live status (`pending → signed → executed / failed`). |
| `useLedger()` | `{ ledgerApi(params) }` | Raw participant pass-through for reads the hooks don't cover. |

## Architecture

See [`architecture.md`](architecture.md) for provider, connector, hook, and event-flow structure.

## Relationship to PartyLayer

[`@partylayer/sdk`](https://partylayer.xyz) is an existing wagmi-style
package for Canton. The team chose to roll their own here because PartyLayer
is currently sub-1.0 with explicit "minor versions may contain breaking
changes" notes, and the scaffold needs a stable hook surface it controls.

The hook signatures in this package are deliberately wagmi-like, so a
future migration to delegate the implementation under `@partylayer/sdk` (or
any other Canton-wallet-kit) would keep the dApp's `App.tsx` unchanged.

## Testing

```bash
pnpm test
```

`node:test` with `tsx` as the loader; happy-dom + React Testing Library for
component tests. Mirrors `carpincho-wallet`'s setup.
