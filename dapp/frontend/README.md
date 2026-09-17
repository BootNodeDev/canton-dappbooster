# @canton-dappbooster/frontend — Amulet vesting dApp

dApp for **Amulet vesting**: propose a grant, the receiver accepts, claim as it
vests, or cancel into a residual claim. Accepting locks the funder's Amulet in
escrow and each claim releases part of it, so the figures on screen are real
holdings; grants render live vested/claimable figures from the pure schedule math in
[`src/utils/schedule.ts`](src/utils/schedule.ts).

Every read and every write goes through the connected CIP-0103 wallet, so the app acts as
the wallet's primary account and each write raises a real approval prompt. There is no
mock mode: without a deployment config and a wallet session the pages show a connect
placeholder. See the root [README](../../README.md) for the wider stack.

> The frontend was imported from `cn-dappbooster@feat/vesting-lite` — see
> [`PROVENANCE.md`](PROVENANCE.md). The DAML package it speaks to lives in
> [`../daml`](../daml).

## Run

The app needs a Canton LocalNet, the Wallet Gateway and the vesting DAR deployed before it
renders anything; the root [README](../../README.md) is the whole bring-up. Once that is up,
from the repo root (one `pnpm install` links every workspace):

```bash
pnpm run build-dar
# use the appropriate version for amulet-vesting-*.dar
pnpm run deploy-dar -- dapp/daml/.daml/dist/amulet-vesting-*.dar
pnpm run bootstrap        # creates the operator and its factory
pnpm run wallet-gateway   # → http://localhost:3030
pnpm run app:dev          # → http://localhost:3012
```

The bootstrap writes nothing. It leaves the operator and the factory on the ledger, and the dApp
finds both once a wallet connects: the operator through the rights the bootstrap granted, the
factory through an active-contracts read that returns its explicit-disclosure payload, without
which a grant cannot be created. Re-running it supersedes the last one, on any ledger.

Funding a grant takes Amulet, and the account menu has a faucet for it: **Tap Amulet** taps
100 AMT into the connected party.

> Every write, the faucet included, is currently broken. They all need the `AmuletRules` and
> open mining round disclosures, which `src/backend/transferContext.ts` still fetches over
> JSON-RPC from `VITE_WALLET_RPC_URL`, and nothing serves that endpoint any more. Reads work.

Connect with a CIP-0103 wallet — the Wallet Gateway on http://localhost:3030 is the one the dev
stack starts. The party it reports is the one you act as, and the session is restored on reload by
the wallet itself. Changing the wallet's primary party changes the party the dApp acts as. Its
three env knobs — the explorer party ids link to, the gateway's dApp API, and the JSON-RPC endpoint
above — default to the local stack and are set in the repo root's `.env`; see the root
[`.env.example`](../../.env.example).

## How it fits together

The internal seams and the reasoning behind them are in
[`architecture.md`](architecture.md).
