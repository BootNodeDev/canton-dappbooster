
## Local network

This project also carries a local Canton stack:

- `@bootnodedev/canton-barebones` runs a Splice LocalNet in Docker, with its config in
  `.canton-localnet/`
- `@canton-network/wallet-gateway-remote` is [Wallet Gateway](https://github.com/canton-network/wallet),
  which the dApp connects to on http://localhost:3030, with its config in `wallet-gateway.config.json`

It needs Docker running and pnpm, plus `dpm` when the app has a contract.

```bash
pnpm stack up      # LocalNet, the contract if there is one, Wallet Gateway, dev server
pnpm stack down    # stop everything and keep the ledger
pnpm stack         # interactive menu
```

Then pick Wallet Gateway in the dApp's picker and log in with the client secret `unsafe`. Create a
party in the gateway with `wallet-kernel` as the signing provider.

On its first run, `pnpm stack up` mints `CANTON_BACKEND_TOKEN` into `.env`. When the project has a
contract, it then builds and deploys it, and runs the `bootstrap` script if there is one. To
wipe the ledger, run `canton-barebones reset` inside `.canton-localnet/`. You then have to create
the gateway's parties again.

Each step is also a script of its own: `pnpm mint-token` and `pnpm wallet-gateway`.
