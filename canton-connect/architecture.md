# Architecture: canton-connect

What the package is and how to use it: [`README.md`](README.md). This file maps the seams. Two
subsystems carry their own chapter:
[`architecture/connection-machine.md`](architecture/connection-machine.md) for the states and what
settles each promise, and [`architecture/popup-close-guard.md`](architecture/popup-close-guard.md)
for the SDK bug the guard works around.

## Project structure

```
src/
  machine/
    connectionMachine.ts    the lifecycle; owns the sdk, party, status and the last error
    connectionActors.ts     init / connect / restore / disconnect / walletEvents
    accountsMachine.ts      the account read, invoked inside session.authenticated
    accountsActors.ts       listAccounts reader and accountsChanged listener
  CantonConnectProvider/
    index.tsx               the context: publishes the actor and four actions
    useConnectionActor.ts   creates the actor, sends the boot restore
    useConnectBridge.ts     connect() as a promise over the machine's tags
    useDisconnectBridge.ts  disconnect() as a promise over the machine's tags
    adapters.ts             buildAdditionalAdapters
  hooks/                    the seven public hooks, plus useTxFeed and useWalletCall
  mock/mockAdapter.ts       createMockAdapter, a ProviderAdapter for dev and tests
  testing/                  the ./testing doubles, plus suite-local helpers
  connectError.ts           ConnectCancelledError, PickerClosedError, toConnectError
  guardedConnect.ts         sdk.connect() with a closed-popup watchdog
  walletAccount.ts          account normalization and primary selection
  types.ts                  Party, ConnectionStatus, CantonConnectConfig, WalletSdk, context value
  index.ts                  public exports
```

## Who talks to whom

```mermaid
flowchart LR
  app["consumer dApp"]
  cc["canton-connect"]
  sdk["dapp-sdk"]
  picker["wallet picker"]
  wallet["CIP-0103 wallet"]

  app -->|hooks| cc
  cc -->|calls| sdk
  sdk --> picker
  sdk -->|transport| wallet
  wallet -->|pushes| sdk
  sdk -->|listeners| cc
  cc -->|context| app
```

| edge | what crosses it |
|---|---|
| calls | `init`, `connect`, `disconnect`, `status`, `listAccounts` from the machine's actors; `signMessage`, `prepareExecuteAndWait`, `ledgerApi` from the hooks |
| transport | extension postMessage, WalletConnect, remote gateway |
| pushes | `statusChanged`, `accountsChanged`, `txChanged` |
| listeners | `onStatusChanged`, `onAccountsChanged`, `onTxChanged` |
| context | one `CantonConnectContextValue` |

## Seams

### The lifecycle: `machine/`

One model of connecting, session, lock and disconnect, so the impossible combinations (a party with
no live session, an error beside a live session) cannot be built. Three decisions carry the weight:

- `idle` is not `disconnected`. `idle` means the boot restore has not answered; `disconnected` means
  it has, and there is nothing.
- `party` is cleared on leaving `session.authenticated`, so a wallet that will not serve requests
  publishes none. The session itself stays, which keeps the wallet listener alive: an unlock is
  heard and the party is read again with no reconnect.
- The account read is a child machine, so a failed read cannot end the session; only the promise
  carries the failure.

### The bridges

`connect()` and `disconnect()` are a send plus a wait on a tag, so the promise over a transition
lives outside the machine. Neither passes a timeout. The connect wait has no clock on purpose, since
a wallet login can take as long as it takes; it ends when the wallet answers or the user cancels
(`connect.cancel`). The disconnect wait the machine bounds itself, giving up on a wallet 10 s silent
(`DISCONNECT_TIMEOUT_MS`), since nobody is deciding anything in that window.

### The provider publishes, the hooks select

The context value is the config, the actor as `ConnectionSubscription` (`send` is unreachable
through it, so the bridges stay the only senders) and four identity-stable actions. Each hook
selects its own slice, which is wagmi's shape: `WagmiProvider` publishes, `useAccount` subscribes
itself. `useConnect`, `useDisconnect`, `useParty` and `useWalletStatus` read session state;
`useLedger`, `useExecute`, `useSignMessage` and `usePartyType` select a guard plus the sdk and
call it directly, never entering the machine.

