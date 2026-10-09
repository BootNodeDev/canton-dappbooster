# canton-connect

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. This package is its hooks layer: the wallet connection and the ledger reads. The complete kit, the installer and the guides live at [dappbooster.cc](https://dappbooster.cc).

React hooks for connecting a Canton dApp to a CIP-0103 wallet, in the style of wagmi. They sit on top of the `DappSDK` facade from `@canton-network/dapp-sdk`.

## Why

`dapp-sdk` already does wallet discovery, the connect picker, the session and every transport (browser extension, WalletConnect, remote gateway). What it does not ship is React hooks, so this package adds them. You never call the SDK yourself. You install it as a peer, and the hooks take the SDK's own parameter types.

The alternative is [`@partylayer/react`](https://partylayer.xyz), which comes with its own wallet adapters. This package wraps Digital Asset's official SDK instead, since these dApps depend on it anyway, and it stays thin enough to remove later. If you are coming from wagmi, [coming-from-wagmi.md](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/coming-from-wagmi.md) maps the hook results to what you already know.

## Why a state machine

On paper the connection has four states: idle, connecting, connected, disconnected. In practice the hard part is canceling work after the state that started it is gone. A picker the user closed, a lock racing the account read, a connect requested in the middle of a disconnect, a wallet that answers late or never. We first handled those one by one and ended up with five separate races (#76). A state machine puts them in one model. Work invoked by a state is canceled when that state is left, and the combinations that used to be bugs (connected with no party, an error next to a live session) become named states such as `session.unauthenticated` and `session.authenticated.unavailable`.

Most of that machinery exists to work around gaps in `@canton-network/dapp-sdk`, not because the domain is complex (see the table). Once those gaps close upstream, the machine shrinks to its floor: idle versus disconnected, the account-read states, and the lock/disconnect ambiguity in CIP-0103. At that size a lighter store wins on bundle size. We tried a zustand rewrite as a spike and got full behavioral parity, but the only gains were bundle size and one dependency less, not less logic. So the plan is to switch once the gaps close. Until then the machine pays for itself.

| dapp-sdk gap | what it costs us | gone when |
|---|---|---|
| `connect()` can't be aborted; a closed popup hangs it (#49) | `guardedConnect`, `settleAbandonedConnect`, `PickerClosedError`, the `retiring` state, `retireSdk`'s picker swap | `connect(signal)` truly aborts |
| `init()` caches a rejected promise forever | `retireSdk`, the `retiring` state, `InitFailedError` | `init()` retries after a failure |
| `disconnect()` has no timeout (#105) | `DISCONNECT_TIMEOUT_MS`, and `retireSdk` when it fires | `disconnect()` times out itself |
| lock and wallet-side disconnect are one push | `session.unauthenticated`, party-dropped-on-lock | CIP-0103 separates them (spec, not SDK) |

## Status

Published to npm as `@bootnodedev/canton-connect`. `dapp/frontend` in this repo uses it too, and links the local folder as long as the version satisfies the declared range.

## Install

Install these peers next to it: `@canton-network/dapp-sdk`, `@canton-network/core-types`, `react` 19 and `@walletconnect/sign-client`. The last one is required here even though `dapp-sdk` marks it optional. `dapp-sdk` imports it statically at the top of its bundle (checked on 1.5.1), so it has to be present whether or not you set `walletConnectProjectId`. Only the session is lazy: `SignClient.init()` runs when a pairing starts, not at import time.

## Usage

```tsx
import {
  CantonConnectProvider,
  useConnect,
  useAccount,
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
  const { connect, isPending, isConnected, error } = useConnect()
  const { account } = useAccount()
  const { isLocked } = useWalletStatus()
  const { signMessage } = useSignMessage()
  const { execute } = useExecute()
  const { ledgerApi } = useLedger()

  if (!isConnected) {
    return (
      <div>
        <button onClick={() => connect().catch(() => undefined)} disabled={isPending}>
          Connect
        </button>
        {error !== undefined && <p>{error.message}</p>}
      </div>
    )
  }

  if (isLocked) {
    return <p>Wallet locked. Unlock it to continue.</p>
  }

  // ... your dApp: account.partyId, signMessage(text), execute(params), ledgerApi(params)
}
```

`connect()` opens the SDK's wallet picker, a popup by default. There is no mode argument, the picker is where the wallet gets chosen. Closing it rejects with `ConnectCancelledError`. Check for it with `instanceof`, not by message. Whether `error` records it too depends on which side saw the close, so don't rely on that.

`signMessage`, `execute` and `ledgerApi` refuse to run without a session, and again while the wallet reports it is not authenticated. That second case is `isLocked`, and it can happen after a successful connect. `signMessage` and `execute` also need a party, `ledgerApi` does not. The reference gateway refuses `signMessage` for a local party as well; `usePartyType().readPartyType()` tells you whether a party is local or external. The SDK's status has a single `isConnected` flag, so a lock and a wallet-side disconnect look the same from here. `useLedger().isReady` covers both, and `useAccount().account` is `undefined` for as long as it lasts. Gate session content on the party, and use `isLocked` only to explain why it went away.

### Connecting through a Wallet Gateway

```tsx
import { RemoteAdapter } from '@canton-network/dapp-sdk'

const config = {
  appName: 'My dApp',
  additionalAdapters: [
    new RemoteAdapter({ name: 'Gateway', rpcUrl: 'http://localhost:3030/api/v0/dapp' }),
  ],
}
```

> [!NOTE]
> The dapp-sdk wallet picker also lets a user paste any gateway URL and connect to it without the dApp listing it. That session does not survive a reload. One with a gateway listed here does.

Details in [architecture.md](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md#remote-gateway).

### Connecting through WalletConnect

```tsx
const config = {
  appName: 'My dApp',
  networkId: 'canton:devnet',
  walletConnectProjectId: 'YOUR_REOWN_PROJECT_ID',
}
```

`networkId` is the Canton network the dApp targets, as a CAIP-2 chain id.

Details in [architecture.md](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md#walletconnect).

## Reference

Every hook and config field has JSDoc. Your editor shows it at the call site, and the same text is published at [components.dappbooster.cc](https://components.dappbooster.cc/). Start with `CantonConnectProvider` and `CantonConnectConfig`.

## Testing helpers

- `createMockAdapter()`, exported from the package root, is a `ProviderAdapter` that answers `connect`, `disconnect`, `status` and `listAccounts` with no wallet installed, so a dApp or a test can connect and show a party. Every other method throws and names itself.
- `@bootnodedev/canton-connect/testing` has the rest: `createFakeWallet()`, a CIP-0103 extension driven over `postMessage` that goes through the SDK's real announce and detect path; `createAutoPicker()`, a headless picker so `connect()` runs without a popup; `FakeSessionProvider`, the context rehydrated at the session you ask for with no SDK behind it; and `pause(ms)`, a sleep on real timers.

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

[`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md) maps the seams. The chapters under `architecture/` cover the connection machine and the popup close guard.

## Testing

`pnpm test` runs vitest with jsdom and Testing Library. `pnpm coverage` runs the same suite under v8, excluding `testing/`, `mock/` and the barrel.
