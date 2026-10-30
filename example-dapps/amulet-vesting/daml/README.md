# dApp Daml

The vesting dApp's Daml code: one package, `amulet-vesting`, holding the factory, proposal,
contract and residual claim, escrowing real Canton Coin as a Splice `LockedAmulet`. It sits
directly here rather than in a folder named after itself, so a rename touches
[`daml.yaml`](daml.yaml) and nothing else. Its scenarios stay in the repository it was vendored
from; see
[`PROVENANCE.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/amulet-vesting/daml/PROVENANCE.md).

## Build and deploy

With the local network (`--localnet`), `pnpm stack up` builds and deploys the DAR, after checking
that `dpm` is on your PATH. Without it, run this from the project root, with `CANTON_JSON_API_URL`
and `CANTON_BACKEND_TOKEN` set in `.env`:

```bash
pnpm build-dar
pnpm deploy-dar -- daml/.daml/dist/amulet-vesting-<version>.dar
```

`<version>` is the one in [`daml.yaml`](daml.yaml). `build-dar` needs the Daml SDK (`dpm`).
`deploy-dar` uploads to `CANTON_JSON_API_URL` and sends `CANTON_BACKEND_TOKEN`.

Any edit to the model changes the package id, and a participant refuses a second package at the
same name and version (`KNOWN_PACKAGE_VERSION`). So a redeploy after a source change means bumping
`version` in [`daml.yaml`](daml.yaml) or, with the local network, resetting it
(`pnpm exec canton-barebones reset` in `.canton-localnet/`).

## The Splice dependencies

`amulet-vesting` data-depends on four Splice DARs. They are not committed: `pnpm build-dar` runs
`scripts/fetch-daml-deps.mjs` first, which fetches them into the gitignored `deps/` and skips the
work once they are there.

Which Splice release they come from is not a choice. An Amulet-moving choice is exercised against
the `AmuletRules` the network is running, so the build has to use that network's Amulet. Set
`SPLICE_TAG` in `.env` to the release your network runs. Without it, the script reads `splice.tag`
off the pinned `@bootnodedev/canton-barebones` template, which a project has only with
`--localnet`, so bumping the local network moves the DAR with it. Either way it takes the highest
`splice-amulet` version that release ships; delete `deps/` to force a refetch.
