# canton-connect

wagmi-style React hooks for connecting Canton dApps to CIP-0103 wallets, over
`@canton-network/dapp-sdk`'s `DappSDK` facade.

## Why

`dapp-sdk` handles wallet discovery, the connect picker, the session and every transport (browser
extension, WalletConnect, remote gateway), but ships no React hooks. This package adds that layer.
A consumer never calls the SDK: it installs it as a peer, and the hooks take the SDK's own parameter
types.

[`@partylayer/react`](https://partylayer.xyz) is the alternative, built over its own wallet
adapters. This one wraps Digital Asset's official SDK, the dependency these dApps already carry, and
stays thin enough to delete. How close the result shapes should sit to wagmi's is open in #52.

## Why a state machine

The connection lifecycle looks like four states (idle, connecting, connected,
disconnected) and isn't. The hard part isn't holding state, it's canceling work
when the state that started it is gone: a picker the user walked out of, a lock
that races the account read, a connect asked for mid-disconnect, a wallet that
answers late or never. Handled one at a time these were five separate races
(#76). A state machine folds them into one model: a state's invoked work is
canceled when the state is left, and the combinations that used to be bugs
(connected with no party, an error beside a live session) are states that name
their case: `session.unauthenticated`, `session.authenticated.unavailable`.

Most of that weight works around `@canton-network/dapp-sdk` gaps, not domain
complexity (below). When those close upstream, this layer collapses to its floor
(idle-vs-disconnected, the account-read states, the CIP-0103 lock/disconnect
ambiguity), small enough that a lighter store wins on bundle size. A spike
reimplementing it on zustand confirmed this: full behavioral parity, but the win
is bundle size and one fewer dependency, not less logic, and it points to
switching only once those gaps close. Until then, the machine earns its cost.

| dapp-sdk gap | what it costs us | gone when |
|---|---|---|
| `connect()` can't be aborted; a closed popup hangs it (#49) | `guardedConnect`, `settleAbandonedConnect`, `PickerClosedError`, the `retiring` state | `connect(signal)` truly aborts |
| `init()` caches a rejected promise forever | `retireSdk`, the `retiring` state, `InitFailedError` | `init()` retries after a failure |
| `disconnect()` has no timeout (#105) | `DISCONNECT_TIMEOUT_MS`, and `retireSdk` when it fires | `disconnect()` times out itself |
| lock and wallet-side disconnect are one push | `session.unauthenticated`, party-dropped-on-lock | CIP-0103 separates them (spec, not SDK) |

## Status

Consumed by `dapp/frontend` in this repo as a workspace package. Not published (`private: true`).

## Install

Peers a consumer installs beside it: `@canton-network/dapp-sdk`, `@canton-network/core-types`,
`react` 19 and `@walletconnect/sign-client`. The last is declared optional, but `dapp-sdk` imports
it statically at the top of its bundle (checked on 1.5.1), so it has to be present whether or not
you set `walletConnectProjectId`. Only the session is lazy: `SignClient.init()` runs when a pairing
starts, not at import.

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
    return <p>Wallet locked. Unlock it to continue.</p>
  }

  // ... your dApp: party.partyId, signMessage(text), execute(params), ledgerApi(params)
}
```

`connect()` opens the SDK's wallet picker, a popup by default. There is no mode argument: the picker
is what chooses the wallet. Dismissing it rejects with `ConnectCancelledError`, which you filter by
`instanceof`, never by message. Whether `connectError` records it as well depends on which side saw
the close, so do not gate on that.

`signMessage`, `execute` and `ledgerApi` refuse with no session, and refuse again while the wallet
reports it is not authenticated; that is `isLocked`, and it happens after a successful connect. The
SDK's status carries one `isConnected` flag, so a lock and a wallet-side disconnect look the same
here. `useLedger().isReady` covers both, and `useParty().party` is `undefined` for the duration:
gate session content on the party, and use `isLocked` only to explain why it went away.

## Reference

Every hook and every config field is documented in JSDoc, which your editor surfaces at the call
site and which is published at
[docs-canton-dappbooster.vercel.app](https://docs-canton-dappbooster.vercel.app). Start at
`CantonConnectProvider` and `CantonConnectConfig`.

## Testing helpers

- `createMockAdapter()`, from the package root: a `ProviderAdapter` answering `connect`,
  `disconnect`, `status` and `listAccounts` with no wallet installed, so a dApp or a test can
  connect and show a party. Anything else throws, naming the method.
- From `@bootnodedev/canton-connect/testing`: `createFakeWallet()`, a CIP-0103 extension driven over
  `postMessage` that exercises the SDK's real announce and detect path; `createAutoPicker()`, a
  headless picker so `connect()` runs without a popup; `FakeSessionProvider`, the context rehydrated
  at an asked-for session with no SDK behind it; and `pause(ms)`, a real-timer sleep.

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

[`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md)
maps the seams; its `architecture/` chapters carry the connection machine and the popup close guard.

## Testing

`pnpm test`: vitest + jsdom + Testing Library. `pnpm coverage` runs the same suite under v8, with
`testing/`, `mock/` and the barrel excluded.
