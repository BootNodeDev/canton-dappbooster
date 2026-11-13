# Agent configuration: `example-dapps/token-vault`

This file applies only to `example-dapps/token-vault/`. The rules every example shares are in
[`../CLAUDE.md`](../CLAUDE.md), and the repo-wide ones in [`../../CLAUDE.md`](../../CLAUDE.md). The
internal structure is in [`architecture.md`](architecture.md). Deltas for this app only are below.

## The vault party

- **The vault party is participant-hosted, and nothing in `src/` submits as it.** Both `*_Settle`
  choices are its to exercise, and a withdraw needs it to escrow its own `USDX`, so it cannot be a
  wallet account. `scripts/vault-operator.mjs` acts as it over the JSON Ledger API. The browser
  submits only as the connected party; a component that wants to act as the vault is a bug.
- **The root guardrail on `participant` parties does not cover it, nor the issuer.** That rule is
  about Amulet a validator merges. The vault and the issuer hold canton-token-forge tokens only,
  exactly as token-vesting's operator and instrument admin do.
- **`bootstrap`, the operator and `src/backend/deployment.ts` agree on the `vault-operator` hint.**
  The bootstrap reuses that party, and the other two match `vault-operator::`, separator included,
  so a stamped `vault-operator-<n>` party from an older bootstrap never matches.

## Ledger reads and writes

- **`call` lives in `src/backend/acs.ts`, not in a `config.ts`.** `acs.ts` also owns the
  active-contracts body and the two filter builders; `deployment.ts` is what token-vesting calls
  `config.ts`. A second hand-written `/v2/state/active-contracts` body is where the two spellings
  below drift apart.
- **A template id has two spellings, and each is wrong in the other's place.** A filter takes the
  package-name reference (`#canton-token-vault:Canton.TokenVault.Vault:Vault`). A command takes the
  resolved id, read off the `templateId` of the row the discovery found. A filter given a resolved
  id reads empty without an error.
- **A command exercises a choice declared on an interface under the interface id.**
  `AllocationFactory_Allocate` names
  `#splice-api-token-allocation-instruction-v1:…:AllocationFactory`, with the `InstrumentConfig`'s
  contract id.
- **In `src/`, `deployment.ts` reads the `InstrumentConfig` disclosure off the ledger, and nothing
  else does.** A depositor is no stakeholder of the config, so every tap and allocation discloses
  it. On the local network the wallet's user may read as the issuer. token-vesting takes the same
  shortcut to read its factory as the operator, and it is why this stack runs no registry. With a
  second reader, swapping a registry back in becomes a rewrite. Outside `src/`, the operator reads
  it too, to disclose it in its payout allocation, so a swap changes `scripts/vault-operator.mjs`
  as well.
- **`src/backend/requests.ts` reads the queue through the `AllocationRequest` interface, never the
  vault's templates.** The view carries the settlement and the leg. Both go into the allocation
  unchanged, because `*_Settle` compares them field by field. The filter matches every
  `AllocationRequest` on the ledger, so `requests.ts` scopes it twice. The settlement's `executor`
  must be this vault, and the leg the party sends must be one the settle choices name.

## The DARs

- **The Daml packages are binaries in `vendor/`, built elsewhere.** A new one, or a new build of
  either, updates its column in [`architecture.md`](architecture.md#the-committed-dars) in the same
  change. Replace the binary, run `sha256sum vendor/*.dar`, and update the column by hand.
- **`canton-token-forge.dar` is token-vesting's file, byte for byte.** Both examples upload it to
  one LocalNet. A participant refuses a second package at a name and version it already holds, so
  a new release goes to both examples together.
