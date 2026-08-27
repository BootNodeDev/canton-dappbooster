# dApp Daml

The vesting dApp's Daml code. One package, [`vesting-lite/`](vesting-lite/), whose own README
covers building and testing it; its scenarios live in a separate test package,
[`../daml-test/`](../daml-test/), so the shipped DAR carries no `daml-script` dependency.
Vendoring details are in [`PROVENANCE.md`](PROVENANCE.md).

## Build and deploy

From the repo root:

```bash
pnpm run build-dar
pnpm run deploy-dar -- dapp/daml/vesting-lite/.daml/dist/vesting-lite-0.0.1.dar
```

`deploy-dar` uploads to the app-user JSON API and takes the bearer token from the root `.env`.
Both commands need the Daml SDK (`dpm`), which `scripts/dev-stack.sh up` checks for before it
starts anything.
