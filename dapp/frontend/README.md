# Vesting dApp

`@canton-dappbooster/frontend` is a dApp for vesting a canton-token-forge instrument. A funder
proposes a grant, and the receiver accepts or declines it. The funder can cancel it until the
receiver accepts. The receiver claims `DBT` as the grant vests. If the funder cancels an accepted
grant, the receiver keeps the vested but unclaimed `DBT` as a residual claim.

Acceptance locks the funder's `DBT` in a `LockedToken` escrow, and each claim releases part of it.
The figures on screen are therefore real holdings. Each grant shows its vested and claimable amounts
live, and [`src/utils/schedule.ts`](src/utils/schedule.ts) computes them.

Every read and every write goes through the connected CIP-0103 wallet. The app acts as the wallet's
primary account, and each write raises a real approval prompt. There is no mock mode. If the ledger
has no vesting operator and factory, or you have not connected a wallet, the pages show a connect
placeholder. See the root [README](../../README.md) for the wider stack.

> This frontend comes from `cn-dappbooster@feat/vesting-lite`. See
> [`PROVENANCE.md`](PROVENANCE.md). The Daml packages it uses are the committed binaries in
> [`../../vendor`](../../vendor).

## Run the app

To start everything this app needs, and the app itself, run `./scripts/dev-stack.sh` from the repo
root. The root [README](../../README.md) describes it.

To start the pieces by hand, start a Canton LocalNet first. Then run these commands from the repo
root. A single `pnpm install` at the root links every workspace.

```bash
pnpm run mint-token       # prints a CANTON_BACKEND_TOKEN line; add it to .env
pnpm run deploy-dar -- vendor/canton-token-forge.dar
pnpm run deploy-dar -- vendor/vesting.dar
pnpm run bootstrap        # creates the operator and its factory, the admin and the DBT instrument
pnpm run wallet-gateway   # serves http://localhost:3030
pnpm run app:dev          # serves http://localhost:3012
```

The token registry must also run on 3013, configured from the env block `bootstrap` prints.

Re-running `bootstrap` supersedes the last run, on any ledger. It writes no file.
[`architecture.md`](architecture.md) explains how the dApp finds the operator and the factory on the
ledger.

## Get DBT and connect a wallet

Funding a grant takes `DBT`. The **Tap dAppBooster Token** faucet in the account menu taps 1000 DBT
into the connected party, straight off the instrument's own config. It refuses an amount above the
`maxPerTap` that `bootstrap` set, and the failure toast says so.

Connect with a CIP-0103 wallet. The dev stack starts Wallet Gateway on http://localhost:3030.

You act as the party the wallet reports, and the wallet restores the session on reload. If you
change the wallet's primary party, the dApp acts as the new one.

## Configure the app

The app reads its variables from the repo root's `.env`, and the root
[`.env.example`](../../.env.example) lists them. The explorer, registry and gateway URLs default to
the local stack.

WalletConnect is off unless you set `VITE_WALLET_CONNECT_PROJECT_ID` to a Reown project id. Once you
set it, `VITE_NETWORK_ID` must match the network the wallet serves. For the local gateway, that is
`canton:localnet`.

The deployed demo is inert until its Vercel project points the registry URL at a registry reachable
from the internet. No such registry is hosted today, so `loadBackendConfig` hard-fails and every
page shows "No deployment" once a wallet connects. The gateway URL has to name a hosted Wallet
Gateway on the same network as that registry, and none is hosted either.

A build whose output is going to be served takes no defaults for the three URLs. The build command
in `vercel.json` sets `DEPLOYED_BUILD=1`, and with it an unset URL fails the build rather than
baking in a `localhost` address that an https page blocks as mixed content. Any other host serving
this bundle sets it too. A local build and CI's compile check do not.

## How it fits together

[`architecture.md`](architecture.md) describes the app's internal structure and the reasoning
behind it.
