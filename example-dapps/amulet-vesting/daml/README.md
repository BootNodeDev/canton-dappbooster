# dApp Daml

The vesting dApp's Daml model: the `amulet-vesting` package, holding the factory, the proposal, the contract and the residual claim. It escrows real Canton Coin as a Splice `LockedAmulet`. Its scenarios stay in the repository it was vendored from; see [`PROVENANCE.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/amulet-vesting/daml/PROVENANCE.md).

## Build and deploy

With the local network (`--localnet`), `pnpm stack up` builds and deploys the DAR. Without it, run this from the project root, with `CANTON_JSON_API_URL` and `CANTON_BACKEND_TOKEN` set in `.env`:

```bash
pnpm build-dar
pnpm deploy-dar -- daml/.daml/dist/amulet-vesting-<version>.dar
```

`<version>` is the one in [`daml.yaml`](daml.yaml). `build-dar` needs the Daml SDK (`dpm`). `deploy-dar` uploads to `CANTON_JSON_API_URL` and sends `CANTON_BACKEND_TOKEN`.

> [!WARNING]
> Any edit to the model changes the package id, and a participant refuses a second package at the same name and version (`KNOWN_PACKAGE_VERSION`). Redeploying after a source change means bumping `version` in [`daml.yaml`](daml.yaml), which the participant accepts only for a valid upgrade, or, with the local network, running `pnpm stack reset`.

## The Splice dependencies

`amulet-vesting` data-depends on Splice DARs. They are not committed: `pnpm build-dar` fetches them into the gitignored `deps/` first and skips the work once they are there.

Which Splice release they come from is not a choice. An Amulet-moving choice is exercised against the `AmuletRules` the network is running, so the build has to use that network's Amulet. Set `SPLICE_TAG` in `.env` to the release your network runs, and the build takes the highest `splice-amulet` version that release ships. Without it, the build asks the local network's Scan which Amulet it runs, which a project can do only with `--localnet`. Delete `deps/` to force a refetch.

A local network upgraded in place keeps the Amulet its DSO voted in last, and the build follows it, so the deployed DAR does not change. Moving to the new release's Amulet takes a DSO vote and a `version` bump in [`daml.yaml`](daml.yaml); the local network's `splice-upgrade.md` walks through both.
