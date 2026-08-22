# dApp Daml

The vesting dApp's Daml code. One package, [`vesting-lite/`](vesting-lite/), whose own README
covers building and testing it; its scenarios live in a separate test package,
[`../daml-test/`](../daml-test/), so the shipped DAR carries no `daml-script` dependency.
Vendoring details are in [`PROVENANCE.md`](PROVENANCE.md).

## Build and deploy

From the repo root:

```bash
pnpm run build-dar -- dapp/daml/vesting-lite
pnpm run deploy-dar -- dapp/daml/vesting-lite/.daml/dist/vesting-lite-0.0.1.dar
```

The same DAR is checked in prebuilt at
[`canton-barebones/dars/vesting-lite-0.0.1.dar`](../../canton-barebones/dars/vesting-lite-0.0.1.dar),
which is what the local bring-up deploys when `dpm` is not installed. See the Canton barebones
[Deploy a DAR](../../canton-barebones/README.md#deploy-a-dar) step.
