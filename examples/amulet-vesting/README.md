# Amulet vesting dApp

`@bootnodedev/canton-example-amulet-vesting` is a dApp for Amulet vesting. A funder proposes a grant and the
receiver accepts it. The receiver claims Amulet as the grant vests. If the funder cancels the grant,
the receiver keeps the vested but unclaimed Amulet as a residual claim.

Acceptance locks the funder's Amulet in escrow, and each claim releases part of it. The figures on
screen are therefore real holdings. Each grant shows its vested and claimable amounts live, and
[`src/utils/schedule.ts`](src/utils/schedule.ts) computes them.

Every read and every write goes through the connected CIP-0103 wallet. The app acts as the wallet's
primary account, and each write raises a real approval prompt. There is no mock mode. If the ledger
has no vesting operator and factory, or you have not connected a wallet, the pages show a connect
placeholder. See the root [README](../../README.md) for the wider stack.

> This frontend comes from `cn-dappbooster@feat/vesting-lite`. See
> [`PROVENANCE.md`](PROVENANCE.md). The Daml package it uses is in [`daml/`](daml/).

## Run the app

To start everything this app needs, and the app itself, run `./scripts/dev-stack.sh` from the repo
root. The root [README](../../README.md) describes it.

To start the pieces by hand, start a Canton LocalNet first. Then run these commands from the repo
root. A single `pnpm install` at the root links every workspace.

```bash
pnpm run mint-token       # prints a CANTON_BACKEND_TOKEN line; add it to this folder's .env
pnpm run build-dar
# <version> is the one in examples/amulet-vesting/daml/daml.yaml
pnpm run deploy-dar -- examples/amulet-vesting/daml/.daml/dist/amulet-vesting-<version>.dar
pnpm run bootstrap        # creates the operator and its factory
pnpm run wallet-gateway   # serves http://localhost:3030
pnpm run app:dev          # serves http://localhost:3012
```

Each `bootstrap` run creates a new operator and factory, and the dApp uses the newest. It writes no
file. [`architecture.md`](architecture.md) explains how the dApp finds them on the ledger.

## Get Amulet and connect a wallet

Funding a grant takes Amulet. The **Tap Amulet** faucet in the account menu taps 100 AMT into the
connected party. It works on LocalNet and DevNet, where `AmuletRules_DevNet_Tap` exists. It fails
until the first mining round opens, about ten minutes after a fresh LocalNet start.

Connect with a CIP-0103 wallet. The dev stack starts Wallet Gateway on http://localhost:3030. When
you create a party in Wallet Gateway, choose the `wallet-kernel` signing provider. With
`participant`, the validator merges the party's Amulets, and accepting a pending grant then fails.

You act as the party the wallet reports, and the wallet restores the session on reload. If you
change the wallet's primary party, the dApp acts as the new one.

## Configure the app

The app reads its variables from `.env` in this folder, and [`.env.example`](.env.example) lists
them. The URL variables default to the local stack.

WalletConnect is off unless you set `VITE_WALLET_CONNECT_PROJECT_ID` to a Reown project id. Once you
set it, `VITE_NETWORK_ID` must match the network the wallet serves. For the local gateway, that is
`canton:localnet`.

## How it fits together

[`architecture.md`](architecture.md) describes the app's internal structure and the reasoning
behind it.
