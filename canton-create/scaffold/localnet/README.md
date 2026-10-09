
## Local network

This project also carries a full local Canton stack:

- `@bootnodedev/canton-barebones` runs a Splice LocalNet in Docker (config lands in `.canton-localnet/`)
- `@canton-network/wallet-gateway-remote` is the [Wallet Gateway](https://github.com/canton-network/wallet)
  the dApp connects to, on http://localhost:3030 (config in `wallet-gateway.config.json`)

Requirements: Docker running, plus `dpm` when the app has a contract.

```bash
pnpm stack up      # LocalNet, the contract if there is one, Wallet Gateway, dev server
pnpm stack down    # stop everything, keep the ledger
pnpm stack         # interactive menu
```

Then pick Wallet Gateway in the dApp's picker and log in with client secret `unsafe`. Create a
party in the gateway with `wallet-kernel` as the signing provider.

`pnpm stack up` mints `CANTON_BACKEND_TOKEN` into `.env` on first run, then builds and deploys the
contract and runs the `bootstrap` script when the project has them. To wipe the ledger, run
`canton-barebones reset` inside `.canton-localnet/`; parties the gateway created must then be
created again.

Every step is also a script of its own: `pnpm mint-token`, `pnpm wallet-gateway`.
