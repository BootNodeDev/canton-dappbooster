# Token vesting dApp

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. The installer, the guides and the rest of the stack live at [dappbooster.cc](https://dappbooster.cc).

`@bootnodedev/canton-example-token-vesting` is the [amulet-vesting](https://github.com/BootNodeDev/canton-dappbooster/tree/main/example-dapps/amulet-vesting) dApp over a [canton-token-forge](https://github.com/BootNodeDev/canton-token-forge) token, `DBT`, instead of Canton Coin. This README covers what changes; the rest works as amulet-vesting describes.

> [!NOTE]
> Unlike amulet-vesting, which builds its contract from `daml/`, this app only uses prebuilt DARs in `vendor/`: the vesting contract from [canton-vesting-forge](https://github.com/BootNodeDev/canton-vesting-forge) and the token from canton-token-forge. They depend on no Splice release, so one build works on any network and the app needs no Daml toolchain. [`vendor/PROVENANCE.md`](vendor/PROVENANCE.md) records where each one comes from.

## Run the app

You need Node 24.15 or later, pnpm, and Docker running.

1. Create a project from this example, with the local network.

   ```bash
   pnpm create canton-dappbooster --example token-vesting --localnet
   ```

2. In the project folder, start everything (LocalNet, DARs, token registry, Wallet Gateway and dApp).

   ```bash
   pnpm stack up
   ```

3. Open http://localhost:3012, pick Wallet Gateway in the wallet picker and log in with the client secret `unsafe`. Create a party in the gateway.
4. In the account menu, use **Tap dAppBooster Token** to get 1000 `DBT`.
5. Create a grant for a second party from the gateway. To accept and claim it, make that party the wallet's primary party: the dApp acts as whichever party the wallet reports.

## How it works

The vesting flow is the one [amulet-vesting](https://github.com/BootNodeDev/canton-dappbooster/tree/main/example-dapps/amulet-vesting#how-it-works) shows, with these differences:

- a canton-token-forge registry serves the token and the `InstrumentConfig` each write discloses, where amulet-vesting reads `AmuletRules` and the open mining round from Scan;
- creating a grant takes one funder approval instead of two;
- acceptance locks the funder's `DBT` in a `LockedToken` instead of a `LockedAmulet`.

## Configure the app

The variables work as in [amulet-vesting](https://github.com/BootNodeDev/canton-dappbooster/tree/main/example-dapps/amulet-vesting#configure-the-app), WalletConnect included, and [`.env.example`](.env.example) lists them. What this app adds:

### Use your own network

Point `.env` at your network: `CANTON_JSON_API_URL`, `CANTON_BACKEND_TOKEN` and the `VITE_` URLs. Then run:

| Script | What it does |
| --- | --- |
| `pnpm bootstrap` | uploads the DARs, creates the operator, its factory and the DBT instrument |
| `pnpm stack:up` | starts the token registry on http://localhost:3013 (`pnpm stack up` runs it for you on the local network) |
| `pnpm dev` | serves http://localhost:3012 |

`bootstrap` creates only what is missing, so running it again is safe. The one file it writes is `.env.registry`, the registry's settings, which `stack:up` starts the registry from. `pnpm stack:down` stops it.

### Open the dApp on another address

By default the registry accepts only http://localhost:3012. To open the dApp on any other address (`127.0.0.1`, a published port, a LAN name), list it in `CORS_ORIGINS`.

### Deploy a build

Build with `DEPLOYED_BUILD=1` for a host. The URL variables then have no defaults, and an unset one fails the build rather than baking in a `localhost` address that an https page blocks as mixed content.

[`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vesting/architecture.md) describes the app's internal structure and the reasoning behind it, including how the dApp finds the operator and its factory on the ledger, and [`PROVENANCE.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vesting/PROVENANCE.md) records where the frontend came from.
