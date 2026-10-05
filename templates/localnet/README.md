
## Local network

This project also carries a full local Canton stack:

- `@bootnodedev/canton-barebones` runs a Splice LocalNet in Docker (config lands in `.canton-localnet/`)
- `@canton-network/wallet-gateway-remote` is the [Wallet Gateway](https://github.com/canton-network/wallet)
  the dApp connects to, on http://localhost:3030 (config in `wallet-gateway.config.json`)
- `daml/` holds a starter DAML model, built with `dpm` and uploaded to the participant

Requirements: Docker running, and the Daml SDK 3.5 (`dpm`). `daml/daml.yaml` pins the patch it is
tested on; any installed 3.5.x builds.

```bash
pnpm stack up      # LocalNet, build + deploy the DAR, Wallet Gateway, dev server
pnpm stack down    # stop everything, keep the ledger
pnpm stack         # interactive menu
```

Then pick Wallet Gateway in the dApp's picker and log in with client secret `unsafe`. Create a
party in the gateway with `wallet-kernel` as the signing provider.

`pnpm stack up` mints `CANTON_BACKEND_TOKEN` into `.env` on first run. To wipe the ledger, run
`canton-barebones reset` inside `.canton-localnet/`; parties the gateway created must then be
created again.

Every step is also a script of its own: `pnpm build-dar`, `pnpm deploy-dar -- daml/.daml/dist/<name>.dar`,
`pnpm mint-token`, `pnpm wallet-gateway`. If the project defines a `bootstrap` script, `stack up`
runs it once the DAR is deployed — the place for anything your model needs created on the ledger first.
