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

The app needs a Canton LocalNet, wallet-service on port 3010 and the vesting DAR deployed
before it renders anything; the root [README](../../README.md) is the whole bring-up. Once
that is up, from the repo root (one `pnpm install` links every workspace):

```bash
pnpm run build-dar
pnpm run deploy-dar -- dapp/daml/.daml/dist/amulet-vesting-0.0.1.dar
pnpm run bootstrap   # creates the operator and its factory
pnpm run app:dev     # → http://localhost:3012
```

The bootstrap writes nothing. It leaves the operator and the factory on the ledger, and the dApp
finds both once a wallet connects: the operator through the rights the bootstrap granted, the
factory through an active-contracts read that returns its explicit-disclosure payload, without
which a grant cannot be created. Re-running it supersedes the last one, on any ledger.

Funding a grant takes Amulet, and the account menu has a faucet for it: **Tap Amulet** taps
100 AMT into the connected party. It works on LocalNet and devnet, where the choice exists, and
refuses until the SV has opened the first mining round, roughly ten minutes after a fresh start.

Connect with a CIP-0103 browser wallet; the party it reports is the one you act as, and
the session is restored on reload by the wallet itself. Changing the wallet's primary
account changes the party the dApp acts as. Its two env knobs — the explorer party ids
link to and the wallet-service endpoint it builds the Amulet disclosures from — default to
the local stack and are set in the repo root's `.env`; see the root
[`.env.example`](../../.env.example).

## How it fits together

The internal seams and the reasoning behind them are in
[`architecture.md`](architecture.md).
