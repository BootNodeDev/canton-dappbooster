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
| `useWriteContract` then `useWaitForTransactionReceipt` | `useExecute().execute`, resolving after execution | The wallet submits and waits; one call covers both. |
| none | `useExecute().lastTx` | The wallet pushes `pending`, `signed`, `executed`, `failed` as it goes; wagmi has no hook returning a stream. |
| `useSignMessage().data`, a hex string | `useSignMessage().signature` | The name says the type. |
| `readContract` from `@wagmi/core` | `useLedger().activeContracts({ templateId, decode })`, resolving `{ contracts, offset }` | One template's contracts as the connected party, envelope unwrapped. Where wagmi decodes against the ABI you pass, `decode` proves each payload, since only the dApp knows its Daml model; a contract it answers `undefined` for is skipped. `templateId` takes only the package-name form, `#my-app:Main:Grant`, not the package id a contract's own `templateId` comes back as. The offset is where following changes resumes. |
| `useReadContract`, `usePublicClient().request` | `useLedger().ledgerApi`, untyped, gated by `isReady` | The participant's JSON API; the route is templated, with values in `path`, never written into the string. |
| `mutate`, `mutateAsync`, `status`, `variables`, `data` | none; `isPending`, `error`, `reset` carry over | No TanStack Query underneath. |
