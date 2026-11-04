# @bootnodedev/canton-connect

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. This package is its hooks layer: the wallet connection and the ledger reads. The complete kit, the installer and the guides live at [dappbooster.cc](https://dappbooster.cc).

React hooks for connecting a Canton dApp to a CIP-0103 wallet, in the style of wagmi. They wrap the `DappSDK` facade from `@canton-network/dapp-sdk`. You don't need to call the SDK yourself, and the hooks take its own parameter types. [Coming from wagmi](https://components.dappbooster.cc/documents/_bootnodedev_canton-connect.Coming_from_wagmi.html) maps the hook results to what you already know.

The API reference is at [components.dappbooster.cc](https://components.dappbooster.cc/).

## Installation

With npm:

```bash
npm install @bootnodedev/canton-connect @canton-network/dapp-sdk @walletconnect/sign-client
```

With pnpm:

```bash
pnpm add @bootnodedev/canton-connect @canton-network/dapp-sdk @walletconnect/sign-client
```

> [!NOTE]
> `@walletconnect/sign-client` is required even though `dapp-sdk` marks it optional: `dapp-sdk` imports it statically (checked on 1.8.0), with or without `walletConnectProjectId`. Only the session is lazy; `SignClient.init()` runs when a pairing starts.

## Usage

```tsx
import { CantonConnectProvider } from '@bootnodedev/canton-connect'

// Wrap the app once; networkId is the CAIP-2 chain the wallet must serve
function Root() {
  return (
    <CantonConnectProvider config={{ appName: 'My dApp', networkId: 'canton:local' }}>
      <App />
    </CantonConnectProvider>
  )
}
```

<details>
<summary>Full example: every hook</summary>

```tsx
import {
  ConnectCancelledError,
  useAccount,
  useConnect,
  useExecute,
  usePartyType,
  useSignMessage,
  useWalletStatus,
} from '@bootnodedev/canton-connect'

// Connect
function Connect() {
  const { connect, isPending, error } = useConnect()

  // connect() opens the wallet picker; closing it rejects with ConnectCancelledError
  const open = () => connect().catch(() => undefined)

  // a wallet failure lands in error; a cancel is not worth a message
  const failure = error instanceof ConnectCancelledError ? undefined : error

  return (
    <>
      <button onClick={open} disabled={isPending}>Connect</button>
      {failure !== undefined && <p>{failure.message}</p>}
    </>
  )
}

// Session state
function Session() {
  const { account } = useAccount()
  const { isLocked } = useWalletStatus()

  // the wallet keeps the session but answers nothing until the user unlocks it
  if (isLocked) {
    return <p>Wallet locked. Unlock it to continue.</p>
  }

  // nothing connected, or the account read still in flight
  if (account === undefined) {
    return <p>No session.</p>
  }

  return <span>{account.partyId}</span>
}

// Sign a message
function Sign() {
  const { signMessage, signature, isPending, error } = useSignMessage()

  // throws without a session, while locked or with no party; a wallet refusal lands in error too
  const sign = () => signMessage('Approve vesting claim').catch(() => undefined)

  return (
    <>
      <button onClick={sign} disabled={isPending}>Sign</button>
      {signature !== undefined && <code>{signature}</code>}
      {error !== undefined && <p>{error.message}</p>}
    </>
  )
}

// Submit commands
function Claim() {
  const { execute, lastTx, isPending } = useExecute()

  // acts as the party useAccount reports and resolves once executed; the same guards as signMessage
  const claim = () => execute({ commandId: 'claim-1', commands }).catch(() => undefined)

  // the wallet pushes pending, signed, executed or failed into lastTx as it goes
  return (
    <>
      <button onClick={claim} disabled={isPending}>Claim</button>
      {lastTx !== undefined && <p>{lastTx.status}</p>}
    </>
  )
}

// Local or external party
function SignGuard() {
  const { readPartyType, isReady } = usePartyType()

  // the reference gateway refuses signMessage for a local party, so ask before offering it
  const check = async () => {
    if ((await readPartyType()) === 'local') {
      toast.error('This wallet cannot sign messages for a local party')
    }
  }

  return <button onClick={check} disabled={!isReady}>Check party</button>
}
```

</details>

### Reading the ledger directly

The participant's JSON API, untyped, for what the hooks above do not cover.

```tsx
import { useLedger } from '@bootnodedev/canton-connect'

function UserRights() {
  const { ledgerApi, isReady } = useLedger()

  // keep the route a template and put the values in path; the gateway refuses an interpolated id
  const load = () =>
    ledgerApi({ requestMethod: 'get', resource: '/v2/users/{user-id}/rights', path: { 'user-id': 'alice' } })

  // isReady is false without a session and while locked, when ledgerApi would throw
  return <button onClick={load} disabled={!isReady}>Load rights</button>
}
```

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
> The picker also lets a user paste any gateway URL. That session does not survive a reload; one with a gateway listed here does.

Details in [architecture.md](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md#remote-gateway).

### Connecting through WalletConnect

```tsx
const config = {
  appName: 'My dApp',
  networkId: 'canton:devnet',
  walletConnectProjectId: 'YOUR_REOWN_PROJECT_ID',
}
```

Details in [architecture.md](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md#walletconnect).

## Testing helpers

- `createMockAdapter()`, from the package root: a `ProviderAdapter` that answers `connect`, `disconnect`, `status` and `listAccounts` with no wallet installed, so a dApp or a test can connect and show a party. Every other method throws.
- `@bootnodedev/canton-connect/testing`: `createFakeWallet()`, a CIP-0103 extension driven over `postMessage` through the SDK's real announce and detect path; `createAutoPicker()`, a headless picker so `connect()` needs no popup; `FakeSessionProvider`, the context at the session you ask for, no SDK behind it; `pause(ms)`, a sleep on real timers.

```tsx
import { CantonConnectProvider, createMockAdapter } from '@bootnodedev/canton-connect'
import { createAutoPicker } from '@bootnodedev/canton-connect/testing'

const config = {
  appName: 'My dApp',
  additionalAdapters: [createMockAdapter()],
  walletPicker: createAutoPicker(),
}
```

## Working on the package

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm build` | tsdown build into `dist/`: ESM `index.js` and `testing/index.js`, each with its `.d.ts` |
| `pnpm test` | vitest with jsdom and Testing Library, run against `src` |
| `pnpm coverage` | the same suite under v8, excluding `testing/`, `mock/` and the barrel |
| `pnpm typecheck` | `tsc --noEmit` |

Published to npm. The examples in `example-dapps/` use it and link this folder while their range matches its version.

> [!NOTE]
> The wallet SDK leaves gaps a dApp would otherwise have to cover. canton-connect handles them in a state machine, so the UX stays robust. See [architecture.md](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-connect/architecture.md#the-lifecycle-machine) for details.
