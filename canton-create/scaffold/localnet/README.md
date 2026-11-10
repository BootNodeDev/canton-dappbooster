
## Local network

This project also carries a local Canton stack:

- `@bootnodedev/canton-barebones` runs a Splice LocalNet in Docker, with its config in `.canton-localnet/`;
- `@canton-network/wallet-gateway-remote` is [Wallet Gateway](https://github.com/canton-network/wallet), which the dApp connects to on http://localhost:3030, with its config in `wallet-gateway.config.json`.

It needs Docker running and pnpm, plus `dpm` when the app has a contract.

| Script | What it does |
| --- | --- |
| `pnpm stack up` | LocalNet, the contract if there is one, Wallet Gateway, dev server |
| `pnpm stack down` | stops everything and keeps the ledger |
| `pnpm stack reset` | stops everything and drops the ledger and the gateway's parties |
| `pnpm stack` | interactive menu |

Then pick Wallet Gateway in the dApp's picker and log in with the client secret `unsafe`. Create a party in the gateway.

`pnpm stack up` mints `CANTON_BACKEND_TOKEN` into `.env` when it is missing. When the project has a contract, it builds and deploys it. It then runs the `bootstrap` script if there is one, and the `stack:up` script, which starts anything else the app needs. `pnpm stack down` runs `stack:down`. When the pinned Splice release has moved and the old ledger is still in Docker, `pnpm stack up` upgrades it in place: the ledger keeps the Amulet its DSO voted in last, and the contract builds against that one. `splice-upgrade.md` moves it to the new release's Amulet.

Each step is also a script of its own: `pnpm mint-token` and `pnpm wallet-gateway`.

> [!CAUTION]
> After `pnpm stack reset`, create the gateway's parties again.
