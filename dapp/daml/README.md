# dApp Daml

The vesting dApp's Daml code: one package, `amulet-vesting`, holding the factory, proposal,
contract and residual claim, escrowing real Canton Coin as a Splice `LockedAmulet`. It sits
directly here rather than in a folder named after itself, so a rename touches
[`daml.yaml`](daml.yaml) and nothing else. Its scenarios stay in the repository it was vendored
from; see [`PROVENANCE.md`](PROVENANCE.md).

## Build and deploy

From the repo root:

```bash
pnpm run build-dar
pnpm run deploy-dar -- dapp/daml/.daml/dist/amulet-vesting-0.0.1.dar
```

`deploy-dar` uploads to the app-user JSON API and takes the bearer token from the root `.env`.
Both commands need the Daml SDK (`dpm`), which `scripts/dev-stack.sh up` checks for before it
starts anything.

Any edit to the model changes the package id, and a participant refuses a second package at the
same name and version — `KNOWN_PACKAGE_VERSION`. So a redeploy after a source change means either
bumping `version` in [`daml.yaml`](daml.yaml) or resetting the LocalNet
(`pnpm exec canton-barebones reset` in `.canton-localnet/`).

## The Splice dependencies

`amulet-vesting` data-depends on four Splice DARs. They are not committed: `pnpm build-dar` runs
`scripts/fetch-daml-deps.mjs` first, which fetches them into the gitignored `deps/` and skips the
work once they are there.

Which Splice release they come from is not a choice. An Amulet-moving choice is exercised against
the `AmuletRules` the network is running, so the build has to use that network's Amulet. The script
therefore reads `splice.tag` off the pinned `@bootnodedev/canton-barebones` template, which is the
same template the LocalNet is scaffolded from, and takes the highest `splice-amulet` version that
release ships. Bumping the LocalNet moves the DAR with it; delete `deps/` to force a refetch.
