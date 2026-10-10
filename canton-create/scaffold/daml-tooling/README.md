
## Contract

`daml/` holds the app's Daml model, and `dpm` from the Daml SDK 3.5 builds it. `daml/daml.yaml`
pins a tested patch release, and any installed 3.5 release builds the model.

```bash
pnpm build-dar                                           # fetch the Splice DARs it depends on, then build
pnpm deploy-dar -- daml/.daml/dist/<name>-<version>.dar  # upload it to CANTON_JSON_API_URL
```

When `daml/daml.yaml` lists Splice DARs, `build-dar` fetches the ones your network's Splice release
ships. With the local network it reads that release from the LocalNet. Without one, set
`SPLICE_TAG` in `.env` to the release your network runs.

`deploy-dar` sends the `CANTON_BACKEND_TOKEN` from `.env`. If the project has a `bootstrap` script,
run it after `deploy-dar`. It creates what the model needs on the ledger first.
