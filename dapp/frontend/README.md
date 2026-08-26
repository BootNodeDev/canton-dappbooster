# @canton-dappbooster/frontend — Canton Coin vesting dApp

dApp for **Canton Coin vesting**: propose a grant, the beneficiary accepts, claim as it
vests, or cancel into a residual claim. Grants render live vested/claimable figures from
the pure schedule math in [`src/utils/schedule.ts`](src/utils/schedule.ts).

Every read and every write goes through the connected CIP-0103 wallet, so the app acts as
the wallet's primary account and each write raises a real approval prompt. There is no
mock mode: without a deployment config and a wallet session the pages show a connect
placeholder. See the root [README](../../README.md) for the wider stack.

> The frontend was imported from `cn-dappbooster@feat/vesting-lite` — see
> [`PROVENANCE.md`](PROVENANCE.md). The DAML package it speaks to now lives in
> [`../daml/vesting-lite`](../daml/vesting-lite).

## Run

From the repo root (one `pnpm install` links every workspace):

```bash
pnpm run canton:up
pnpm run deploy-dar -- canton-barebones/dars/vesting-lite-0.0.1.dar
node scripts/bootstrap-vesting-lite.mjs   # writes public/vesting-lite-parties.json
pnpm run app:dev                          # → http://localhost:3012
```

The bootstrap file is the deployment: it carries the package id and the operator factory's
explicit-disclosure payload, without which a grant cannot be created. It is git-ignored,
so it is per-machine and re-runnable.

Connect with a CIP-0103 browser wallet; the party it reports is the one you act as, and
the session is restored on reload by the wallet itself. Changing the wallet's primary
account changes the party the dApp acts as. The one env knob, the explorer party ids link
to, defaults to the local Splice Scan; override it by copying [`.env.example`](.env.example)
to `.env.local`.

## How it fits together

The internal seams and the reasoning behind them are in
[`architecture.md`](architecture.md).
