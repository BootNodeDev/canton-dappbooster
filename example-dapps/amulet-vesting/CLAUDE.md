# Agent Configuration — example-dapps/amulet-vesting

This file applies only to `example-dapps/amulet-vesting/`. The rules every example shares are in
[`../CLAUDE.md`](../CLAUDE.md), and the repo-wide ones in [`../../CLAUDE.md`](../../CLAUDE.md). The
internal seams are in [`architecture.md`](architecture.md). Deltas for this app only are below.

- No server code, and so no folder beside `src/` for it: this app is a static bundle, `vercel.json`
  answers every path with `index.html`, and every call goes straight to the service answering it.
- The Daml package sits directly in `daml/`, not in a folder named after itself, so a rename
  touches `daml/daml.yaml` and nothing else. Moving it into a folder of its own changes its package
  id, which covers the relative source root.
- `daml/` comes from [cc-vesting-contracts](https://github.com/BootNodeDev/cc-vesting-contracts) at
  `000c481b1c9119bf564568c93ab53cddd3072ab0`, without its test package, whose scenarios need a full
  Splice checkout. A fresh copy needs these edits again:
  - `meta = None` on each `TransferOutput` in `AmuletVesting.daml`, the optional field
    `splice-amulet` gained after 0.1.19
  - `source: .` in `daml.yaml`
  - data-dependencies on the version-less DARs in `deps/`
- `amulet-vesting-walletless` carries an identical copy of `daml/`, so a change goes to both in the
  same commit. Both upload `amulet-vesting` at the same version to one LocalNet, and a participant
  refuses a second package at a name and version it already holds.
- The token's mark on every figure is the Amulet mark, `assets/canton-coin.png`, through `AMT` in
  `utils/tokens.tsx`.
