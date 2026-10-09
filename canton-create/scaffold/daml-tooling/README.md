
## Contract

`daml/` holds the app's DAML model, built with `dpm`. Requirements: the Daml SDK 3.5 (`dpm`);
`daml/daml.yaml` pins the patch it is tested on, and any installed 3.5.x builds.

```bash
pnpm build-dar                                       # fetch any Splice DARs it depends on, then build
pnpm deploy-dar -- daml/.daml/dist/<name>-<version>.dar  # upload it to CANTON_JSON_API_URL
```

`deploy-dar` sends `CANTON_BACKEND_TOKEN` from `.env`. If the project defines a `bootstrap` script,
run it once the DAR is deployed: it is the place for anything the model needs on the ledger first.
