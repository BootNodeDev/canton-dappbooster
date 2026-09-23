---
title: Coming from wagmi
---

The hook names follow wagmi, so a developer arriving from it knows which one to reach for. The result shapes do not, and this is where.

| wagmi | canton-connect | why |
|---|---|---|
| `connectors: [injected(), walletConnect({ projectId })]` | `walletConnectProjectId`, `additionalAdapters: [new RemoteAdapter(...)]` for a gateway | Extensions are discovered automatically; there is no connector to list for them. `networkId` is the CAIP-2 chain the wallet must serve. |
| none | `useConnect().cancelConnect` | Abandons a connect in flight, rejecting it with `ConnectCancelledError`; wagmi has no cancel. |
| `useAccount().address` | `useAccount().account.partyId` | A Canton identity is a party, and the account carries it alongside its key, signing provider and network. |
| `useAccount().chain`, `.chainId` | `useAccount().account.networkId` | The wallet reports the network per account, so it travels with the account rather than beside it. |
| `useAccount().addresses`, `.connector` | none | Not exposed yet. |
| none | `useWalletStatus().isLocked` | Connected-but-locked is a CIP-0103 state. |
| `status: 'connected'` implies an address | `isConnected` with `account` still `undefined` | The primary is the user's choice in the wallet, so where the wallet flags none there is nothing to report. |
| none | `usePartyType().readPartyType()`, resolving `'local'` or `'external'` | Canton parties come in two kinds and the reference gateway refuses `signMessage` for a local one; wagmi has one kind of account. |
| none | `useLedger().userRights()`, resolving `UserRight[]` | What the ledger user behind the wallet may act or read as, which can be more parties than the connected one; an Ethereum account needs no grant to act, so wagmi has nothing to ask. |
| `useWriteContract` then `useWaitForTransactionReceipt` | `useExecute().execute`, resolving after execution with the `updateId` | The wallet submits and waits; one call covers both. |
| `error.name === 'ContractFunctionExecutionError'`, `BaseError.shortMessage` | `error instanceof CantonError`, its `code` and `errorCategory`; `isRetryable(error)` | The participant's own rejection, read out of whatever the wallet wrapped it in. A gateway reports every failure under one JSON-RPC code, so only Canton's `code` tells them apart; `isRetryable` reads its retry hint. |
| `useTransactionReceipt(hash).logs` | `useLedger().transaction<Payload>(updateId).events` | The committed transaction's events, discriminated on `kind`; a created one carries its contract with the payload typed as `Payload`, an exercised one the choice's argument and result. |
| `useContractEvents`, `getLogs` | `useLedger().transactions<Payload>({ templateId })` | One template's history a page at a time, from the ledger's start to its end unless told otherwise. |
| none | `useExecute().lastTx` | The wallet pushes `pending`, `signed`, `executed`, `failed` as it goes; wagmi has no hook returning a stream. |
| `useSignMessage().data`, a hex string | `useSignMessage().signature` | The name says the type. |
| `useReadContract` | `useActiveContracts<Payload>({ templateId })`, returning `{ contracts, isLoading, error, refetch }` | The connected party's contracts of one template; the payload type is the dApp's to name, since only it knows its Daml model. `contracts`, not `data`, and `undefined` until the first read answers, so an empty array means none. |
| `useBlockNumber({ watch: true })` plus `refetch` in an effect | `useActiveContracts({ templateId, watch: pollEvery(ms) })` | Follows the template's transactions from the snapshot's offset rather than re-reading on every change; `watch` takes any `WatchSource`, so the timer is only the default. |
| `readContract` from `@wagmi/core` | `useLedger().activeContracts<Payload>({ templateId })`, resolving `{ contracts, offset }` | The same read, once, envelope unwrapped, with the offset the snapshot was taken at, which is where following changes resumes. |
| `useReadContracts` over one ABI | `useLedger().activeContractsByInterface<View>({ interfaceId })`, resolving `{ contracts, offset }` | Every contract implementing one Daml interface, whatever its template, with the interface view as the one shared shape. |
| `getTransactionReceipt` by hash | `useLedger().contractById<Payload>(contractId)`, resolving `{ contract, archivedOffset }` | One contract already in hand, live or archived: Canton answers a contract id with its create and its archival, so `archivedOffset` undefined is the whole of "still active". |
| `useChains()` | `useLedger().connectedSynchronizers()`, resolving `ConnectedSynchronizer[]` | Read off the ledger for the connected party rather than configured: a participant can sit on several synchronizers, and `permission` says what it may do for the party on each. |
| `usePublicClient().request` | `useLedger().ledgerApi`, untyped, gated by `isReady` | The participant's JSON API; the route is templated, with values in `path`, never written into the string. |
| `@wagmi/core` actions over `createConfig` | `createLedger(ledgerApi)` from `@bootnodedev/canton-connect/core` | The same reads without React or a wallet session; the caller hands it the call that answers them, and names the party on each read. |
| `mutate`, `mutateAsync`, `status`, `variables`, `data` | none; `isPending`, `error`, `reset` carry over | No TanStack Query underneath. |
