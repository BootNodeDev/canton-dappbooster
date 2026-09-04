---
title: Coming from wagmi
---

The hook names follow wagmi, so a developer arriving from it knows which one to reach for. The result shapes do not, and this is where.

| wagmi | canton-connect | why |
|---|---|---|
| `useAccount().address` | `useParty().party.partyId` | A Canton identity is a party. |
| `useAccount().addresses`, `.connector`, `.chain` | none | Not exposed yet. |
| none | `useWalletStatus().isLocked` | Connected-but-locked is a CIP-0103 state. |
| `useWriteContract` then `useWaitForTransactionReceipt` | `useExecute().execute`, resolving after execution | The wallet submits and waits; one call covers both. |
| none | `useExecute().lastTx` | The wallet pushes `pending`, `signed`, `executed`, `failed` as it goes; wagmi has no hook returning a stream. |
| `useSignMessage().data`, a hex string | `useSignMessage().signature` | The name says the type. |
| `usePublicClient()`, a typed client | `useLedger().ledgerApi`, untyped, gated by `isReady` | The participant's JSON API, passed through the wallet's session. |
| `mutate`, `mutateAsync`, `status`, `variables`, `data` | none; `isPending`, `error`, `reset` carry over | No TanStack Query underneath. |
