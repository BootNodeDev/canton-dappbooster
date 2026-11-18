# Upgrading the LocalNet

After a Splice bump, `pnpm stack up` keeps your ledger: parties, users, contracts and wallets. `pnpm stack reset` starts over instead.

## Postgres

When the new release runs a newer Postgres, `up` moves the data to it first. The old data stays in a `_postgres-pg*` backup volume until you drop it. If the move stops halfway, run `up` again.

## Amulet

The ledger keeps the Amulet its DSO voted in last, and your contract builds against it. To move to the new release's:

1. Set `sv.svUI` to `true` in `.canton-localnet/canton-barebones.config.json`, then `pnpm stack down` and `pnpm stack up`.
2. List the versions to vote in:

   ```bash
   docker exec splice ls /app/splice-node/dars | sed -nE 's/^splice-(amulet|amulet-name-service|dso-governance|validator-lifecycle|wallet|wallet-payments)-([0-9.]+)\.dar$/splice-\1 \2/p' | sort -V | awk '{ latest[$1] = $2 } END { for (name in latest) print name, latest[name] }' | sort
   ```

3. Open http://sv.localhost:4000 as `ledger-api-user`. Under Governance, pick Initiate Proposal, then Set Amulet Rules Configuration and Next. Set each Daml model version to the listed one (`amulet` is `splice-amulet`, and so on), pick Make effective at threshold, add a summary and a URL, then Review Proposal and Submit Proposal.
4. `pnpm stack down` and `pnpm stack up`, so the validators vet the new versions.
5. Bump `version` in `daml/daml.yaml`: built against the new Amulet, the contract is a new package.
6. `pnpm stack down` and `pnpm stack up` again, to build and deploy it.

> [!IMPORTANT]
> Within 24 hours Splice unvets the old packages. From then on, name `AmuletRules` by package, `#splice-amulet:Splice.AmuletRules:AmuletRules`, not by the template id Scan returns.
