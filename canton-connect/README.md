# @bootnodedev/canton-connect

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. The installer, the guides and the rest of the stack live at [dappbooster.cc](https://dappbooster.cc).

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

Every hook reads the session the provider holds. `useExecute` does the most: it submits commands through the wallet and tracks the transaction.

```tsx
import {
  CantonConnectProvider,
  useAccount,
  useConnect,
  useExecute,
  useLedger,
  usePartyType,
  useSignMessage,
  useWalletStatus,
} from '@bootnodedev/canton-connect'

// Wrap the app once; networkId is the CAIP-2 chain the wallet must serve
function App() {
  return (
    <CantonConnectProvider config={{ appName: 'My dApp', networkId: 'canton:local' }}>
      <Claim />
    </CantonConnectProvider>
  )
}

function Claim() {
  const { execute, lastTx, isPending } = useExecute()
  // likewise: connect(), account, isLocked, signMessage(), ledgerApi(), readPartyType()

  // resolves once executed; throws without a session, while locked or with no party
  const claim = () => execute({ commandId: 'claim-1', commands }).catch(() => undefined)

  // the wallet pushes pending, signed, executed or failed into lastTx as it goes
  return (
    <>
      <button onClick={claim} disabled={isPending}>Claim</button>
      {lastTx !== undefined && <p>{lastTx.status}</p>}
    </>
  )
}
```

The [API reference](https://components.dappbooster.cc/) has an example for each hook.

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

List a gateway in `additionalAdapters` and its sessions survive a reload. The picker also takes any gateway URL a user pastes, but that session ends on reload.

```tsx
import { RemoteAdapter } from '@canton-network/dapp-sdk'

const config = {
  appName: 'My dApp',
  additionalAdapters: [
    new RemoteAdapter({ name: 'Gateway', rpcUrl: 'http://localhost:3030/api/v0/dapp' }),
  ],
}
```

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

To connect with no wallet installed, in a test or a demo, add the mock adapter, which connects and shows a party but throws on anything else, and skip the picker popup with the auto picker:

```tsx
import { createMockAdapter } from '@bootnodedev/canton-connect'
import { createAutoPicker } from '@bootnodedev/canton-connect/testing'

const config = {
  appName: 'My dApp',
  additionalAdapters: [createMockAdapter()],
  walletPicker: createAutoPicker(),
}
```

`@bootnodedev/canton-connect/testing` has more doubles, such as a fake CIP-0103 wallet and a fake session provider. The [API reference](https://components.dappbooster.cc/modules/_bootnodedev_canton-connect.Testing.html) covers each one.

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
