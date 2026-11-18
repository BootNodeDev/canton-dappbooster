# Example dApps

Each folder here is a Canton dApp built with Canton dAppBooster. Each one is also an npm package of its own, `@bootnodedev/canton-example-<folder>`. The installer copies an example into a new project, and the example's README becomes the project's README.

| Example | Folder | What it does |
| --- | --- | --- |
| Amulet Vesting | [`amulet-vesting`](amulet-vesting/) | Vests Canton Coin from one party to another through a CIP-0103 wallet |
| Wallet-less Amulet Vesting | [`amulet-vesting-walletless`](amulet-vesting-walletless/) | The Amulet Vesting dApp with username and password accounts instead of a wallet |
| Token Vesting | [`token-vesting`](token-vesting/) | The vesting dApp over `DBT`, a canton-token-forge token, with its registry |
| Token Vault | [`token-vault`](token-vault/) | Takes `USDX` deposits for `VSH` vault shares, and pays `USDX` back for shares |

## Install an example

Make sure you meet the [requirements](../README.md#requirements), and that Docker is running.
### Interactive mode

Run the installer and pick an example from its menu. The menu also asks whether to add the local network.

```bash
pnpm create canton-dappbooster
```

### Non-interactive mode

For an agent or a script, name the project folder and the example. Run the line for the example you want:

```bash
pnpm create canton-dappbooster my-dapp --example amulet-vesting
pnpm create canton-dappbooster my-dapp --example amulet-vesting-walletless
pnpm create canton-dappbooster my-dapp --example token-vesting
pnpm create canton-dappbooster my-dapp --example token-vault
```

### Start the project

With the local network, run this in the project folder. It starts the local network, the contracts, the services the example runs beside the ledger, and the dApp.

```bash
pnpm stack up
```

Then open http://localhost:3012.

Each example's README has the rest of the steps.

## Working on the examples

Check the requirements above, then run `pnpm install` from the repo's root. Check out [`CONTRIBUTING.md`](../CONTRIBUTING.md) for additional info.

Run these from the repo root. `<example>` is the example's folder name.

| Script | What it does |
| --- | --- |
| `pnpm dev:<example>` | Opens a menu with the stack commands |
| `pnpm dev:<example> up` | Starts the LocalNet, the example's contracts and services, Wallet Gateway and the dApp |
| `pnpm dev:<example> down` | Stops everything and keeps the ledger |
| `pnpm dev:<example> reset` | Stops everything and drops the ledger and the gateway's parties |
| `pnpm dev:<example> status` | Shows what is running |
| `pnpm -C example-dapps/<example> test` | Runs the example's tests |
| `pnpm -C example-dapps/<example> typecheck` | Checks the example's types |
| `pnpm -C canton-create try` | Packs the installer and every example into `canton-create/.try`, then prints the commands to install one there as a user would |
| `pnpm -C canton-create try:clean` | Stops what `try` started, resets its LocalNet and removes `.try` |

`up` serves the dApp on port 3012 and Wallet Gateway on port 3030 for every example.
The stack writes its logs to `.dev-stack/` at the repo root.

> [!IMPORTANT]
> The examples share one LocalNet and port 3012. Run `pnpm dev:<example> down` on one example before you start another.
