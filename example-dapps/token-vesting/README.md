# Token vesting dApp

`@bootnodedev/canton-example-token-vesting` is a dApp for vesting a
[canton-token-forge](https://github.com/BootNodeDev/canton-token-forge) token, `DBT`. A funder
proposes a grant, and the receiver accepts or declines it. The funder can cancel it until the
receiver accepts. The receiver claims `DBT` as the grant vests. If the funder cancels an accepted
grant, the receiver keeps the vested but unclaimed `DBT` as a residual claim.

Acceptance locks the funder's `DBT` in a `LockedToken` escrow, and each claim releases part of it.
The figures on screen are therefore real holdings. Each grant shows its vested and claimable amounts
live, and [`src/utils/schedule.ts`](src/utils/schedule.ts) computes them.

Every read and every write goes through the connected CIP-0103 wallet. The app acts as the wallet's
primary account, and each write raises a real approval prompt. There is no mock mode. If the ledger
has no vesting operator and factory, or you have not connected a wallet, the pages show a connect
placeholder.

It needs no Splice reference data and no Daml toolchain. The two Daml packages ship as binaries in
[`vendor/`](vendor/), and a canton-token-forge registry serves the token's metadata.

> This frontend comes from the Amulet Vesting example. See
> [`PROVENANCE.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vesting/PROVENANCE.md).

## Run the app

`create-canton-dappbooster --example token-vesting` makes a project from this package. With
`--localnet`, `pnpm stack up` starts the app and everything it needs. That includes the token
registry on http://localhost:3013. The installer appends a Local network section to this
README that describes it.

Without the local network, point `.env` at your network first: `CANTON_JSON_API_URL`,
`CANTON_BACKEND_TOKEN` and the `VITE_` URLs. Then run:

```bash
pnpm bootstrap   # uploads both DARs, creates the operator, its factory and the DBT instrument
pnpm stack:up    # starts the token registry on http://localhost:3013
pnpm dev         # serves http://localhost:3012
```

`bootstrap` creates only what is missing, so running it again is safe. The one file it writes is
`.env.registry`, the registry's settings, which `stack:up` starts the registry from.
`pnpm stack:down` stops it.
[`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vesting/architecture.md)
explains how the dApp finds the operator and the factory on the ledger.

## Get DBT and connect a wallet

Funding a grant takes `DBT`. The **Tap dAppBooster Token** faucet in the account menu taps 1000 DBT
into the connected party, straight off the instrument's own config. It refuses an amount over the
`maxPerTap` that `bootstrap` set, and the failure toast says so.

Connect with a CIP-0103 wallet. With the local network, `pnpm stack up` starts Wallet Gateway on
http://localhost:3030.

You act as the party the wallet reports, and the wallet restores the session on reload. If you
change the wallet's primary party, the dApp acts as the new one.

## Configure the app

The app reads its variables from `.env` in the project folder, and [`.env.example`](.env.example)
lists them. The explorer, registry and gateway URLs default to the local stack. Open the dApp on any
address other than http://localhost:3012 and the registry refuses it until `CORS_ORIGINS` lists
that address.

WalletConnect is off unless you set `VITE_WALLET_CONNECT_PROJECT_ID` to a Reown project id. Once you
set it, `VITE_NETWORK_ID` must match the network the wallet serves. For the local gateway, that is
`canton:localnet`.

A build you deploy takes no defaults for the three URLs. With `DEPLOYED_BUILD=1`, an
unset URL fails the build rather than baking in a `localhost` address that an https page blocks as
mixed content. On Vercel, [`api/registry.ts`](api/registry.ts) forwards the registry's routes from
the deployed origin, to the registry `REGISTRY_URL` names.

## How it fits together

[`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vesting/architecture.md)
describes the app's internal structure and the reasoning behind it.
