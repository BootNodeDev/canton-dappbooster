# @canton-dappbooster/frontend: vesting dApp

dApp for **vesting a canton-token-forge instrument**: propose a grant, the receiver accepts or
declines it and the funder can cancel it until they do, claim as it vests, or cancel an accepted
grant into a residual claim. Accepting locks the funder's `DBT` in a `LockedToken` escrow and each claim
releases part of it, so the figures on screen are real holdings; grants render live
vested/claimable figures from the pure schedule math in
[`src/utils/schedule.ts`](src/utils/schedule.ts).

Every read and every write goes through the connected CIP-0103 wallet, so the app acts as
the wallet's primary account and each write raises a real approval prompt. There is no
mock mode: without a deployment config and a wallet session the pages show a connect
placeholder. See the root [README](../../README.md) for the wider stack.

> The frontend was imported from `cn-dappbooster@feat/vesting-lite`, see
> [`PROVENANCE.md`](PROVENANCE.md). The Daml packages it speaks to are the committed
> binaries in [`../../vendor`](../../vendor).

## Run

The app needs a Canton LocalNet, both vendored DARs deployed, the token registry on 3013 and the
Wallet Gateway on 3030 before it renders anything; the root [README](../../README.md) is the whole
bring-up. Once that is up, from the repo root (one `pnpm install` links every workspace):

```bash
pnpm run deploy-dar -- vendor/canton-token-forge.dar
pnpm run deploy-dar -- vendor/vesting.dar
pnpm run bootstrap        # creates the operator and its factory, the admin and the DBT instrument
pnpm run wallet-gateway   # → http://localhost:3030
pnpm run app:dev          # → http://localhost:3012
```

The registry also has to be running, against the env block `bootstrap` prints;
`./scripts/dev-stack.sh up` does that for you.

The bootstrap writes nothing. It leaves the operator and the factory on the ledger, and the dApp
finds both once a wallet connects: the operator through the rights the bootstrap granted, the
factory through an active-contracts read that returns its explicit-disclosure payload, without
which a grant cannot be created. Re-running it supersedes the last one, on any ledger.

Funding a grant takes `DBT`, and the account menu has a faucet for it: **Tap dAppBooster Token**
taps 1000 DBT into the connected party, straight off the instrument's own config. It refuses an
amount above the `maxPerTap` the bootstrap set, and says so in the failure toast.

Connect with a CIP-0103 wallet; the Wallet Gateway on http://localhost:3030 is the one the dev
stack starts. Create its parties with the `wallet-kernel` signing provider, as the root README
explains. The party it reports is the one you act as, and the session is restored on reload by the
wallet itself. Changing the wallet's primary account changes the party the dApp acts as. Its three
env knobs, the explorer party ids link to, the registry it fetches the instrument config from, and
the gateway's dApp API, default to the local stack and are set in the repo root's `.env`; see the
root
[`.env.example`](../../.env.example).

The deployed demo is inert until its Vercel project points the registry knob at a registry reachable
from the internet, and no such registry is hosted today, so `loadBackendConfig` hard-fails and every
page shows "No deployment" once a wallet connects. The gateway knob has to name a hosted Wallet
Gateway on the same network as that registry, and none is hosted either.

A build whose output is going to be served takes no defaults for those three knobs: `vercel.json`'s
build command sets `DEPLOYED_BUILD=1`, and with it an unset key fails the build rather than baking in
a `localhost` address that an https page blocks as mixed content. Any other host serving this bundle
sets it too; a local build and CI's compile check do not.

## How it fits together

The internal seams and the reasoning behind them are in
[`architecture.md`](architecture.md).
