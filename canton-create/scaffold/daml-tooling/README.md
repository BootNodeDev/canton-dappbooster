
## Contract

`daml/` holds the app's Daml model, and `dpm` from the Daml SDK 3.5 builds it. `daml/daml.yaml` pins a tested patch release, and any installed 3.5 release builds the model.

| Script | What it does |
| --- | --- |
| `pnpm build-dar` | fetches the Splice DARs it depends on, then builds |
| `pnpm deploy-dar -- daml/.daml/dist/<name>-<version>.dar` | uploads it to `CANTON_JSON_API_URL` |

When `daml/daml.yaml` lists Splice DARs, `build-dar` fetches them from your network's Splice release. With the local network, it builds against the Amulet the LocalNet's Scan reports, or the release's newest DARs when no Scan answers. Without one, set `SPLICE_TAG` in `.env` to the release your network runs.

`deploy-dar` sends the `CANTON_BACKEND_TOKEN` from `.env`. If the project has a `bootstrap` script, run it after `deploy-dar`: it creates on the ledger what the app needs before it can start.

> [!WARNING]
> Any edit to the model changes the package id, and a participant refuses a second package at the same name and version (`KNOWN_PACKAGE_VERSION`). Redeploying after a source change means bumping `version` in `daml/daml.yaml`, which the participant accepts only for a valid upgrade, or, with the local network, wiping the ledger as the Local network section describes.
