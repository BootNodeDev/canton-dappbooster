# @canton-dappbooster/frontend — Canton Coin vesting dApp

Direct-access dApp for **Canton Coin vesting**: propose a grant, the beneficiary
accepts, claim as it vests, or cancel into a residual claim. Grants render live
vested/claimable figures from the pure schedule math in [`src/lib/schedule.ts`](src/lib/schedule.ts).

It runs **mock-first**: with no deployment config present it uses an in-memory
`MockBackend` seeded with sample parties, grants, proposals, and a residual claim,
so the whole app is explorable with **no wallet-service, Canton, or DAR**. See the
root [README](../../README.md) for the wider stack.

> Imported from `cn-dappbooster@feat/vesting-lite` — see [`PROVENANCE.md`](PROVENANCE.md).
> The live `LiteBackend` path (real ledger via the wallet-service proxy), its
> `vesting-lite` DAML package, and the party-bootstrap script are **deferred**; only
> the frontend + mock layer are in this repo today.

## Run

From the repo root (one `pnpm install` links every workspace):

```bash
pnpm run app:dev   # → http://localhost:3012
```

Pick any party on the landing screen to "connect" (the DirectWallet just chooses
which party you act as; it is remembered in `localStorage`). No env vars needed:
the one knob, the explorer party ids link to, defaults to the local Splice Scan.
Override it by copying [`.env.example`](.env.example) to `.env.local`.

## Going live (deferred)

When the `vesting-lite` DAML package and bootstrap land, dropping the
bootstrap-written `public/vesting-lite-parties.json` (`{pkg, operator, rpcUrl}`)
flips the app to the real ledger with no code change.

## How it fits together

The internal seams and the reasoning behind them are in
[`architecture.md`](architecture.md).
