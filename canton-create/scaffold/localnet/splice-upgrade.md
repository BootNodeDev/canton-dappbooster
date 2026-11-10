# Upgrading the LocalNet's Amulet

After a Splice bump, `pnpm stack up` keeps the old ledger. The LocalNet runs the new release, but the ledger keeps the Amulet its DSO voted in last, and the contract builds against that one. A real network is in the same state between a release and its DSO vote.

These steps move the ledger to the new release's Amulet with one DSO vote. To start over on a fresh ledger instead, run `pnpm stack reset`.

1. Turn on the SV UI: set `sv.svUI` to `true` in `.canton-localnet/canton-barebones.config.json`, then restart the stack.

   ```bash
   pnpm stack down
   pnpm stack up
   ```

2. List the newest version of each Daml package the vote sets, as the new release ships them.

   ```bash
   docker exec splice ls /app/splice-node/dars | sed -nE 's/^splice-(amulet|amulet-name-service|dso-governance|validator-lifecycle|wallet|wallet-payments)-([0-9.]+)\.dar$/splice-\1 \2/p' | sort -V | awk '{ latest[$1] = $2 } END { for (name in latest) print name, latest[name] }' | sort
   ```

3. Vote them in. Open http://sv.localhost:4000 and log in as `ledger-api-user`. Under Governance, pick Initiate Proposal. Under Select Action, pick Set Amulet Rules Configuration, then Next. Near the end of the form, set each Daml model version to the one you noted: `amulet` is `splice-amulet`, `amuletNameService` is `splice-amulet-name-service`, and so on. Pick Make effective at threshold, and fill in the summary and a URL. Then Review Proposal and Submit Proposal. The LocalNet's single SV is the whole threshold, so the vote takes effect within a minute.

4. Wait 11 minutes. The app-user validator reads the new configuration from Scan through a 10-minute cache and vets the new versions only then. Until it does, the participant refuses any transaction that needs them.

5. Bump `version` in `daml/daml.yaml`. Built against the new Amulet, the contract is a new package, and the participant refuses a second package at the same name and version (`KNOWN_PACKAGE_VERSION`).

6. Restart the stack. `pnpm stack up` builds the contract against the new Amulet, deploys it as an upgrade, and runs the `bootstrap` script on it.

   ```bash
   pnpm stack down
   pnpm stack up
   ```

> [!IMPORTANT]
> Splice unvets the packages the new configuration no longer names at a random time within 24 hours. It picks that time after the vote and again every time the stack starts, so a restart moves it. A command that exercises `AmuletRules` with the template id Scan returns for it fails from then on. Name the template by its package instead: `#splice-amulet:Splice.AmuletRules:AmuletRules`.
