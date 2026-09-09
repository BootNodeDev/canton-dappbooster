---
title: Coming from wagmi
---

The hook names follow wagmi, so a developer arriving from it knows which one to reach for. The result shapes do not, and this is where.

| wagmi | canton-connect | why |
|---|---|---|
| `connectors: [injected(), walletConnect({ projectId })]` | `walletConnectProjectId`, `additionalAdapters: [new RemoteAdapter(...)]` for a gateway | Extensions are discovered automatically; there is no connector to list for them. |
| none | `useConnect().cancelConnect` | Abandons a connect in flight, rejecting it with `ConnectCancelledError`; wagmi has no cancel. |
| `useAccount().address` | `useParty().party.partyId` | A Canton identity is a party. |
| `useAccount().addresses`, `.connector`, `.chain` | none | Not exposed yet. |
| none | `useWalletStatus().isLocked` | Connected-but-locked is a CIP-0103 state. |
| none | `usePartyType().readPartyType()`, resolving `'local'` or `'external'` | Canton parties come in two kinds and the reference gateway refuses `signMessage` for a local one; wagmi has one kind of account. |
| `useWriteContract` then `useWaitForTransactionReceipt` | `useExecute().execute`, resolving after execution | The wallet submits and waits; one call covers both. |
| none | `useExecute().lastTx` | The wallet pushes `pending`, `signed`, `executed`, `failed` as it goes; wagmi has no hook returning a stream. |
| `useSignMessage().data`, a hex string | `useSignMessage().signature` | The name says the type. |
| `usePublicClient()`, a typed client | `useLedger().ledgerApi`, untyped, gated by `isReady` | The participant's JSON API, passed through the wallet's session. |
| `mutate`, `mutateAsync`, `status`, `variables`, `data` | none; `isPending`, `error`, `reset` carry over | No TanStack Query underneath. |
