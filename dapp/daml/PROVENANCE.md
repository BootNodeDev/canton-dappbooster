# Provenance

The `amulet-vesting` Daml package was vendored from the `cc-vesting-contracts` repository. No
DAR is checked in; `pnpm build-dar` produces it, and the Splice DARs it data-depends on are
fetched rather than committed (see [`README.md`](README.md)).

| Field | Value |
|-------|-------|
| Source repo | https://github.com/BootNodeDev/cc-vesting-contracts |
| Source branch | `main` |
| Source commit | `000c481b1c9119bf564568c93ab53cddd3072ab0` |
| Imported | `daml/amulet-vesting/daml/` flattened into `dapp/daml/` |

## Integration deltas

- **The package sits at `dapp/daml/` rather than in a folder named after itself, and `daml.yaml`
  reads `source: .` rather than `source: daml`.** Upstream is a container of several dpm packages
  and needs the name in the path; there is one package here, so a rename would otherwise move every
  reference to it. The LF package id covers the relative source root, so this layout is what
  produces the `36560185…` recorded below where the upstream layout produces `67e6dff7…`; both are
  reproducible, and a participant holding one refuses the other at the same name and version.
- **`daml.yaml`'s data-dependencies point at `deps/`, and carry no version.** Upstream names
  `splice-amulet-0.1.19.dar` under its own `deps/splice-daml/dars/`, which is the output of its
  `scripts/fetch-dep.sh` at a hardcoded Splice tag. Here `scripts/fetch-daml-deps.mjs` reads the
  tag off the pinned `@bootnodedev/canton-barebones` template — the same one the LocalNet is
  scaffolded from — and copies each DAR to a version-less name, so the amulet built against and
  the amulet the network runs cannot drift apart and no path here moves when they bump.
- **Each of the five `TransferOutput` literals in `AmuletVesting.daml` gained `meta = None`.**
  `Splice.AmuletRules.TransferOutput` grew a `meta : Optional Metadata` field between
  `splice-amulet` 0.1.19, which upstream builds against, and 0.1.21, which Splice 0.6.11 runs. The
  field is optional and nothing else in the record moved, so this is the upgrade-compatible
  spelling and no behaviour travels with it. It belongs upstream; until it lands there, re-vendoring
  means reapplying it.
- The test package (`daml/amulet-vesting-test/`) is not imported. It runs against Splice's own
  Amulet test harness, which upstream builds from a full checkout of `canton-network/splice`, and
  that is a heavier dependency than this repository's loop needs. The scenarios stay upstream.

Nothing else. `AmuletVesting.daml` and `AmuletVesting/Schedule.daml` are otherwise unmodified.

## Verified on import

`pnpm build-dar` under `dpm` 1.0.10 against Splice 0.6.11 (`splice-amulet` 0.1.21, package id
`73e9ffdb…`) produces main package id
`36560185ce1f8999ce6d9903c52933087bca82c6ef3842168eed14830fd17148`. The full grant lifecycle —
tap, factory, proposal, accept, withdraw — was exercised against the LocalNet with that DAR
deployed.
