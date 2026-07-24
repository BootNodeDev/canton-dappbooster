# Wallet Service

Express JSON-RPC bridge between Carpincho and the Splice LocalNet `app-user`
participant.

It is intentionally app-agnostic: app-specific Daml commands come from the
consumer, Carpincho owns signing and approval UI, and this service only handles
Canton connectivity, participant reads, prepared transaction execution, and
wallet-internal party onboarding.

## Run

`npm run canton:up` (the root [quick start](../../README.md#quick-start)) brings
this service up alongside Postgres and Canton. Verify it from the repo root:

```bash
npm run wallet-service:health
```

For host-side iteration with no Docker, run it standalone in [mock mode](#mock-mode):

```bash
WALLET_SERVICE_MOCK=1 npm run wallet-service:dev
```

## Token

Real Canton calls require a bearer token accepted by Splice LocalNet.
wallet-service does not mint this token at boot. It requires
`CANTON_BACKEND_TOKEN`.

Generate one from the repo root:

```bash
npm run canton:token -- ledger-api-user
```

Paste the printed `CANTON_BACKEND_TOKEN=...` line into
`canton-barebones/.env`, then start the stack.

Mock mode does not require a token.

## API Boundary

The public dApp surface is CIP-0103. Carpincho exposes that provider to dApps;
this service exposes only the HTTP JSON-RPC bridge Carpincho needs at:

```text
POST /rpc
```

- [CIP-0103 Provider API](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#provider-api)
- [CIP-0103 Synchronous dApp API](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#synchronous-dapp-api)
- [Vendored OpenRPC dApp API](api-specs/openrpc-dapp-api.json)

Service-specific methods:

| Method               | Caller                          | Purpose                                                                                                          |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `prepareTransaction` | Carpincho                       | Calls Canton interactive submission prepare and returns the prepared transaction payload/hash for local signing. |
| `executePrepared`    | Carpincho                       | Submits Carpincho's signature over a prepared transaction to Canton.                                             |
| `ledgerApi`          | Carpincho on behalf of the dApp | Proxies app-user JSON API reads/writes and injects `CANTON_BACKEND_TOKEN`.                                       |

### CIP-56 token methods

These add Canton token-standard reads and transfers plus Amulet (Canton Coin) preapproval. They are token-standard / Amulet logic, not consumer-dApp logic.

| Method | Purpose |
| --- | --- |
| `cip56.listHoldingSummary` | Per-instrument token balance summaries for a party (Amulet summaries via scan proxy; other tokens via holding UTXOs). |
| `cip56.listHoldings` | Raw token holding UTXOs for a party. |
| `cip56.listPendingTransfers` | Pending incoming CIP-56 transfer instructions for a party. |
| `cip56.createTransfer` | Prepares a token transfer for the caller to sign and execute. |
| `cip56.acceptTransfer` | Prepares acceptance of a pending incoming transfer. |
| `amulet.preapproval.status` | Reads the Amulet transfer-preapproval (auto-accept) status for a receiver. |
| `amulet.preapproval.create` | Prepares enabling Amulet auto-accept. |
| `amulet.preapproval.cancel` | Prepares disabling Amulet auto-accept. |
| `amulet.preapproval.acceptProposal` | Accepts a `TransferPreapprovalProposal` for the receiver. |
| `amulet.tap` | Prepares the fixed 100 AMT Splice DevNet faucet tap for a receiver (DevNet only). |

The write methods (`create*`, `acceptTransfer`, `amulet.preapproval.create/cancel/acceptProposal`, `amulet.tap`) return prepared transactions; Carpincho signs locally and submits via `executePrepared`.

`prepareExecute`, `prepareExecuteAndWait`, and `signMessage` stay in
Carpincho because they require the user's key and approval UI.

For `ledgerApi` semantics, read the upstream spec instead of duplicating it:

- [CIP-0103 `ledgerApi`](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#ledgerapi)
- [CIP-0103 JSON Ledger API rationale](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#interoperability-with-the-json-ledger-api)
- [`LedgerApiRequest` schema](api-specs/openrpc-dapp-api.json)

## Admin Endpoints

External party onboarding is wallet/provider operational logic, not generic
dApp API. See
[CIP-0103 topology-related capabilities](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#topology-related-capabilities).

Carpincho uses these wallet-internal endpoints:

| Endpoint                     | Purpose                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /admin/party/prepare`  | Prepares the external party topology transaction and returns `{ onboardingId, partyId, multiHash }`. |
| `POST /admin/party/complete` | Submits the signed topology transaction, grants user rights, and returns the created party.          |

These endpoints stay outside `/rpc` so the dApp API remains a projection of
the CIP/OpenRPC surface.

## Mock Mode

`WALLET_SERVICE_MOCK=1` short-circuits Canton SDK calls and returns canned
responses from [`src/mock.ts`](src/mock.ts). This is useful for wallet-only
iteration with no Docker, Canton, or Daml SDK running.

Mock mode reports `mock: true` from `GET /health` and
`GET /wallet-service/info`; no Canton JWT is required.

The mock intentionally implements only the participant read shape currently
used by the dApp frontend for ACS reads:

```text
POST /v2/state/active-contracts
```