The machine's input is read once, when the actor is created, so a changed `config` prop needs a
remount. One accepted cost: `sdk` in context makes the snapshot unserializable, which rules out
`getPersistedSnapshot`.

### The picker, and the close guard around it

`CantonConnectConfig.walletPicker` decides the picker: omitted, the SDK's popup; injected, a custom
one (`createAutoPicker` in tests). It is fixed at `new DappSDK()`, which is why the provider hands
the machine a `createSdk` closure rather than an instance.

With the SDK popup in use, `guardedConnect` wraps `sdk.connect()` with a watchdog on the popup
window, because the SDK misses a close (#49). A caught close rejects with `PickerClosedError`, which
takes the machine to `retiring`, where the `DappSDK` is replaced. `cancelConnect` lands there too:
the guard closes the popup itself, off the abort xstate fires when it stops the connect actor.

### Adapters

`buildAdditionalAdapters` assembles what `sdk.init` registers beyond the auto-discovered extensions:
a `WalletConnectAdapter` when `walletConnectProjectId` is set, plus `config.additionalAdapters`. The
init actor passes `defaultAdapters: []`, dropping the SDK's bundled `localhost:3030` dev gateway.
`networkId` (default `'canton:local'`) is both the WalletConnect `chainId` and the fallback
`Party.networkId` for a wallet that reports none.

### Remote gateway

Configured like any adapter: `additionalAdapters: [new RemoteAdapter({ name, rpcUrl })]` in
`CantonConnectConfig`, `RemoteAdapter` imported from `dapp-sdk`. Connect, restore, disconnect and
execute all reach a gateway with no change to this package.

The SDK picker lists it by `name`; picking it opens the gateway's login page in the SDK popup,
where a self-signed IDP takes a client id and secret, the gateway pushes the connected status over
SSE, and the party arrives. `useExecute` opens the gateway's review page the same way; approval
there signs and executes (an admin-workflow `Ping` create came back `executed`, with an update id,
in about half a second). The popup-close guard behaves the same on a gateway as on an extension.

Restore after a reload is silent only for a gateway registered through `additionalAdapters` at
init: `RemoteAdapter.restore()` requires the stored discovery URL to match a registered adapter's
`rpcUrl`, so a gateway URL typed into the picker has nothing to match at the next init and its
session does not come back.

A gateway has no lock: its UI offers only Logout, which ends the gateway page's own session, not
the dApp's, so `useWalletStatus().isLocked` never turns true on one. Disconnect from the dApp does
work: status goes to not connected and the SDK clears its session and discovery keys, keeping the
picker's cache.

The gateway checks every `ledgerApi` resource against the Canton JSON API route list exactly (the
templated route with values in `path`, never a concrete URL); extensions accept either.

Run one locally: `npx @canton-network/wallet-gateway-remote@1.10.0 -c config.json`, with
`kernel.clientType: "remote"`, a `server.port` / `dappPath`, one `self_signed` entry in
`bootstrap.idps`, and one `bootstrap.networks` entry pointing `ledgerApi.baseUrl` at the
participant's JSON API with matching `self_signed` `auth` / `adminAuth`. Point the dApp's adapter
at `rpcUrl: 'http://localhost:3030/api/v0/dapp'`.

### The party type

A party under the hosting participant's namespace is local, any other is external. A dApp cares
because the reference gateway refuses `signMessage` for a local party. CIP-0103 has no field for
it, so `usePartyType().readPartyType` derives it when the consumer asks, never in the machine: one
`ledgerApi` read of the participant id (`GET /v2/parties/participant-id`, open to a `CanActAs`
token), its namespace compared with `Party.namespace`, which arrives from the wallet unchanged, as
`signingProviderId` does. A failed read rejects; what follows is the consumer's call. `isLocal` on
the parties endpoint means hosted here, external parties included, so it is not the signal.

### Testing doubles

`createFakeWallet` is a real CIP-0103 extension over `postMessage`, so a test walks the SDK's own
announce, detect and connect path. `createAutoPicker` answers the picker headlessly, and
`FakeSessionProvider` rehydrates the machine at an asked-for state with no SDK behind it.

## Deferred

- Themed in-page picker (#50): its PR (#63) was closed unmerged, so the SDK popup is still the only
  picker; a new attempt starts from the `walletPicker` seam.

For the stack around this package: the root [`architecture.md`](../architecture.md).
